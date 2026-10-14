import Meyda from 'meyda';

/**
 * Один бит, найденный в треке.
 */
export interface BeatEvent {
  /** Время от начала трека в секундах. */
  time: number;
  /** Сила удара от 0 до 1 — удобно для размера, яркости и толщины эффектов. */
  intensity: number;
}

/**
 * Результат анализа: ритмическая сетка плюс звук, готовый к воспроизведению.
 */
export interface AnalysisResult {
  beats: BeatEvent[];
  /** Декодированный звук с частотой AudioContext сцены: играется без пересэмплинга. */
  buffer: AudioBuffer;
  /** Длительность трека в секундах. */
  duration: number;
  /** Частота дискретизации, на которой считался анализ. */
  sampleRate: number;
}

export interface AnalyzerOptions {
  /** Частота анализа. Должна совпадать с частотой AudioContext сцены. */
  sampleRate?: number;
  /** Размер окна Meyda в сэмплах. */
  frameSize?: number;
  /** Шаг окна в сэмплах. Чем меньше шаг, тем точнее таймстемпы. */
  hopSize?: number;
}

const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_FRAME_SIZE = 1024;
const DEFAULT_HOP_SIZE = 512;

/** Длина окна, по которому считаем локальный фон громкости. */
const BACKGROUND_SECONDS = 1.5;
/** Насколько (в долях) удар должен быть громче локального фона. */
const ONSET_LEVEL = 0.15;
/** Абсолютный минимум громкости (-70 dBFS): тише — это шум, а не удар. */
const MIN_LEVEL = 3e-4;
/** Длина окна адаптивного порога по всплескам громкости. */
const THRESHOLD_WINDOW_SECONDS = 0.28;
/** Во сколько раз всплеск должен превысить локальное среднее. */
const THRESHOLD_FACTOR = 1.3;
/** Доля от самого сильного всплеска: всё тише считаем не-ударом. */
const THRESHOLD_FLOOR = 0.03;
/** Минимальная пауза между битами в секундах (≈ 500 BPM). */
const MIN_ONSET_GAP = 0.12;
/** Сколько соседних кадров проверяем при поиске локального максимума. */
const PEAK_NEIGHBOURS = 2;
/** Перцентиль громкости ударов, который считаем «самым сильным». */
const INTENSITY_PERCENTILE = 0.95;
/** Минимальная интенсивность, чтобы бит оставался видимым. */
const MIN_INTENSITY = 0.15;
/** Короткое окно (сэмплов) для уточнения момента удара по сырому сигналу. */
const REFINE_WINDOW = 64;
/** Шаг короткого окна (сэмплов). 16 сэмплов ≈ 0.4 мс. */
const REFINE_STEP = 16;
/** Доля от локального максимума энергии, с которой считаем, что удар начался. */
const REFINE_LEVEL = 0.35;

/**
 * Анализ аудиофайла: где в треке удары и насколько они сильные.
 *
 * Схема работы:
 *  1. `OfflineAudioContext` декодирует файл и рендерит его в моно на частоте сцены;
 *  2. Meyda считает громкость (`rms`) в окнах по 1024 сэмпла с шагом 512;
 *  3. по огибающей громкости ищутся удары: кадр должен быть заметно громче
 *     локального фона и давать всплеск сильнее соседних;
 *  4. момент удара уточняется по сырому сигналу с точностью до миллисекунд.
 *
 * Всё считается вне реального времени, без обращения к DOM: даже длинный трек
 * разбирается за доли секунды, а сцена получает готовый массив битов.
 */
export class AudioAnalyzer {
  private readonly sampleRate: number;
  private readonly frameSize: number;
  private readonly hopSize: number;

  constructor(options: AnalyzerOptions = {}) {
    this.sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    this.frameSize = options.frameSize ?? DEFAULT_FRAME_SIZE;
    this.hopSize = options.hopSize ?? DEFAULT_HOP_SIZE;
  }

  /**
   * Разбирает файл и возвращает биты вместе с готовым к проигрыванию буфером.
   */
  async analyze(file: Blob): Promise<AnalysisResult> {
    const bytes = await file.arrayBuffer();

    // Контекст нужен только для decodeAudioData, поэтому берём минимальную длину.
    const decoder = new OfflineAudioContext(1, 1, this.sampleRate);
    const buffer = await decoder.decodeAudioData(bytes);

    if (buffer.duration <= 0) {
      throw new Error('Файл не содержит звука.');
    }

    const mono = await this.renderMono(buffer);

    return {
      beats: AudioAnalyzer.detectBeats(mono, this.sampleRate, this.frameSize, this.hopSize),
      buffer,
      duration: buffer.duration,
      sampleRate: this.sampleRate,
    };
  }

  /**
   * Рендерит трек в один моно-канал на нужной частоте: каналов меньше — анализ
   * вдвое дешевле, а для поиска ударов стерео не даёт ничего нового.
   */
  private async renderMono(buffer: AudioBuffer): Promise<Float32Array> {
    const frames = Math.max(1, Math.ceil(buffer.duration * this.sampleRate));
    const offline = new OfflineAudioContext(1, frames, this.sampleRate);

    const input = offline.createBufferSource();
    input.buffer = buffer;
    input.connect(offline.destination);
    input.start(0);

    const rendered = await offline.startRendering();

    return rendered.getChannelData(0);
  }

  /**
   * Огибающая громкости: Meyda считает `rms` для каждого окна сигнала.
   * Это самый дешёвый её экстрактор — без FFT, только по времени.
   *
   * Статический метод и без Web Audio, поэтому его легко проверить отдельно.
   */
  static energyEnvelope(
    signal: Float32Array,
    frameSize = DEFAULT_FRAME_SIZE,
    hopSize = DEFAULT_HOP_SIZE,
  ): Float32Array {
    Meyda.bufferSize = frameSize;

    const frameCount = Math.max(1, Math.ceil(signal.length / hopSize));
    const envelope = new Float32Array(frameCount);
    const frame = new Float32Array(frameSize);

    for (let i = 0; i < frameCount; i++) {
      const start = i * hopSize;
      frame.fill(0);
      frame.set(signal.subarray(start, Math.min(start + frameSize, signal.length)));

      // Список фич, а не строка: на массиве Meyda возвращает объект с полями,
      // на одиночной строке — просто число.
      const features = Meyda.extract(['rms'], frame);
      envelope[i] = features?.rms ?? 0;
    }

    return envelope;
  }

  /**
   * Ищет удары в моно-сигнале и возвращает их таймстемпы.
   *
   * Три условия на удар:
   *  1. кадр заметно громче локального фона (тишина между ударами не считается);
   *  2. всплеск громкости сильнее локального среднего (адаптивный порог);
   *  3. всплеск — локальный максимум (иначе один удар даст десять битов).
   *
   * Метод не знает ничего про файлы и Web Audio — его легко проверить отдельно.
   */
  static detectBeats(
    signal: Float32Array,
    sampleRate: number,
    frameSize = DEFAULT_FRAME_SIZE,
    hopSize = DEFAULT_HOP_SIZE,
  ): BeatEvent[] {
    const envelope = AudioAnalyzer.energyEnvelope(signal, frameSize, hopSize);
    if (envelope.length < 3) return [];

    const hopTime = hopSize / sampleRate;
    const envelopePrefix = prefixSums(envelope);
    const backgroundFrames = Math.max(1, Math.round(BACKGROUND_SECONDS / hopTime));
    const thresholdFrames = Math.max(1, Math.round(THRESHOLD_WINDOW_SECONDS / hopTime));

    // Шаг 1: рост громкости относительно фона и предыдущего кадра.
    const rise = new Float32Array(envelope.length);

    for (let i = 1; i < envelope.length; i++) {
      const background = windowMean(envelopePrefix, i - backgroundFrames, i + backgroundFrames);
      if (envelope[i] < background * (1 + ONSET_LEVEL) + MIN_LEVEL) continue;

      rise[i] = Math.max(0, envelope[i] - envelope[i - 1]);
    }

    let maxRise = 0;
    for (let i = 0; i < rise.length; i++) {
      if (rise[i] > maxRise) maxRise = rise[i];
    }

    if (maxRise <= 0) return [];

    // Шаг 2: адаптивный порог — пик должен быть выше локального среднего
    // и не мельче, чем доля от самого сильного удара в треке.
    const risePrefix = prefixSums(rise);
    const floor = maxRise * THRESHOLD_FLOOR;
    const peaks: number[] = [];

    for (let i = 1; i < rise.length - 1; i++) {
      if (rise[i] < floor) continue;

      const localMean = windowMean(risePrefix, i - thresholdFrames, i + thresholdFrames);
      if (rise[i] < localMean * THRESHOLD_FACTOR) continue;
      if (!isLocalPeak(rise, i, PEAK_NEIGHBOURS)) continue;

      peaks.push(i);
    }

    // Шаг 3: склеиваем близкие всплески, уточняем время и считаем силу удара.
    const minGapFrames = Math.max(1, Math.round(MIN_ONSET_GAP / hopTime));
    const onsets = mergeClosePeaks(peaks, rise, minGapFrames);
    const reference = Math.max(
      percentile(onsets.map((index) => envelope[index]), INTENSITY_PERCENTILE),
      MIN_LEVEL,
    );

    return onsets.map((index) => ({
      time: AudioAnalyzer.refineOnset(signal, index, frameSize, hopSize, sampleRate),
      intensity: clamp(envelope[index] / reference, MIN_INTENSITY, 1),
    }));
  }

  /**
   * Уточняет момент удара по сырому сигналу.
   *
   * Кадр Meyda длиной 1024 сэмпла — это ±12 мс, для ритм-игры слишком грубо.
   * Поэтому ищем в окне кадра первую точку, где короткое окно энергии
   * поднимается до 35 % от локального максимума: это и есть атака удара.
   */
  private static refineOnset(
    signal: Float32Array,
    frameIndex: number,
    frameSize: number,
    hopSize: number,
    sampleRate: number,
  ): number {
    const frameStart = frameIndex * hopSize;
    const from = Math.max(0, frameStart - hopSize);
    const to = Math.min(signal.length, frameStart + frameSize + hopSize);

    if (to - from <= REFINE_WINDOW) return frameStart / sampleRate;

    let peak = 0;
    for (let i = from; i + REFINE_WINDOW <= to; i += REFINE_STEP) {
      const energy = sumOfSquares(signal, i, i + REFINE_WINDOW);
      if (energy > peak) peak = energy;
    }

    const level = peak * REFINE_LEVEL;
    for (let i = from; i + REFINE_WINDOW <= to; i += REFINE_STEP) {
      if (sumOfSquares(signal, i, i + REFINE_WINDOW) >= level) return i / sampleRate;
    }

    return frameStart / sampleRate;
  }
}

/** Префиксные суммы: среднее по любому окну считается за одно вычитание. */
function prefixSums(values: Float32Array): Float64Array {
  const prefix = new Float64Array(values.length + 1);

  for (let i = 0; i < values.length; i++) {
    prefix[i + 1] = prefix[i] + values[i];
  }

  return prefix;
}

/** Среднее по полуинтервалу [from, to) с обрезкой по границам массива. */
function windowMean(prefix: Float64Array, from: number, to: number): number {
  const start = Math.max(0, from);
  const end = Math.min(prefix.length - 1, to);

  return end > start ? (prefix[end] - prefix[start]) / (end - start) : 0;
}

/** Сумма квадратов на интервале [from, to) — «энергия» короткого окна. */
function sumOfSquares(signal: Float32Array, from: number, to: number): number {
  let sum = 0;

  for (let i = from; i < to; i++) {
    const value = signal[i] ?? 0;
    sum += value * value;
  }

  return sum;
}

/** Локальный максимум: не ниже левых соседей и строго выше правых. */
function isLocalPeak(rise: Float32Array, index: number, neighbours: number): boolean {
  for (let step = 1; step <= neighbours; step++) {
    const left = rise[index - step] ?? Number.NEGATIVE_INFINITY;
    const right = rise[index + step] ?? Number.NEGATIVE_INFINITY;

    if (rise[index] < left || rise[index] <= right) return false;
  }

  return true;
}

/** Склеивает всплески ближе минимальной паузы, оставляя самый сильный. */
function mergeClosePeaks(peaks: number[], rise: Float32Array, minGapFrames: number): number[] {
  const merged: number[] = [];

  for (const peak of peaks) {
    const previous = merged[merged.length - 1];

    if (previous !== undefined && peak - previous < minGapFrames) {
      if (rise[peak] > rise[previous]) merged[merged.length - 1] = peak;
      continue;
    }

    merged.push(peak);
  }

  return merged;
}

/** Значение перцентиля (0..1) методом ближайшего ранга. */
function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(ratio * (sorted.length - 1))));

  return sorted[index] ?? 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

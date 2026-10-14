import Phaser from 'phaser';
import { AudioAnalyzer, type BeatEvent } from '../classes/AudioAnalyzer';

/** Сколько секунд кольцо летит от края к центру. */
const FLIGHT_TIME = 2;
/** Радиус, на котором рождается кольцо (половина высоты поля — 320). */
const SPAWN_RADIUS = 300;
/** Окна попадания в секундах. */
const PERFECT_WINDOW = 0.1;
const GOOD_WINDOW = 0.2;
/** Пауза перед воспроизведением: за неё первые кольца успевают вылететь. */
const LEAD_IN = FLIGHT_TIME;
/** Сколько живёт кольцо после своего бита. */
const RING_TAIL = 0.15;
/** Длительность пульса центрального метронома. */
const PULSE_TIME = 0.15;
/** Очки за попадание. */
const SCORE_PERFECT = 100;
const SCORE_GOOD = 50;
/** Радиус центральной точки. */
const TARGET_RADIUS = 26;
/** Сколько затухает вспышка от нажатия. */
const FLASH_DURATION_MS = 220;
/** Пауза перед разбором файла: статус «Анализ…» должен успеть отрисоваться. */
const ANALYSIS_YIELD_MS = 32;
/** Цвета. */
const COLOR_IDLE = 0x38bdf8;
const COLOR_RING = 0x60a5fa;
const COLOR_PERFECT = 0x22d3ee;
const COLOR_GOOD = 0x4ade80;
const COLOR_MISS = 0xf87171;
const COLOR_TEXT = '#e2e8f0';
const COLOR_DIM = '#94a3b8';
const FONT = 'system-ui, sans-serif';

type SceneState = 'idle' | 'analyzing' | 'playing' | 'finished';
type Judgement = 'PERFECT' | 'GOOD' | 'MISS';

/** Кольцо, летящее к центру. */
interface FlyingRing {
  time: number;
  intensity: number;
}

/**
 * Ритм-механика: игрок выбирает свой трек, игра находит в нём биты,
 * к центру летят кольца, а ЛКМ нужно попасть точно в момент удара.
 *
 * Синхронизация идёт по аудио-часам: `AudioContext.currentTime` минус момент
 * старта воспроизведения. Поэтому картинка не зависит от FPS и не разъезжается
 * с музыкой, а попадания считаются по времени самого трека.
 */
export class RhythmScene extends Phaser.Scene {
  private ctx?: AudioContext;
  private output?: AudioNode;
  private analyzer?: AudioAnalyzer;
  private source?: AudioBufferSourceNode;
  private buffer?: AudioBuffer;

  private beats: BeatEvent[] = [];
  private duration = 0;
  private bpm = 0;
  private trackName = '';
  private state: SceneState = 'idle';

  /** Момент старта трека в часах AudioContext. */
  private audioStartTime = 0;
  private nextRingIndex = 0;
  private pulseIndex = 0;
  private rings: FlyingRing[] = [];
  private judged = new Set<number>();
  private stats = { perfect: 0, good: 0, miss: 0, score: 0, combo: 0, bestCombo: 0 };
  private hitFlash = 0;
  private flashColor = COLOR_PERFECT;
  private trackInfoCache = '';

  private ringsGraphics!: Phaser.GameObjects.Graphics;
  private target!: Phaser.GameObjects.Arc;
  private judgementText!: Phaser.GameObjects.Text;
  private offsetText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private trackText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private button!: Phaser.GameObjects.Rectangle;
  private buttonLabel!: Phaser.GameObjects.Text;
  private fileInput!: HTMLInputElement;

  constructor() {
    super('RhythmScene');
  }

  create(): void {
    this.createInterface();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    const sound = this.sound;

    // Нужен именно Web Audio: OfflineAudioContext для анализа и общий
    // с воспроизведением currentTime для синхронизации.
    if (!(sound instanceof Phaser.Sound.WebAudioSoundManager)) {
      this.setStatus('Нужен браузер с Web Audio API — ритм-механика не заработает');
      this.hintText.setText('');
      this.setButtonVisible(false);
      return;
    }

    this.ctx = sound.context;
    this.output = sound.destination;
    this.analyzer = new AudioAnalyzer({ sampleRate: this.ctx.sampleRate });
  }

  update(_time: number, delta: number): void {
    const audioTime = this.audioTime();

    this.hitFlash = Math.max(0, this.hitFlash - delta / FLASH_DURATION_MS);
    this.spawnRings(audioTime);
    this.drawRings(audioTime);
    this.drawTarget(audioTime);
    this.updateTrackInfo(audioTime);
  }

  /** Время внутри трека в секундах. */
  private audioTime(): number {
    const ctx = this.ctx;

    if (!ctx) return 0;

    // outputLatency — задержка вывода: игрок слышит звук позже, чем «тикает»
    // currentTime, поэтому сдвигаем шкалу на эту задержку.
    return ctx.currentTime - this.audioStartTime - this.outputLatency();
  }

  private outputLatency(): number {
    const latency = this.ctx?.outputLatency;

    return typeof latency === 'number' && Number.isFinite(latency) ? latency : 0;
  }

  /** Клик по игровому полю: во время игры — удар, после финала — повтор. */
  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonDown()) return;

    if (this.state === 'playing') {
      this.hit();
      return;
    }

    if (this.state === 'finished') {
      void this.startPlayback();
    }
  }

  /**
   * Удар: ищем ближайший бит и сравниваем время аудио с его временем.
   * Разница меньше 0.1 с — PERFECT, меньше 0.2 с — GOOD, иначе MISS.
   */
  private hit(): void {
    if (this.state !== 'playing' || !this.ctx) return;

    const time = this.audioTime();
    if (time < 0) return;

    let nearestIndex = -1;
    let distance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < this.beats.length; i++) {
      const candidate = Math.abs(this.beats[i].time - time);
      if (candidate < distance) {
        distance = candidate;
        nearestIndex = i;
      }
    }

    if (nearestIndex < 0 || distance > GOOD_WINDOW) {
      this.registerHit('MISS', 'нет бита рядом');
      return;
    }

    // Второй клик по тому же биту — тоже промах: бит уже сыгран.
    if (this.judged.has(nearestIndex)) {
      this.registerHit('MISS', 'этот бит уже сыгран');
      return;
    }

    this.judged.add(nearestIndex);

    const offset = time - this.beats[nearestIndex].time;
    this.registerHit(distance < PERFECT_WINDOW ? 'PERFECT' : 'GOOD', formatOffset(offset));
  }

  /** judgement — результат удара, detail — что показать под надписью. */
  private registerHit(judgement: Judgement, detail: string): void {
    if (judgement === 'MISS') {
      this.stats.miss += 1;
      this.stats.combo = 0;
      this.hitFlash = 1;
      this.flashColor = COLOR_MISS;
    } else {
      const perfect = judgement === 'PERFECT';

      if (perfect) this.stats.perfect += 1;
      else this.stats.good += 1;

      this.stats.score += perfect ? SCORE_PERFECT : SCORE_GOOD;
      this.stats.combo += 1;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.stats.combo);
      this.hitFlash = 1;
      this.flashColor = perfect ? COLOR_PERFECT : COLOR_GOOD;
    }

    this.judgementText.setText(judgement).setColor(judgementColor(judgement));
    this.offsetText.setText(detail);

    this.updateHud();
  }

  private async loadFile(file: File): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;

    this.stopSource();
    this.state = 'analyzing';
    this.resetRun();
    this.setStatus(`Анализ «${file.name}»…`);
    this.hintText.setText('Ищу удары в треке');

    // Разбор файла синхронный и небыстрый: отдаём кадр, чтобы статус был виден.
    await new Promise<void>((resolve) => {
      this.time.delayedCall(ANALYSIS_YIELD_MS, () => resolve());
    });

    try {
      const analyzer = this.analyzer ?? new AudioAnalyzer({ sampleRate: ctx.sampleRate });
      this.analyzer = analyzer;

      const result = await analyzer.analyze(file);

      this.trackName = file.name;
      this.buffer = result.buffer;
      this.beats = result.beats;
      this.duration = result.duration;
      this.bpm = estimateBpm(result.beats);

      if (this.beats.length === 0) {
        this.state = 'idle';
        this.setStatus('Удары не найдены — нужен трек с явным ритмом');
        this.hintText.setText('ЛКМ по полю — удар в такт');
        return;
      }

      await this.startPlayback();
    } catch (error) {
      this.state = 'idle';
      this.setStatus(`Не получилось разобрать файл: ${describeError(error)}`);
      this.hintText.setText('ЛКМ по полю — удар в такт');
      this.setButtonVisible(true);
    }
  }

  private async startPlayback(): Promise<void> {
    const ctx = this.ctx;
    const buffer = this.buffer;

    if (!ctx || !buffer) return;

    if (ctx.state === 'suspended') await ctx.resume();

    this.stopSource();
    this.resetRun();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output ?? ctx.destination);
    source.onended = () => {
      if (this.state === 'playing') this.finish();
    };

    // Аудио стартует в известный момент часов контекста — от него и считаем.
    this.audioStartTime = ctx.currentTime + LEAD_IN;
    source.start(this.audioStartTime);
    this.source = source;
    this.state = 'playing';

    this.setButtonVisible(false);
    this.setStatus(`Играет: ${this.trackName}`);
    this.hintText.setText('ЛКМ по полю — удар в такт');
  }

  private finish(): void {
    this.state = 'finished';
    this.source = undefined;

    const total = this.stats.perfect + this.stats.good + this.stats.miss;
    const accuracy = total > 0 ? Math.round(((this.stats.perfect + this.stats.good) / total) * 100) : 0;

    this.judgementText.setText('ТРЕК ЗАВЕРШЁН').setFontSize(30).setColor('#ffffff');
    this.offsetText.setText(
      `PERFECT ${this.stats.perfect} · GOOD ${this.stats.good} · MISS ${this.stats.miss} · точность ${accuracy}%`,
    );
    this.setStatus(`Битов в треке: ${this.beats.length} · Score ${this.stats.score}`);
    this.hintText.setText('ЛКМ — запустить заново');
    this.setButtonVisible(true);
  }

  private stopSource(): void {
    const source = this.source;
    if (!source) return;

    this.source = undefined;
    source.onended = null;

    try {
      source.stop();
    } catch {
      // источник уже остановлен — ничего страшного
    }

    source.disconnect();
  }

  /** Сброс партии: счёт, кольца, отмеченные биты. */
  private resetRun(): void {
    this.judged.clear();
    this.rings.length = 0;
    this.nextRingIndex = 0;
    this.pulseIndex = 0;
    this.hitFlash = 0;
    this.stats = { perfect: 0, good: 0, miss: 0, score: 0, combo: 0, bestCombo: 0 };
    this.judgementText.setText('').setFontSize(46);
    this.offsetText.setText('');
    this.trackInfoCache = '';
    this.updateHud();
  }

  /** Рождение колец: за FLIGHT_TIME секунд до бита и ни секундой раньше. */
  private spawnRings(audioTime: number): void {
    while (
      this.nextRingIndex < this.beats.length &&
      this.beats[this.nextRingIndex].time - audioTime <= FLIGHT_TIME
    ) {
      const beat = this.beats[this.nextRingIndex];
      this.rings.push({ time: beat.time, intensity: beat.intensity });
      this.nextRingIndex += 1;
    }

    while (this.rings.length > 0 && this.rings[0].time + RING_TAIL <= audioTime) {
      this.rings.shift();
    }
  }

  /**
   * Радиус кольца считается из времени до бита, а не из скорости полёта:
   * кольцо придёт в центр ровно в момент бита, даже если кадр подвис.
   */
  private drawRings(audioTime: number): void {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    this.ringsGraphics.clear();

    for (const ring of this.rings) {
      const progress = Phaser.Math.Clamp((ring.time - audioTime) / FLIGHT_TIME, 0, 1);
      const radius = SPAWN_RADIUS * progress;
      const alpha = 0.25 + 0.75 * ring.intensity;

      this.ringsGraphics.lineStyle(1 + 3 * ring.intensity, COLOR_RING, alpha);
      this.ringsGraphics.strokeCircle(centerX, centerY, radius);
    }
  }

  /** Центральная точка: пульс на бит и вспышка от попадания. */
  private drawTarget(audioTime: number): void {
    const pulse = this.beatPulse(audioTime);
    const color = this.hitFlash > 0 ? this.flashColor : COLOR_IDLE;

    this.target.setRadius(TARGET_RADIUS + pulse * 8);
    this.target.setStrokeStyle(3, color, 0.85);
    this.target.setFillStyle(color, 0.12 + pulse * 0.35 + this.hitFlash * 0.25);
  }

  /** Насколько близко к только что прошедшему биту (1 — ровно в бит). */
  private beatPulse(audioTime: number): number {
    while (this.pulseIndex < this.beats.length && this.beats[this.pulseIndex].time <= audioTime) {
      this.pulseIndex += 1;
    }

    const beat = this.beats[this.pulseIndex - 1];
    if (!beat) return 0;

    const sinceBeat = audioTime - beat.time;

    return sinceBeat >= 0 && sinceBeat < PULSE_TIME ? 1 - sinceBeat / PULSE_TIME : 0;
  }

  private updateTrackInfo(audioTime: number): void {
    if (this.state !== 'playing' && this.state !== 'finished') return;

    const position = Phaser.Math.Clamp(audioTime, 0, this.duration);
    const text = `${position.toFixed(1)} / ${this.duration.toFixed(1)} с${this.bpm > 0 ? `\n≈ ${this.bpm} BPM` : ''}`;

    if (text === this.trackInfoCache) return;

    this.trackInfoCache = text;
    this.trackText.setText(text);
  }

  private updateHud(): void {
    this.scoreText.setText(`Score: ${this.stats.score}`);
    this.comboText.setText(`Combo: ${this.stats.combo} · макс ${this.stats.bestCombo}`);
  }

  private createInterface(): void {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    this.add
      .text(centerX, 20, 'РИТМ-ПРОТОТИП', { fontFamily: FONT, fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5, 0);

    this.statusText = this.add
      .text(centerX, 54, 'Выбери аудиофайл — игра найдёт в нём биты', {
        fontFamily: FONT,
        fontSize: '16px',
        color: COLOR_DIM,
      })
      .setOrigin(0.5, 0);

    this.scoreText = this.add.text(24, 20, 'Score: 0', {
      fontFamily: FONT,
      fontSize: '20px',
      color: COLOR_TEXT,
    });

    this.comboText = this.add.text(24, 48, 'Combo: 0 · макс 0', {
      fontFamily: FONT,
      fontSize: '16px',
      color: COLOR_DIM,
    });

    this.trackText = this.add
      .text(width - 24, 20, '', {
        fontFamily: FONT,
        fontSize: '16px',
        color: COLOR_DIM,
        align: 'right',
      })
      .setOrigin(1, 0);

    this.judgementText = this.add
      .text(centerX, centerY - 110, '', {
        fontFamily: FONT,
        fontSize: '46px',
        fontStyle: 'bold',
        color: COLOR_TEXT,
      })
      .setOrigin(0.5)
      .setDepth(3);

    this.offsetText = this.add
      .text(centerX, centerY - 68, '', { fontFamily: FONT, fontSize: '20px', color: COLOR_DIM })
      .setOrigin(0.5)
      .setDepth(3);

    this.ringsGraphics = this.add.graphics().setDepth(1);

    this.target = this.add
      .circle(centerX, centerY, TARGET_RADIUS, COLOR_IDLE, 0.15)
      .setStrokeStyle(3, COLOR_IDLE, 0.9)
      .setDepth(2);

    this.hintText = this.add
      .text(centerX, height - 12, 'ЛКМ по полю — удар в такт', {
        fontFamily: FONT,
        fontSize: '16px',
        color: COLOR_DIM,
      })
      .setOrigin(0.5, 1);

    this.createButton(centerX, height - 64);
    this.createFileInput();
  }

  private createButton(x: number, y: number): void {
    this.button = this.add
      .rectangle(x, y, 320, 52, 0x1e293b)
      .setStrokeStyle(2, COLOR_IDLE, 0.9)
      .setInteractive({ useHandCursor: true })
      .setDepth(4);

    this.buttonLabel = this.add
      .text(x, y, 'ВЫБРАТЬ АУДИОФАЙЛ', { fontFamily: FONT, fontSize: '18px', color: COLOR_TEXT })
      .setOrigin(0.5)
      .setDepth(5);

    this.button.on(
      Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN,
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        this.handleButtonClick(event);
      },
    );
  }

  private handleButtonClick(event: Phaser.Types.Input.EventData): void {
    if (this.state === 'playing' || this.state === 'analyzing') return;

    // Клик по кнопке не должен заодно считаться ударом по полю.
    event.stopPropagation();
    this.fileInput.click();
  }

  /** Скрытый `input type="file"`: системный диалог выбора аудио. */
  private createFileInput(): void {
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'audio/*';
    this.fileInput.style.display = 'none';
    this.fileInput.addEventListener('change', this.handleFileSelected);
    document.body.appendChild(this.fileInput);
  }

  private handleFileSelected = (): void => {
    const file = this.fileInput.files?.[0];
    if (!file) return;

    // Сброс значения: иначе повторный выбор того же файла не вызовет change.
    this.fileInput.value = '';
    void this.loadFile(file);
  };

  private setButtonVisible(visible: boolean): void {
    this.button.setVisible(visible);
    this.buttonLabel.setVisible(visible);
  }

  private setStatus(text: string): void {
    this.statusText.setText(text);
  }

  private handleShutdown(): void {
    this.stopSource();
    this.fileInput.value = '';
    this.fileInput.removeEventListener('change', this.handleFileSelected);
    this.fileInput.remove();
  }
}

/** Сдвиг попадания в миллисекундах: плюс — поздно, минус — рано. */
function formatOffset(offset: number): string {
  return `${offset >= 0 ? '+' : '-'}${Math.round(Math.abs(offset) * 1000)} мс`;
}

/** Цвет надписи по результату удара. */
function judgementColor(judgement: Judgement): string {
  if (judgement === 'PERFECT') return '#22d3ee';
  if (judgement === 'GOOD') return '#4ade80';

  return '#f87171';
}

/** Оценка темпа по медианному интервалу между битами. */
function estimateBpm(beats: BeatEvent[]): number {
  if (beats.length < 4) return 0;

  const intervals: number[] = [];
  for (let i = 1; i < beats.length; i++) {
    intervals.push(beats[i].time - beats[i - 1].time);
  }

  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)] ?? 0;

  return median > 0 ? Math.round(60 / median) : 0;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'неизвестная ошибка';
}

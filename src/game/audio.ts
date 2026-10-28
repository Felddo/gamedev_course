/**
 * Синтезатор звуковых эффектов на Web Audio API.
 * Не требует внешних аудио-файлов и сторонних библиотек.
 */
class SoundFx {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 1.0;
  private muted: boolean = false;

  isMuted(): boolean {
    return this.muted;
  }

  getVolume(): number {
    return this.volume;
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.muted && this.volume > 0) {
      this.muted = false;
    }
    this.updateGain();
  }

  setMuted(mute: boolean): void {
    this.muted = mute;
    this.updateGain();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.updateGain();
    return this.muted;
  }

  private updateGain(): void {
    if (this.ctx && this.masterGain) {
      const targetGain = this.muted ? 0 : this.volume;
      this.masterGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }
  }

  private init(): void {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && !this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private getMasterDestination(): AudioNode | null {
    this.init();
    return this.masterGain || this.ctx?.destination || null;
  }

  /**
   * Звук выстрела сдвоенного лазерного бластера.
   */
  playLaser(): void {
    this.playCannon();
  }

  /**
   * Мощный выстрел носового корабельного орудия.
   */
  playCannon(): void {
    try {
      this.init();
      const dest = this.getMasterDestination();
      if (!this.ctx || !dest || this.muted) return;
      const now = this.ctx.currentTime;

      // 1. Ударная волна орудия (низкочастотный импульс выстрела)
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);
      oscGain.gain.setValueAtTime(0.35, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(oscGain);
      oscGain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.22);

      // 2. Взрывной хлопок газов и лязг механизма
      const sampleRate = this.ctx.sampleRate;
      const duration = 0.26;
      const buffer = this.ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.05));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(850, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + duration);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.28, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(dest);
      noise.start(now);
    } catch {
      // Игнорируем ошибки воспроизведения
    }
  }

  /**
   * Звук попадания лазера по броне.
   */
  playHit(): void {
    try {
      this.init();
      const dest = this.getMasterDestination();
      if (!this.ctx || !dest || this.muted) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';

      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // Игнорируем ошибки воспроизведения
    }
  }

  /**
   * Звук взрыва уничтоженного космического корабля.
   */
  playExplosion(): void {
    try {
      this.init();
      const dest = this.getMasterDestination();
      if (!this.ctx || !dest || this.muted) return;
      const sampleRate = this.ctx.sampleRate;
      const duration = 0.28;
      const buffer = this.ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.08));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + duration);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start();
    } catch {
      // Игнорируем ошибки воспроизведения
    }
  }

  /**
   * Звук наведения на голографическую кнопку в меню.
   */
  playUiHover(): void {
    try {
      this.init();
      const dest = this.getMasterDestination();
      if (!this.ctx || !dest || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';

      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.04);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Игнорируем ошибки воспроизведения
    }
  }

  /**
   * Звук клика в интерфейсе меню.
   */
  playUiClick(): void {
    try {
      this.init();
      const dest = this.getMasterDestination();
      if (!this.ctx || !dest || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';

      osc.frequency.setValueAtTime(620, now);
      osc.frequency.setValueAtTime(940, now + 0.03);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Игнорируем ошибки воспроизведения
    }
  }

  /**
   * Выстрел плазменного орудия вражеского крейсера.
   */
  playTerminatorShoot(): void {
    try {
      this.init();
      const dest = this.getMasterDestination();
      if (!this.ctx || !dest || this.muted) return;
      const now = this.ctx.currentTime;

      // 1. Пьезо-электрический лазерный импульс
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.16);

      gain.gain.setValueAtTime(0.20, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.16);

      // 2. Металлический лязг сервопривода затвора
      const clankOsc = this.ctx.createOscillator();
      const clankGain = this.ctx.createGain();
      clankOsc.type = 'triangle';
      clankOsc.frequency.setValueAtTime(880, now);
      clankOsc.frequency.exponentialRampToValueAtTime(220, now + 0.07);
      clankGain.gain.setValueAtTime(0.14, now);
      clankGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      clankOsc.connect(clankGain);
      clankGain.connect(dest);
      clankOsc.start(now);
      clankOsc.stop(now + 0.07);
    } catch {
      // Игнорируем ошибки воспроизведения
    }
  }

  /**
   * Звук мощного форсажа маршевых двигателей звездолета.
   */
  playRocketBoost(): void {
    try {
      this.init();
      const dest = this.getMasterDestination();
      if (!this.ctx || !dest || this.muted) return;
      const now = this.ctx.currentTime;
      const duration = 0.42;

      // 1. Низкочастотный импульс и нарастающий рев ракетного двигателя
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(320, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(65, now + duration);

      oscGain.gain.setValueAtTime(0.01, now);
      oscGain.gain.linearRampToValueAtTime(0.32, now + 0.06);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(oscGain);
      oscGain.connect(dest);
      osc.start(now);
      osc.stop(now + duration);

      // 2. Высокотемпературный рев пламени (продувка газов через сопло)
      const sampleRate = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.28));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.linearRampToValueAtTime(1600, now + 0.12);
      filter.frequency.exponentialRampToValueAtTime(250, now + duration);
      filter.Q.setValueAtTime(2.2, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.38, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(dest);
      noise.start(now);
    } catch {
      // Игнорируем ошибки воспроизведения
    }
  }

  /**
   * Звук готовности перезарядки форсажа.
   */
  playDashReady(): void {
    try {
      this.init();
      const dest = this.getMasterDestination();
      if (!this.ctx || !dest || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';

      osc.frequency.setValueAtTime(740, now);
      osc.frequency.setValueAtTime(1180, now + 0.05);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
      // Игнорируем ошибки воспроизведения
    }
  }

  /**
   * Звук активации боевого овердрайва реактора корабля.
   */
  playSuperTransform(): void {
    try {
      this.init();
      const dest = this.getMasterDestination();
      if (!this.ctx || !dest || this.muted) return;
      const now = this.ctx.currentTime;

      // 1. Механический раскручивающийся гул сирены овердрайва
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.35);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.42);

      // 2. Взрывной хлопок воспламенения реактивных дюз
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(95, now);
      subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.3);

      subGain.gain.setValueAtTime(0.35, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      subOsc.connect(subGain);
      subGain.connect(dest);
      subOsc.start(now);
      subOsc.stop(now + 0.32);
    } catch {
      // Игнорируем
    }
  }

  /**
   * Сверхтяжелый залп орудий в режиме овердрайва.
   */
  playSuperCannon(): void {
    try {
      this.init();
      const dest = this.getMasterDestination();
      if (!this.ctx || !dest || this.muted) return;
      const now = this.ctx.currentTime;

      // Глубокий басовый удар
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 0.28);
      oscGain.gain.setValueAtTime(0.42, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(oscGain);
      oscGain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.28);

      // Металлический отзвук ствола
      const ringOsc = this.ctx.createOscillator();
      const ringGain = this.ctx.createGain();
      ringOsc.type = 'triangle';
      ringOsc.frequency.setValueAtTime(480, now);
      ringOsc.frequency.exponentialRampToValueAtTime(110, now + 0.16);
      ringGain.gain.setValueAtTime(0.24, now);
      ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      ringOsc.connect(ringGain);
      ringGain.connect(dest);
      ringOsc.start(now);
      ringOsc.stop(now + 0.16);
    } catch {
      // Игнорируем
    }
  }

  /**
   * Звук готовности овердрайва реактора корабля.
   */
  playSuperReady(): void {
    try {
      this.init();
      const dest = this.getMasterDestination();
      if (!this.ctx || !dest || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';

      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(880, now + 0.06);
      osc.frequency.setValueAtTime(1320, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Игнорируем
    }
  }

  /**
   * Голографический сигнал обновления тактической фазы боя.
   */
  playPhaseNotification(phaseNumber = 1): void {
    try {
      this.init();
      const dest = this.getMasterDestination();
      if (!this.ctx || !dest || this.muted) return;
      const now = this.ctx.currentTime;

      // Гармонические тона с голографической реверберацией
      const tones = phaseNumber === 1 ? [440, 660, 880] : [520, 780, 1040];
      tones.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.04, now + idx * 0.08 + 0.24);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.setValueAtTime(0.16, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.32);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.34);
      });
    } catch {
      // Игнорируем
    }
  }

  /**
   * Триумфальный футуристический аккорд при установке тактического апгрейда.
   */
  playUpgradeSelect(): void {
    try {
      this.init();
      const dest = this.getMasterDestination();
      if (!this.ctx || !dest || this.muted) return;
      const now = this.ctx.currentTime;

      const freqs = [330, 440, 554, 659, 880];
      freqs.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.02, now + idx * 0.05 + 0.35);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.setValueAtTime(0.18, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.38);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.4);
      });
    } catch {
      // Игнорируем
    }
  }
}

export const soundFx = new SoundFx();

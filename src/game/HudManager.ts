import Phaser from 'phaser';
import { PLAYER_MAX_HP, GAME_PHASES } from './constants';
import { EnemyShip, Meteor, SpaceStation, ExpOrb, ScrapPickup } from './types';
import { CampaignMission } from './campaign/types';

const RADAR_SIZE = 170;
const RADAR_MARGIN = 18;
const RADAR_SCAN_RADIUS = 1500;

/**
 * Менеджер пользовательского интерфейса (HUD):
 * верхняя голографическая панель, фиолетовая голографическая полоска опыта,
 * индикатор босса миссии и тактический радар сектора
 */
export class HudManager {
  private scene: Phaser.Scene;
  private currentMission: CampaignMission | null = null;
  public playerMaxHp: number = PLAYER_MAX_HP;

  // Элементы верхней панели
  private hudGraphics!: Phaser.GameObjects.Graphics;
  private hpLabel!: Phaser.GameObjects.Text;
  private hpBg!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private timerLabel!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private killsLabel!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private scrapLabel!: Phaser.GameObjects.Text;
  private scrapText!: Phaser.GameObjects.Text;
  private phaseLabel!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;

  // Голографическая полоска опыта под верхней панелью
  private expBarGraphics!: Phaser.GameObjects.Graphics;
  private expBarText!: Phaser.GameObjects.Text;
  private currentExpRatio = 0;
  private displayedExpRatio = 0;

  // Полоса здоровья босса
  private bossBarGraphics!: Phaser.GameObjects.Graphics;
  private bossBarText!: Phaser.GameObjects.Text;

  // Тактический радар (Мини-карта)
  private radarContainer!: Phaser.GameObjects.Container;
  private radarBg!: Phaser.GameObjects.Rectangle;
  private radarGraphics!: Phaser.GameObjects.Graphics;
  private radarLabel!: Phaser.GameObjects.Text;
  private coordsText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.scene = scene;
    this.createHud(width, height);
  }

  private createHud(width: number, height: number): void {
    // 1. Графика зеленой голографической панели
    this.hudGraphics = this.scene.add.graphics();
    this.hudGraphics.setScrollFactor(0);
    this.hudGraphics.setDepth(30);

    this.hpLabel = this.scene.add
      .text(0, 0, 'ПРОЧНОСТЬ КОРАБЛЯ // HP', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#6ee7b7',
      })
      .setScrollFactor(0)
      .setDepth(32);

    this.hpBg = this.scene.add.rectangle(0, 0, 140, 12, 0x031c14);
    this.hpBg.setStrokeStyle(1, 0x059669, 0.9);
    this.hpBg.setOrigin(0, 0.5);
    this.hpBg.setScrollFactor(0);
    this.hpBg.setDepth(31);

    this.hpBarFill = this.scene.add.rectangle(0, 0, 140, 12, 0x10b981);
    this.hpBarFill.setOrigin(0, 0.5);
    this.hpBarFill.setScrollFactor(0);
    this.hpBarFill.setDepth(32);

    this.hpText = this.scene.add
      .text(0, 0, '100%', {
        fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ecfdf5',
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(33);

    this.timerLabel = this.scene.add
      .text(0, 0, 'ПРОТОКОЛ ВЫЖИВАНИЯ', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '10px',
        fontStyle: '600',
        color: '#6ee7b7',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(32);

    this.timerText = this.scene.add
      .text(0, 0, '00:00', {
        fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ecfdf5',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(32);

    this.killsLabel = this.scene.add
      .text(0, 0, 'ЦЕЛИ УНИЧТОЖЕНЫ', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '10px',
        fontStyle: '600',
        color: '#6ee7b7',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(32);

    this.killsText = this.scene.add
      .text(0, 0, '0', {
        fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ecfdf5',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(32);

    this.scrapLabel = this.scene.add
      .text(0, 0, 'МЕТАЛЛОЛОМ // SCRAP', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '10px',
        fontStyle: '600',
        color: '#fde68a',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(32);

    this.scrapText = this.scene.add
      .text(0, 0, '0', {
        fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#fbbf24',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(32);

    this.phaseLabel = this.scene.add
      .text(0, 0, 'БОЕВАЯ ФАЗА', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '10px',
        fontStyle: '600',
        color: '#6ee7b7',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(32);

    this.phaseText = this.scene.add
      .text(0, 0, 'ФАЗА 1', {
        fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#34d399',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(32);

    // 1.1. Фиолетовая голографическая полоска опыта под верхней панелью
    this.expBarGraphics = this.scene.add.graphics();
    this.expBarGraphics.setScrollFactor(0);
    this.expBarGraphics.setDepth(31);

    this.expBarText = this.scene.add
      .text(0, 0, 'ОПЫТ // EXP: 0 / 200 (0%)', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#f3e8ff',
        stroke: '#3b0764',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(33);

    // 1.2. Полоска здоровья босса миссии
    this.bossBarGraphics = this.scene.add.graphics();
    this.bossBarGraphics.setScrollFactor(0);
    this.bossBarGraphics.setDepth(34);

    this.bossBarText = this.scene.add
      .text(0, 0, '', {
        fontFamily: "'Orbitron', 'Rajdhani', monospace",
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fef2f2',
        stroke: '#7f1d1d',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(35)
      .setVisible(false);

    this.layoutHud(width);

    this.scene.tweens.add({
      targets: this.hudGraphics,
      alpha: { from: 0.86, to: 1.0 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 2. Тактический радар сектора (Мини-карта)
    this.radarContainer = this.scene.add.container(0, 0);
    this.positionRadar(width, height);
    this.radarContainer.setScrollFactor(0);
    this.radarContainer.setDepth(30);

    this.radarBg = this.scene.add.rectangle(0, 0, RADAR_SIZE, RADAR_SIZE, 0x020c08, 0.85);
    this.radarBg.setStrokeStyle(1.5, 0x10b981);

    this.radarLabel = this.scene.add
      .text(-RADAR_SIZE / 2 + 6, -RADAR_SIZE / 2 - 14, 'ТАКТИЧЕСКИЙ РАДАР // СЕКТОР', {
        fontFamily: "'Rajdhani', monospace",
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#10b981',
      })
      .setOrigin(0, 0);

    this.coordsText = this.scene.add
      .text(-RADAR_SIZE / 2 + 6, RADAR_SIZE / 2 + 4, 'КООРД: 1800, 1800', {
        fontFamily: "'Rajdhani', monospace",
        fontSize: '10px',
        color: '#6ee7b7',
      })
      .setOrigin(0, 0);

    this.radarGraphics = this.scene.add.graphics();
    this.radarContainer.add([this.radarBg, this.radarGraphics, this.radarLabel, this.coordsText]);
  }

  public layoutHud(width: number): void {
    const topBarHeight = 44;
    const expBarHeight = 14;
    const padX = 18;

    this.hudGraphics.clear();
    this.hudGraphics.fillStyle(0x02130e, 0.88);
    this.hudGraphics.fillRect(0, 0, width, topBarHeight);

    this.hudGraphics.lineStyle(1.5, 0x10b981, 0.95);
    this.hudGraphics.lineBetween(0, topBarHeight, width, topBarHeight);

    this.hudGraphics.lineStyle(1, 0x059669, 0.35);
    this.hudGraphics.strokeRect(padX - 4, 6, width - padX * 2 + 8, topBarHeight - 12);

    const hpOffset = 58;
    this.hpLabel.setPosition(padX + 4 + hpOffset, 8);
    this.hpBg.setPosition(padX + 4 + hpOffset, 28);
    this.hpBarFill.setPosition(padX + 4 + hpOffset, 28);
    this.hpText.setPosition(padX + 152 + hpOffset, 28);

    const centerX = width / 2;
    this.timerLabel.setPosition(centerX, 12);
    this.timerText.setPosition(centerX, 28);

    const killsX = centerX - 140;
    this.killsLabel.setPosition(killsX, 12);
    this.killsText.setPosition(killsX, 28);

    const scrapX = centerX + 140;
    this.scrapLabel.setPosition(scrapX, 12);
    this.scrapText.setPosition(scrapX, 28);

    const phaseX = width - padX - 80;
    this.phaseLabel.setPosition(phaseX, 12);
    this.phaseText.setPosition(phaseX, 28);

    const expBarY = topBarHeight;
    this.expBarText.setPosition(centerX, expBarY + expBarHeight / 2);
    this.renderExpBar(width);
  }

  private renderExpBar(width: number): void {
    const topBarHeight = 44;
    const expBarHeight = 14;
    const expBarY = topBarHeight;

    this.expBarGraphics.clear();

    // 1. Темный полупрозрачный фиолетовый фон под верхней панелью
    this.expBarGraphics.fillStyle(0x0c0418, 0.92);
    this.expBarGraphics.fillRect(0, expBarY, width, expBarHeight);

    // 2. Голографические границы полоски
    this.expBarGraphics.lineStyle(1, 0x581c87, 0.65);
    this.expBarGraphics.lineBetween(0, expBarY, width, expBarY);

    this.expBarGraphics.lineStyle(1.5, 0xa855f7, 0.95);
    this.expBarGraphics.lineBetween(0, expBarY + expBarHeight, width, expBarY + expBarHeight);

    // 3. Голографические деления / сетка (каждые 10% ширины)
    this.expBarGraphics.lineStyle(1, 0x9333ea, 0.28);
    for (let i = 1; i < 10; i++) {
      const gx = (width * i) / 10;
      this.expBarGraphics.lineBetween(gx, expBarY + 2, gx, expBarY + expBarHeight - 2);
    }

    // 4. Заполнение полоски опытом
    const fillWidth = width * this.displayedExpRatio;
    if (fillWidth > 0) {
      // Основной неоново-фиолетовый слой
      this.expBarGraphics.fillStyle(0x9333ea, 0.9);
      this.expBarGraphics.fillRect(0, expBarY + 1, fillWidth, expBarHeight - 2);

      // Верхний светлый блик (голографический глянец)
      this.expBarGraphics.fillStyle(0xd8b4fe, 0.45);
      this.expBarGraphics.fillRect(0, expBarY + 1, fillWidth, 2);

      // Яркий голографический сканирующий срез
      this.expBarGraphics.fillStyle(0xffffff, 0.95);
      this.expBarGraphics.fillRect(Math.max(0, fillWidth - 2), expBarY, 3, expBarHeight);

      // Внешний фиолетовый ореол наконечника
      this.expBarGraphics.fillStyle(0xc084fc, 0.4);
      this.expBarGraphics.fillRect(Math.max(0, fillWidth - 6), expBarY, 9, expBarHeight);
    }
  }

  private positionRadar(width: number, height: number): void {
    const rx = width - RADAR_SIZE / 2 - RADAR_MARGIN;
    const ry = height - RADAR_SIZE / 2 - RADAR_MARGIN;
    this.radarContainer.setPosition(rx, ry);
  }

  public handleResize(width: number, height: number): void {
    this.layoutHud(width);
    this.positionRadar(width, height);
  }

  private isVisible = true;

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.hudGraphics.setVisible(visible);
    this.hpLabel.setVisible(visible);
    this.hpBg.setVisible(visible);
    this.hpBarFill.setVisible(visible);
    this.hpText.setVisible(visible);
    this.timerLabel.setVisible(visible);
    this.timerText.setVisible(visible);
    this.killsLabel.setVisible(visible);
    this.killsText.setVisible(visible);
    this.phaseLabel.setVisible(visible);
    this.phaseText.setVisible(visible);
    this.expBarGraphics.setVisible(visible);
    this.expBarText.setVisible(visible);
    this.radarContainer.setVisible(visible);
    if (this.bossBarGraphics) this.bossBarGraphics.setVisible(visible);
    if (this.bossBarText && !visible) this.bossBarText.setVisible(false);
  }

  public setMission(mission: CampaignMission): void {
    this.currentMission = mission;
    this.phaseLabel.setText('СЕКТОР ' + mission.sector);
    this.phaseText.setText(mission.isBoss ? `БОСС ${mission.id}` : `МИССИЯ ${mission.id}`);
    if (mission.isBoss) {
      this.timerLabel.setText('ДО ВХОДА БОССА');
    } else {
      this.timerLabel.setText('ДО ЭВАКУАЦИИ');
    }
    if (this.bossBarGraphics) this.bossBarGraphics.clear();
    if (this.bossBarText) this.bossBarText.setVisible(false);
  }

  public update(
    playerHp: number,
    survivalTime: number,
    killsCount: number,
    score: number,
    playerX: number,
    playerY: number,
    playerAngle: number,
    cam: Phaser.Cameras.Scene2D.Camera,
    enemies: EnemyShip[],
    _ignoredHolograms?: unknown,
    currentPhase = 1,
    meteors: Meteor[] = [],
    stations: SpaceStation[] = [],
    targetedStation: SpaceStation | null = null,
    expOrbs: ExpOrb[] = [],
    activeBoss: EnemyShip | null = null,
    scrapCount = 0,
    scrapItems: ScrapPickup[] = [],
  ): void {
    if (!this.isVisible) return;

    // 1. Полоска прочности корабля
    const maxHp = this.playerMaxHp > 0 ? this.playerMaxHp : PLAYER_MAX_HP;
    const hpRatio = Phaser.Math.Clamp(playerHp / maxHp, 0, 1);
    this.hpBarFill.setSize(Math.max(0, 140 * hpRatio), 12);

    if (hpRatio > 0.5) {
      this.hpBarFill.setFillStyle(0x10b981);
    } else if (hpRatio > 0.25) {
      this.hpBarFill.setFillStyle(0xf59e0b);
    } else {
      this.hpBarFill.setFillStyle(0xef4444);
    }
    this.hpText.setText(`${Math.ceil(hpRatio * 100)}%`);

    // 2. Таймер и индикация миссии кампании
    if (this.currentMission) {
      if (this.currentMission.isBoss) {
        if (activeBoss && activeBoss.hp > 0) {
          this.timerLabel.setText('ФЛАГМАН В СЕКТОРЕ');
          this.timerText.setText(this.formatTime(survivalTime));
          this.phaseLabel.setText('СЕКТОР ' + this.currentMission.sector);
          this.phaseText.setText('БОСС ' + this.currentMission.id);
          this.renderBossBar(activeBoss);
        } else {
          const spawnDelay = this.currentMission.bossConfig?.spawnDelay ?? 60;
          const remainingToBoss = Math.max(0, spawnDelay - survivalTime);
          this.timerLabel.setText('ДО ВХОДА БОССА');
          this.timerText.setText(this.formatTime(remainingToBoss));
          this.phaseLabel.setText('СЕКТОР ' + this.currentMission.sector);
          this.phaseText.setText('МИССИЯ ' + this.currentMission.id + ' [БОСС]');
          if (this.bossBarGraphics) this.bossBarGraphics.clear();
          if (this.bossBarText) this.bossBarText.setVisible(false);
        }
      } else {
        const remainingSeconds = Math.max(0, this.currentMission.targetDuration - survivalTime);
        this.timerLabel.setText('ДО ЭВАКУАЦИИ');
        this.timerText.setText(this.formatTime(remainingSeconds));
        this.phaseLabel.setText('СЕКТОР ' + this.currentMission.sector);
        this.phaseText.setText('МИССИЯ ' + this.currentMission.id);
        if (this.bossBarGraphics) this.bossBarGraphics.clear();
        if (this.bossBarText) this.bossBarText.setVisible(false);
      }
    } else {
      this.timerLabel.setText('ПРОТОКОЛ ВЫЖИВАНИЯ');
      this.timerText.setText(this.formatTime(survivalTime));
      this.phaseLabel.setText('БОЕВАЯ ФАЗА');
      this.phaseText.setText(`ФАЗА ${currentPhase}`);
      if (this.bossBarGraphics) this.bossBarGraphics.clear();
      if (this.bossBarText) this.bossBarText.setVisible(false);
    }

    // 3. Цели и металлолом
    this.killsText.setText(`${killsCount}`);
    this.scrapText.setText(`${scrapCount}`);

    // 4. Фиолетовая голографическая полоска опыта под верхней панелью
    this.updateExpBar(score, currentPhase);

    // 5. Тактический радар
    this.updateRadar(playerX, playerY, playerAngle, cam, enemies, meteors, stations, targetedStation, expOrbs, scrapItems);
  }

  private renderBossBar(boss: EnemyShip): void {
    if (!this.bossBarGraphics || !this.bossBarText) return;
    const width = this.scene.scale.width;
    const barY = 62;
    const barHeight = 16;
    const bossRatio = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
    const barWidth = Math.min(460, width - 40);
    const barX = (width - barWidth) / 2;

    this.bossBarGraphics.clear();
    // Подложка
    this.bossBarGraphics.fillStyle(0x1a0606, 0.92);
    this.bossBarGraphics.fillRect(barX, barY, barWidth, barHeight);
    this.bossBarGraphics.lineStyle(1.5, 0xef4444, 0.95);
    this.bossBarGraphics.strokeRect(barX, barY, barWidth, barHeight);

    // Заполнение красным градиентом
    const fillWidth = (barWidth - 2) * bossRatio;
    if (fillWidth > 0) {
      this.bossBarGraphics.fillStyle(0xdc2626, 0.95);
      this.bossBarGraphics.fillRect(barX + 1, barY + 1, fillWidth, barHeight - 2);
      this.bossBarGraphics.fillStyle(0xf87171, 0.55);
      this.bossBarGraphics.fillRect(barX + 1, barY + 1, fillWidth, 2);
    }

    this.bossBarText.setVisible(this.isVisible);
    this.bossBarText.setPosition(width / 2, barY + barHeight / 2);
    const percent = Math.ceil(bossRatio * 100);
    this.bossBarText.setText(
      `⚠ ${boss.bossName || 'БОСС'} // ПРОЧНОСТЬ: ${Math.ceil(boss.hp)} / ${boss.maxHp} (${percent}%)`,
    );
  }

  private updateExpBar(score: number, currentPhase: number): void {
    const width = this.scene.scale.width;
    let prevThreshold = 0;
    let nextThreshold = 200;

    const currentPhaseInfo = GAME_PHASES.find((p) => p.number === currentPhase);
    const nextPhaseInfo = GAME_PHASES.find((p) => p.number === currentPhase + 1);

    if (currentPhaseInfo) {
      prevThreshold = currentPhaseInfo.scoreThreshold;
    }
    if (nextPhaseInfo) {
      nextThreshold = nextPhaseInfo.scoreThreshold;
    } else {
      nextThreshold = prevThreshold + 1000;
    }

    const expNeeded = Math.max(1, nextThreshold - prevThreshold);
    const currentExpInPhase = Math.max(0, score - prevThreshold);
    this.currentExpRatio = Phaser.Math.Clamp(currentExpInPhase / expNeeded, 0, 1);

    // Плавная интерполяция заполнения
    this.displayedExpRatio = Phaser.Math.Linear(this.displayedExpRatio, this.currentExpRatio, 0.15);
    if (Math.abs(this.displayedExpRatio - this.currentExpRatio) < 0.002) {
      this.displayedExpRatio = this.currentExpRatio;
    }

    const percent = Math.min(100, Math.floor(this.displayedExpRatio * 100));

    if (nextPhaseInfo) {
      this.expBarText.setText(
        `ОПЫТ // EXP: ${currentExpInPhase} / ${expNeeded} (${percent}%) // ДО ФАЗЫ ${currentPhase + 1}`,
      );
    } else {
      this.expBarText.setText(
        `ОПЫТ // EXP: ${currentExpInPhase} / ${expNeeded} (${percent}%) // МАКС. ФАЗА`,
      );
    }

    this.renderExpBar(width);
  }

  private updateRadar(
    playerX: number,
    playerY: number,
    playerAngle: number,
    cam: Phaser.Cameras.Scene2D.Camera,
    enemies: EnemyShip[],
    meteors: Meteor[] = [],
    stations: SpaceStation[] = [],
    targetedStation: SpaceStation | null = null,
    expOrbs: ExpOrb[] = [],
    scrapItems: ScrapPickup[] = [],
  ): void {
    this.radarGraphics.clear();
    const half = RADAR_SIZE / 2;
    const radarRadius = half - 5;
    const scanRadius = RADAR_SCAN_RADIUS;

    // Сетка радара
    this.radarGraphics.lineStyle(1, 0x064e3b, 0.6);
    this.radarGraphics.strokeCircle(0, 0, radarRadius * 0.35);
    this.radarGraphics.strokeCircle(0, 0, radarRadius * 0.7);
    this.radarGraphics.strokeCircle(0, 0, radarRadius);
    this.radarGraphics.lineBetween(-radarRadius, 0, radarRadius, 0);
    this.radarGraphics.lineBetween(0, -radarRadius, 0, radarRadius);

    // Зона видимости камеры
    if (cam && cam.worldView) {
      const camW = (cam.worldView.width / scanRadius) * radarRadius;
      const camH = (cam.worldView.height / scanRadius) * radarRadius;
      this.radarGraphics.lineStyle(1, 0x38bdf8, 0.35);
      this.radarGraphics.strokeRect(-camW / 2, -camH / 2, camW, camH);
    }

    // Космические станции на радаре
    for (const station of stations) {
      const dx = station.sprite.x - playerX;
      const dy = station.sprite.y - playerY;
      const dist = Math.hypot(dx, dy);
      if (dist <= scanRadius) {
        const sx = (dx / scanRadius) * radarRadius;
        const sy = (dy / scanRadius) * radarRadius;
        if (targetedStation === station) {
          this.radarGraphics.lineStyle(2, 0xef4444, 1.0);
          this.radarGraphics.strokeCircle(sx, sy, 6.5);
          this.radarGraphics.fillStyle(0xf87171, 1.0);
          this.radarGraphics.fillCircle(sx, sy, 3.5);
        } else {
          this.radarGraphics.fillStyle(0x38bdf8, 1.0);
          this.radarGraphics.lineStyle(1.5, 0x818cf8, 0.9);
          this.radarGraphics.strokeCircle(sx, sy, 4.5);
          this.radarGraphics.fillCircle(sx, sy, 2.5);
        }
      }
    }

    // Метки вражеских кораблей (красные)
    this.radarGraphics.fillStyle(0xef4444, 0.95);
    for (const enemy of enemies) {
      const dx = enemy.sprite.x - playerX;
      const dy = enemy.sprite.y - playerY;
      const dist = Math.hypot(dx, dy);
      if (dist <= scanRadius) {
        const ex = (dx / scanRadius) * radarRadius;
        const ey = (dy / scanRadius) * radarRadius;
        this.radarGraphics.fillCircle(ex, ey, 2.5);
      }
    }

    // Метеориты на тактическом радаре (оранжевые метки)
    this.radarGraphics.fillStyle(0xf97316, 0.95);
    for (const meteor of meteors) {
      const dx = meteor.sprite.x - playerX;
      const dy = meteor.sprite.y - playerY;
      const dist = Math.hypot(dx, dy);
      if (dist <= scanRadius) {
        const mx = (dx / scanRadius) * radarRadius;
        const my = (dy / scanRadius) * radarRadius;
        const dotR = meteor.scale > 0.8 ? 2.5 : 1.5;
        this.radarGraphics.fillCircle(mx, my, dotR);
      }
    }

    // Сферы голографического опыта на радаре (фиолетовые маркеры)
    this.radarGraphics.fillStyle(0xc084fc, 0.95);
    for (const orb of expOrbs) {
      const dx = orb.x - playerX;
      const dy = orb.y - playerY;
      const dist = Math.hypot(dx, dy);
      if (dist <= scanRadius) {
        const ox = (dx / scanRadius) * radarRadius;
        const oy = (dy / scanRadius) * radarRadius;
        this.radarGraphics.fillCircle(ox, oy, 1.8);
      }
    }

    // Фрагменты металлолома на радаре (янтарно-золотые маркеры)
    this.radarGraphics.fillStyle(0xfbbf24, 0.95);
    for (const item of scrapItems) {
      const dx = item.x - playerX;
      const dy = item.y - playerY;
      const dist = Math.hypot(dx, dy);
      if (dist <= scanRadius) {
        const sx = (dx / scanRadius) * radarRadius;
        const sy = (dy / scanRadius) * radarRadius;
        this.radarGraphics.fillCircle(sx, sy, 2.0);
      }
    }

    // Корабль игрока в центре радара (изумрудный маркер с вектором курса)
    this.radarGraphics.fillStyle(0x10b981, 1);
    this.radarGraphics.fillCircle(0, 0, 3.5);

    const arrowLen = 7;
    const ax = Math.cos(playerAngle) * arrowLen;
    const ay = Math.sin(playerAngle) * arrowLen;
    this.radarGraphics.lineStyle(1.5, 0x34d399, 1);
    this.radarGraphics.lineBetween(0, 0, ax, ay);

    this.coordsText.setText(
      `КООРД: ${Math.round(playerX)}, ${Math.round(playerY)}`,
    );
  }

  public formatTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const padM = mins < 10 ? `0${mins}` : `${mins}`;
    const padS = secs < 10 ? `0${secs}` : `${secs}`;
    return `${padM}:${padS}`;
  }

  public destroy(): void {
    this.hudGraphics.destroy();
    this.hpLabel.destroy();
    this.hpBg.destroy();
    this.hpBarFill.destroy();
    this.hpText.destroy();
    this.timerLabel.destroy();
    this.timerText.destroy();
    this.killsLabel.destroy();
    this.killsText.destroy();
    this.phaseLabel.destroy();
    this.phaseText.destroy();
    this.expBarGraphics.destroy();
    this.expBarText.destroy();
    this.bossBarGraphics.destroy();
    this.bossBarText.destroy();
    this.radarContainer.destroy();
  }
}

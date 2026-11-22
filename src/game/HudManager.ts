import Phaser from 'phaser';
import { PLAYER_MAX_HP, MAP_WIDTH, MAP_HEIGHT } from './constants';
import { EnemyShip, Meteor, SpaceStation, ScrapPickup } from './types';
import { CampaignMission } from './campaign/types';
import { isMobilePhone } from './deviceUtils';

const RADAR_SIZE = 170;
const RADAR_MARGIN = 18;
const RADAR_SCAN_RADIUS = 1500;

// Высокое разрешение для рендеринга текста в текстуры WebGL (убирает размытие/замыливание на экранах любой плотности)
const HUD_TEXT_RESOLUTION = Math.max(3, Math.min(4, Math.ceil((window.devicePixelRatio || 1) * 1.5)));

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
  private hudContainer!: Phaser.GameObjects.Container;
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

  // Полоса здоровья босса
  private bossBarGraphics!: Phaser.GameObjects.Graphics;
  private bossBarText!: Phaser.GameObjects.Text;

  // Тактический радар (Мини-карта)
  private radarContainer!: Phaser.GameObjects.Container;
  private radarBg!: Phaser.GameObjects.Rectangle;
  private radarGraphics!: Phaser.GameObjects.Graphics;
  private radarLabel!: Phaser.GameObjects.Text;
  private coordsText!: Phaser.GameObjects.Text;

  // Динамические адаптивные размеры для мобильных экранов
  private currentHpBarWidth: number = 140;
  private currentHpBarHeight: number = 12;
  private currentRadarSize: number = RADAR_SIZE;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.scene = scene;
    this.createHud(width, height);
  }

  private createHud(width: number, height: number): void {
    // Единый экранный контейнер для всех HUD-элементов
    this.hudContainer = this.scene.add.container(0, 0);
    this.hudContainer.setScrollFactor(0);
    this.hudContainer.setDepth(30);

    // 1. Графика зеленой голографической панели
    this.hudGraphics = this.scene.add.graphics();

    this.hpLabel = this.scene.add
      .text(0, 0, 'HP', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#6ee7b7',
        resolution: HUD_TEXT_RESOLUTION,
      });

    this.hpBg = this.scene.add.rectangle(0, 0, 140, 12, 0x031c14);
    this.hpBg.setStrokeStyle(1, 0x059669, 0.9);
    this.hpBg.setOrigin(0, 0.5);

    this.hpBarFill = this.scene.add.rectangle(0, 0, 140, 12, 0x10b981);
    this.hpBarFill.setOrigin(0, 0.5);

    this.hpText = this.scene.add
      .text(0, 0, '100%', {
        fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ecfdf5',
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0, 0.5);

    this.timerLabel = this.scene.add
      .text(0, 0, 'ВРЕМЯ БОЯ', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '10px',
        fontStyle: '600',
        color: '#6ee7b7',
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0.5);

    this.timerText = this.scene.add
      .text(0, 0, '00:00', {
        fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ecfdf5',
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0.5);

    // Блок целей — в едином синем стиле с этапом, без стикера 🎯
    this.killsLabel = this.scene.add
      .text(0, 0, 'ЦЕЛИ', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#7dd3fc',
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0.5);

    this.killsText = this.scene.add
      .text(0, 0, '0 / 20', {
        fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#f0f9ff',
        stroke: '#0c4a6e',
        strokeThickness: 2,
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0.5);

    this.scrapLabel = this.scene.add
      .text(0, 0, 'МЕТАЛЛОЛОМ // SCRAP', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '10px',
        fontStyle: '600',
        color: '#fde68a',
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0.5);

    this.scrapText = this.scene.add
      .text(0, 0, '0', {
        fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#fbbf24',
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0.5);

    // Надпись "Сектор х" скрыта по запросу пользователя, оставлено только название этапа
    this.phaseLabel = this.scene.add
      .text(0, 0, '', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#7dd3fc',
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    this.phaseText = this.scene.add
      .text(0, 0, 'ЭТАП 1-1', {
        fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#38bdf8',
        stroke: '#0c4a6e',
        strokeThickness: 2,
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0.5);

    // 1.2. Полоска здоровья босса миссии
    this.bossBarGraphics = this.scene.add.graphics();

    this.bossBarText = this.scene.add
      .text(0, 0, '', {
        fontFamily: "'Orbitron', 'Rajdhani', monospace",
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fef2f2',
        stroke: '#7f1d1d',
        strokeThickness: 2,
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    // 2. Тактический радар сектора (Мини-карта)
    this.radarContainer = this.scene.add.container(0, 0);

    this.radarBg = this.scene.add.rectangle(0, 0, RADAR_SIZE, RADAR_SIZE, 0x020c08, 0.85);
    this.radarBg.setStrokeStyle(1.5, 0x10b981);

    this.radarLabel = this.scene.add
      .text(-RADAR_SIZE / 2 + 6, -RADAR_SIZE / 2 - 14, 'ТАКТИЧЕСКИЙ РАДАР // СЕКТОР', {
        fontFamily: "'Rajdhani', monospace",
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#10b981',
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0, 0);

    this.coordsText = this.scene.add
      .text(-RADAR_SIZE / 2 + 6, RADAR_SIZE / 2 + 4, 'КООРД: 1800, 1800', {
        fontFamily: "'Rajdhani', monospace",
        fontSize: '10px',
        color: '#6ee7b7',
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0, 0);

    this.radarGraphics = this.scene.add.graphics();
    this.radarContainer.add([this.radarBg, this.radarGraphics, this.radarLabel, this.coordsText]);

    // Добавляем все элементы интерфейса в единый экранный контейнер
    this.hudContainer.add([
      this.hudGraphics,
      this.hpBg,
      this.hpBarFill,
      this.hpLabel,
      this.hpText,
      this.timerLabel,
      this.timerText,
      this.killsLabel,
      this.killsText,
      this.scrapLabel,
      this.scrapText,
      this.phaseLabel,
      this.phaseText,
      this.bossBarGraphics,
      this.bossBarText,
      this.radarContainer,
    ]);

    this.layoutHud(width);
    this.positionRadar(width, height);
    this.syncZoomTransform();
  }

  /**
   * Синхронизация масштаба и положения экранного HUD-контейнера относительно зума камеры.
   * Гарантирует, что верхняя панель всегда строго привязана к верхнему краю экрана (y = 0),
   * растянута на 100% ширины экрана, а шрифты отображаются в точном физическом разрешении.
   */
  public syncZoomTransform(): void {
    if (!this.hudContainer) return;
    const cam = this.scene.cameras.main;
    if (!cam) return;
    const z = cam.zoom || 1.0;
    const cx = cam.width * (cam.originX ?? 0.5);
    const cy = cam.height * (cam.originY ?? 0.5);

    this.hudContainer.setScale(1 / z);
    this.hudContainer.setPosition(cx - cx / z, cy - cy / z);
  }

  public layoutHud(width: number): void {
    const isPhone = isMobilePhone();
    const topBarHeight = isPhone ? 42 : 44;
    const isSmall = width < 850;
    const isVerySmall = width < 680;

    this.hudGraphics.clear();
    // Высококонтрастная плотная подложка для абсолютной четкости элементов верхней панели
    this.hudGraphics.fillStyle(0x020a07, 0.98);
    this.hudGraphics.fillRect(0, 0, width, topBarHeight);

    this.hudGraphics.lineStyle(1.5, 0x10b981, 1.0);
    this.hudGraphics.lineBetween(0, topBarHeight, width, topBarHeight);

    const padX = isPhone ? 8 : (isSmall ? 8 : 18);
    this.hudGraphics.lineStyle(1, 0x059669, 0.4);
    this.hudGraphics.strokeRect(padX - 4, isPhone ? 4 : 6, width - padX * 2 + 8, topBarHeight - (isPhone ? 8 : 12));

    // 1. Здоровье игрока (сдвинуто правее кнопки ESC для предотвращения наложения)
    const hpStartX = isPhone ? 88 : (isSmall ? 84 : 96);
    this.currentHpBarWidth = isPhone ? 70 : (isVerySmall ? 60 : (isSmall ? 78 : 130));
    this.currentHpBarHeight = isPhone ? 11 : 12;
    this.hpBg.setSize(this.currentHpBarWidth, this.currentHpBarHeight);

    this.hpLabel.setPosition(hpStartX, isPhone ? 6 : 8);
    this.hpLabel.setFontSize(isPhone ? '10px' : (isSmall ? '9px' : '11px'));
    this.hpLabel.setText(isPhone || isSmall ? 'HP' : 'ПРОЧНОСТЬ КОРАБЛЯ // HP');

    const barY = isPhone ? 25 : 28;
    this.hpBg.setPosition(hpStartX, barY);
    this.hpBarFill.setPosition(hpStartX, barY);
    this.hpText.setPosition(hpStartX + this.currentHpBarWidth + 6, barY);
    this.hpText.setFontSize(isPhone ? '12px' : (isSmall ? '10px' : '12px'));

    const hpRightEdge = hpStartX + this.currentHpBarWidth + (isPhone ? 40 : (isSmall ? 36 : 48));

    // 2. Текущий этап (справа) — надпись "Сектор х" убрана, название этапа отцентрировано
    const phaseBoxW = isPhone ? 88 : (isVerySmall ? 84 : (isSmall ? 98 : 138));
    const phaseBoxH = isPhone ? 32 : 34;
    const phaseX = width - padX - phaseBoxW / 2 - 2;
    const phaseBoxX = phaseX - phaseBoxW / 2;
    const phaseBoxY = isPhone ? 5 : 5;

    this.phaseLabel.setText('');
    this.phaseLabel.setVisible(false);
    this.phaseText.setPosition(phaseX, phaseBoxY + phaseBoxH / 2);
    this.phaseText.setFontSize(isPhone ? '15px' : (isSmall ? '13px' : '15px'));

    // Отрисовка синей плашки этапа
    this.hudGraphics.fillStyle(0x0c2438, 0.95);
    this.hudGraphics.fillRoundedRect(phaseBoxX, phaseBoxY, phaseBoxW, phaseBoxH, 4);
    this.hudGraphics.lineStyle(1.5, 0x38bdf8, 1);
    this.hudGraphics.strokeRoundedRect(phaseBoxX, phaseBoxY, phaseBoxW, phaseBoxH, 4);
    this.hudGraphics.lineStyle(2, 0x7dd3fc, 1);
    this.hudGraphics.lineBetween(phaseBoxX + 6, phaseBoxY + 1, phaseBoxX + phaseBoxW - 6, phaseBoxY + 1);

    // 3. Центральные элементы: Kills, Timer, Scrap
    const availableCenterLeft = hpRightEdge;
    const availableCenterRight = phaseBoxX;

    let centerX: number;
    let killsX: number;
    let scrapX: number;

    const killsBoxW = isPhone ? 84 : (isVerySmall ? 80 : (isSmall ? 96 : 124));
    const killsBoxH = isPhone ? 32 : 34;

    if (!isSmall && !isPhone) {
      centerX = width / 2;
      killsX = centerX - 140;
      scrapX = centerX + 140;
    } else {
      centerX = (availableCenterLeft + availableCenterRight) / 2;
      killsX = (availableCenterLeft + centerX) / 2;
      scrapX = (centerX + availableCenterRight) / 2;
    }

    const killsBoxX = killsX - killsBoxW / 2;
    const killsBoxY = isPhone ? 5 : 5;

    // Плашка целей — теперь оформлена в том же синем стиле, что и блок с этапом
    this.hudGraphics.fillStyle(0x0c2438, 0.95);
    this.hudGraphics.fillRoundedRect(killsBoxX, killsBoxY, killsBoxW, killsBoxH, 4);
    this.hudGraphics.lineStyle(1.5, 0x38bdf8, 1);
    this.hudGraphics.strokeRoundedRect(killsBoxX, killsBoxY, killsBoxW, killsBoxH, 4);
    this.hudGraphics.lineStyle(2, 0x7dd3fc, 1);
    this.hudGraphics.lineBetween(killsBoxX + 6, killsBoxY + 1, killsBoxX + killsBoxW - 6, killsBoxY + 1);

    // Таймер
    this.timerLabel.setPosition(centerX, isPhone ? 12 : 12);
    this.timerLabel.setFontSize(isPhone ? '10px' : (isSmall ? '9px' : '10px'));
    this.timerText.setPosition(centerX, isPhone ? 26 : 28);
    this.timerText.setFontSize(isPhone ? '16px' : (isSmall ? '13px' : '17px'));

    // Цели (стикер 🎯 убран)
    this.killsLabel.setPosition(killsX, isPhone ? 12 : 12);
    this.killsLabel.setFontSize(isPhone ? '10px' : (isSmall ? '9px' : '11px'));
    this.killsLabel.setColor('#7dd3fc');
    this.killsText.setPosition(killsX, isPhone ? 26 : 28);
    this.killsText.setFontSize(isPhone ? '15px' : (isSmall ? '12px' : '16px'));
    this.killsText.setColor('#f0f9ff');

    // Металлолом
    this.scrapLabel.setPosition(scrapX, isPhone ? 12 : 12);
    this.scrapLabel.setFontSize(isPhone ? '10px' : (isSmall ? '9px' : '10px'));
    this.scrapLabel.setText(isPhone || isSmall ? '⚙ МЕТАЛЛ' : 'МЕТАЛЛОЛОМ // SCRAP');
    this.scrapText.setPosition(scrapX, isPhone ? 26 : 28);
    this.scrapText.setFontSize(isPhone ? '15px' : (isSmall ? '12px' : '16px'));

    this.syncZoomTransform();
  }

  private positionRadar(width: number, height: number): void {
    const isPhone = isMobilePhone();
    const isCompact = width < 850 || height < 520;
    this.currentRadarSize = isPhone ? 115 : (isCompact ? 115 : (width < 1100 ? 140 : RADAR_SIZE));
    const size = this.currentRadarSize;

    if (this.radarBg) {
      this.radarBg.setSize(size, size);
    }
    if (this.radarLabel) {
      this.radarLabel.setPosition(-size / 2 + 4, -size / 2 - 12);
      this.radarLabel.setFontSize(isPhone ? '10px' : (isCompact ? '9px' : '10px'));
    }
    if (this.coordsText) {
      this.coordsText.setPosition(-size / 2 + 4, size / 2 + 3);
      this.coordsText.setFontSize(isPhone ? '10px' : (isCompact ? '9px' : '10px'));
    }

    const rx = width - size / 2 - (isPhone ? 12 : (isCompact ? 10 : 20));
    const topBarHeight = isPhone ? 42 : 44;
    const labelOffset = isPhone ? 12 : (isCompact ? 12 : 14);
    const topMargin = isPhone ? 10 : (isCompact ? 10 : 28);
    const preferredRy = topBarHeight + topMargin + labelOffset + size / 2;
    const ry = Math.min(preferredRy, Math.max(90, height - size / 2 - 12));
    if (this.radarContainer) {
      this.radarContainer.setPosition(rx, ry);
    }
    this.syncZoomTransform();
  }

  public handleResize(width: number, height: number): void {
    this.layoutHud(width);
    this.positionRadar(width, height);
    this.syncZoomTransform();
  }

  private isVisible = true;

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (this.hudContainer) {
      this.hudContainer.setVisible(visible);
    }
    if (this.bossBarText && !visible) {
      this.bossBarText.setVisible(false);
    }
  }

  public setMission(mission: CampaignMission): void {
    this.currentMission = mission;
    this.phaseLabel.setText('');
    this.phaseLabel.setVisible(false);
    this.phaseText.setText(mission.isBoss ? `БОСС ${mission.id}` : `ЭТАП ${mission.id}`);
    if (mission.isBoss) {
      this.timerLabel.setText('ДО ВХОДА БОССА');
      const spawnKills = mission.bossConfig?.spawnKills ?? (mission.targetKills ?? 20);
      this.killsLabel.setText('ДО БОССА');
      this.killsText.setText(`0 / ${spawnKills}`);
      this.killsText.setColor('#f0f9ff');
    } else {
      this.timerLabel.setText('ВРЕМЯ БОЯ');
      this.timerText.setText('00:00');
      const targetKills =
        mission.targetKills ??
        (15 + ((mission.sector - 1) * 5 + (mission.mission - 1)) * 5);
      this.killsLabel.setText('ЦЕЛИ');
      this.killsText.setText(`0 / ${targetKills}`);
      this.killsText.setColor('#f0f9ff');
    }
    if (this.bossBarGraphics) this.bossBarGraphics.clear();
    if (this.bossBarText) this.bossBarText.setVisible(false);
  }

  public update(
    playerHp: number,
    survivalTime: number,
    killsCount: number,
    _score: number,
    playerX: number,
    playerY: number,
    playerAngle: number,
    cam: Phaser.Cameras.Scene2D.Camera,
    enemies: EnemyShip[],
    _ignoredHolograms?: unknown,
    _currentPhase = 1,
    meteors: Meteor[] = [],
    stations: SpaceStation[] = [],
    targetedStation: SpaceStation | null = null,
    activeBoss: EnemyShip | null = null,
    scrapCount = 0,
    scrapItems: ScrapPickup[] = [],
  ): void {
    if (!this.isVisible) return;
    this.syncZoomTransform();

    // 1. Полоска прочности корабля
    const maxHp = this.playerMaxHp > 0 ? this.playerMaxHp : PLAYER_MAX_HP;
    const hpRatio = Phaser.Math.Clamp(playerHp / maxHp, 0, 1);
    this.hpBarFill.setSize(Math.max(0, this.currentHpBarWidth * hpRatio), this.currentHpBarHeight);

    if (hpRatio > 0.5) {
      this.hpBarFill.setFillStyle(0x10b981);
    } else if (hpRatio > 0.25) {
      this.hpBarFill.setFillStyle(0xf59e0b);
    } else {
      this.hpBarFill.setFillStyle(0xef4444);
    }
    this.hpText.setText(`${Math.ceil(hpRatio * 100)}%`);

    // 2. Таймер и индикация целей миссии кампании
    if (this.currentMission) {
      if (this.currentMission.isBoss) {
        if (activeBoss && activeBoss.hp > 0) {
          this.timerLabel.setText('ФЛАГМАН В СЕКТОРЕ');
          this.timerText.setText(this.formatTime(survivalTime));
          this.phaseLabel.setText('');
          this.phaseLabel.setVisible(false);
          this.phaseText.setText('БОСС ' + this.currentMission.id);
          this.killsLabel.setText('СБИТО ВРАГОВ');
          this.killsText.setText(`${killsCount}`);
          this.killsText.setColor('#38bdf8');
          this.renderBossBar(activeBoss);
        } else {
          const spawnDelay = this.currentMission.bossConfig?.spawnDelay ?? 60;
          const remainingToBoss = Math.max(0, spawnDelay - survivalTime);
          const spawnKills =
            this.currentMission.bossConfig?.spawnKills ?? (this.currentMission.targetKills ?? 20);
          this.timerLabel.setText('ДО ВХОДА БОССА');
          this.timerText.setText(this.formatTime(remainingToBoss));
          this.phaseLabel.setText('');
          this.phaseLabel.setVisible(false);
          this.phaseText.setText('БОСС ' + this.currentMission.id);
          this.killsLabel.setText('ДО БОССА');
          this.killsText.setText(`${killsCount} / ${spawnKills}`);
          this.killsText.setColor(killsCount >= spawnKills ? '#38bdf8' : '#f0f9ff');
          if (this.bossBarGraphics) this.bossBarGraphics.clear();
          if (this.bossBarText) this.bossBarText.setVisible(false);
        }
      } else {
        const targetKills =
          this.currentMission.targetKills ??
          (15 + ((this.currentMission.sector - 1) * 5 + (this.currentMission.mission - 1)) * 5);
        this.timerLabel.setText('ВРЕМЯ БОЯ');
        this.timerText.setText(this.formatTime(survivalTime));
        this.phaseLabel.setText('');
        this.phaseLabel.setVisible(false);
        this.phaseText.setText('ЭТАП ' + this.currentMission.id);
        this.killsLabel.setText('ЦЕЛИ');
        this.killsText.setText(`${killsCount} / ${targetKills}`);
        this.killsText.setColor(killsCount >= targetKills ? '#38bdf8' : '#f0f9ff');
        if (this.bossBarGraphics) this.bossBarGraphics.clear();
        if (this.bossBarText) this.bossBarText.setVisible(false);
      }
    } else {
      this.timerLabel.setText('ВРЕМЯ БОЯ');
      this.timerText.setText(this.formatTime(survivalTime));
      this.phaseLabel.setText('');
      this.phaseLabel.setVisible(false);
      this.phaseText.setText('ЭТАП 1-1');
      this.killsLabel.setText('ЦЕЛИ');
      this.killsText.setText(`${killsCount}`);
      this.killsText.setColor('#f0f9ff');
      if (this.bossBarGraphics) this.bossBarGraphics.clear();
      if (this.bossBarText) this.bossBarText.setVisible(false);
    }

    // 3. Металлолом
    this.scrapText.setText(`${scrapCount}`);

    // 4. Тактический радар
    this.updateRadar(playerX, playerY, playerAngle, cam, enemies, meteors, stations, targetedStation, scrapItems);
  }

  private renderBossBar(boss: EnemyShip): void {
    if (!this.bossBarGraphics || !this.bossBarText) return;
    const isPhone = isMobilePhone();
    const width = this.scene.scale.width;
    const topBarHeight = isPhone ? 42 : 44;
    const barY = topBarHeight + 6;
    const barHeight = isPhone ? 15 : 16;
    const bossRatio = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
    const barWidth = Math.min(isPhone ? 340 : 460, width - (isPhone ? 20 : 40));
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
    this.bossBarText.setFontSize('11px');
    this.bossBarText.setPosition(width / 2, barY + barHeight / 2);
    const percent = Math.ceil(bossRatio * 100);
    this.bossBarText.setText(
      `⚠ ${boss.bossName || 'БОСС'} // ПРОЧНОСТЬ: ${Math.ceil(boss.hp)} / ${boss.maxHp} (${percent}%)`,
    );
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
    scrapItems: ScrapPickup[] = [],
  ): void {
    this.radarGraphics.clear();
    const half = this.currentRadarSize / 2;
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

    // Отображение пояса туманностей границ сектора на радаре при приближении к краю карты
    const bMinX = 130;
    const bMaxX = MAP_WIDTH - 130;
    const bMinY = 130;
    const bMaxY = MAP_HEIGHT - 130;
    this.radarGraphics.lineStyle(2.4, 0xa855f7, 0.85);

    if (Math.abs(playerX - bMinX) <= scanRadius) {
      const rx = ((bMinX - playerX) / scanRadius) * radarRadius;
      this.radarGraphics.lineBetween(rx, -radarRadius, rx, radarRadius);
    }
    if (Math.abs(playerX - bMaxX) <= scanRadius) {
      const rx = ((bMaxX - playerX) / scanRadius) * radarRadius;
      this.radarGraphics.lineBetween(rx, -radarRadius, rx, radarRadius);
    }
    if (Math.abs(playerY - bMinY) <= scanRadius) {
      const ry = ((bMinY - playerY) / scanRadius) * radarRadius;
      this.radarGraphics.lineBetween(-radarRadius, ry, radarRadius, ry);
    }
    if (Math.abs(playerY - bMaxY) <= scanRadius) {
      const ry = ((bMaxY - playerY) / scanRadius) * radarRadius;
      this.radarGraphics.lineBetween(-radarRadius, ry, radarRadius, ry);
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
    if (this.hudContainer) {
      this.hudContainer.destroy(true);
    }
  }
}

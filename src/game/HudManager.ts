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
  private hpOverlayGraphics!: Phaser.GameObjects.Graphics;
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

    this.hpBg = this.scene.add.rectangle(0, 0, 140, 12, 0x021c14);
    this.hpBg.setStrokeStyle(1, 0x10b981, 0.85);
    this.hpBg.setOrigin(0, 0.5);

    this.hpBarFill = this.scene.add.rectangle(0, 0, 140, 12, 0x10b981);
    this.hpBarFill.setOrigin(0, 0.5);

    this.hpOverlayGraphics = this.scene.add.graphics();

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
        fontStyle: 'bold',
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
        stroke: '#022c22',
        strokeThickness: 2,
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0.5);

    // Блок целей — в единой зеленой голографической палитре
    this.killsLabel = this.scene.add
      .text(0, 0, 'ЦЕЛИ', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#6ee7b7',
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0.5);

    this.killsText = this.scene.add
      .text(0, 0, '0 / 20', {
        fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ecfdf5',
        stroke: '#022c22',
        strokeThickness: 2,
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0.5);

    this.scrapLabel = this.scene.add
      .text(0, 0, 'МЕТАЛЛОЛОМ // SCRAP', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '10px',
        fontStyle: 'bold',
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
        stroke: '#451a03',
        strokeThickness: 2,
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0.5);

    // Надпись "Сектор х" скрыта по запросу пользователя, оставлено только название этапа
    this.phaseLabel = this.scene.add
      .text(0, 0, '', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#6ee7b7',
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    this.phaseText = this.scene.add
      .text(0, 0, 'ЭТАП 1-1', {
        fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#6ee7b7',
        stroke: '#022c22',
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
      this.hpOverlayGraphics,
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

  private getTopBarHeight(): number {
    return isMobilePhone() ? 44 : 54;
  }

  /**
   * Отрисовка отдельного голографического модуля верхней панели со скошенными углами и уголками
   */
  private drawHoloPod(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    borderColor = 0x10b981,
    highlightColor = 0x6ee7b7,
    fillColor = 0x032218,
    chamfer = 6,
  ): void {
    const c = Math.min(chamfer, w * 0.2, h * 0.35);
    const pts = [
      new Phaser.Math.Vector2(x + c, y),
      new Phaser.Math.Vector2(x + w, y),
      new Phaser.Math.Vector2(x + w, y + h - c),
      new Phaser.Math.Vector2(x + w - c, y + h),
      new Phaser.Math.Vector2(x, y + h),
      new Phaser.Math.Vector2(x, y + c),
    ];

    // Мягкое внешнее голографическое свечение
    g.lineStyle(3.5, borderColor, 0.14);
    g.strokePoints(pts, true);

    // Основная полупрозрачная изумрудная подложка
    g.fillStyle(fillColor, 0.92);
    g.fillPoints(pts, true);

    // Внутренний верхний блик голограммы
    g.fillStyle(borderColor, 0.08);
    g.fillRect(x + c, y + 1, Math.max(0, w - c - 2), Math.max(2, h * 0.32));

    // Контур модуля
    g.lineStyle(1.3, borderColor, 0.85);
    g.strokePoints(pts, true);

    // Акцентная верхняя грань
    g.lineStyle(2, highlightColor, 0.92);
    g.lineBetween(x + c + 4, y + 1, x + w - 4, y + 1);

    // Тактические уголки (corner brackets)
    const br = 5;
    g.lineStyle(1.5, highlightColor, 0.95);
    // Правый верхний угол
    g.lineBetween(x + w - br, y + 1, x + w - 1, y + 1);
    g.lineBetween(x + w - 1, y + 1, x + w - 1, y + br);
    // Левый нижний угол
    g.lineBetween(x + 1, y + h - br, x + 1, y + h - 1);
    g.lineBetween(x + 1, y + h - 1, x + br, y + h - 1);
  }

  public layoutHud(width: number): void {
    const isPhone = isMobilePhone();
    const topBarHeight = this.getTopBarHeight();
    const isSmall = width < 850;
    const isVerySmall = width < 680;

    this.hudGraphics.clear();

    // 1. Общая подложка верхней голографической панели + сканлайны
    this.hudGraphics.fillStyle(0x02120c, 0.92);
    this.hudGraphics.fillRect(0, 0, width, topBarHeight);

    // Верхняя мягкая изумрудная полоса свечения
    this.hudGraphics.fillStyle(0x064e3b, 0.22);
    this.hudGraphics.fillRect(0, 0, width, Math.floor(topBarHeight * 0.45));

    // Тонкие горизонтальные голографические scanlines
    this.hudGraphics.lineStyle(1, 0x10b981, 0.055);
    for (let sy = 4; sy < topBarHeight - 2; sy += 4) {
      this.hudGraphics.lineBetween(0, sy, width, sy);
    }

    // Верхняя тонкая линия и нижний неоновый кант с мягким свечением
    this.hudGraphics.lineStyle(1, 0x34d399, 0.32);
    this.hudGraphics.lineBetween(0, 1, width, 1);

    this.hudGraphics.lineStyle(4, 0x10b981, 0.16);
    this.hudGraphics.lineBetween(0, topBarHeight, width, topBarHeight);
    this.hudGraphics.lineStyle(1.6, 0x34d399, 0.92);
    this.hudGraphics.lineBetween(0, topBarHeight, width, topBarHeight);

    const padX = isPhone ? 8 : (isSmall ? 10 : 16);
    const podY = isPhone ? 5 : 6;
    const podH = topBarHeight - podY * 2;

    // 2. Модуль прочности корабля (HP), правее кнопки [ESC]
    const hpStartX = isPhone ? 78 : (isSmall ? 84 : 96);
    const hpPodX = hpStartX - 7;
    this.currentHpBarWidth = isPhone ? 64 : (isVerySmall ? 60 : (isSmall ? 78 : 138));
    this.currentHpBarHeight = isPhone ? 10 : 12;
    const hpPercentGap = isPhone ? 40 : (isSmall ? 36 : 48);
    const hpPodW = (hpStartX - hpPodX) + this.currentHpBarWidth + hpPercentGap;

    this.drawHoloPod(this.hudGraphics, hpPodX, podY, hpPodW, podH, 0x10b981, 0x6ee7b7, 0x032218, isPhone ? 4 : 6);
    this.hpBg.setSize(this.currentHpBarWidth, this.currentHpBarHeight);

    this.hpLabel.setPosition(hpStartX, podY + (isPhone ? 5 : 6));
    this.hpLabel.setFontSize(isPhone ? '9px' : (isSmall ? '9px' : '10px'));
    this.hpLabel.setText(isPhone || isSmall ? 'HP' : 'ПРОЧНОСТЬ // HP');

    const barY = podY + podH - (isPhone ? 10 : 12);
    this.hpBg.setPosition(hpStartX, barY);
    this.hpBarFill.setPosition(hpStartX, barY);
    this.hpText.setPosition(hpStartX + this.currentHpBarWidth + 6, barY);
    this.hpText.setFontSize(isPhone ? '11px' : (isSmall ? '10px' : '12px'));

    // Сегментные засечки и стеклянный блик поверх полосы HP
    this.hpOverlayGraphics.clear();
    this.hpOverlayGraphics.fillStyle(0xffffff, 0.14);
    this.hpOverlayGraphics.fillRect(
      hpStartX + 1,
      barY - this.currentHpBarHeight / 2 + 1,
      Math.max(0, this.currentHpBarWidth - 2),
      2,
    );
    this.hpOverlayGraphics.lineStyle(1, 0x02120c, 0.65);
    const segments = isPhone ? 5 : 8;
    for (let i = 1; i < segments; i++) {
      const sx = hpStartX + (this.currentHpBarWidth * i) / segments;
      this.hpOverlayGraphics.lineBetween(
        sx,
        barY - this.currentHpBarHeight / 2,
        sx,
        barY + this.currentHpBarHeight / 2,
      );
    }

    const hpRightEdge = hpPodX + hpPodW;

    // 3. Правый модуль: Текущий этап / Босс
    const phaseBoxW = isPhone ? 88 : (isVerySmall ? 84 : (isSmall ? 98 : 134));
    const phaseBoxX = width - padX - phaseBoxW;
    const phaseX = phaseBoxX + phaseBoxW / 2;

    this.phaseLabel.setText('');
    this.phaseLabel.setVisible(false);
    this.phaseText.setPosition(phaseX, podY + podH / 2);
    this.phaseText.setFontSize(isPhone ? '14px' : (isSmall ? '13px' : '15px'));
    this.phaseText.setColor('#6ee7b7');

    this.drawHoloPod(this.hudGraphics, phaseBoxX, podY, phaseBoxW, podH, 0x34d399, 0xa7f3d0, 0x042b1e, isPhone ? 4 : 6);

    // 4. Центральные модули: Цели, Время боя, Металлолом
    const availableCenterLeft = hpRightEdge + (isPhone ? 6 : 10);
    const availableCenterRight = phaseBoxX - (isPhone ? 6 : 10);
    const availableSpan = Math.max(180, availableCenterRight - availableCenterLeft);

    const useCenteredDesktop = !isSmall && !isPhone && width >= 1080;
    const killsBoxW = useCenteredDesktop ? 126 : Math.floor(Math.min(110, availableSpan * 0.31));
    const timerBoxW = useCenteredDesktop ? 142 : Math.floor(Math.min(126, availableSpan * 0.34));
    const scrapBoxW = useCenteredDesktop ? 132 : Math.floor(Math.min(116, availableSpan * 0.31));

    const centerX = useCenteredDesktop ? width / 2 : availableCenterLeft + availableSpan * 0.5;
    const killsX = useCenteredDesktop ? centerX - 152 : availableCenterLeft + availableSpan * 0.165;
    const scrapX = useCenteredDesktop ? centerX + 152 : availableCenterLeft + availableSpan * 0.835;

    // Плашка целей
    this.drawHoloPod(
      this.hudGraphics,
      killsX - killsBoxW / 2,
      podY,
      killsBoxW,
      podH,
      0x10b981,
      0x6ee7b7,
      0x032218,
      isPhone ? 4 : 6,
    );

    // Центральная плашка таймера (главный тактический блок)
    this.drawHoloPod(
      this.hudGraphics,
      centerX - timerBoxW / 2,
      podY - (isPhone ? 0 : 1),
      timerBoxW,
      podH + (isPhone ? 0 : 2),
      0x34d399,
      0xa7f3d0,
      0x042b1e,
      isPhone ? 5 : 7,
    );

    // Плашка металлолома (изумрудная база с золотым верхним акцентом)
    this.drawHoloPod(
      this.hudGraphics,
      scrapX - scrapBoxW / 2,
      podY,
      scrapBoxW,
      podH,
      0x10b981,
      0xfbbf24,
      0x032218,
      isPhone ? 4 : 6,
    );

    const labelY = podY + (isPhone ? 9 : 11);
    const valueY = podY + podH - (isPhone ? 10 : 12);

    // Таймер
    this.timerLabel.setPosition(centerX, labelY);
    this.timerLabel.setFontSize(isPhone ? '9px' : (isSmall ? '9px' : '10px'));
    this.timerLabel.setColor('#6ee7b7');
    this.timerText.setPosition(centerX, valueY);
    this.timerText.setFontSize(isPhone ? '15px' : (isSmall ? '13px' : '17px'));

    // Цели
    this.killsLabel.setPosition(killsX, labelY);
    this.killsLabel.setFontSize(isPhone ? '9px' : (isSmall ? '9px' : '10.5px'));
    this.killsLabel.setColor('#6ee7b7');
    this.killsText.setPosition(killsX, valueY);
    this.killsText.setFontSize(isPhone ? '14px' : (isSmall ? '12px' : '16px'));
    this.killsText.setColor('#ecfdf5');

    // Металлолом
    this.scrapLabel.setPosition(scrapX, labelY);
    this.scrapLabel.setFontSize(isPhone ? '9px' : (isSmall ? '9px' : '10px'));
    this.scrapLabel.setText(isPhone || isSmall ? '⚙ МЕТАЛЛ' : 'МЕТАЛЛОЛОМ');
    this.scrapText.setPosition(scrapX, valueY);
    this.scrapText.setFontSize(isPhone ? '14px' : (isSmall ? '12px' : '16px'));

    // Декоративные соединительные линии между модулями на широком экране
    if (useCenteredDesktop) {
      this.hudGraphics.lineStyle(1, 0x10b981, 0.35);
      const midY = podY + podH / 2;
      this.hudGraphics.lineBetween(hpRightEdge + 3, midY, killsX - killsBoxW / 2 - 3, midY);
      this.hudGraphics.lineBetween(killsX + killsBoxW / 2 + 3, midY, centerX - timerBoxW / 2 - 3, midY);
      this.hudGraphics.lineBetween(centerX + timerBoxW / 2 + 3, midY, scrapX - scrapBoxW / 2 - 3, midY);
      this.hudGraphics.lineBetween(scrapX + scrapBoxW / 2 + 3, midY, phaseBoxX - 3, midY);
    }

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
    const topBarHeight = this.getTopBarHeight();
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
      this.killsText.setColor('#ecfdf5');
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
          this.killsText.setColor('#34d399');
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
          this.killsText.setColor(killsCount >= spawnKills ? '#34d399' : '#ecfdf5');
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
        this.killsText.setColor(killsCount >= targetKills ? '#34d399' : '#ecfdf5');
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
      this.killsText.setColor('#ecfdf5');
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
    const topBarHeight = this.getTopBarHeight();
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

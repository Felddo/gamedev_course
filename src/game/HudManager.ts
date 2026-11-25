import Phaser from 'phaser';
import { PLAYER_MAX_HP, MAP_WIDTH, MAP_HEIGHT } from './constants';
import { EnemyShip, Meteor, SpaceStation, ScrapPickup } from './types';
import { CampaignMission } from './campaign/types';
import { isMobilePhone, getGameDpr } from './deviceUtils';

const RADAR_SIZE = 170;
const RADAR_SCAN_RADIUS = 1500;

// Высокое разрешение для рендеринга текста в текстуры WebGL
const HUD_TEXT_RESOLUTION = Math.max(3, Math.min(6, Math.ceil((window.devicePixelRatio || 1) * 2)));

/**
 * Менеджер пользовательского интерфейса (HUD):
 * верхняя голографическая панель, индикатор босса миссии и тактический радар сектора.
 * Отрисовывается в выделенной статичной сцене HudScene (zoom = 1, scroll = 0, без shake),
 * что гарантирует абсолютную неподвижность и четкость шрифтов и цифр.
 */
export class HudManager {
  private scene: Phaser.Scene | null = null;
  private currentMission: CampaignMission | null = null;
  public playerMaxHp: number = PLAYER_MAX_HP;

  private lastWidth: number;
  private lastHeight: number;
  private isVisible = true;
  private pendingLayoutRaf: number | null = null;

  // Элементы верхней панели
  private hudContainer: Phaser.GameObjects.Container | null = null;
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
  private currentHpBarWidth = 140;
  private currentHpBarHeight = 12;
  private currentRadarSize = RADAR_SIZE;

  // Кэш значений текста/стилей для предотвращения лишних перерисовок текстур каждый кадр
  private textCache = new Map<Phaser.GameObjects.Text, string>();
  private lastHpFillColor = -1;
  private lastHpFillWidth = -1;
  private lastKillsColor = '';

  constructor(width: number, height: number) {
    this.lastWidth = width;
    this.lastHeight = height;
  }

  private getLogicalWidth(): number {
    if (!this.scene) return this.lastWidth;
    const dpr = getGameDpr();
    return (this.scene.scale.width || this.lastWidth * dpr) / dpr;
  }

  private getLogicalHeight(): number {
    if (!this.scene) return this.lastHeight;
    const dpr = getGameDpr();
    return (this.scene.scale.height || this.lastHeight * dpr) / dpr;
  }

  /**
   * Подключение менеджера к выделенной сцене HudScene и создание всех элементов HUD.
   */
  public attachScene(scene: Phaser.Scene): void {
    if (this.hudContainer) {
      this.hudContainer.destroy(true);
      this.hudContainer = null;
      this.textCache.clear();
    }

    this.scene = scene;
    const width = this.getLogicalWidth();
    const height = this.getLogicalHeight();
    this.lastWidth = width;
    this.lastHeight = height;

    this.createHud(width, height);
    this.setVisible(this.isVisible);
    if (this.currentMission) {
      this.applyMissionUi(this.currentMission);
    }
  }

  private setTextCached(target: Phaser.GameObjects.Text | undefined, value: string): void {
    if (!target) return;
    if (this.textCache.get(target) === value) return;
    this.textCache.set(target, value);
    target.setText(value);
  }

  private createHud(width: number, height: number): void {
    if (!this.scene) return;

    this.hudContainer = this.scene.add.container(0, 0);
    this.hudContainer.setDepth(30);

    // 1. Графика зеленой голографической панели
    this.hudGraphics = this.scene.add.graphics();

    this.hpLabel = this.scene.add.text(0, 0, 'HP', {
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

    // Моноширинный шрифт (JetBrains Mono) для цифр предотвращает скачки ширины при изменении значений
    this.hpText = this.scene.add
      .text(0, 0, '100%', {
        fontFamily: "'JetBrains Mono', monospace",
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
        fontFamily: "'JetBrains Mono', monospace",
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
        fontFamily: "'JetBrains Mono', monospace",
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
        fontFamily: "'JetBrains Mono', monospace",
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
        fontFamily: "'JetBrains Mono', 'Orbitron', monospace",
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
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '9.5px',
        color: '#6ee7b7',
        resolution: HUD_TEXT_RESOLUTION,
      })
      .setOrigin(0, 0);

    this.radarGraphics = this.scene.add.graphics();
    this.radarContainer.add([this.radarBg, this.radarGraphics, this.radarLabel, this.coordsText]);

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
  }

  /**
   * Метод сохранен для обратной совместимости вызовов из GameScene.
   * В отдельной сцене HudScene камера всегда имеет масштаб 1.0 и нулевой скролл.
   */
  public syncZoomTransform(): void {
    // Статичная сцена HudScene не нуждается в компенсации зума или скролла.
  }

  private getTopBarHeight(): number {
    return isMobilePhone() ? 44 : 54;
  }

  /**
   * Измеряет правую границу DOM-кнопки паузы (#btn-top-esc), учитывая safe-area-inset-left
   * (вырез/Dynamic Island на iPhone и вырезы на Android), чтобы полоса HP никогда не заходила под кнопку.
   */
  private getPauseButtonRightEdge(isPhone: boolean, isSmall: boolean): number {
    const fallback = isPhone ? 46 : (isSmall ? 76 : 86);
    if (typeof document === 'undefined') return fallback;

    const btn = document.getElementById('btn-top-esc');
    if (!btn) return fallback;

    const rect = btn.getBoundingClientRect();
    if (rect.width > 0 && rect.right > 0) {
      return Math.ceil(rect.right);
    }
    return fallback;
  }

  private getSafeAreaRight(): number {
    if (typeof document === 'undefined' || !window.getComputedStyle) return 0;
    const raw = window.getComputedStyle(document.documentElement).getPropertyValue('--safe-area-right');
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : 0;
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
    const ix = Math.round(x);
    const iy = Math.round(y);
    const iw = Math.round(w);
    const ih = Math.round(h);
    const c = Math.round(Math.min(chamfer, iw * 0.2, ih * 0.35));
    const pts = [
      new Phaser.Math.Vector2(ix + c, iy),
      new Phaser.Math.Vector2(ix + iw, iy),
      new Phaser.Math.Vector2(ix + iw, iy + ih - c),
      new Phaser.Math.Vector2(ix + iw - c, iy + ih),
      new Phaser.Math.Vector2(ix, iy + ih),
      new Phaser.Math.Vector2(ix, iy + c),
    ];

    // Мягкое внешнее голографическое свечение
    g.lineStyle(3.5, borderColor, 0.14);
    g.strokePoints(pts, true);

    // Основная полупрозрачная изумрудная подложка
    g.fillStyle(fillColor, 0.92);
    g.fillPoints(pts, true);

    // Внутренний верхний блик голограммы
    g.fillStyle(borderColor, 0.08);
    g.fillRect(ix + c, iy + 1, Math.max(0, iw - c - 2), Math.max(2, Math.round(ih * 0.32)));

    // Контур модуля
    g.lineStyle(1.3, borderColor, 0.85);
    g.strokePoints(pts, true);

    // Акцентная верхняя грань
    g.lineStyle(2, highlightColor, 0.92);
    g.lineBetween(ix + c + 4, iy + 1, ix + iw - 4, iy + 1);

    // Тактические уголки (corner brackets)
    const br = 5;
    g.lineStyle(1.5, highlightColor, 0.95);
    // Правый верхний угол
    g.lineBetween(ix + iw - br, iy + 1, ix + iw - 1, iy + 1);
    g.lineBetween(ix + iw - 1, iy + 1, ix + iw - 1, iy + br);
    // Левый нижний угол
    g.lineBetween(ix + 1, iy + ih - br, ix + 1, iy + ih - 1);
    g.lineBetween(ix + 1, iy + ih - 1, ix + br, iy + ih - 1);
  }

  public layoutHud(width: number): void {
    this.lastWidth = width;
    if (!this.hudContainer) return;

    const isPhone = isMobilePhone();
    const topBarHeight = this.getTopBarHeight();
    const isSmall = width < 850;
    const isVerySmall = width < 680;

    this.hudGraphics.clear();

    // 1. Общая подложка верхней голографической панели + сканлайны
    const barSpanWidth = Math.ceil(width);
    this.hudGraphics.fillStyle(0x02120c, 0.92);
    this.hudGraphics.fillRect(0, 0, barSpanWidth, topBarHeight);

    // Верхняя мягкая изумрудная полоса свечения
    this.hudGraphics.fillStyle(0x064e3b, 0.22);
    this.hudGraphics.fillRect(0, 0, barSpanWidth, Math.floor(topBarHeight * 0.45));

    // Тонкие горизонтальные голографические scanlines
    this.hudGraphics.lineStyle(1, 0x10b981, 0.055);
    for (let sy = 4; sy < topBarHeight - 2; sy += 4) {
      this.hudGraphics.lineBetween(0, sy, barSpanWidth, sy);
    }

    // Верхняя тонкая линия и нижний неоновый кант с мягким свечением
    this.hudGraphics.lineStyle(1, 0x34d399, 0.32);
    this.hudGraphics.lineBetween(0, 1, barSpanWidth, 1);

    this.hudGraphics.lineStyle(4, 0x10b981, 0.16);
    this.hudGraphics.lineBetween(0, topBarHeight, barSpanWidth, topBarHeight);
    this.hudGraphics.lineStyle(1.6, 0x34d399, 0.92);
    this.hudGraphics.lineBetween(0, topBarHeight, barSpanWidth, topBarHeight);

    const padX = isPhone ? 8 : (isSmall ? 10 : 16);
    const rightSafe = this.getSafeAreaRight();
    const rightPad = Math.max(padX, rightSafe > 0 ? rightSafe + 4 : padX);
    const podY = isPhone ? 5 : 6;
    const podH = topBarHeight - podY * 2;

    // 2. Модуль прочности корабля (HP), строго правее кнопки паузы (с учетом safe-area-inset-left)
    const escRightEdge = this.getPauseButtonRightEdge(isPhone, isSmall);
    const hpPodX = Math.max(padX, escRightEdge + (isPhone ? 6 : 8));
    const hpStartX = hpPodX + 7;
    this.currentHpBarWidth = isPhone ? 58 : (isVerySmall ? 60 : (isSmall ? 78 : 138));
    this.currentHpBarHeight = isPhone ? 10 : 12;
    const hpPercentGap = isPhone ? 40 : (isSmall ? 36 : 48);
    const hpPodW = (hpStartX - hpPodX) + this.currentHpBarWidth + hpPercentGap;

    this.drawHoloPod(this.hudGraphics, hpPodX, podY, hpPodW, podH, 0x10b981, 0x6ee7b7, 0x032218, isPhone ? 4 : 6);
    this.hpBg.setSize(this.currentHpBarWidth, this.currentHpBarHeight);

    this.hpLabel.setPosition(hpStartX, podY + (isPhone ? 4 : 6));
    this.hpLabel.setFontSize(isPhone ? '9px' : (isSmall ? '9px' : '10px'));
    this.setTextCached(this.hpLabel, isPhone || isSmall ? 'HP' : 'ПРОЧНОСТЬ // HP');

    const barY = Math.round(podY + podH - (isPhone ? 10 : 12));
    this.hpBg.setPosition(hpStartX, barY);
    this.hpBarFill.setPosition(hpStartX, barY);
    this.hpText.setPosition(hpStartX + this.currentHpBarWidth + 5, barY);
    this.hpText.setFontSize(isPhone ? '11px' : (isSmall ? '10px' : '12px'));

    // Сегментные засечки и стеклянный блик поверх полосы HP
    this.hpOverlayGraphics.clear();
    this.hpOverlayGraphics.fillStyle(0xffffff, 0.14);
    this.hpOverlayGraphics.fillRect(
      hpStartX + 1,
      Math.round(barY - this.currentHpBarHeight / 2 + 1),
      Math.max(0, this.currentHpBarWidth - 2),
      2,
    );
    this.hpOverlayGraphics.lineStyle(1, 0x02120c, 0.65);
    const segments = isPhone ? 5 : 8;
    for (let i = 1; i < segments; i++) {
      const sx = Math.round(hpStartX + (this.currentHpBarWidth * i) / segments);
      this.hpOverlayGraphics.lineBetween(
        sx,
        Math.round(barY - this.currentHpBarHeight / 2),
        sx,
        Math.round(barY + this.currentHpBarHeight / 2),
      );
    }

    const hpRightEdge = hpPodX + hpPodW;

    // 3. Правый модуль: Текущий этап / Босс (с учетом safe-area-inset-right)
    const phaseBoxW = isPhone ? 84 : (isVerySmall ? 84 : (isSmall ? 98 : 134));
    const phaseBoxX = Math.round(width - rightPad - phaseBoxW);
    const phaseX = Math.round(phaseBoxX + phaseBoxW / 2);

    this.setTextCached(this.phaseLabel, '');
    this.phaseLabel.setVisible(false);
    this.phaseText.setPosition(phaseX, Math.round(podY + podH / 2));
    this.phaseText.setFontSize(isPhone ? '13px' : (isSmall ? '13px' : '15px'));
    this.phaseText.setColor('#6ee7b7');

    this.drawHoloPod(this.hudGraphics, phaseBoxX, podY, phaseBoxW, podH, 0x34d399, 0xa7f3d0, 0x042b1e, isPhone ? 4 : 6);

    // 4. Центральные модули: Цели, Время боя, Металлолом
    const centerGap = isPhone ? 5 : 10;
    const availableCenterLeft = hpRightEdge + centerGap;
    const availableCenterRight = phaseBoxX - centerGap;
    const availableSpan = Math.max(120, availableCenterRight - availableCenterLeft);

    const useCenteredDesktop = !isSmall && !isPhone && width >= 1080 && availableCenterLeft < width / 2 - 225;
    const killsBoxW = useCenteredDesktop ? 126 : Math.floor(Math.min(110, availableSpan * 0.31));
    const timerBoxW = useCenteredDesktop ? 142 : Math.floor(Math.min(126, availableSpan * 0.34));
    const scrapBoxW = useCenteredDesktop ? 132 : Math.floor(Math.min(116, availableSpan * 0.31));

    const centerX = Math.round(useCenteredDesktop ? width / 2 : availableCenterLeft + availableSpan * 0.5);
    const killsX = Math.round(useCenteredDesktop ? centerX - 152 : availableCenterLeft + availableSpan * 0.165);
    const scrapX = Math.round(useCenteredDesktop ? centerX + 152 : availableCenterLeft + availableSpan * 0.835);

    // Плашка целей
    this.drawHoloPod(
      this.hudGraphics,
      Math.round(killsX - killsBoxW / 2),
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
      Math.round(centerX - timerBoxW / 2),
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
      Math.round(scrapX - scrapBoxW / 2),
      podY,
      scrapBoxW,
      podH,
      0x10b981,
      0xfbbf24,
      0x032218,
      isPhone ? 4 : 6,
    );

    const labelY = Math.round(podY + (isPhone ? 9 : 11));
    const valueY = Math.round(podY + podH - (isPhone ? 10 : 12));

    // Таймер
    this.timerLabel.setPosition(centerX, labelY);
    this.timerLabel.setFontSize(isPhone ? '8.5px' : (isSmall ? '9px' : '10px'));
    this.timerLabel.setColor('#6ee7b7');
    this.timerText.setPosition(centerX, valueY);
    this.timerText.setFontSize(isPhone ? '14px' : (isSmall ? '13px' : '16px'));

    // Цели
    this.killsLabel.setPosition(killsX, labelY);
    this.killsLabel.setFontSize(isPhone ? '8.5px' : (isSmall ? '9px' : '10.5px'));
    this.killsLabel.setColor('#6ee7b7');
    this.killsText.setPosition(killsX, valueY);
    this.killsText.setFontSize(isPhone ? '13px' : (isSmall ? '12px' : '15px'));
    this.killsText.setColor('#ecfdf5');
    this.lastKillsColor = '#ecfdf5';

    // Металлолом
    this.scrapLabel.setPosition(scrapX, labelY);
    this.scrapLabel.setFontSize(isPhone ? '8.5px' : (isSmall ? '9px' : '10px'));
    this.setTextCached(this.scrapLabel, isPhone || isSmall ? '⚙ МЕТАЛЛ' : 'МЕТАЛЛОЛОМ');
    this.scrapText.setPosition(scrapX, valueY);
    this.scrapText.setFontSize(isPhone ? '13px' : (isSmall ? '12px' : '15px'));

    // Декоративные соединительные линии между модулями на широком экране
    if (useCenteredDesktop) {
      this.hudGraphics.lineStyle(1, 0x10b981, 0.35);
      const midY = Math.round(podY + podH / 2);
      this.hudGraphics.lineBetween(hpRightEdge + 3, midY, Math.round(killsX - killsBoxW / 2 - 3), midY);
      this.hudGraphics.lineBetween(Math.round(killsX + killsBoxW / 2 + 3), midY, Math.round(centerX - timerBoxW / 2 - 3), midY);
      this.hudGraphics.lineBetween(Math.round(centerX + timerBoxW / 2 + 3), midY, Math.round(scrapX - scrapBoxW / 2 - 3), midY);
      this.hudGraphics.lineBetween(Math.round(scrapX + scrapBoxW / 2 + 3), midY, phaseBoxX - 3, midY);
    }
  }

  private positionRadar(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    if (!this.radarContainer) return;

    const isPhone = isMobilePhone();
    const isCompact = width < 850 || height < 520;
    this.currentRadarSize = isPhone ? 115 : (isCompact ? 115 : (width < 1100 ? 140 : RADAR_SIZE));
    const size = this.currentRadarSize;

    if (this.radarBg) {
      this.radarBg.setSize(size, size);
    }
    if (this.radarLabel) {
      this.radarLabel.setPosition(Math.round(-size / 2 + 4), Math.round(-size / 2 - 12));
      this.radarLabel.setFontSize(isPhone ? '10px' : (isCompact ? '9px' : '10px'));
    }
    if (this.coordsText) {
      this.coordsText.setPosition(Math.round(-size / 2 + 4), Math.round(size / 2 + 3));
      this.coordsText.setFontSize(isPhone ? '9px' : (isCompact ? '8.5px' : '9.5px'));
    }

    const rightSafe = this.getSafeAreaRight();
    const rxMargin = Math.max(isPhone ? 12 : (isCompact ? 10 : 20), rightSafe > 0 ? rightSafe + 6 : 0);
    const rx = Math.round(width - size / 2 - rxMargin);
    const topBarHeight = this.getTopBarHeight();
    const labelOffset = isPhone ? 12 : (isCompact ? 12 : 14);
    const topMargin = isPhone ? 10 : (isCompact ? 10 : 28);
    const preferredRy = topBarHeight + topMargin + labelOffset + size / 2;
    const ry = Math.round(Math.min(preferredRy, Math.max(90, height - size / 2 - 12)));
    this.radarContainer.setPosition(rx, ry);
  }

  public handleResize(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.layoutHud(width);
    this.positionRadar(width, height);
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (this.hudContainer) {
      this.hudContainer.setVisible(visible);
    }
    if (this.bossBarText && !visible) {
      this.bossBarText.setVisible(false);
    }
    if (visible && this.hudContainer) {
      // Пересчет отступа после отображения DOM-кнопки паузы (#btn-top-esc)
      if (this.pendingLayoutRaf !== null) {
        window.cancelAnimationFrame(this.pendingLayoutRaf);
      }
      this.pendingLayoutRaf = window.requestAnimationFrame(() => {
        this.pendingLayoutRaf = null;
        if (this.hudContainer && this.scene) {
          this.layoutHud(this.getLogicalWidth());
          this.positionRadar(this.getLogicalWidth(), this.getLogicalHeight());
        }
      });
    }
  }

  private applyMissionUi(mission: CampaignMission): void {
    if (!this.hudContainer) return;

    this.setTextCached(this.phaseLabel, '');
    this.phaseLabel.setVisible(false);
    this.setTextCached(this.phaseText, mission.isBoss ? `БОСС ${mission.id}` : `ЭТАП ${mission.id}`);
    if (mission.isBoss) {
      this.setTextCached(this.timerLabel, 'ДО ВХОДА БОССА');
      const spawnKills = mission.bossConfig?.spawnKills ?? (mission.targetKills ?? 20);
      this.setTextCached(this.killsLabel, 'ДО БОССА');
      this.setTextCached(this.killsText, `0 / ${spawnKills}`);
      if (this.lastKillsColor !== '#f0f9ff') {
        this.killsText.setColor('#f0f9ff');
        this.lastKillsColor = '#f0f9ff';
      }
    } else {
      this.setTextCached(this.timerLabel, 'ВРЕМЯ БОЯ');
      this.setTextCached(this.timerText, '00:00');
      const targetKills =
        mission.targetKills ??
        (15 + ((mission.sector - 1) * 5 + (mission.mission - 1)) * 5);
      this.setTextCached(this.killsLabel, 'ЦЕЛИ');
      this.setTextCached(this.killsText, `0 / ${targetKills}`);
      if (this.lastKillsColor !== '#ecfdf5') {
        this.killsText.setColor('#ecfdf5');
        this.lastKillsColor = '#ecfdf5';
      }
    }
    if (this.bossBarGraphics) this.bossBarGraphics.clear();
    if (this.bossBarText) this.bossBarText.setVisible(false);
  }

  public setMission(mission: CampaignMission): void {
    this.currentMission = mission;
    this.applyMissionUi(mission);
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
    if (!this.isVisible || !this.hudContainer) return;

    // 1. Полоска прочности корабля
    const maxHp = this.playerMaxHp > 0 ? this.playerMaxHp : PLAYER_MAX_HP;
    const hpRatio = Phaser.Math.Clamp(playerHp / maxHp, 0, 1);
    const fillWidth = Math.max(0, Math.round(this.currentHpBarWidth * hpRatio));
    if (fillWidth !== this.lastHpFillWidth) {
      this.lastHpFillWidth = fillWidth;
      this.hpBarFill.setSize(fillWidth, this.currentHpBarHeight);
    }

    const hpColor = hpRatio > 0.5 ? 0x10b981 : hpRatio > 0.25 ? 0xf59e0b : 0xef4444;
    if (hpColor !== this.lastHpFillColor) {
      this.lastHpFillColor = hpColor;
      this.hpBarFill.setFillStyle(hpColor);
    }
    this.setTextCached(this.hpText, `${Math.ceil(hpRatio * 100)}%`);

    // 2. Таймер и индикация целей миссии кампании
    if (this.currentMission) {
      if (this.currentMission.isBoss) {
        if (activeBoss && activeBoss.hp > 0) {
          this.setTextCached(this.timerLabel, 'ФЛАГМАН В СЕКТОРЕ');
          this.setTextCached(this.timerText, this.formatTime(survivalTime));
          this.setTextCached(this.phaseLabel, '');
          this.phaseLabel.setVisible(false);
          this.setTextCached(this.phaseText, 'БОСС ' + this.currentMission.id);
          this.setTextCached(this.killsLabel, 'СБИТО ВРАГОВ');
          this.setTextCached(this.killsText, `${killsCount}`);
          if (this.lastKillsColor !== '#34d399') {
            this.killsText.setColor('#34d399');
            this.lastKillsColor = '#34d399';
          }
          this.renderBossBar(activeBoss);
        } else {
          const spawnDelay = this.currentMission.bossConfig?.spawnDelay ?? 60;
          const remainingToBoss = Math.max(0, spawnDelay - survivalTime);
          const spawnKills =
            this.currentMission.bossConfig?.spawnKills ?? (this.currentMission.targetKills ?? 20);
          this.setTextCached(this.timerLabel, 'ДО ВХОДА БОССА');
          this.setTextCached(this.timerText, this.formatTime(remainingToBoss));
          this.setTextCached(this.phaseLabel, '');
          this.phaseLabel.setVisible(false);
          this.setTextCached(this.phaseText, 'БОСС ' + this.currentMission.id);
          this.setTextCached(this.killsLabel, 'ДО БОССА');
          this.setTextCached(this.killsText, `${killsCount} / ${spawnKills}`);
          const nextColor = killsCount >= spawnKills ? '#34d399' : '#ecfdf5';
          if (this.lastKillsColor !== nextColor) {
            this.killsText.setColor(nextColor);
            this.lastKillsColor = nextColor;
          }
          if (this.bossBarGraphics) this.bossBarGraphics.clear();
          if (this.bossBarText) this.bossBarText.setVisible(false);
        }
      } else {
        const targetKills =
          this.currentMission.targetKills ??
          (15 + ((this.currentMission.sector - 1) * 5 + (this.currentMission.mission - 1)) * 5);
        this.setTextCached(this.timerLabel, 'ВРЕМЯ БОЯ');
        this.setTextCached(this.timerText, this.formatTime(survivalTime));
        this.setTextCached(this.phaseLabel, '');
        this.phaseLabel.setVisible(false);
        this.setTextCached(this.phaseText, 'ЭТАП ' + this.currentMission.id);
        this.setTextCached(this.killsLabel, 'ЦЕЛИ');
        this.setTextCached(this.killsText, `${killsCount} / ${targetKills}`);
        const nextColor = killsCount >= targetKills ? '#34d399' : '#ecfdf5';
        if (this.lastKillsColor !== nextColor) {
          this.killsText.setColor(nextColor);
          this.lastKillsColor = nextColor;
        }
        if (this.bossBarGraphics) this.bossBarGraphics.clear();
        if (this.bossBarText) this.bossBarText.setVisible(false);
      }
    } else {
      this.setTextCached(this.timerLabel, 'ВРЕМЯ БОЯ');
      this.setTextCached(this.timerText, this.formatTime(survivalTime));
      this.setTextCached(this.phaseLabel, '');
      this.phaseLabel.setVisible(false);
      this.setTextCached(this.phaseText, 'ЭТАП 1-1');
      this.setTextCached(this.killsLabel, 'ЦЕЛИ');
      this.setTextCached(this.killsText, `${killsCount}`);
      if (this.lastKillsColor !== '#ecfdf5') {
        this.killsText.setColor('#ecfdf5');
        this.lastKillsColor = '#ecfdf5';
      }
      if (this.bossBarGraphics) this.bossBarGraphics.clear();
      if (this.bossBarText) this.bossBarText.setVisible(false);
    }

    // 3. Металлолом
    this.setTextCached(this.scrapText, `${scrapCount}`);

    // 4. Тактический радар
    this.updateRadar(playerX, playerY, playerAngle, cam, enemies, meteors, stations, targetedStation, scrapItems);
  }

  private renderBossBar(boss: EnemyShip): void {
    if (!this.bossBarGraphics || !this.bossBarText || !this.scene) return;
    const isPhone = isMobilePhone();
    const width = this.getLogicalWidth();
    const topBarHeight = this.getTopBarHeight();
    const barY = topBarHeight + 6;
    const barHeight = isPhone ? 15 : 16;
    const bossRatio = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
    const barWidth = Math.round(Math.min(isPhone ? 340 : 460, width - (isPhone ? 20 : 40)));
    const barX = Math.round((width - barWidth) / 2);

    this.bossBarGraphics.clear();
    // Подложка
    this.bossBarGraphics.fillStyle(0x1a0606, 0.92);
    this.bossBarGraphics.fillRect(barX, barY, barWidth, barHeight);
    this.bossBarGraphics.lineStyle(1.5, 0xef4444, 0.95);
    this.bossBarGraphics.strokeRect(barX, barY, barWidth, barHeight);

    // Заполнение красным градиентом
    const fillWidth = Math.round((barWidth - 2) * bossRatio);
    if (fillWidth > 0) {
      this.bossBarGraphics.fillStyle(0xdc2626, 0.95);
      this.bossBarGraphics.fillRect(barX + 1, barY + 1, fillWidth, barHeight - 2);
      this.bossBarGraphics.fillStyle(0xf87171, 0.55);
      this.bossBarGraphics.fillRect(barX + 1, barY + 1, fillWidth, 2);
    }

    this.bossBarText.setVisible(this.isVisible);
    this.bossBarText.setFontSize('11px');
    this.bossBarText.setPosition(Math.round(width / 2), Math.round(barY + barHeight / 2));
    const percent = Math.ceil(bossRatio * 100);
    this.setTextCached(
      this.bossBarText,
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

    this.setTextCached(
      this.coordsText,
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
    if (this.pendingLayoutRaf !== null) {
      window.cancelAnimationFrame(this.pendingLayoutRaf);
      this.pendingLayoutRaf = null;
    }
    if (this.hudContainer) {
      this.hudContainer.destroy(true);
      this.hudContainer = null;
    }
    this.textCache.clear();
    this.scene = null;
  }
}

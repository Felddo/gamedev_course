import Phaser from 'phaser';
import { PLAYER_MAX_HP } from './constants';
import { EnemyShip, Meteor, SpaceStation, ScrapPickup } from './types';
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
      .text(0, 0, 'ВРЕМЯ БОЯ', {
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
      .text(0, 0, 'ЦЕЛИ', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '10px',
        fontStyle: '600',
        color: '#6ee7b7',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(32);

    this.killsText = this.scene.add
      .text(0, 0, '0 / 20', {
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
      .text(0, 0, 'СЕКТОР 1', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '10px',
        fontStyle: '600',
        color: '#6ee7b7',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(32);

    this.phaseText = this.scene.add
      .text(0, 0, 'МИССИЯ 1-1', {
        fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#34d399',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(32);

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
      const spawnKills = mission.bossConfig?.spawnKills ?? (mission.targetKills ?? 20);
      this.killsLabel.setText('ДО БОССА');
      this.killsText.setText(`0 / ${spawnKills}`);
    } else {
      this.timerLabel.setText('ВРЕМЯ БОЯ');
      this.timerText.setText('00:00');
      const targetKills = mission.targetKills ?? 25;
      this.killsLabel.setText('ЦЕЛИ');
      this.killsText.setText(`0 / ${targetKills}`);
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

    // 2. Таймер и индикация целей миссии кампании
    if (this.currentMission) {
      if (this.currentMission.isBoss) {
        if (activeBoss && activeBoss.hp > 0) {
          this.timerLabel.setText('ФЛАГМАН В СЕКТОРЕ');
          this.timerText.setText(this.formatTime(survivalTime));
          this.phaseLabel.setText('СЕКТОР ' + this.currentMission.sector);
          this.phaseText.setText('БОСС ' + this.currentMission.id);
          this.killsLabel.setText('СБИТО ВРАГОВ');
          this.killsText.setText(`${killsCount}`);
          this.renderBossBar(activeBoss);
        } else {
          const spawnDelay = this.currentMission.bossConfig?.spawnDelay ?? 60;
          const remainingToBoss = Math.max(0, spawnDelay - survivalTime);
          const spawnKills =
            this.currentMission.bossConfig?.spawnKills ?? (this.currentMission.targetKills ?? 20);
          this.timerLabel.setText('ДО ВХОДА БОССА');
          this.timerText.setText(this.formatTime(remainingToBoss));
          this.phaseLabel.setText('СЕКТОР ' + this.currentMission.sector);
          this.phaseText.setText('МИССИЯ ' + this.currentMission.id + ' [БОСС]');
          this.killsLabel.setText('ДО БОССА');
          this.killsText.setText(`${killsCount} / ${spawnKills}`);
          if (this.bossBarGraphics) this.bossBarGraphics.clear();
          if (this.bossBarText) this.bossBarText.setVisible(false);
        }
      } else {
        const targetKills = this.currentMission.targetKills ?? 25;
        this.timerLabel.setText('ВРЕМЯ БОЯ');
        this.timerText.setText(this.formatTime(survivalTime));
        this.phaseLabel.setText('СЕКТОР ' + this.currentMission.sector);
        this.phaseText.setText('МИССИЯ ' + this.currentMission.id);
        this.killsLabel.setText('ЦЕЛИ');
        this.killsText.setText(`${killsCount} / ${targetKills}`);
        if (this.bossBarGraphics) this.bossBarGraphics.clear();
        if (this.bossBarText) this.bossBarText.setVisible(false);
      }
    } else {
      this.timerLabel.setText('ВРЕМЯ БОЯ');
      this.timerText.setText(this.formatTime(survivalTime));
      this.phaseLabel.setText('СЕКТОР 1');
      this.phaseText.setText('МИССИЯ 1-1');
      this.killsLabel.setText('ЦЕЛИ');
      this.killsText.setText(`${killsCount}`);
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
    const width = this.scene.scale.width;
    const barY = 50;
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
    this.bossBarGraphics.destroy();
    this.bossBarText.destroy();
    this.radarContainer.destroy();
  }
}

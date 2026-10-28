import Phaser from 'phaser';
import { PLAYER_MAX_HP } from './constants';
import { EnemyShip, Meteor, SpaceStation } from './types';

/**
 * Менеджер пользовательского интерфейса (HUD):
 * верхняя голографическая панель и тактический радар сектора
 */
export class HudManager {
  private scene: Phaser.Scene;

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
  private scoreLabel!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private phaseLabel!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;

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

    this.scoreLabel = this.scene.add
      .text(0, 0, 'БОЕВОЙ СЧЕТ', {
        fontFamily: "'Rajdhani', -apple-system, sans-serif",
        fontSize: '10px',
        fontStyle: '600',
        color: '#6ee7b7',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(32);

    this.scoreText = this.scene.add
      .text(0, 0, '0', {
        fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#34d399',
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
    const radarSize = 136;
    const rx = width - radarSize / 2 - 18;
    const ry = height - radarSize / 2 - 18;

    this.radarContainer = this.scene.add.container(rx, ry);
    this.radarContainer.setScrollFactor(0);
    this.radarContainer.setDepth(30);

    this.radarBg = this.scene.add.rectangle(0, 0, radarSize, radarSize, 0x020c08, 0.85);
    this.radarBg.setStrokeStyle(1.5, 0x10b981);

    this.radarLabel = this.scene.add
      .text(-radarSize / 2 + 6, -radarSize / 2 - 14, 'ТАКТИЧЕСКИЙ РАДАР // СЕКТОР', {
        fontFamily: "'Rajdhani', monospace",
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#10b981',
      })
      .setOrigin(0, 0);

    this.coordsText = this.scene.add
      .text(-radarSize / 2 + 6, radarSize / 2 + 4, 'КООРД: 1800, 1800', {
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

    this.hpLabel.setPosition(padX + 4, 8);
    this.hpBg.setPosition(padX + 4, 28);
    this.hpBarFill.setPosition(padX + 4, 28);
    this.hpText.setPosition(padX + 152, 28);

    const centerX = width / 2;
    this.timerLabel.setPosition(centerX, 12);
    this.timerText.setPosition(centerX, 28);

    const killsX = centerX - 140;
    this.killsLabel.setPosition(killsX, 12);
    this.killsText.setPosition(killsX, 28);

    const scoreX = centerX + 140;
    this.scoreLabel.setPosition(scoreX, 12);
    this.scoreText.setPosition(scoreX, 28);

    const phaseX = width - padX - 80;
    this.phaseLabel.setPosition(phaseX, 12);
    this.phaseText.setPosition(phaseX, 28);
  }

  public handleResize(width: number, height: number): void {
    this.layoutHud(width);
    const radarSize = 136;
    const rx = width - radarSize / 2 - 18;
    const ry = height - radarSize / 2 - 18;
    this.radarContainer.setPosition(rx, ry);
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
    this.scoreLabel.setVisible(visible);
    this.scoreText.setVisible(visible);
    this.phaseLabel.setVisible(visible);
    this.phaseText.setVisible(visible);
    this.radarContainer.setVisible(visible);
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
  ): void {
    if (!this.isVisible) return;

    // 1. Полоска прочности корабля
    const hpRatio = Phaser.Math.Clamp(playerHp / PLAYER_MAX_HP, 0, 1);
    this.hpBarFill.width = 140 * hpRatio;

    if (hpRatio > 0.5) {
      this.hpBarFill.setFillStyle(0x10b981);
    } else if (hpRatio > 0.25) {
      this.hpBarFill.setFillStyle(0xf59e0b);
    } else {
      this.hpBarFill.setFillStyle(0xef4444);
    }
    this.hpText.setText(`${Math.ceil(hpRatio * 100)}%`);

    // 2. Таймер выживания
    this.timerText.setText(this.formatTime(survivalTime));

    // 3. Счет и фаза
    this.killsText.setText(`${killsCount}`);
    this.scoreText.setText(`${score}`);
    this.phaseText.setText(`ФАЗА ${currentPhase}`);

    // 4. Тактический радар
    this.updateRadar(playerX, playerY, playerAngle, cam, enemies, meteors, stations);
  }

  private updateRadar(
    playerX: number,
    playerY: number,
    playerAngle: number,
    cam: Phaser.Cameras.Scene2D.Camera,
    enemies: EnemyShip[],
    meteors: Meteor[] = [],
    stations: SpaceStation[] = [],
  ): void {
    this.radarGraphics.clear();
    const radarSize = 136;
    const half = radarSize / 2;
    const radarRadius = half - 5;
    const scanRadius = 1500;

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
    this.radarGraphics.fillStyle(0x38bdf8, 1.0);
    this.radarGraphics.lineStyle(1.5, 0x818cf8, 0.9);
    for (const station of stations) {
      const dx = station.sprite.x - playerX;
      const dy = station.sprite.y - playerY;
      const dist = Math.hypot(dx, dy);
      if (dist <= scanRadius) {
        const sx = (dx / scanRadius) * radarRadius;
        const sy = (dy / scanRadius) * radarRadius;
        this.radarGraphics.strokeCircle(sx, sy, 4.5);
        this.radarGraphics.fillCircle(sx, sy, 2.5);
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
    this.scoreLabel.destroy();
    this.scoreText.destroy();
    this.phaseLabel.destroy();
    this.phaseText.destroy();
    this.radarContainer.destroy();
  }
}

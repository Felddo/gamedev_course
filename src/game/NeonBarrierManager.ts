import Phaser from 'phaser';
import { MAP_WIDTH, MAP_HEIGHT } from './constants';
import { PlayerShip } from './PlayerShip';
import { EnemyShip } from './types';
import { ParticleManager } from './ParticleManager';
import { soundFx } from './audio';

/**
 * Менеджер неонового периметра карты с предупреждающими надписями STOP:
 * - Заменяет пояс астероидов стильным голографическим лазерным барьером сектора
 * - На всех 4 краях карты натянуты неоновые светящиеся линии с надписями STOP
 * - Корабль игрока и вражеские суда не могут вылететь за пределы барьера
 * - Метеориты свободно пролетают сквозь барьер в обоих направлениях
 */
export class NeonBarrierManager {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private labelsContainer: Phaser.GameObjects.Container;
  private stopLabels: Phaser.GameObjects.Text[] = [];
  private cornerPylons: Phaser.GameObjects.Arc[] = [];

  // Границы безопасного сектора
  public readonly minX = 75;
  public readonly maxX = MAP_WIDTH - 75;
  public readonly minY = 75;
  public readonly maxY = MAP_HEIGHT - 75;

  private animTimer = 0;
  private contactCooldown = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = this.scene.add.graphics();
    this.graphics.setDepth(6);

    this.labelsContainer = this.scene.add.container(0, 0);
    this.labelsContainer.setDepth(6.1);

    this.createNeonBorder();
  }

  /**
   * Инициализация неонового лазерного барьера и текста STOP
   */
  private createNeonBorder(): void {
    const minX = this.minX;
    const maxX = this.maxX;
    const minY = this.minY;
    const maxY = this.maxY;

    // 1. Угловые лазерные пилоны-излучатели
    const corners = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];

    for (const c of corners) {
      // Внешний неоновый ореол пилона
      const pylonGlow = this.scene.add.circle(c.x, c.y, 14, 0xef4444, 0.45);
      pylonGlow.setDepth(6.2);
      this.cornerPylons.push(pylonGlow);

      // Яркое ядро излучателя
      const pylonCore = this.scene.add.circle(c.x, c.y, 6, 0xffffff, 0.95);
      pylonCore.setStrokeStyle(2, 0xff2a5f, 1);
      pylonCore.setDepth(6.3);
      this.cornerPylons.push(pylonCore);
    }

    // 2. Генерация повторяющихся неоновых надписей STOP вдоль 4 краев
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "'Rajdhani', 'Orbitron', monospace",
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ff2a5f',
      stroke: '#450a0a',
      strokeThickness: 3,
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: '#ef4444',
        blur: 10,
        stroke: true,
        fill: true,
      },
    };

    const step = 220; // Шаг размещения надписи STOP

    // Верхняя граница (горизонтальная)
    for (let x = minX + 110; x <= maxX - 110; x += step) {
      const text = this.scene.add.text(x, minY - 1, '⛔ STOP', textStyle);
      text.setOrigin(0.5, 0.5);
      this.stopLabels.push(text);
      this.labelsContainer.add(text);
    }

    // Нижняя граница (горизонтальная)
    for (let x = minX + 110; x <= maxX - 110; x += step) {
      const text = this.scene.add.text(x, maxY + 1, '⛔ STOP', textStyle);
      text.setOrigin(0.5, 0.5);
      this.stopLabels.push(text);
      this.labelsContainer.add(text);
    }

    // Левая граница (вертикальная, повернута на -90 градусов)
    for (let y = minY + 110; y <= maxY - 110; y += step) {
      const text = this.scene.add.text(minX - 1, y, '⛔ STOP', textStyle);
      text.setOrigin(0.5, 0.5);
      text.setRotation(-Math.PI / 2);
      this.stopLabels.push(text);
      this.labelsContainer.add(text);
    }

    // Правая граница (вертикальная, повернута на 90 градусов)
    for (let y = minY + 110; y <= maxY - 110; y += step) {
      const text = this.scene.add.text(maxX + 1, y, '⛔ STOP', textStyle);
      text.setOrigin(0.5, 0.5);
      text.setRotation(Math.PI / 2);
      this.stopLabels.push(text);
      this.labelsContainer.add(text);
    }
  }

  /**
   * Обновление неонового свечения, анимации лазера и проверка удержания объектов внутри карты
   */
  public update(seconds: number): void {
    this.animTimer += seconds;
    if (this.contactCooldown > 0) {
      this.contactCooldown -= seconds;
    }

    // Пульсирующая яркость неонового контура
    const pulse = Math.sin(this.animTimer * 4.2);
    const alphaBase = 0.8 + pulse * 0.18;
    const isFlicker = Math.random() < 0.02; // Легкое реалистичное мерцание неоновых ламп
    const currentAlpha = isFlicker ? 0.45 : alphaBase;

    // Отрисовка многослойных светящихся неоновых линий периметра
    this.graphics.clear();

    const minX = this.minX;
    const maxX = this.maxX;
    const minY = this.minY;
    const maxY = this.maxY;

    // Внешний диффузный неоновый ореол
    this.graphics.lineStyle(12, 0xef4444, currentAlpha * 0.28);
    this.graphics.strokeRect(minX, minY, maxX - minX, maxY - minY);

    // Средний неоновый лазерный контур
    this.graphics.lineStyle(5, 0xff1744, currentAlpha * 0.65);
    this.graphics.strokeRect(minX, minY, maxX - minX, maxY - minY);

    // Яркое центральное ядро лазера
    this.graphics.lineStyle(2, 0xffa4b3, currentAlpha * 0.95);
    this.graphics.strokeRect(minX, minY, maxX - minX, maxY - minY);

    // Ослепительная тонкая внутренняя нить
    this.graphics.lineStyle(1, 0xffffff, currentAlpha);
    this.graphics.strokeRect(minX, minY, maxX - minX, maxY - minY);

    // Анимация прозрачности надписей STOP
    this.labelsContainer.setAlpha(currentAlpha);
  }

  /**
   * Удержание корабля игрока внутри барьера сектора
   */
  public clampPlayer(player: PlayerShip, particleManager?: ParticleManager): void {
    const margin = 26;
    let hitBarrier = false;

    if (player.shipSprite.x < this.minX + margin) {
      player.shipSprite.x = this.minX + margin;
      hitBarrier = true;
    } else if (player.shipSprite.x > this.maxX - margin) {
      player.shipSprite.x = this.maxX - margin;
      hitBarrier = true;
    }

    if (player.shipSprite.y < this.minY + margin) {
      player.shipSprite.y = this.minY + margin;
      hitBarrier = true;
    } else if (player.shipSprite.y > this.maxY - margin) {
      player.shipSprite.y = this.maxY - margin;
      hitBarrier = true;
    }

    if (hitBarrier && this.contactCooldown <= 0) {
      this.contactCooldown = 0.25;
      soundFx.playHit();
      if (particleManager) {
        particleManager.spawnHitSparks(player.shipSprite.x, player.shipSprite.y);
      }
    }
  }

  /**
   * Удержание вражеских кораблей внутри барьера сектора
   */
  public clampEnemy(enemy: EnemyShip): void {
    const margin = enemy.radius || 24;
    enemy.sprite.x = Phaser.Math.Clamp(enemy.sprite.x, this.minX + margin, this.maxX - margin);
    enemy.sprite.y = Phaser.Math.Clamp(enemy.sprite.y, this.minY + margin, this.maxY - margin);
  }

  public destroy(): void {
    this.graphics.destroy();
    for (const p of this.cornerPylons) {
      p.destroy();
    }
    this.cornerPylons = [];
    for (const l of this.stopLabels) {
      l.destroy();
    }
    this.stopLabels = [];
    this.labelsContainer.destroy();
  }
}

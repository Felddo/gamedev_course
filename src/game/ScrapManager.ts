import Phaser from 'phaser';
import { soundFx } from './audio';
import { ParticleManager } from './ParticleManager';
import { ScrapPickup } from './types';

/**
 * Менеджер единственной валюты «Металлолом» (Scrap Metal):
 * - Выпадение янтарных металлических фрагментов металлолома из уничтоженных врагов
 * - Магнитный захват и притягивание металлолома к кораблю игрока при сближении
 * - Звуковая и визуальная обратная связь при сборе
 * - Автосбор оставшегося на карте металлолома при победе в миссии
 */
export class ScrapManager {
  private scene: Phaser.Scene;
  private items: ScrapPickup[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public getItems(): ScrapPickup[] {
    return this.items;
  }

  /**
   * Спавн металлических фрагментов металлолома в координатах гибели вражеского судна
   */
  public spawnScrap(x: number, y: number, totalAmount: number): void {
    if (totalAmount <= 0) return;

    // Разбиваем общее количество на 1-4 визуальных фрагмента для динамики боя
    let pieceCount = 1;
    if (totalAmount >= 30) {
      pieceCount = 4;
    } else if (totalAmount >= 10) {
      pieceCount = 3;
    } else if (totalAmount >= 5) {
      pieceCount = 2;
    }

    const basePieceValue = Math.floor(totalAmount / pieceCount);
    let remainder = totalAmount % pieceCount;

    for (let i = 0; i < pieceCount; i++) {
      const pieceValue = basePieceValue + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;

      const offsetX = Phaser.Math.Between(-12, 12);
      const offsetY = Phaser.Math.Between(-12, 12);

      const sprite = this.scene.add.sprite(x + offsetX, y + offsetY, 'scrap_metal_icon');
      sprite.setOrigin(0.5, 0.5);
      sprite.setDepth(15);
      sprite.setBlendMode(Phaser.BlendModes.ADD);

      // Масштаб зависит от номинала фрагмента
      let baseScale = 0.85;
      if (pieceValue >= 20) baseScale = 1.25;
      else if (pieceValue >= 7) baseScale = 1.05;

      sprite.setScale(baseScale);

      // Стартовый импульс разлета металлолома при взрыве
      const burstAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const burstSpeed = Phaser.Math.Between(45, 120);
      const vx = Math.cos(burstAngle) * burstSpeed;
      const vy = Math.sin(burstAngle) * burstSpeed;

      this.items.push({
        sprite,
        x: x + offsetX,
        y: y + offsetY,
        vx,
        vy,
        value: pieceValue,
        isMagnetized: false,
        rotationSpeed: Phaser.Math.FloatBetween(-2.8, 2.8),
        pulseTimer: Phaser.Math.FloatBetween(0, Math.PI * 2),
        baseScale,
      });
    }

    // Защита от переполнения пула объектов на карте
    if (this.items.length > 200) {
      const removed = this.items.splice(0, this.items.length - 200);
      for (const oldItem of removed) {
        oldItem.sprite.destroy();
      }
    }
  }

  /**
   * Обновление состояния металлолома: разлет, вращение, притяжение к кораблю и сбор
   */
  public update(
    seconds: number,
    playerX: number,
    playerY: number,
    onCollect: (value: number) => void,
    particleManager?: ParticleManager,
  ): void {
    const MAGNET_RADIUS = 160;
    const COLLECT_RADIUS = 30;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];

      // 1. Плавное затухание импульса разлета
      if (Math.abs(item.vx) > 0.1 || Math.abs(item.vy) > 0.1) {
        const drag = Math.pow(0.08, seconds);
        item.vx *= drag;
        item.vy *= drag;
        item.x += item.vx * seconds;
        item.y += item.vy * seconds;
      }

      // 2. Металлическое мерцание и вращение
      item.pulseTimer += seconds;
      item.sprite.rotation += item.rotationSpeed * seconds;
      const pulse = 1.0 + Math.sin(item.pulseTimer * 4.2) * 0.12;
      item.sprite.setScale(item.baseScale * pulse);
      item.sprite.setAlpha(0.88 + Math.sin(item.pulseTimer * 3.2) * 0.12);

      // 3. Дистанция до корабля игрока
      const dx = playerX - item.x;
      const dy = playerY - item.y;
      const dist = Math.hypot(dx, dy);

      // 4. Магнитное притягивание к кораблю игрока
      if (dist <= MAGNET_RADIUS || item.isMagnetized) {
        item.isMagnetized = true;

        const pullSpeed = Math.min(1100, Math.max(480, 960 - dist * 1.5));
        const step = pullSpeed * seconds;

        if (dist > 0.001) {
          item.x += (dx / dist) * step;
          item.y += (dy / dist) * step;
        }

        // Золотистый шлейф металлической звездной пыли при притяжении
        if (particleManager && Math.random() < 0.22) {
          particleManager.spawnScrapTrailSpark(item.x, item.y);
        }
      }

      item.sprite.setPosition(item.x, item.y);

      // 5. Момент подбора металлолома кораблем
      if (dist <= COLLECT_RADIUS) {
        soundFx.playScrapPickup();
        if (particleManager) {
          particleManager.spawnScrapPickup(item.x, item.y, item.value);
        }
        onCollect(item.value);

        item.sprite.destroy();
        this.items.splice(i, 1);
      }
    }
  }

  /**
   * Автоматический сбор всех оставшихся на карте фрагментов при победе в миссии,
   * чтобы добыча игрока не терялась перед показом экрана победы.
   */
  public collectAll(_playerX: number, _playerY: number, onCollect: (value: number) => void): void {
    for (const item of this.items) {
      onCollect(item.value);
      item.sprite.destroy();
    }
    this.items = [];
  }

  public reset(): void {
    for (const item of this.items) {
      item.sprite.destroy();
    }
    this.items = [];
  }

  public destroy(): void {
    this.reset();
  }
}

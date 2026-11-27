import Phaser from 'phaser';
import { MAP_WIDTH, MAP_HEIGHT } from './constants';
import { PlayerShip } from './PlayerShip';
import { EnemyShip } from './types';
import { ParticleManager } from './ParticleManager';
import { soundFx } from './audio';

interface NebulaGasMist {
  sprite: Phaser.GameObjects.Arc;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseAlpha: number;
  pulseSpeed: number;
  pulseTimer: number;
}

/**
 * Менеджер границы сектора из космических туманностей:
 * - Заменяет красные лазерные линии стильным плотным поясом космических туманностей
 * - Плотные клубящиеся газовые облака и ионизированная плазма по всему периметру карты
 * - Корабль игрока и вражеские корабли не могут пролететь сквозь плотную материю туманности
 * - Астероиды и метеориты беспрепятственно пролетают сквозь туманности в обоих направлениях
 */
export class NeonBarrierManager {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private nebulaSprites: Phaser.GameObjects.Image[] = [];
  private gasMists: NebulaGasMist[] = [];

  // Границы безопасного сектора (внутри пояса туманностей)
  public readonly minX = 130;
  public readonly maxX = MAP_WIDTH - 130;
  public readonly minY = 130;
  public readonly maxY = MAP_HEIGHT - 130;

  private animTimer = 0;
  private contactCooldown = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = this.scene.add.graphics();
    this.graphics.setDepth(5);

    this.ensureNebulaTextures();
    this.createNebulaBorder();
  }

  /**
   * Генерация процедурных текстур для плотных пограничных облаков туманности
   */
  private ensureNebulaTextures(): void {
    const size = 512;

    // 1. Фиолетово-пурпурное облако плотной туманности
    if (!this.scene.textures.exists('nebula_border_cloud_violet')) {
      const canvas = this.scene.textures.createCanvas('nebula_border_cloud_violet', size, size);
      if (canvas) {
        const ctx = canvas.context;
        const grad = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(168, 85, 247, 0.42)');
        grad.addColorStop(0.3, 'rgba(126, 34, 206, 0.32)');
        grad.addColorStop(0.65, 'rgba(76, 29, 149, 0.18)');
        grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }

    // 2. Лазурно-бирюзовое облако ионизированного газа
    if (!this.scene.textures.exists('nebula_border_cloud_cyan')) {
      const canvas = this.scene.textures.createCanvas('nebula_border_cloud_cyan', size, size);
      if (canvas) {
        const ctx = canvas.context;
        const grad = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(6, 182, 212, 0.38)');
        grad.addColorStop(0.35, 'rgba(14, 116, 144, 0.28)');
        grad.addColorStop(0.7, 'rgba(8, 51, 68, 0.15)');
        grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }

    // 3. Темное плотное облако космической материи
    if (!this.scene.textures.exists('nebula_border_cloud_dark')) {
      const canvas = this.scene.textures.createCanvas('nebula_border_cloud_dark', size, size);
      if (canvas) {
        const ctx = canvas.context;
        const grad = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(88, 28, 135, 0.48)');
        grad.addColorStop(0.4, 'rgba(59, 7, 100, 0.35)');
        grad.addColorStop(0.75, 'rgba(30, 27, 75, 0.18)');
        grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }
  }

  /**
   * Инициализация пояса плотных туманностей по периметру космической карты
   */
  private createNebulaBorder(): void {
    const minX = this.minX;
    const maxX = this.maxX;
    const minY = this.minY;
    const maxY = this.maxY;

    const textures = [
      'nebula_border_cloud_violet',
      'nebula_border_cloud_cyan',
      'nebula_border_cloud_dark',
    ];

    const step = 460; // Оптимальный шаг размещения облаков туманности (меньше overdraw)

    // Вспомогательная функция спавна облака туманности
    const spawnCloud = (x: number, y: number, baseScale = 2.4, baseAlpha = 0.55) => {
      const tex = Phaser.Utils.Array.GetRandom(textures);
      const cloud = this.scene.add.image(x, y, tex);
      const scale = baseScale * Phaser.Math.FloatBetween(0.9, 1.2);
      const alpha = baseAlpha * Phaser.Math.FloatBetween(0.85, 1.15);
      cloud.setScale(scale);
      cloud.setAlpha(alpha);
      cloud.setDepth(6);
      cloud.setBlendMode(Phaser.BlendModes.ADD);
      cloud.setVisible(false);

      this.nebulaSprites.push(cloud);
    };

    // 1. Верхний пояс туманности
    for (let x = -100; x <= MAP_WIDTH + 100; x += step) {
      spawnCloud(x, minY - 65, 2.7, 0.72);
    }

    // 2. Нижний пояс туманности
    for (let x = -100; x <= MAP_WIDTH + 100; x += step) {
      spawnCloud(x, maxY + 65, 2.7, 0.72);
    }

    // 3. Левый пояс туманности
    for (let y = -100; y <= MAP_HEIGHT + 100; y += step) {
      spawnCloud(minX - 65, y, 2.7, 0.72);
    }

    // 4. Правый пояс туманности
    for (let y = -100; y <= MAP_HEIGHT + 100; y += step) {
      spawnCloud(maxX + 65, y, 2.7, 0.72);
    }

    // 5. Плотные скопления в 4 углах карты
    const corners = [
      { x: minX - 60, y: minY - 60 },
      { x: maxX + 60, y: minY - 60 },
      { x: maxX + 60, y: maxY + 60 },
      { x: minX - 60, y: maxY + 60 },
    ];
    for (const c of corners) {
      spawnCloud(c.x, c.y, 3.2, 0.85);
    }

    // Статическая геометрия кромки туманностей — в update() меняется только alpha
    const w = maxX - minX;
    const h = maxY - minY;
    this.graphics.clear();
    this.graphics.lineStyle(24, 0xa855f7, 0.35);
    this.graphics.strokeRect(minX, minY, w, h);
    this.graphics.lineStyle(10, 0x06b6d4, 0.55);
    this.graphics.strokeRect(minX, minY, w, h);
    this.graphics.lineStyle(2, 0xe0e7ff, 0.7);
    this.graphics.strokeRect(minX, minY, w, h);

    // 6. Парящие мерцающие микрочастицы туманности вдоль периметра
    const mistColors = [0xc084fc, 0x38bdf8, 0xa855f7, 0x67e8f9];
    const mistCount = 30;
    for (let i = 0; i < mistCount; i++) {
      let mx = 0;
      let my = 0;
      const edge = i % 4;
      if (edge === 0) {
        // Верх
        mx = Phaser.Math.Between(minX, maxX);
        my = Phaser.Math.Between(minY - 70, minY + 15);
      } else if (edge === 1) {
        // Низ
        mx = Phaser.Math.Between(minX, maxX);
        my = Phaser.Math.Between(maxY - 15, maxY + 70);
      } else if (edge === 2) {
        // Лево
        mx = Phaser.Math.Between(minX - 70, minX + 15);
        my = Phaser.Math.Between(minY, maxY);
      } else {
        // Право
        mx = Phaser.Math.Between(maxX - 15, maxX + 70);
        my = Phaser.Math.Between(minY, maxY);
      }

      const color = Phaser.Utils.Array.GetRandom(mistColors);
      const sprite = this.scene.add.circle(mx, my, Phaser.Math.FloatBetween(6, 16), color, 0.45);
      sprite.setDepth(6.2);

      this.gasMists.push({
        sprite,
        x: mx,
        y: my,
        vx: Phaser.Math.FloatBetween(-8, 8),
        vy: Phaser.Math.FloatBetween(-8, 8),
        baseAlpha: Phaser.Math.FloatBetween(0.25, 0.5),
        pulseSpeed: Phaser.Math.FloatBetween(1.2, 2.5),
        pulseTimer: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * Обновление свечения туманности, отсечения вне камеры и дрейфа видимых микрочастиц газа
   */
  public update(seconds: number): void {
    this.animTimer += seconds;
    if (this.contactCooldown > 0) {
      this.contactCooldown -= seconds;
    }

    const cam = this.scene.cameras.main;
    const view = cam?.worldView;
    const viewLeft = view ? view.x : 0;
    const viewRight = view ? view.right : MAP_WIDTH;
    const viewTop = view ? view.y : 0;
    const viewBottom = view ? view.bottom : MAP_HEIGHT;

    const nearBorder =
      viewLeft <= this.minX + 120 ||
      viewRight >= this.maxX - 120 ||
      viewTop <= this.minY + 120 ||
      viewBottom >= this.maxY - 120;

    // Пульсация мягкого свечения внутренней кромки туманностей (без перерисовки геометрии)
    if (nearBorder) {
      const pulse = Math.sin(this.animTimer * 1.8);
      this.graphics.setVisible(true);
      this.graphics.setAlpha(0.22 + pulse * 0.08);
    } else {
      this.graphics.setVisible(false);
    }

    // Отсечение облаков туманности вне области камеры (устраняет лишний overdraw)
    const cloudMargin = 820;
    for (const cloud of this.nebulaSprites) {
      const isVisible =
        cloud.x >= viewLeft - cloudMargin &&
        cloud.x <= viewRight + cloudMargin &&
        cloud.y >= viewTop - cloudMargin &&
        cloud.y <= viewBottom + cloudMargin;
      if (cloud.visible !== isVisible) {
        cloud.setVisible(isVisible);
      }
    }

    // Движение парящих микрочастиц газа (обновляем и рисуем только видимые в камере)
    const mistMargin = 80;
    for (const m of this.gasMists) {
      m.x += m.vx * seconds;
      m.y += m.vy * seconds;
      const isVisible =
        m.x >= viewLeft - mistMargin &&
        m.x <= viewRight + mistMargin &&
        m.y >= viewTop - mistMargin &&
        m.y <= viewBottom + mistMargin;
      if (m.sprite.visible !== isVisible) {
        m.sprite.setVisible(isVisible);
      }
      if (!isVisible) continue;

      m.pulseTimer += seconds * m.pulseSpeed;
      m.sprite.setPosition(m.x, m.y);

      const alpha = m.baseAlpha + Math.sin(m.pulseTimer) * 0.15;
      m.sprite.setAlpha(Phaser.Math.Clamp(alpha, 0.1, 0.7));
    }
  }

  /**
   * Удержание корабля игрока внутри безопасного сектора:
   * плотная туманность не дает пролететь дальше
   */
  public clampPlayer(player: PlayerShip, particleManager?: ParticleManager): void {
    const margin = 24;
    let hitNebula = false;

    if (player.shipSprite.x < this.minX + margin) {
      player.shipSprite.x = this.minX + margin;
      hitNebula = true;
    } else if (player.shipSprite.x > this.maxX - margin) {
      player.shipSprite.x = this.maxX - margin;
      hitNebula = true;
    }

    if (player.shipSprite.y < this.minY + margin) {
      player.shipSprite.y = this.minY + margin;
      hitNebula = true;
    } else if (player.shipSprite.y > this.maxY - margin) {
      player.shipSprite.y = this.maxY - margin;
      hitNebula = true;
    }

    if (hitNebula && this.contactCooldown <= 0) {
      this.contactCooldown = 0.28;
      soundFx.playNebulaContact();
      if (particleManager) {
        particleManager.spawnNebulaContact(player.shipSprite.x, player.shipSprite.y);
      }
    }
  }

  /**
   * Удержание вражеских кораблей внутри сектора
   */
  public clampEnemy(enemy: EnemyShip): void {
    const margin = enemy.radius || 24;
    enemy.sprite.x = Phaser.Math.Clamp(enemy.sprite.x, this.minX + margin, this.maxX - margin);
    enemy.sprite.y = Phaser.Math.Clamp(enemy.sprite.y, this.minY + margin, this.maxY - margin);
  }

  public destroy(): void {
    this.graphics.destroy();
    for (const s of this.nebulaSprites) {
      s.destroy();
    }
    this.nebulaSprites = [];
    for (const m of this.gasMists) {
      m.sprite.destroy();
    }
    this.gasMists = [];
  }
}

// Экспорт алиаса для полной совместимости
export { NeonBarrierManager as NebulaBarrierManager };

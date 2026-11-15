import Phaser from 'phaser';
import { soundFx } from './audio';
import { ParticleManager } from './ParticleManager';
import { ExpOrb } from './types';

/**
 * Менеджер фиолетового голографического опыта:
 * - Выпадение парящих светящихся сфер опыта из уничтоженных противников
 * - Притягивание сфер к кораблю игрока при сближении (магнитный захват)
 * - Сбор сфер, воспроизведение звуков, спецэффектов и начисление очков опыта
 */
export class ExperienceManager {
  private scene: Phaser.Scene;
  private orbs: ExpOrb[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public getOrbs(): ExpOrb[] {
    return this.orbs;
  }

  /**
   * Спавн фиолетовых голографических сфер опыта в координатах гибели вражеского корабля
   */
  public spawnOrbs(x: number, y: number, totalExp: number): void {
    if (totalExp <= 0) return;

    // Расчет количества сфер и их номинала для визуального разнообразия
    let orbCount = 1;
    let orbValue = totalExp;

    if (totalExp >= 100) {
      orbCount = 4;
      orbValue = Math.round(totalExp / 4);
    } else if (totalExp >= 45) {
      orbCount = 3;
      orbValue = Math.round(totalExp / 3);
    } else if (totalExp >= 20) {
      orbCount = 2;
      orbValue = Math.round(totalExp / 2);
    }

    for (let i = 0; i < orbCount; i++) {
      const offsetX = Phaser.Math.Between(-10, 10);
      const offsetY = Phaser.Math.Between(-10, 10);

      const sprite = this.scene.add.sprite(x + offsetX, y + offsetY, 'exp_orb_purple');
      sprite.setOrigin(0.5, 0.5);
      sprite.setDepth(15);
      sprite.setBlendMode(Phaser.BlendModes.ADD);

      // Масштаб зависит от номинала сферы опыта
      let baseScale = 0.85;
      if (orbValue >= 50) baseScale = 1.25;
      else if (orbValue >= 20) baseScale = 1.05;

      sprite.setScale(baseScale);

      // Стартовый импульс разлета из эпицентра взрыва
      const burstAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const burstSpeed = Phaser.Math.Between(45, 120);
      const vx = Math.cos(burstAngle) * burstSpeed;
      const vy = Math.sin(burstAngle) * burstSpeed;

      this.orbs.push({
        sprite,
        x: x + offsetX,
        y: y + offsetY,
        vx,
        vy,
        value: orbValue,
        isMagnetized: false,
        pulseTimer: Phaser.Math.FloatBetween(0, Math.PI * 2),
        baseScale,
      });
    }

    // Защита от переполнения пула объектов на карте
    if (this.orbs.length > 200) {
      const removed = this.orbs.splice(0, this.orbs.length - 200);
      for (const oldOrb of removed) {
        oldOrb.sprite.destroy();
      }
    }
  }

  /**
   * Обновление состояния сфер опыта: торможение импульса, голографическая пульсация,
   * магнитное притягивание к кораблю и сбор.
   */
  public update(
    seconds: number,
    playerX: number,
    playerY: number,
    onCollect: (value: number) => void,
    particleManager?: ParticleManager,
  ): void {
    // Дистанция обнаружения и начала притягивания к кораблю
    const MAGNET_RADIUS = 160;
    // Дистанция непосредственного сбора кораблем
    const COLLECT_RADIUS = 30;

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];

      // 1. Плавное затухание начального импульса разлета
      if (Math.abs(orb.vx) > 0.1 || Math.abs(orb.vy) > 0.1) {
        const drag = Math.pow(0.08, seconds);
        orb.vx *= drag;
        orb.vy *= drag;
        orb.x += orb.vx * seconds;
        orb.y += orb.vy * seconds;
      }

      // 2. Голографическое мерцание, пульсация и вращение вокруг своей оси
      orb.pulseTimer += seconds;
      orb.sprite.rotation += 2.4 * seconds;
      const pulse = 1.0 + Math.sin(orb.pulseTimer * 4.5) * 0.14;
      orb.sprite.setScale(orb.baseScale * pulse);
      orb.sprite.setAlpha(0.85 + Math.sin(orb.pulseTimer * 3.5) * 0.15);

      // 3. Расстояние между кораблем игрока и сферой опыта
      const dx = playerX - orb.x;
      const dy = playerY - orb.y;
      const dist = Math.hypot(dx, dy);

      // 4. Магнитное притягивание к кораблю игрока
      // "если корабль игрока очень близко к кружочку опыта, ТО опыт притягивается"
      if (dist <= MAGNET_RADIUS || orb.isMagnetized) {
        orb.isMagnetized = true;

        // Чем ближе сфера к кораблю, тем выше скорость захвата
        const pullSpeed = Math.min(1100, Math.max(480, 960 - dist * 1.5));
        const step = pullSpeed * seconds;

        if (dist > 0.001) {
          orb.x += (dx / dist) * step;
          orb.y += (dy / dist) * step;
        }

        // Легкий след фиолетовой звездной пыли при полете к кораблю
        if (particleManager && Math.random() < 0.22) {
          particleManager.spawnExpTrailSpark(orb.x, orb.y);
        }
      }

      orb.sprite.setPosition(orb.x, orb.y);

      // 5. Момент подбирания сферы кораблем игрока
      if (dist <= COLLECT_RADIUS) {
        soundFx.playExpPickup();
        if (particleManager) {
          particleManager.spawnExpPickup(orb.x, orb.y, orb.value);
        }
        onCollect(orb.value);

        orb.sprite.destroy();
        this.orbs.splice(i, 1);
      }
    }
  }

  public reset(): void {
    for (const orb of this.orbs) {
      orb.sprite.destroy();
    }
    this.orbs = [];
  }

  public destroy(): void {
    this.reset();
  }
}

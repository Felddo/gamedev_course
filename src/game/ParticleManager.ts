import Phaser from 'phaser';
import { DebrisParticle } from './types';

/**
 * Менеджер визуальных спецэффектов космического боя:
 * плазменные вспышки, искры столкновений, взрывы, след маршевых сопел
 */
export class ParticleManager {
  private scene: Phaser.Scene;
  private particles: DebrisParticle[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public reset(): void {
    for (const p of this.particles) {
      p.sprite.destroy();
    }
    this.particles = [];
  }

  public update(seconds: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.sprite.x += p.vx * seconds;
      p.sprite.y += p.vy * seconds;
      p.alpha -= p.decay * seconds;
      p.sprite.setAlpha(Math.max(0, p.alpha));

      if (p.alpha <= 0) {
        p.sprite.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Сноп искр и стартовая вспышка из дюз при начале форсажа
   */
  public spawnDashBurstFire(x: number, y: number, rearAngle: number): void {
    const rx = x + Math.cos(rearAngle) * 26;
    const ry = y + Math.sin(rearAngle) * 26;

    const flash = this.scene.add.circle(rx, ry, 18, 0xfacc15, 0.95);
    flash.setDepth(14);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2.2,
      duration: 120,
      onComplete: () => flash.destroy(),
    });

    for (let i = 0; i < 18; i++) {
      const spark = this.scene.add.sprite(rx, ry, 'spark_particle');
      spark.setScale(Phaser.Math.FloatBetween(1.0, 1.8));
      const colors = [0xffffff, 0xfacc15, 0xf97316, 0xef4444];
      spark.setTint(colors[i % colors.length]);
      spark.setDepth(12);

      const spread = rearAngle + (Math.random() - 0.5) * 1.1;
      const speed = Phaser.Math.Between(140, 360);
      this.particles.push({
        sprite: spark,
        vx: Math.cos(spread) * speed,
        vy: Math.sin(spread) * speed,
        alpha: 1.0,
        decay: 3.2,
      });
    }
  }

  /**
   * Плазменный шлейф двигателей в открытом космосе при активном улучшении
   */
  public spawnDashFireTrail(x: number, y: number, rearAngle: number, shipRotation: number): void {
    const sideAngle = rearAngle + Math.PI / 2;
    const rx = x + Math.cos(rearAngle) * 22;
    const ry = y + Math.sin(rearAngle) * 22;

    const offsets = [-18, 0, 18];
    for (const offset of offsets) {
      const tx = rx + Math.cos(sideAngle) * offset + (Math.random() - 0.5) * 6;
      const ty = ry + Math.sin(sideAngle) * offset + (Math.random() - 0.5) * 6;

      const firePatch = this.scene.add.sprite(tx, ty, 'fire_trail_patch');
      firePatch.setRotation(shipRotation + (Math.random() - 0.5) * 0.4);
      firePatch.setScale(Phaser.Math.FloatBetween(0.9, 1.4));
      firePatch.setDepth(3);
      firePatch.setAlpha(0.95);

      this.particles.push({
        sprite: firePatch,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        alpha: 0.95,
        decay: 0.72,
      });

      if (Math.random() < 0.65) {
        const ember = this.scene.add.sprite(tx, ty, 'spark_particle');
        ember.setScale(Phaser.Math.FloatBetween(0.5, 0.9));
        ember.setTint(0xfacc15);
        ember.setDepth(4);
        this.particles.push({
          sprite: ember,
          vx: (Math.random() - 0.5) * 25,
          vy: -Phaser.Math.Between(15, 45),
          alpha: 0.9,
          decay: 1.4,
        });
      }
    }
  }

  /**
   * Круговой выброс плазменных искр при активации режима овердрайва
   */
  public spawnSuperActivationBurst(x: number, y: number, rearAngle: number): void {
    for (let i = 0; i < 18; i++) {
      const spark = this.scene.add.sprite(x, y, 'spark_particle');
      spark.setScale(Phaser.Math.FloatBetween(1.0, 2.0));
      spark.setTint(Math.random() < 0.5 ? 0xfacc15 : 0xf97316);
      spark.setDepth(12);

      const angle = rearAngle + (Math.random() - 0.5) * Math.PI * 0.8;
      const spd = Phaser.Math.Between(180, 480);
      this.particles.push({
        sprite: spark,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        alpha: 1.0,
        decay: 3.5,
      });
    }
  }

  /**
   * След плазмы и выхлопа космолета из спрайтов космических эффектов
   */
  public spawnShipExhaust(x: number, y: number, exhaustAngle: number, isSuper: boolean): void {
    const smokeKeys = ['space_effect_008', 'space_effect_010', 'space_effect_013'];
    const chosenKey = smokeKeys[Math.floor(Math.random() * smokeKeys.length)];
    if (!this.scene.textures.exists(chosenKey)) return;

    const smoke = this.scene.add.sprite(x, y, chosenKey);
    smoke.setRotation(Math.random() * Math.PI * 2);
    smoke.setScale(Phaser.Math.FloatBetween(0.35, 0.65));
    smoke.setDepth(8);
    smoke.setAlpha(0.65);
    if (isSuper) {
      smoke.setTint(0x38bdf8);
    }

    const spread = exhaustAngle + (Math.random() - 0.5) * 0.45;
    const speed = Phaser.Math.Between(45, 95);
    this.particles.push({
      sprite: smoke,
      vx: Math.cos(spread) * speed,
      vy: Math.sin(spread) * speed,
      alpha: 0.65,
      decay: 2.2,
    });
  }

  /**
   * Световой шлейф сопел при форсаже космолета
   */
  public spawnShipDashTrail(x: number, y: number, exhaustAngle: number): void {
    const key = Math.random() < 0.65 ? 'space_effect_017' : 'space_effect_008';
    if (!this.scene.textures.exists(key)) return;

    const part = this.scene.add.sprite(x, y, key);
    part.setRotation(exhaustAngle + Math.PI / 2);
    part.setScale(Phaser.Math.FloatBetween(0.7, 1.2));
    part.setDepth(9);
    part.setAlpha(0.85);

    const speed = Phaser.Math.Between(60, 140);
    this.particles.push({
      sprite: part,
      vx: Math.cos(exhaustAngle) * speed,
      vy: Math.sin(exhaustAngle) * speed,
      alpha: 0.85,
      decay: 3.8,
    });
  }

  /**
   * Вспышка носового орудия корабля
   */
  public spawnMuzzleFlash(x: number, y: number, angle: number): void {
    const flash = this.scene.add.circle(x, y, 9, 0xfacc15, 0.95);
    flash.setDepth(15);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.8,
      duration: 70,
      onComplete: () => flash.destroy(),
    });

    for (let i = 0; i < 3; i++) {
      const smoke = this.scene.add.sprite(x, y, 'spark_particle');
      smoke.setScale(Phaser.Math.FloatBetween(0.8, 1.3));
      smoke.setTint(0x94a3b8);
      smoke.setDepth(14);

      const spreadAngle = angle + (Math.random() - 0.5) * 0.45;
      const speed = Phaser.Math.Between(50, 130);

      this.particles.push({
        sprite: smoke,
        vx: Math.cos(spreadAngle) * speed,
        vy: Math.sin(spreadAngle) * speed,
        alpha: 0.7,
        decay: 3.0,
      });
    }
  }

  /**
   * Искры при кинетическом и плазменном попадании
   */
  public spawnHitSparks(x: number, y: number): void {
    for (let i = 0; i < 4; i++) {
      const sprite = this.scene.add.sprite(x, y, 'spark_particle');
      sprite.setScale(0.7);
      sprite.setTint(0xfacc15);
      sprite.setDepth(12);

      const angle = Math.random() * Math.PI * 2;
      const speed = Phaser.Math.Between(80, 180);

      this.particles.push({
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        decay: 5,
      });
    }
  }

  /**
   * Сноп искр при столкновении
   */
  public spawnSparkBurst(x: number, y: number): void {
    this.spawnHitSparks(x, y);
  }

  /**
   * Взрыв при уничтожении вражеского корабля
   */
  public spawnExplosion(x: number, y: number): void {
    const flash = this.scene.add.circle(x, y, 28, 0xffedd5, 0.95);
    flash.setDepth(15);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.8,
      duration: 180,
      onComplete: () => flash.destroy(),
    });

    for (let i = 0; i < 14; i++) {
      const sprite = this.scene.add.sprite(x, y, 'spark_particle');
      sprite.setScale(Phaser.Math.FloatBetween(0.8, 1.4));
      sprite.setTint(Math.random() < 0.5 ? 0xef4444 : 0xf97316);
      sprite.setDepth(14);

      const angle = Math.random() * Math.PI * 2;
      const speed = Phaser.Math.Between(70, 240);

      this.particles.push({
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        decay: 2.2,
      });
    }
  }

  /**
   * Красная дульная вспышка выстрела вражеского крейсера
   */
  public spawnEnemyMuzzleFlash(x: number, y: number, angle: number): void {
    const flash = this.scene.add.circle(x, y, 14, 0xff0044, 0.9);
    flash.setDepth(14);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.6,
      duration: 100,
      onComplete: () => flash.destroy(),
    });

    for (let i = 0; i < 6; i++) {
      const spark = this.scene.add.sprite(x, y, 'spark_particle');
      spark.setScale(Phaser.Math.FloatBetween(0.6, 1.2));
      spark.setTint(i % 2 === 0 ? 0xef4444 : 0xffffff);
      spark.setDepth(13);

      const spread = angle + (Math.random() - 0.5) * 0.9;
      const speed = Phaser.Math.Between(120, 260);
      this.particles.push({
        sprite: spark,
        vx: Math.cos(spread) * speed,
        vy: Math.sin(spread) * speed,
        alpha: 1,
        decay: 4.5,
      });
    }
  }

  /**
   * Мощный взрыв при ликвидации тяжелого крейсера
   */
  public spawnBigExplosion(x: number, y: number): void {
    const ring = this.scene.add.circle(x, y, 36, 0xff0044, 0.85);
    ring.setDepth(15);
    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 2.4,
      duration: 260,
      onComplete: () => ring.destroy(),
    });

    const core = this.scene.add.circle(x, y, 20, 0xffffff, 1.0);
    core.setDepth(16);
    this.scene.tweens.add({
      targets: core,
      alpha: 0,
      scale: 2.0,
      duration: 150,
      onComplete: () => core.destroy(),
    });

    for (let i = 0; i < 28; i++) {
      const sprite = this.scene.add.sprite(x, y, 'spark_particle');
      sprite.setScale(Phaser.Math.FloatBetween(1.0, 2.0));
      const tints = [0xffffff, 0xef4444, 0xf97316, 0x94a3b8, 0x38bdf8];
      sprite.setTint(tints[i % tints.length]);
      sprite.setDepth(15);

      const angle = Math.random() * Math.PI * 2;
      const speed = Phaser.Math.Between(90, 360);

      this.particles.push({
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        decay: Phaser.Math.FloatBetween(1.4, 2.5),
      });
    }
  }

  /**
   * Колоссальный взрыв космической станции с ударной плазменной волной
   */
  public spawnStationMegaExplosion(x: number, y: number, explosionRadius: number, xpReward: number): void {
    // 1. Расширяющаяся плазменная ударная волна
    const shockwave = this.scene.add.circle(x, y, 40, 0x38bdf8, 0.9);
    shockwave.setDepth(16);
    this.scene.tweens.add({
      targets: shockwave,
      scale: explosionRadius / 35,
      alpha: 0,
      duration: 480,
      ease: 'Cubic.easeOut',
      onComplete: () => shockwave.destroy(),
    });

    // 2. Вторичная огненная волна детонации реактора
    const fireWave = this.scene.add.circle(x, y, 25, 0xf97316, 0.95);
    fireWave.setDepth(17);
    this.scene.tweens.add({
      targets: fireWave,
      scale: (explosionRadius * 0.7) / 20,
      alpha: 0,
      duration: 360,
      ease: 'Quad.easeOut',
      onComplete: () => fireWave.destroy(),
    });

    // 3. Ослепительная ядерная вспышка в эпицентре
    const coreFlash = this.scene.add.circle(x, y, 45, 0xffffff, 1.0);
    coreFlash.setDepth(18);
    this.scene.tweens.add({
      targets: coreFlash,
      alpha: 0,
      scale: 1.8,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => coreFlash.destroy(),
    });

    // 4. Осколки обшивки, искры и плазменные сгустки
    for (let i = 0; i < 48; i++) {
      const spark = this.scene.add.sprite(x, y, 'spark_particle');
      spark.setScale(Phaser.Math.FloatBetween(1.2, 2.6));
      const colors = [0xffffff, 0x38bdf8, 0x06b6d4, 0xfacc15, 0xf97316, 0xef4444];
      spark.setTint(colors[i % colors.length]);
      spark.setDepth(16);

      const angle = Math.random() * Math.PI * 2;
      const speed = Phaser.Math.Between(120, explosionRadius * 1.8);

      this.particles.push({
        sprite: spark,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        decay: Phaser.Math.FloatBetween(0.8, 1.8),
      });
    }

    // 5. Всплывающий текст полученного опыта
    const xpText = this.scene.add.text(x, y - 20, `+${xpReward} ОПЫТ`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#38bdf8',
      stroke: '#020617',
      strokeThickness: 5,
    });
    xpText.setOrigin(0.5, 0.5);
    xpText.setDepth(20);

    this.scene.tweens.add({
      targets: xpText,
      y: y - 85,
      alpha: 0,
      scale: 1.25,
      duration: 1200,
      ease: 'Cubic.easeOut',
      onComplete: () => xpText.destroy(),
    });
  }

  public destroy(): void {
    this.reset();
  }
}

import Phaser from 'phaser';
import { Meteor } from './types';
import { MAP_WIDTH, MAP_HEIGHT, GAME_PHASES, PhaseInfo } from './constants';
import { PlayerShip } from './PlayerShip';
import { WeaponSystem } from './WeaponSystem';
import { EnemyManager } from './EnemyManager';
import { ParticleManager } from './ParticleManager';
import { soundFx } from './audio';

const METEOR_TEXTURES = ['meteor_001', 'meteor_002', 'meteor_003', 'meteor_004'];

/**
 * Менеджер метеоритов: периодический спавн астероидов различных размеров,
 * физическое движение в невесомости с вращением, столкновения с лазерами,
 * уничтожение врагов и МГНОВЕННАЯ СМЕРТЬ корабля при таране метеорита.
 * Настройки количества и частоты спавна управляются фазами игры (GAME_PHASES).
 */
export class MeteorManager {
  private scene: Phaser.Scene;
  private meteors: Meteor[] = [];
  private spawnTimer = 0.5;

  // Настройки текущей фазы
  private currentPhaseNumber = 1;
  public maxMeteors = 10;
  public spawnInterval = 2.2;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setPhase(1);
  }

  public getMeteors(): Meteor[] {
    return this.meteors;
  }

  public getCurrentPhaseInfo(): PhaseInfo {
    return GAME_PHASES.find((p) => p.number === this.currentPhaseNumber) || GAME_PHASES[0];
  }

  /**
   * Настройка количества метеоритов в зависимости от активной фазы игры
   */
  public setPhase(phase: number): void {
    this.currentPhaseNumber = phase;
    const phaseInfo = this.getCurrentPhaseInfo();
    if (phaseInfo) {
      this.maxMeteors = phaseInfo.maxMeteors ?? 10;
      this.spawnInterval = phaseInfo.meteorSpawnInterval ?? 2.2;
    }
  }

  /**
   * Начальный спавн метеоритов по карте при старте матча (по настройке фазы)
   */
  public createInitialMeteors(customCount?: number): void {
    const count = customCount !== undefined ? customCount : (this.getCurrentPhaseInfo().initialMeteorCount ?? 5);
    const cam = this.scene.cameras.main;
    const cx = cam.worldView ? cam.worldView.centerX : MAP_WIDTH / 2;
    const cy = cam.worldView ? cam.worldView.centerY : MAP_HEIGHT / 2;

    for (let i = 0; i < count; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.FloatBetween(380, 850);
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const trajAngle = angle + Math.PI + Phaser.Math.FloatBetween(-0.4, 0.4);
      this.spawnMeteorAt(x, y, trajAngle);
    }
  }

  /**
   * Обновление состояния метеоритов: движение, вращение, частицы хвоста и спавн
   */
  public update(
    seconds: number,
    cam: Phaser.Cameras.Scene2D.Camera,
    particleManager: ParticleManager,
  ): void {
    // 1. Таймер периодического появления новых метеоритов (согласно настройкам фазы)
    this.spawnTimer -= seconds;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Phaser.Math.FloatBetween(this.spawnInterval * 0.8, this.spawnInterval * 1.25);
      if (this.meteors.length < this.maxMeteors) {
        this.spawnMeteorAroundCamera(cam);
      }
    }

    // 2. Обновление каждого активного метеорита
    const camCenterX = cam.worldView ? cam.worldView.centerX : 0;
    const camCenterY = cam.worldView ? cam.worldView.centerY : 0;

    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      const sprite = m.sprite;

      // Линейное перемещение
      sprite.x += m.vx * seconds;
      sprite.y += m.vy * seconds;

      // Свободное вращение в невесомости
      sprite.rotation += m.angularVelocity * seconds;

      // Эффект вспышки при получении урона от лазеров
      if (m.isHitFlash > 0) {
        m.isHitFlash -= seconds;
        if (m.isHitFlash <= 0) {
          sprite.clearTint();
        }
      }

      // Частицы космической пыли и искр в хвосте летящего метеорита
      m.trailTimer -= seconds;
      if (m.trailTimer <= 0) {
        m.trailTimer = m.scale > 0.8 ? 0.08 : 0.15;
        this.emitMeteorTrail(m, particleManager);
      }

      // Очистка метеоритов, улетевших далеко за пределы обзора в бесконечном космосе
      const distToCamera = Phaser.Math.Distance.Between(
        sprite.x,
        sprite.y,
        camCenterX,
        camCenterY,
      );
      if (distToCamera > 2400) {
        sprite.destroy();
        this.meteors.splice(i, 1);
      }
    }
  }

  /**
   * Спавн метеорита на границе видимости камеры, летящего сквозь сектор
   */
  private spawnMeteorAroundCamera(cam: Phaser.Cameras.Scene2D.Camera): void {
    let startX = 0;
    let startY = 0;

    const vw = cam.worldView ? cam.worldView.width : 1600;
    const vh = cam.worldView ? cam.worldView.height : 900;
    const vx = cam.worldView ? cam.worldView.x : 0;
    const vy = cam.worldView ? cam.worldView.y : 0;
    const offset = Phaser.Math.Between(100, 180);

    const side = Phaser.Math.Between(0, 3); // 0: top, 1: right, 2: bottom, 3: left
    if (side === 0) {
      startX = Phaser.Math.Between(vx - 50, vx + vw + 50);
      startY = vy - offset;
    } else if (side === 1) {
      startX = vx + vw + offset;
      startY = Phaser.Math.Between(vy - 50, vy + vh + 50);
    } else if (side === 2) {
      startX = Phaser.Math.Between(vx - 50, vx + vw + 50);
      startY = vy + vh + offset;
    } else {
      startX = vx - offset;
      startY = Phaser.Math.Between(vy - 50, vy + vh + 50);
    }

    // Целимся в случайную точку внутри экрана игрока
    const targetX = vx + vw * Phaser.Math.FloatBetween(0.15, 0.85);
    const targetY = vy + vh * Phaser.Math.FloatBetween(0.15, 0.85);

    const angle = Math.atan2(targetY - startY, targetX - startX) + Phaser.Math.FloatBetween(-0.25, 0.25);
    this.spawnMeteorAt(startX, startY, angle);
  }

  /**
   * Спавн метеорита в конкретной точке под заданным углом с градацией размеров
   */
  public spawnMeteorAt(
    x: number,
    y: number,
    flightAngle: number,
    forcedCategory?: 'small' | 'medium' | 'large' | 'giant',
  ): Meteor {
    // Случайный выбор текстуры из 4 вариантов spaceMeteors
    const textureKey = Phaser.Utils.Array.GetRandom(METEOR_TEXTURES);

    // Определение категории размера (разные размеры как в ТЗ)
    let category = forcedCategory;
    if (!category) {
      const roll = Math.random();
      if (roll < 0.38) {
        category = 'small';
      } else if (roll < 0.74) {
        category = 'medium';
      } else if (roll < 0.91) {
        category = 'large';
      } else {
        category = 'giant';
      }
    }

    let scale = 0.5;
    let speed = 160;
    let hp = 4;

    switch (category) {
      case 'small':
        scale = Phaser.Math.FloatBetween(0.26, 0.38);
        speed = Phaser.Math.Between(190, 290);
        hp = 2;
        break;
      case 'medium':
        scale = Phaser.Math.FloatBetween(0.48, 0.68);
        speed = Phaser.Math.Between(130, 200);
        hp = 6;
        break;
      case 'large':
        scale = Phaser.Math.FloatBetween(0.78, 1.05);
        speed = Phaser.Math.Between(80, 135);
        hp = 14;
        break;
      case 'giant':
        scale = Phaser.Math.FloatBetween(1.2, 1.55);
        speed = Phaser.Math.Between(50, 90);
        hp = 26;
        break;
    }

    const sprite = this.scene.add.sprite(x, y, textureKey);
    sprite.setScale(scale);
    sprite.setDepth(8);

    // Радиус столкновения: оригинальный размер спрайта ~210px * 0.44 * scale
    const radius = Math.max(14, 210 * 0.44 * scale);

    const meteor: Meteor = {
      sprite,
      vx: Math.cos(flightAngle) * speed,
      vy: Math.sin(flightAngle) * speed,
      angularVelocity: Phaser.Math.FloatBetween(-2.4, 2.4),
      radius,
      scale,
      hp,
      maxHp: hp,
      isHitFlash: 0,
      trailTimer: 0.05,
      sizeCategory: category,
    };

    this.meteors.push(meteor);
    return meteor;
  }

  /**
   * Смертоносное столкновение с кораблем игрока:
   * "при столкновении корабля с метеоритом корабль должен сразу погибать"
   */
  public checkPlayerCollision(
    player: PlayerShip,
    onFatalCrash: () => void,
  ): boolean {
    if (player.isGameOver) return false;

    // Радиус хитбокса корабля игрока (с учетом уменьшенного масштаба)
    const playerRadius = 20;

    for (let i = 0; i < this.meteors.length; i++) {
      const m = this.meteors[i];
      const dist = Phaser.Math.Distance.Between(player.x, player.y, m.sprite.x, m.sprite.y);

      // Проверка перекрытия круговых коллайдеров
      if (dist < playerRadius + m.radius) {
        // МГНОВЕННАЯ СМЕРТЬ: сбрасываем HP до 0 и вызываем триггер фатального взрыва
        player.hp = 0;
        onFatalCrash();
        return true;
      }
    }

    return false;
  }

  /**
   * Взаимодействие снарядов бластера с метеоритами:
   * попадания высекают искры и сколы камня, при разрушении крупный метеорит раскалывается на обломки!
   */
  public checkLaserCollisions(
    weaponSystem: WeaponSystem,
    particleManager: ParticleManager,
    onScoreGained: (score: number) => void,
  ): void {
    const projectiles = weaponSystem.getLasers();

    for (let pIdx = projectiles.length - 1; pIdx >= 0; pIdx--) {
      const laser = projectiles[pIdx];
      const lx = laser.sprite.x;
      const ly = laser.sprite.y;

      for (let mIdx = this.meteors.length - 1; mIdx >= 0; mIdx--) {
        const meteor = this.meteors[mIdx];
        const dist = Phaser.Math.Distance.Between(lx, ly, meteor.sprite.x, meteor.sprite.y);

        if (dist < meteor.radius + 12) {
          // Уничтожаем снаряд и создаем искры удара о камень
          laser.sprite.destroy();
          projectiles.splice(pIdx, 1);

          this.emitImpactSparks(lx, ly, particleManager);

          // Урон метеориту
          const damage = laser.damage || 1.5;
          meteor.hp -= damage;
          meteor.isHitFlash = 0.08;
          meteor.sprite.setTint(0xffffff);

          if (meteor.hp <= 0) {
            this.destroyMeteor(mIdx, particleManager, onScoreGained);
          }

          break; // Снаряд уже уничтожен
        }
      }
    }
  }

  /**
   * Разрушение метеорита огнем орудий
   */
  private destroyMeteor(
    mIdx: number,
    particleManager: ParticleManager,
    onScoreGained: (score: number) => void,
  ): void {
    const m = this.meteors[mIdx];
    const mx = m.sprite.x;
    const my = m.sprite.y;
    const cat = m.sizeCategory;

    soundFx.playExplosion();
    this.emitMeteorExplosion(mx, my, m.scale, particleManager);

    // Очки за уничтожение космического тела
    let scoreReward = 30;
    if (cat === 'medium') scoreReward = 60;
    if (cat === 'large') scoreReward = 120;
    if (cat === 'giant') scoreReward = 250;
    onScoreGained(scoreReward);

    // Удаляем исходный спрайт
    m.sprite.destroy();
    this.meteors.splice(mIdx, 1);

    // Раскалывание крупных метеоритов на мелкие осколки!
    if (cat === 'giant') {
      const angle1 = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const angle2 = angle1 + Math.PI * Phaser.Math.FloatBetween(0.65, 0.95);
      this.spawnMeteorAt(mx - 25, my - 25, angle1, 'medium');
      this.spawnMeteorAt(mx + 25, my + 25, angle2, 'medium');
    } else if (cat === 'large') {
      const angle1 = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const angle2 = angle1 + Math.PI * Phaser.Math.FloatBetween(0.65, 0.95);
      this.spawnMeteorAt(mx - 15, my - 15, angle1, 'small');
      this.spawnMeteorAt(mx + 15, my + 15, angle2, 'small');
    }
  }

  /**
   * Проверка столкновений метеоритов с вражескими кораблями
   */
  public checkEnemyCollisions(
    enemyManager: EnemyManager,
    particleManager: ParticleManager,
  ): void {
    const enemies = enemyManager.getEnemies();
    for (const meteor of this.meteors) {
      for (let e = enemies.length - 1; e >= 0; e--) {
        const enemy = enemies[e];
        const dist = Phaser.Math.Distance.Between(meteor.sprite.x, meteor.sprite.y, enemy.sprite.x, enemy.sprite.y);
        if (dist <= meteor.radius + enemy.radius) {
          soundFx.playExplosion();
          particleManager.spawnExplosion(enemy.sprite.x, enemy.sprite.y);
          enemy.hp -= meteor.hp * 2;
          enemy.sprite.setTint(0xffffff);
          enemy.isHitFlash = 0.1;
          if (enemy.hp <= 0) {
            enemyManager.destroyEnemy(e, particleManager, () => {});
          }
        }
      }
    }
  }

  /**
   * Частицы пыли и искр позади летящего астероида
   */
  private emitMeteorTrail(meteor: Meteor, particleManager: ParticleManager): void {
    const flightAngle = Math.atan2(meteor.vy, meteor.vx);
    const rearAngle = flightAngle + Math.PI;

    const offsetDist = meteor.radius * 0.7;
    const tx = meteor.sprite.x + Math.cos(rearAngle) * offsetDist;
    const ty = meteor.sprite.y + Math.sin(rearAngle) * offsetDist;

    // Пылевые частицы
    const dust = this.scene.add.circle(
      tx + Phaser.Math.Between(-6, 6),
      ty + Phaser.Math.Between(-6, 6),
      Phaser.Math.FloatBetween(2, 4.5) * meteor.scale,
      Math.random() < 0.6 ? 0xb45309 : 0x78716c,
      0.65,
    );
    dust.setDepth(7);

    this.scene.tweens.add({
      targets: dust,
      alpha: 0,
      scale: 0.2,
      duration: Phaser.Math.Between(350, 700),
      ease: 'Quad.easeOut',
      onComplete: () => dust.destroy(),
    });
  }

  /**
   * Искры при ударе снаряда о твердую породу метеорита
   */
  private emitImpactSparks(x: number, y: number, particleManager: ParticleManager): void {
    particleManager.spawnHitSparks(x, y);

    for (let i = 0; i < 4; i++) {
      const rockChip = this.scene.add.rectangle(
        x,
        y,
        Phaser.Math.Between(2, 4),
        Phaser.Math.Between(2, 4),
        0xd97706,
      );
      rockChip.setDepth(14);

      this.scene.tweens.add({
        targets: rockChip,
        x: x + Phaser.Math.Between(-25, 25),
        y: y + Phaser.Math.Between(-25, 25),
        alpha: 0,
        rotation: Phaser.Math.FloatBetween(-3, 3),
        duration: Phaser.Math.Between(250, 450),
        onComplete: () => rockChip.destroy(),
      });
    }
  }

  /**
   * Мощный разрыв метеорита на каменные обломки и взрывную волну
   */
  private emitMeteorExplosion(
    x: number,
    y: number,
    scale: number,
    particleManager: ParticleManager,
  ): void {
    particleManager.spawnExplosion(x, y);

    // Каменные осколки
    const chipCount = Math.floor(10 + scale * 12);
    for (let i = 0; i < chipCount; i++) {
      const shardSize = Phaser.Math.Between(3, 7) * scale;
      const shard = this.scene.add.rectangle(
        x,
        y,
        shardSize,
        shardSize,
        Math.random() < 0.5 ? 0x92400e : 0x78716c,
      );
      shard.setDepth(14);

      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(40, 160) * scale;

      this.scene.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        rotation: Phaser.Math.FloatBetween(-6, 6),
        duration: Phaser.Math.Between(400, 850),
        ease: 'Cubic.easeOut',
        onComplete: () => shard.destroy(),
      });
    }
  }

  public reset(): void {
    for (const m of this.meteors) {
      m.sprite.destroy();
    }
    this.meteors = [];
    this.spawnTimer = 0.5;
  }

  public destroy(): void {
    this.reset();
  }
}

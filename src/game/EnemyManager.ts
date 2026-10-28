import Phaser from 'phaser';
import { soundFx } from './audio';
import {
  BLASTER_RANGE,
  BLASTER_DAMAGE,
  ENEMY_SCOUT_HP,
  ENEMY_SCOUT_SPEED,
  ENEMY_SCOUT_SCORE,
  ENEMY_SCOUT_SCALE,
  ENEMY_SCOUT_RADIUS,
  ENEMY_INTERCEPTOR_HP,
  ENEMY_INTERCEPTOR_SPEED,
  ENEMY_INTERCEPTOR_SCORE,
  ENEMY_INTERCEPTOR_SCALE,
  ENEMY_INTERCEPTOR_RADIUS,
  ENEMY_GUNSHIP_HP,
  ENEMY_GUNSHIP_SPEED,
  ENEMY_GUNSHIP_SCORE,
  ENEMY_GUNSHIP_SCALE,
  ENEMY_GUNSHIP_RADIUS,
  ENEMY_GUNSHIP_SHOOT_COOLDOWN,
  ENEMY_GUNSHIP_SHOOT_RANGE,
  ENEMY_GUNSHIP_BULLET_SPEED,
  ENEMY_GUNSHIP_BULLET_DAMAGE,
  ENEMY_GUNSHIP_BULLET_LIFETIME,
  GAME_PHASES,
  PhaseInfo,
} from './constants';
import { EnemyShip, EnemyBullet } from './types';
import { PlayerShip } from './PlayerShip';
import { WeaponSystem } from './WeaponSystem';
import { ParticleManager } from './ParticleManager';

/**
 * Менеджер вражеских космических кораблей:
 * волны спавна, перехват корабля игрока, стрельба плазменными зарядами
 * и расчет попаданий/столкновений в открытом космосе.
 */
export class EnemyManager {
  private scene: Phaser.Scene;
  private enemies: EnemyShip[] = [];
  private enemyBullets: EnemyBullet[] = [];
  private spawnTimer = 0;
  private currentSpawnInterval = 0.1;
  private currentPhase = 1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public getEnemies(): EnemyShip[] {
    return this.enemies;
  }

  public getEnemyBullets(): EnemyBullet[] {
    return this.enemyBullets;
  }

  public getCurrentPhaseInfo(): PhaseInfo {
    return GAME_PHASES.find((p) => p.number === this.currentPhase) || GAME_PHASES[0];
  }

  public setPhase(phase: number): void {
    const prevPhase = this.getCurrentPhaseInfo();
    this.currentPhase = phase;
    const newPhase = this.getCurrentPhaseInfo();

    if (
      prevPhase &&
      newPhase &&
      prevPhase.healthMultiplier > 0 &&
      newPhase.healthMultiplier !== prevPhase.healthMultiplier
    ) {
      const ratio = newPhase.healthMultiplier / prevPhase.healthMultiplier;
      for (const enemy of this.enemies) {
        enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * ratio));
        enemy.hp = Math.max(1, Math.min(enemy.maxHp, Math.round(enemy.hp * ratio)));
      }
    }
  }

  public getPhase(): number {
    return this.currentPhase;
  }

  public reset(): void {
    for (const enemy of this.enemies) {
      this.destroyEnemySprites(enemy);
    }
    this.enemies = [];

    for (const bullet of this.enemyBullets) {
      bullet.sprite.destroy();
    }
    this.enemyBullets = [];

    this.spawnTimer = 0;
    this.currentSpawnInterval = 0.1;
    this.currentPhase = 1;
  }

  private destroyEnemySprites(enemy: EnemyShip): void {
    enemy.sprite.destroy();
  }

  public findNearestEnemy(playerX: number, playerY: number, maxRange = BLASTER_RANGE): EnemyShip | null {
    let nearest: EnemyShip | null = null;
    let minDist = maxRange;

    for (const enemy of this.enemies) {
      const dist = Phaser.Math.Distance.Between(
        playerX,
        playerY,
        enemy.sprite.x,
        enemy.sprite.y,
      );
      if (dist < minDist) {
        minDist = dist;
        nearest = enemy;
      }
    }

    return nearest;
  }

  public handleSpawning(seconds: number, survivalTime: number, cam: Phaser.Cameras.Scene2D.Camera): void {
    this.spawnTimer += seconds;
    const phaseInfo = this.getCurrentPhaseInfo();
    const spawnIntensity = Math.max(0.05, phaseInfo.spawnIntensity || 1.0);
    this.currentSpawnInterval = Math.max(0.05, (0.4 - survivalTime * 0.005) / spawnIntensity);

    while (this.spawnTimer >= this.currentSpawnInterval) {
      this.spawnTimer -= this.currentSpawnInterval;
      this.spawnRandomEnemy(cam, survivalTime);
    }
  }

  private spawnRandomEnemy(cam: Phaser.Cameras.Scene2D.Camera, survivalTime: number): void {
    const viewLeft = cam.worldView.x;
    const viewTop = cam.worldView.y;
    const viewRight = cam.worldView.right;
    const viewBottom = cam.worldView.bottom;

    const edge = Phaser.Math.Between(0, 3);
    const offset = 75;
    let x = 0;
    let y = 0;

    switch (edge) {
      case 0:
        x = Phaser.Math.Between(viewLeft - 30, viewRight + 30);
        y = viewTop - offset;
        break;
      case 1:
        x = Phaser.Math.Between(viewLeft - 30, viewRight + 30);
        y = viewBottom + offset;
        break;
      case 2:
        x = viewLeft - offset;
        y = Phaser.Math.Between(viewTop - 30, viewBottom + 30);
        break;
      case 3:
        x = viewRight + offset;
        y = Phaser.Math.Between(viewTop - 30, viewBottom + 30);
        break;
    }

    const phaseInfo = this.getCurrentPhaseInfo();
    const allowGunship = phaseInfo.allowTerminator;
    const gunshipChance = allowGunship
      ? Math.min(0.28, 0.14 + survivalTime * 0.003)
      : 0;
    const interceptorChance = allowGunship
      ? Math.min(0.32, 0.20 + survivalTime * 0.002)
      : Math.min(0.38, 0.25 + survivalTime * 0.002);

    const roll = Math.random();
    if (gunshipChance > 0 && roll < gunshipChance) {
      this.spawnGunship(x, y);
    } else if (roll < gunshipChance + interceptorChance) {
      this.spawnInterceptorShip(x, y);
    } else {
      this.spawnScoutShip(x, y);
    }
  }

  private spawnGunship(x: number, y: number): void {
    // Тяжелый стреляющий крейсер (spaceShips_006.png)
    const sprite = this.scene.add.sprite(x, y, 'enemy_ship_shooter');
    sprite.setOrigin(0.5, 0.5);
    sprite.setScale(ENEMY_GUNSHIP_SCALE);
    sprite.setDepth(7);

    const hpMult = Math.max(0.1, this.getCurrentPhaseInfo().healthMultiplier || 1.0);
    const gunshipHp = Math.max(1, Math.round(ENEMY_GUNSHIP_HP * hpMult));

    this.enemies.push({
      type: 'gunship',
      sprite,
      hp: gunshipHp,
      maxHp: gunshipHp,
      speed: ENEMY_GUNSHIP_SPEED,
      scoreValue: ENEMY_GUNSHIP_SCORE,
      radius: ENEMY_GUNSHIP_RADIUS,
      isHitFlash: 0,
      isInvulnerable: false,
      shootCooldown: ENEMY_GUNSHIP_SHOOT_COOLDOWN,
      shootTimer: Phaser.Math.FloatBetween(0.4, ENEMY_GUNSHIP_SHOOT_COOLDOWN),
      animPhase: Math.random() * Math.PI * 2,
      recoil: 0,
    });
  }

  private spawnInterceptorShip(x: number, y: number): void {
    // Средний скоростной перехватчик (spaceShips_004.png)
    const sprite = this.scene.add.sprite(x, y, 'enemy_ship_medium');
    sprite.setOrigin(0.5, 0.5);
    sprite.setScale(ENEMY_INTERCEPTOR_SCALE);
    sprite.setDepth(7);

    const hpMult = Math.max(0.1, this.getCurrentPhaseInfo().healthMultiplier || 1.0);
    const interceptorHp = Math.max(1, Math.round(ENEMY_INTERCEPTOR_HP * hpMult));

    this.enemies.push({
      type: 'interceptor',
      sprite,
      hp: interceptorHp,
      maxHp: interceptorHp,
      speed: ENEMY_INTERCEPTOR_SPEED,
      scoreValue: ENEMY_INTERCEPTOR_SCORE,
      radius: ENEMY_INTERCEPTOR_RADIUS,
      isHitFlash: 0,
      isInvulnerable: false,
      animPhase: Math.random() * Math.PI * 2,
      recoil: 0,
    });
  }

  private spawnScoutShip(x: number, y: number): void {
    // Легкий маневренный разведчик (spaceShips_005.png)
    const sprite = this.scene.add.sprite(x, y, 'enemy_ship_weak');
    sprite.setOrigin(0.5, 0.5);
    sprite.setScale(ENEMY_SCOUT_SCALE);
    sprite.setDepth(7);

    const hpMult = Math.max(0.1, this.getCurrentPhaseInfo().healthMultiplier || 1.0);
    const scoutHp = Math.max(1, Math.round(ENEMY_SCOUT_HP * hpMult));

    this.enemies.push({
      type: 'scout',
      sprite,
      hp: scoutHp,
      maxHp: scoutHp,
      speed: ENEMY_SCOUT_SPEED,
      scoreValue: ENEMY_SCOUT_SCORE,
      radius: ENEMY_SCOUT_RADIUS,
      isHitFlash: 0,
      isInvulnerable: false,
      animPhase: Math.random() * Math.PI * 2,
    });
  }

  public update(
    seconds: number,
    playerX: number,
    playerY: number,
    particleManager?: ParticleManager,
  ): void {
    // 1. Обновление кинематики и траекторий врагов
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      const distToPlayer = Phaser.Math.Distance.Between(
        enemy.sprite.x,
        enemy.sprite.y,
        playerX,
        playerY,
      );

      // В бесконечном космосе: удаляем корабли, отставшие более чем на 3200 пикселей
      if (distToPlayer > 3200) {
        this.destroyEnemySprites(enemy);
        this.enemies.splice(i, 1);
        continue;
      }

      const angle = Phaser.Math.Angle.Between(
        enemy.sprite.x,
        enemy.sprite.y,
        playerX,
        playerY,
      );

      // Курс на сближение с кораблем игрока
      enemy.sprite.x += Math.cos(angle) * enemy.speed * seconds;
      enemy.sprite.y += Math.sin(angle) * enemy.speed * seconds;

      // Плавное покачивание кораблей при полете
      enemy.animPhase = (enemy.animPhase ?? 0) + seconds * 4.2;
      const flySway = Math.sin(enemy.animPhase) * 0.04;
      enemy.sprite.rotation = (angle - Math.PI / 2) + flySway;

      // Логика стрельбы тяжелого крейсера (spaceShips_006.png)
      if (enemy.type === 'gunship' || enemy.type === 'terminator') {
        if (distToPlayer <= ENEMY_GUNSHIP_SHOOT_RANGE) {
          enemy.shootTimer = (enemy.shootTimer ?? 0) + seconds;
          if (enemy.shootTimer >= (enemy.shootCooldown ?? ENEMY_GUNSHIP_SHOOT_COOLDOWN)) {
            enemy.shootTimer = 0;
            const muzzleX = enemy.sprite.x + Math.cos(angle) * 24;
            const muzzleY = enemy.sprite.y + Math.sin(angle) * 24;
            this.fireEnemyBullet(muzzleX, muzzleY, angle, particleManager);
          }
        }
      }

      // Белая вспышка при попадании
      if (enemy.isHitFlash > 0) {
        enemy.isHitFlash -= seconds;
        if (enemy.isHitFlash <= 0) {
          enemy.sprite.clearTint();
        }
      }
    }

    // 2. Обновление полета красных плазменных зарядов врагов
    for (let b = this.enemyBullets.length - 1; b >= 0; b--) {
      const bullet = this.enemyBullets[b];
      bullet.sprite.x += bullet.vx * seconds;
      bullet.sprite.y += bullet.vy * seconds;
      bullet.lifetime -= seconds;

      if (bullet.lifetime <= 0) {
        bullet.sprite.destroy();
        this.enemyBullets.splice(b, 1);
      }
    }
  }

  private fireEnemyBullet(
    x: number,
    y: number,
    angle: number,
    particleManager?: ParticleManager,
  ): void {
    soundFx.playTerminatorShoot();

    const bulletSprite = this.scene.add.sprite(x, y, 'enemy_bullet_red');
    bulletSprite.setDepth(11);

    const vx = Math.cos(angle) * ENEMY_GUNSHIP_BULLET_SPEED;
    const vy = Math.sin(angle) * ENEMY_GUNSHIP_BULLET_SPEED;

    this.enemyBullets.push({
      sprite: bulletSprite,
      vx,
      vy,
      lifetime: ENEMY_GUNSHIP_BULLET_LIFETIME,
      damage: ENEMY_GUNSHIP_BULLET_DAMAGE,
    });

    if (particleManager) {
      particleManager.spawnEnemyMuzzleFlash(x, y, angle);
    }
  }

  public checkLaserCollisions(
    weaponSystem: WeaponSystem,
    particleManager: ParticleManager,
    onEnemyKilled: (score: number) => void,
  ): void {
    const lasers = weaponSystem.getLasers();

    for (let l = lasers.length - 1; l >= 0; l--) {
      const laser = lasers[l];

      for (let e = this.enemies.length - 1; e >= 0; e--) {
        const enemy = this.enemies[e];

        if (laser.hitEnemies && laser.hitEnemies.has(enemy)) {
          continue;
        }

        const dist = Phaser.Math.Distance.Between(
          laser.sprite.x,
          laser.sprite.y,
          enemy.sprite.x,
          enemy.sprite.y,
        );

        const hitRadius = (laser.damage && laser.damage > BLASTER_DAMAGE) ? enemy.radius + 6 : enemy.radius;
        if (dist <= hitRadius) {
          soundFx.playHit();
          particleManager.spawnHitSparks(laser.sprite.x, laser.sprite.y);

          if (!laser.hitEnemies) {
            laser.hitEnemies = new Set();
          }
          laser.hitEnemies.add(enemy);

          enemy.sprite.setTint(0xffffff);
          enemy.isHitFlash = 0.08;

          const damage = laser.damage ?? BLASTER_DAMAGE;
          enemy.hp -= damage;

          // Взрывные снаряды: осколочно-фугасный урон по площади
          if (laser.isExplosive) {
            particleManager.spawnExplosion(laser.sprite.x, laser.sprite.y);
            const splashRadius = 110;

            for (let s = this.enemies.length - 1; s >= 0; s--) {
              if (s === e) continue;
              const splashTarget = this.enemies[s];
              const splashDist = Phaser.Math.Distance.Between(
                laser.sprite.x,
                laser.sprite.y,
                splashTarget.sprite.x,
                splashTarget.sprite.y,
              );
              if (splashDist <= splashRadius) {
                splashTarget.sprite.setTint(0xffffff);
                splashTarget.isHitFlash = 0.08;
                splashTarget.hp -= damage * 0.7;
                if (splashTarget.hp <= 0) {
                  this.destroyEnemy(s, particleManager, onEnemyKilled);
                  if (s < e) {
                    e--;
                  }
                }
              }
            }
          }

          if (enemy.hp <= 0) {
            this.destroyEnemy(e, particleManager, onEnemyKilled);
          }

          if (laser.pierceCount && laser.pierceCount > 1) {
            laser.pierceCount -= 1;
          } else {
            weaponSystem.removeLaser(l);
          }
          break;
        }
      }
    }
  }

  /**
   * Нанесение урона плазменным шлейфом
   */
  public checkFireDamage(
    x: number,
    y: number,
    radius: number,
    damage: number,
    particleManager: ParticleManager,
    onEnemyKilled: (score: number) => void,
  ): void {
    for (let e = this.enemies.length - 1; e >= 0; e--) {
      const enemy = this.enemies[e];
      const dist = Phaser.Math.Distance.Between(x, y, enemy.sprite.x, enemy.sprite.y);
      if (dist <= radius + enemy.radius) {
        enemy.hp -= damage;
        enemy.sprite.setTint(0xf97316);
        enemy.isHitFlash = 0.06;
        if (enemy.hp <= 0) {
          this.destroyEnemy(e, particleManager, onEnemyKilled);
        }
      }
    }
  }

  public destroyEnemy(
    index: number,
    particleManager: ParticleManager,
    onEnemyKilled: (score: number) => void,
  ): void {
    const enemy = this.enemies[index];
    if (!enemy) return;

    soundFx.playExplosion();

    if (enemy.type === 'gunship' || enemy.type === 'terminator') {
      particleManager.spawnBigExplosion(enemy.sprite.x, enemy.sprite.y);
    } else {
      particleManager.spawnExplosion(enemy.sprite.x, enemy.sprite.y);
    }

    onEnemyKilled(enemy.scoreValue);
    this.destroyEnemySprites(enemy);
    this.enemies.splice(index, 1);
  }

  public checkPlayerCollisions(
    player: PlayerShip,
    particleManager: ParticleManager,
    onGameOver: () => void,
  ): void {
    // 1. Попадание красных плазменных зарядов в корабль игрока
    for (let b = this.enemyBullets.length - 1; b >= 0; b--) {
      const bullet = this.enemyBullets[b];
      const dist = Phaser.Math.Distance.Between(
        player.x,
        player.y,
        bullet.sprite.x,
        bullet.sprite.y,
      );

      if (dist < 16) {
        const isDead = player.takeDamage(bullet.damage);
        soundFx.playHit();
        this.scene.cameras.main.shake(140, 0.007);
        particleManager.spawnHitSparks(bullet.sprite.x, bullet.sprite.y);

        bullet.sprite.destroy();
        this.enemyBullets.splice(b, 1);

        if (isDead) {
          onGameOver();
          return;
        }
      }
    }

    // 2. Кинетический таран при форсаже
    if (player.hasRamSpikes && player.isDashing) {
      for (let e = this.enemies.length - 1; e >= 0; e--) {
        const enemy = this.enemies[e];
        const dist = Phaser.Math.Distance.Between(player.x, player.y, enemy.sprite.x, enemy.sprite.y);
        if (dist < enemy.radius + 18) {
          soundFx.playExplosion();
          particleManager.spawnExplosion(enemy.sprite.x, enemy.sprite.y);
          enemy.hp -= 20;
          enemy.sprite.setTint(0xffffff);
          enemy.isHitFlash = 0.08;
          if (enemy.hp <= 0) {
            this.destroyEnemy(e, particleManager, () => {});
          }
        }
      }
      return;
    }

    // 3. Контактное столкновение вражеских кораблей со звездолетом игрока
    if (player.invulnTimer > 0 || player.isDashing) return;

    for (const enemy of this.enemies) {
      const dist = Phaser.Math.Distance.Between(
        player.x,
        player.y,
        enemy.sprite.x,
        enemy.sprite.y,
      );

      if (dist < enemy.radius + 14) {
        const isDead = player.takeDamage(15);
        soundFx.playHit();
        this.scene.cameras.main.shake(140, 0.007);
        particleManager.spawnHitSparks(player.x, player.y);

        if (isDead) {
          onGameOver();
        }
        break;
      }
    }
  }

  public destroy(): void {
    this.reset();
  }
}

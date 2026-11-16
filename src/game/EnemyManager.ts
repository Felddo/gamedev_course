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
import { CampaignMission, MissionBossConfig } from './campaign/types';

/**
 * Менеджер вражеских космических кораблей:
 * волны спавна, перехват корабля игрока, стрельба плазменными зарядами,
 * поддержка боссов кампании и расчет попаданий/столкновений в открытом космосе.
 */
export class EnemyManager {
  private scene: Phaser.Scene;
  private enemies: EnemyShip[] = [];
  private enemyBullets: EnemyBullet[] = [];
  private spawnTimer = 0;
  private currentSpawnInterval = 0.1;
  private currentPhase = 1;

  // Интеграция с системой кампании
  private currentMission: CampaignMission | null = null;
  private isSpawningStopped = false;
  private bossSpawned = false;
  private activeBoss: EnemyShip | null = null;

  public onBossSpawned?: (boss: EnemyShip) => void;
  public onBossDestroyed?: (boss: EnemyShip) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public setMission(mission: CampaignMission): void {
    this.currentMission = mission;
    this.isSpawningStopped = false;
    this.bossSpawned = false;
    this.activeBoss = null;
  }

  public getCurrentMission(): CampaignMission | null {
    return this.currentMission;
  }

  public stopSpawning(): void {
    this.isSpawningStopped = true;
  }

  public clearActiveThreats(): void {
    // 1. Уничтожаем все летящие вражеские снаряды
    for (const bullet of this.enemyBullets) {
      bullet.sprite.destroy();
    }
    this.enemyBullets = [];

    // 2. Оставшиеся рядовые враги прекращают атаку и деактивируются
    for (const enemy of this.enemies) {
      if (enemy.sprite && enemy.sprite.active) {
        this.scene.tweens.add({
          targets: enemy.sprite,
          alpha: 0,
          scale: 0.1,
          duration: 400,
          onComplete: () => {
            this.destroyEnemySprites(enemy);
          },
        });
      }
    }
    this.enemies = [];
    this.activeBoss = null;
  }

  public getActiveBoss(): EnemyShip | null {
    return this.activeBoss;
  }

  public isBossSpawned(): boolean {
    return this.bossSpawned;
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
    this.isSpawningStopped = false;
    this.bossSpawned = false;
    this.activeBoss = null;
  }

  private destroyEnemySprites(enemy: EnemyShip): void {
    enemy.sprite.destroy();
  }

  public findNearestEnemy(playerX: number, playerY: number, maxRange = 850): EnemyShip | null {
    let nearest: EnemyShip | null = null;
    let minDist = maxRange;

    for (const enemy of this.enemies) {
      if (!enemy.sprite || !enemy.sprite.active || enemy.hp <= 0) {
        continue;
      }
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
    if (this.isSpawningStopped) return;

    // 1. Проверка появления босса миссии
    if (
      this.currentMission?.isBoss &&
      !this.bossSpawned &&
      this.currentMission.bossConfig
    ) {
      if (survivalTime >= this.currentMission.bossConfig.spawnDelay) {
        this.spawnBoss(cam, this.currentMission.bossConfig);
        this.bossSpawned = true;
      }
    }

    // 2. Периодический спавн рядовых вражеских звеньев
    this.spawnTimer += seconds;
    let spawnIntensity = 1.0;
    if (this.currentMission) {
      spawnIntensity = Math.max(0.1, this.currentMission.enemyConfig.spawnIntensity);
      this.currentSpawnInterval = Math.max(0.08, (0.42 - Math.min(60, survivalTime) * 0.003) / spawnIntensity);
    } else {
      const phaseInfo = this.getCurrentPhaseInfo();
      spawnIntensity = Math.max(0.05, phaseInfo.spawnIntensity || 1.0);
      this.currentSpawnInterval = Math.max(0.05, (0.4 - survivalTime * 0.005) / spawnIntensity);
    }

    while (this.spawnTimer >= this.currentSpawnInterval) {
      this.spawnTimer -= this.currentSpawnInterval;
      this.spawnRandomEnemy(cam, survivalTime);
    }
  }

  public spawnBoss(cam: Phaser.Cameras.Scene2D.Camera, bossConfig: MissionBossConfig): void {
    const viewLeft = cam.worldView.x;
    const viewTop = cam.worldView.y;
    const viewRight = cam.worldView.right;
    const viewBottom = cam.worldView.bottom;

    const edge = Phaser.Math.Between(0, 3);
    const offset = 120;
    let x = 0;
    let y = 0;

    switch (edge) {
      case 0:
        x = Phaser.Math.Between(viewLeft + 50, viewRight - 50);
        y = viewTop - offset;
        break;
      case 1:
        x = Phaser.Math.Between(viewLeft + 50, viewRight - 50);
        y = viewBottom + offset;
        break;
      case 2:
        x = viewLeft - offset;
        y = Phaser.Math.Between(viewTop + 50, viewBottom - 50);
        break;
      case 3:
        x = viewRight + offset;
        y = Phaser.Math.Between(viewTop + 50, viewBottom - 50);
        break;
    }

    const sprite = this.scene.add.sprite(x, y, 'enemy_ship_shooter');
    sprite.setOrigin(0.5, 0.5);
    sprite.setScale(bossConfig.scale);
    if (bossConfig.tint) {
      sprite.setTint(bossConfig.tint);
    }
    sprite.setDepth(9);

    const bossEnemy: EnemyShip = {
      type: 'boss',
      sprite,
      hp: bossConfig.hp,
      maxHp: bossConfig.hp,
      speed: bossConfig.speed,
      scoreValue: 3000,
      radius: Math.round(54 * (bossConfig.scale / 0.95)),
      isHitFlash: 0,
      isInvulnerable: false,
      isBoss: true,
      bossName: bossConfig.name,
      shootCooldown: bossConfig.shootCooldown,
      shootTimer: 0.6,
      animPhase: 0,
      spreadCount: bossConfig.spreadCount,
    };

    this.activeBoss = bossEnemy;
    this.enemies.push(bossEnemy);

    soundFx.playPhaseNotification(2);
    this.scene.cameras.main.shake(450, 0.02);

    if (this.onBossSpawned) {
      this.onBossSpawned(bossEnemy);
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

    if (this.currentMission) {
      const cfg = this.currentMission.enemyConfig;
      const roll = Math.random();
      const gunshipThreshold = cfg.allowGunship ? cfg.gunshipRatio : 0;
      const interceptorThreshold = gunshipThreshold + cfg.interceptorRatio;

      if (roll < gunshipThreshold) {
        this.spawnGunship(x, y);
      } else if (roll < interceptorThreshold) {
        this.spawnInterceptorShip(x, y);
      } else {
        this.spawnScoutShip(x, y);
      }
      return;
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

    const hpMult = this.currentMission
      ? this.currentMission.enemyConfig.healthMultiplier
      : Math.max(0.1, this.getCurrentPhaseInfo().healthMultiplier || 1.0);
    const speedMult = this.currentMission ? this.currentMission.enemyConfig.speedMultiplier : 1.0;
    const gunshipHp = Math.max(1, Math.round(ENEMY_GUNSHIP_HP * hpMult));

    this.enemies.push({
      type: 'gunship',
      sprite,
      hp: gunshipHp,
      maxHp: gunshipHp,
      speed: ENEMY_GUNSHIP_SPEED * speedMult,
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

    const hpMult = this.currentMission
      ? this.currentMission.enemyConfig.healthMultiplier
      : Math.max(0.1, this.getCurrentPhaseInfo().healthMultiplier || 1.0);
    const speedMult = this.currentMission ? this.currentMission.enemyConfig.speedMultiplier : 1.0;
    const interceptorHp = Math.max(1, Math.round(ENEMY_INTERCEPTOR_HP * hpMult));

    this.enemies.push({
      type: 'interceptor',
      sprite,
      hp: interceptorHp,
      maxHp: interceptorHp,
      speed: ENEMY_INTERCEPTOR_SPEED * speedMult,
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

    const hpMult = this.currentMission
      ? this.currentMission.enemyConfig.healthMultiplier
      : Math.max(0.1, this.getCurrentPhaseInfo().healthMultiplier || 1.0);
    const speedMult = this.currentMission ? this.currentMission.enemyConfig.speedMultiplier : 1.0;
    const scoutHp = Math.max(1, Math.round(ENEMY_SCOUT_HP * hpMult));

    this.enemies.push({
      type: 'scout',
      sprite,
      hp: scoutHp,
      maxHp: scoutHp,
      speed: ENEMY_SCOUT_SPEED * speedMult,
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

      // Логика стрельбы босса (веерный залп) и тяжелого крейсера
      if (enemy.isBoss) {
        if (distToPlayer <= 950) {
          enemy.shootTimer = (enemy.shootTimer ?? 0) + seconds;
          if (enemy.shootTimer >= (enemy.shootCooldown ?? 1.5)) {
            enemy.shootTimer = 0;
            const spreadCount = enemy.spreadCount || 3;
            const spreadStep = 0.16;
            const startAngle = angle - ((spreadCount - 1) / 2) * spreadStep;
            const bDmg = this.currentMission?.bossConfig?.bulletDamage ?? 18;
            const bSpd = this.currentMission?.bossConfig?.bulletSpeed ?? 400;

            for (let s = 0; s < spreadCount; s++) {
              const currentAngle = startAngle + s * spreadStep;
              const muzzleDist = enemy.radius * 0.7;
              const muzzleX = enemy.sprite.x + Math.cos(currentAngle) * muzzleDist;
              const muzzleY = enemy.sprite.y + Math.sin(currentAngle) * muzzleDist;
              this.fireEnemyBulletWithParams(muzzleX, muzzleY, currentAngle, bSpd, bDmg, particleManager);
            }
          }
        }
      } else if (enemy.type === 'gunship' || enemy.type === 'terminator') {
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

  public fireEnemyBulletWithParams(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    particleManager?: ParticleManager,
  ): void {
    soundFx.playTerminatorShoot();

    const bulletSprite = this.scene.add.sprite(x, y, 'enemy_bullet_red');
    bulletSprite.setDepth(11);

    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    this.enemyBullets.push({
      sprite: bulletSprite,
      vx,
      vy,
      lifetime: ENEMY_GUNSHIP_BULLET_LIFETIME * 1.2,
      damage,
    });

    if (particleManager) {
      particleManager.spawnEnemyMuzzleFlash(x, y, angle);
    }
  }

  public checkLaserCollisions(
    weaponSystem: WeaponSystem,
    particleManager: ParticleManager,
    onEnemyKilled: (score: number, x: number, y: number, enemyType?: EnemyShip['type'], isBoss?: boolean) => void,
  ): void {
    const lasers = weaponSystem.getLasers();

    for (let l = lasers.length - 1; l >= 0; l--) {
      const laser = lasers[l];

      for (let e = this.enemies.length - 1; e >= 0; e--) {
        const enemy = this.enemies[e];

        if (laser.hitEnemies && laser.hitEnemies.has(enemy)) {
          continue;
        }

        const projectileRadius = (laser.damage && laser.damage > BLASTER_DAMAGE) ? 14 : 10;
        const hitRadius = enemy.radius + projectileRadius;

        const dist = Phaser.Math.Distance.Between(
          laser.sprite.x,
          laser.sprite.y,
          enemy.sprite.x,
          enemy.sprite.y,
        );

        let isHit = dist <= hitRadius;
        if (!isHit) {
          // Проверка промежуточной точки для предотвращения туннелирования высокоскоростных снарядов
          const midX = laser.sprite.x - laser.vx * 0.009;
          const midY = laser.sprite.y - laser.vy * 0.009;
          if (Phaser.Math.Distance.Between(midX, midY, enemy.sprite.x, enemy.sprite.y) <= hitRadius) {
            isHit = true;
          }
        }

        if (isHit) {
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
    onEnemyKilled: (score: number, x: number, y: number, enemyType?: EnemyShip['type'], isBoss?: boolean) => void,
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
    onEnemyKilled?: (score: number, x: number, y: number, enemyType?: EnemyShip['type'], isBoss?: boolean) => void,
  ): void {
    const enemy = this.enemies[index];
    if (!enemy) return;

    soundFx.playExplosion();

    if (enemy.isBoss) {
      this.activeBoss = null;
      this.scene.cameras.main.shake(650, 0.035);
      particleManager.spawnBigExplosion(enemy.sprite.x, enemy.sprite.y);
      particleManager.spawnBigExplosion(enemy.sprite.x + 28, enemy.sprite.y - 20);
      particleManager.spawnBigExplosion(enemy.sprite.x - 28, enemy.sprite.y + 20);
      if (this.onBossDestroyed) {
        this.onBossDestroyed(enemy);
      }
    } else if (enemy.type === 'gunship' || enemy.type === 'terminator') {
      particleManager.spawnBigExplosion(enemy.sprite.x, enemy.sprite.y);
    } else {
      particleManager.spawnExplosion(enemy.sprite.x, enemy.sprite.y);
    }

    const ex = enemy.sprite.x;
    const ey = enemy.sprite.y;
    const scoreVal = enemy.scoreValue;
    const enemyType = enemy.type;
    const isBoss = !!enemy.isBoss;

    if (onEnemyKilled) {
      onEnemyKilled(scoreVal, ex, ey, enemyType, isBoss);
    }
    this.destroyEnemySprites(enemy);
    this.enemies.splice(index, 1);
  }

  public checkPlayerCollisions(
    player: PlayerShip,
    particleManager: ParticleManager,
    onGameOver: () => void,
    onEnemyKilled?: (score: number, x: number, y: number, enemyType?: EnemyShip['type'], isBoss?: boolean) => void,
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
        if (dist < enemy.radius + 20) {
          soundFx.playExplosion();
          particleManager.spawnExplosion(enemy.sprite.x, enemy.sprite.y);
          enemy.hp -= 20;
          enemy.sprite.setTint(0xffffff);
          enemy.isHitFlash = 0.08;
          if (enemy.hp <= 0) {
            this.destroyEnemy(e, particleManager, onEnemyKilled);
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

      if (dist < enemy.radius + 10) {
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

import Phaser from 'phaser';
import { soundFx } from './audio';
import {
  BLASTER_DAMAGE,
  PLAYER_ATTACK_RADIUS,
  MAP_WIDTH,
  MAP_HEIGHT,
  GAME_PHASES,
  PhaseInfo,
  REGULAR_ENEMY_DEFS,
  RegularEnemyDef,
  ENEMY_BULLET_LIFETIME,
  ENEMY_FRIGATE_SHOOT_RANGE,
  ENEMY_DESTROYER_SHOOT_RANGE,
} from './constants';
export type { RegularEnemyDef };
export { REGULAR_ENEMY_DEFS };
import { EnemyShip, EnemyBullet, EnemyType } from './types';
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

  public findNearestEnemy(playerX: number, playerY: number, maxRange = PLAYER_ATTACK_RADIUS): EnemyShip | null {
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

  public handleSpawning(
    seconds: number,
    survivalTime: number,
    cam: Phaser.Cameras.Scene2D.Camera,
    killsCount = 0,
  ): void {
    if (this.isSpawningStopped) return;

    // 1. Проверка появления босса миссии
    if (
      this.currentMission?.isBoss &&
      !this.bossSpawned &&
      this.currentMission.bossConfig
    ) {
      const spawnDelay = this.currentMission.bossConfig.spawnDelay ?? 60;
      const spawnKills =
        this.currentMission.bossConfig.spawnKills ??
        (this.currentMission.targetKills ?? 20);
      if (survivalTime >= spawnDelay || killsCount >= spawnKills) {
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

    const textureKey = bossConfig.texture || 'boss_rocket_001';
    const sprite = this.scene.add.sprite(x, y, textureKey);
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
      collisionDamage: 35,
      isHitFlash: 0,
      isInvulnerable: false,
      isBoss: true,
      bossName: bossConfig.name,
      shootCooldown: bossConfig.shootCooldown,
      shootTimer: 0.5,
      secondaryCooldown: bossConfig.rapidCooldown,
      secondaryShootTimer: bossConfig.rapidCooldown ? 0.3 : undefined,
      animPhase: 0,
      spreadCount: bossConfig.spreadCount,
      shootPattern: bossConfig.pattern || 'spread',
      bulletSpeed: bossConfig.bulletSpeed,
      bulletDamage: bossConfig.bulletDamage,
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
      const s = cfg.scoutRatio ?? 0;
      const i = cfg.interceptorRatio ?? 0;
      const a = cfg.assaultRatio ?? 0;
      const f = cfg.frigateRatio ?? 0;
      const d = cfg.destroyerRatio ?? 0;

      const total = s + i + a + f + d;
      const roll = Math.random() * (total > 0 ? total : 1);

      let threshold = 0;
      if (roll < (threshold += s)) {
        this.spawnEnemyByType('scout', x, y);
      } else if (roll < (threshold += i)) {
        this.spawnEnemyByType('interceptor', x, y);
      } else if (roll < (threshold += a)) {
        this.spawnEnemyByType('assault', x, y);
      } else if (roll < (threshold += f)) {
        this.spawnEnemyByType('frigate', x, y);
      } else {
        this.spawnEnemyByType('destroyer', x, y);
      }
      return;
    }

    // Режим бесконечной игры / фаз
    const phaseInfo = this.getCurrentPhaseInfo();
    const phase = phaseInfo.number;
    const roll = Math.random();

    if (phase >= 4) {
      if (roll < 0.20) this.spawnEnemyByType('destroyer', x, y);
      else if (roll < 0.45) this.spawnEnemyByType('frigate', x, y);
      else if (roll < 0.65) this.spawnEnemyByType('assault', x, y);
      else if (roll < 0.85) this.spawnEnemyByType('interceptor', x, y);
      else this.spawnEnemyByType('scout', x, y);
    } else if (phase >= 2) {
      if (roll < 0.10) this.spawnEnemyByType('destroyer', x, y);
      else if (roll < 0.30) this.spawnEnemyByType('frigate', x, y);
      else if (roll < 0.55) this.spawnEnemyByType('assault', x, y);
      else if (roll < 0.80) this.spawnEnemyByType('interceptor', x, y);
      else this.spawnEnemyByType('scout', x, y);
    } else {
      if (roll < 0.15) this.spawnEnemyByType('assault', x, y);
      else if (roll < 0.50) this.spawnEnemyByType('interceptor', x, y);
      else this.spawnEnemyByType('scout', x, y);
    }
  }

  public spawnEnemyByType(
    type: 'scout' | 'interceptor' | 'assault' | 'frigate' | 'destroyer',
    x: number,
    y: number,
  ): void {
    const def = REGULAR_ENEMY_DEFS[type] || REGULAR_ENEMY_DEFS.scout;

    const sprite = this.scene.add.sprite(x, y, def.texture);
    sprite.setOrigin(0.5, 0.5);
    sprite.setScale(def.scale);
    sprite.setDepth(7);

    const hpMult = this.currentMission
      ? this.currentMission.enemyConfig.healthMultiplier
      : Math.max(0.1, this.getCurrentPhaseInfo().healthMultiplier || 1.0);
    const speedMult = this.currentMission ? this.currentMission.enemyConfig.speedMultiplier : 1.0;
    const enemyHp = Math.max(1, Math.round(def.hp * hpMult));

    this.enemies.push({
      type: def.type,
      sprite,
      hp: enemyHp,
      maxHp: enemyHp,
      speed: def.speed * speedMult,
      scoreValue: def.scoreValue,
      radius: def.radius,
      collisionDamage: def.collisionDamage,
      isHitFlash: 0,
      isInvulnerable: false,
      shootCooldown: def.shootCooldown,
      shootTimer: def.shootCooldown ? Phaser.Math.FloatBetween(0.3, def.shootCooldown) : undefined,
      shootPattern: def.shootPattern,
      spreadCount: def.spreadCount,
      bulletSpeed: def.bulletSpeed,
      bulletDamage: def.bulletDamage,
      animPhase: Math.random() * Math.PI * 2,
      recoil: 0,
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

      // В ограниченной карте: удаляем корабли только если они вылетели далеко за пределы карты
      if (
        enemy.sprite.x < -400 ||
        enemy.sprite.x > MAP_WIDTH + 400 ||
        enemy.sprite.y < -400 ||
        enemy.sprite.y > MAP_HEIGHT + 400
      ) {
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

      // Ограничение врагов пределами боевого сектора (внутри пояса туманностей)
      enemy.sprite.x = Phaser.Math.Clamp(enemy.sprite.x, 130, MAP_WIDTH - 130);
      enemy.sprite.y = Phaser.Math.Clamp(enemy.sprite.y, 130, MAP_HEIGHT - 130);

      // Плавное покачивание кораблей при полете
      enemy.animPhase = (enemy.animPhase ?? 0) + seconds * 4.2;
      const flySway = Math.sin(enemy.animPhase) * 0.04;
      // Боссы развернуты на 180 градусов, чтобы смотреть носовой частью вперед
      const baseRotation = enemy.isBoss ? (angle + Math.PI / 2) : (angle - Math.PI / 2);
      enemy.sprite.rotation = baseRotation + flySway;

      // Логика стрельбы босса и обычных стреляющих противников (фрегат, эсминец)
      if (enemy.isBoss) {
        if (distToPlayer <= 1000) {
          const bDmg = enemy.bulletDamage ?? (this.currentMission?.bossConfig?.bulletDamage ?? 18);
          const bSpd = enemy.bulletSpeed ?? (this.currentMission?.bossConfig?.bulletSpeed ?? 400);

          // 1. Основной залп босса
          enemy.shootTimer = (enemy.shootTimer ?? 0) + seconds;
          if (enemy.shootTimer >= (enemy.shootCooldown ?? 2.0)) {
            enemy.shootTimer = 0;

            if (enemy.shootPattern === 'compact') {
              // Босс 2 (Ударный авианосец): 4 компактных снаряда параллельно в сторону игрока
              this.fireCompactSalvo(enemy, angle, 4, 16, bSpd, bDmg, particleManager);
            } else {
              // Босс 1 (Ракетный крейсер - веер из 5) и Босс 3 (Флагманский линкор - широкий веер)
              const count = enemy.spreadCount ?? (enemy.shootPattern === 'flagship' ? 7 : 5);
              const step = enemy.shootPattern === 'flagship' ? 0.20 : 0.16;
              this.fireSpreadSalvo(enemy, angle, count, step, bSpd, bDmg, particleManager);
            }
          }

          // 2. Дополнительные частые направленные залпы (Босс 3: Флагманский линкор)
          if (enemy.secondaryCooldown) {
            enemy.secondaryShootTimer = (enemy.secondaryShootTimer ?? 0) + seconds;
            if (enemy.secondaryShootTimer >= enemy.secondaryCooldown) {
              enemy.secondaryShootTimer = 0;
              this.fireSingleShot(enemy, angle, bSpd * 1.05, bDmg, particleManager);
            }
          }
        }
      } else if (enemy.shootPattern) {
        // Обычные стреляющие корабли: Ракетный фрегат (одиночный) и Тяжёлый эсминец (веер из 3)
        const range = enemy.type === 'destroyer' ? ENEMY_DESTROYER_SHOOT_RANGE : ENEMY_FRIGATE_SHOOT_RANGE;
        if (distToPlayer <= range) {
          enemy.shootTimer = (enemy.shootTimer ?? 0) + seconds;
          if (enemy.shootTimer >= (enemy.shootCooldown ?? 2.0)) {
            enemy.shootTimer = 0;
            const bSpd = enemy.bulletSpeed ?? 340;
            const bDmg = enemy.bulletDamage ?? 12;

            if (enemy.shootPattern === 'spread') {
              this.fireSpreadSalvo(enemy, angle, enemy.spreadCount ?? 3, 0.18, bSpd, bDmg, particleManager);
            } else {
              this.fireSingleShot(enemy, angle, bSpd, bDmg, particleManager);
            }
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

  private fireSingleShot(
    enemy: EnemyShip,
    angle: number,
    speed: number,
    damage: number,
    particleManager?: ParticleManager,
  ): void {
    if (enemy.isBoss) {
      soundFx.playBossShoot();
    } else {
      soundFx.playTerminatorShoot();
    }
    const muzzleDist = enemy.radius * 0.7;
    const muzzleX = enemy.sprite.x + Math.cos(angle) * muzzleDist;
    const muzzleY = enemy.sprite.y + Math.sin(angle) * muzzleDist;
    this.fireEnemyBulletWithParams(muzzleX, muzzleY, angle, speed, damage, particleManager);
  }

  private fireSpreadSalvo(
    enemy: EnemyShip,
    centerAngle: number,
    count: number,
    spreadStep: number,
    speed: number,
    damage: number,
    particleManager?: ParticleManager,
  ): void {
    // Звук выстрела воспроизводится один раз на весь залп, а не на каждый отдельный снаряд
    if (enemy.isBoss) {
      soundFx.playBossShoot();
    } else {
      soundFx.playTerminatorShoot();
    }
    const startAngle = centerAngle - ((count - 1) / 2) * spreadStep;
    const muzzleDist = enemy.radius * 0.7;

    for (let s = 0; s < count; s++) {
      const shotAngle = startAngle + s * spreadStep;
      const muzzleX = enemy.sprite.x + Math.cos(shotAngle) * muzzleDist;
      const muzzleY = enemy.sprite.y + Math.sin(shotAngle) * muzzleDist;
      this.fireEnemyBulletWithParams(muzzleX, muzzleY, shotAngle, speed, damage, particleManager);
    }
  }

  private fireCompactSalvo(
    enemy: EnemyShip,
    angle: number,
    count: number,
    spacing: number,
    speed: number,
    damage: number,
    particleManager?: ParticleManager,
  ): void {
    // Звук выстрела воспроизводится один раз на весь залп
    if (enemy.isBoss) {
      soundFx.playBossShoot();
    } else {
      soundFx.playTerminatorShoot();
    }
    // Вектор, перпендикулярный направлению на игрока
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    const muzzleDist = enemy.radius * 0.7;
    const baseX = enemy.sprite.x + Math.cos(angle) * muzzleDist;
    const baseY = enemy.sprite.y + Math.sin(angle) * muzzleDist;

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spacing;
      const muzzleX = baseX + perpX * offset;
      const muzzleY = baseY + perpY * offset;
      // Все снаряды летят строго параллельно под одним углом к игроку
      this.fireEnemyBulletWithParams(muzzleX, muzzleY, angle, speed, damage, particleManager);
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
    const bulletSprite = this.scene.add.sprite(x, y, 'enemy_bullet_red');
    bulletSprite.setDepth(11);

    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    this.enemyBullets.push({
      sprite: bulletSprite,
      vx,
      vy,
      lifetime: ENEMY_BULLET_LIFETIME,
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

          const baseDamage = laser.damage ?? BLASTER_DAMAGE;
          const isBoss = enemy.type === 'boss' || !!enemy.isBoss || this.activeBoss === enemy;
          const damage = (isBoss && weaponSystem.hasAnnihilationProtocol)
            ? baseDamage * 1.3
            : baseDamage;
          enemy.hp -= damage;

          // Взрывные снаряды: осколочно-фугасный урон по площади (Плазменные боеприпасы)
          if (laser.isExplosive) {
            particleManager.spawnExplosion(laser.sprite.x, laser.sprite.y);
            const splashRadius = 110;
            const hitInSplash = new Set<EnemyShip>();

            for (let s = this.enemies.length - 1; s >= 0; s--) {
              if (s === e) continue;
              const splashTarget = this.enemies[s];
              if (!splashTarget || hitInSplash.has(splashTarget)) continue;

              const splashDist = Phaser.Math.Distance.Between(
                laser.sprite.x,
                laser.sprite.y,
                splashTarget.sprite.x,
                splashTarget.sprite.y,
              );
              if (splashDist <= splashRadius) {
                hitInSplash.add(splashTarget);
                splashTarget.sprite.setTint(0xffffff);
                splashTarget.isHitFlash = 0.08;
                const splashIsBoss = splashTarget.type === 'boss' || !!splashTarget.isBoss || this.activeBoss === splashTarget;
                const splashBaseDamage = baseDamage * 0.7;
                const splashDamage = (splashIsBoss && weaponSystem.hasAnnihilationProtocol)
                  ? splashBaseDamage * 1.3
                  : splashBaseDamage;
                splashTarget.hp -= splashDamage;
                if (splashTarget.hp <= 0) {
                  this.destroyEnemy(s, particleManager, onEnemyKilled);
                  if (s < e) {
                    e--;
                  }
                }
              }
            }
          }

          // Электромагнитный разряд: 35% шанс вызвать электрическую дугу по ближайшему другому врагу
          if (weaponSystem.hasEmpDischarge && Math.random() < 0.35) {
            let nearestOther: EnemyShip | null = null;
            let minOtherDist = 320;
            for (let o = 0; o < this.enemies.length; o++) {
              const other = this.enemies[o];
              if (other === enemy || other.hp <= 0 || !other.sprite?.active) continue;
              const d = Phaser.Math.Distance.Between(
                laser.sprite.x,
                laser.sprite.y,
                other.sprite.x,
                other.sprite.y,
              );
              if (d < minOtherDist) {
                minOtherDist = d;
                nearestOther = other;
              }
            }
            if (nearestOther) {
              particleManager.spawnElectricArc(
                laser.sprite.x,
                laser.sprite.y,
                nearestOther.sprite.x,
                nearestOther.sprite.y,
              );
              soundFx.playHit();
              nearestOther.sprite.setTint(0x38bdf8);
              nearestOther.isHitFlash = 0.08;
              const arcIsBoss = nearestOther.type === 'boss' || !!nearestOther.isBoss || this.activeBoss === nearestOther;
              const arcDamage = (arcIsBoss && weaponSystem.hasAnnihilationProtocol)
                ? baseDamage * 1.3
                : baseDamage;
              nearestOther.hp -= arcDamage;
              if (nearestOther.hp <= 0) {
                const otherIdx = this.enemies.indexOf(nearestOther);
                if (otherIdx !== -1) {
                  this.destroyEnemy(otherIdx, particleManager, onEnemyKilled);
                  if (otherIdx < e) {
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
    } else if (enemy.type === 'destroyer' || enemy.type === 'frigate') {
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
        const damage = enemy.collisionDamage ?? 15;
        const isDead = player.takeDamage(damage);
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

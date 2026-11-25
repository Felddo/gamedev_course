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

interface GravityWell {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  pullForce: number;
  color: number;
}

/**
 * Менеджер вражеских космических кораблей:
 * волны спавна, перехват корабля игрока, стрельба плазменными зарядами,
 * поддержка боссов кампании и расчет попаданий/столкновений в открытом космосе.
 */
export class EnemyManager {
  private scene: Phaser.Scene;
  private enemies: EnemyShip[] = [];
  private enemyBullets: EnemyBullet[] = [];
  private gravityWells: GravityWell[] = [];
  private gravityGraphics: Phaser.GameObjects.Graphics | null = null;
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
    this.gravityGraphics = this.scene.add.graphics();
    this.gravityGraphics.setDepth(5.4);
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
    this.gravityWells = [];
    this.gravityGraphics?.clear();

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
    this.gravityWells = [];
    this.gravityGraphics?.clear();
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
    this.gravityWells = [];
    this.gravityGraphics?.clear();

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
    // 0. Обновление гравитационных полей притяжения (ракета 007)
    if (this.gravityGraphics) {
      this.gravityGraphics.clear();
      for (let gIdx = this.gravityWells.length - 1; gIdx >= 0; gIdx--) {
        const well = this.gravityWells[gIdx];
        well.life -= seconds;
        if (well.life <= 0) {
          this.gravityWells.splice(gIdx, 1);
          continue;
        }
        const ratio = well.life / well.maxLife;
        const pulse = 0.85 + Math.sin((well.maxLife - well.life) * 14) * 0.15;
        this.gravityGraphics.fillStyle(well.color, 0.12 * ratio);
        this.gravityGraphics.fillCircle(well.x, well.y, well.radius * pulse);
        this.gravityGraphics.lineStyle(1.8, well.color, 0.55 * ratio);
        this.gravityGraphics.strokeCircle(well.x, well.y, well.radius * pulse);
        this.gravityGraphics.lineStyle(1.4, 0xffffff, 0.4 * ratio);
        this.gravityGraphics.strokeCircle(well.x, well.y, well.radius * 0.45 * ratio);
      }
    }

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

      // Замедление от ракеты-замедлителя (002)
      let effectiveSpeed = enemy.speed;
      if (enemy.slowTimer && enemy.slowTimer > 0) {
        enemy.slowTimer -= seconds;
        if (enemy.slowTimer > 0) {
          effectiveSpeed *= enemy.slowMultiplier ?? 0.55;
        } else {
          enemy.slowTimer = 0;
          if (enemy.isHitFlash <= 0) {
            enemy.sprite.clearTint();
          }
        }
      }

      // Курс на сближение с кораблем игрока
      enemy.sprite.x += Math.cos(angle) * effectiveSpeed * seconds;
      enemy.sprite.y += Math.sin(angle) * effectiveSpeed * seconds;

      // Притяжение от гравитационных зон (007)
      for (const well of this.gravityWells) {
        const gdx = well.x - enemy.sprite.x;
        const gdy = well.y - enemy.sprite.y;
        const gDist = Math.hypot(gdx, gdy);
        if (gDist <= well.radius && gDist > 8) {
          const pull = well.pullForce * (enemy.isBoss ? 0.35 : 1.0) * seconds;
          enemy.sprite.x += (gdx / gDist) * pull;
          enemy.sprite.y += (gdy / gDist) * pull;
        }
      }

      // Импульс отбрасывания от ударной волны (006)
      if (enemy.knockbackVx || enemy.knockbackVy) {
        const kvx = enemy.knockbackVx ?? 0;
        const kvy = enemy.knockbackVy ?? 0;
        enemy.sprite.x += kvx * seconds;
        enemy.sprite.y += kvy * seconds;
        const decay = Math.pow(0.0015, seconds);
        enemy.knockbackVx = Math.abs(kvx * decay) < 5 ? 0 : kvx * decay;
        enemy.knockbackVy = Math.abs(kvy * decay) < 5 ? 0 : kvy * decay;
      }

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
          if (enemy.slowTimer && enemy.slowTimer > 0) {
            enemy.sprite.setTint(0x67e8f9);
          } else {
            enemy.sprite.clearTint();
          }
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
          const hitX = laser.sprite.x;
          const hitY = laser.sprite.y;
          soundFx.playHit();
          particleManager.spawnHitSparks(hitX, hitY);

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

          // Взрывные снаряды: осколочно-фугасный урон по площади
          if (laser.isExplosive) {
            this.applyAreaDamage(
              hitX,
              hitY,
              110,
              baseDamage * 0.7,
              enemy,
              weaponSystem,
              particleManager,
              onEnemyKilled,
            );
          }

          // Уникальные механики 10 типов ракет из магазина
          const missileCode = laser.missileTypeCode;
          const missileRarity = laser.missileRarity ?? 'common';
          let bouncedToTarget = false;

          if (missileCode === '002') {
            // 002: Ракета-замедлитель (обновляется, не складывается)
            enemy.slowTimer = 2.0;
            enemy.slowMultiplier = 0.55;
          } else if (missileCode === '003' && !laser.isSubProjectile) {
            // 003: Веерная ракета — разлёт веером из 4 небольших снарядов
            const flightAngle = Math.atan2(laser.vy, laser.vx);
            const fanOffsets = [-0.55, -0.18, 0.18, 0.55];
            const subDamage = baseDamage * 0.45;
            for (const offset of fanOffsets) {
              weaponSystem.spawnSubProjectile(
                hitX,
                hitY,
                flightAngle + offset,
                subDamage,
                missileRarity,
                '010',
                0.55,
                0.28,
                enemy,
              );
            }
          } else if (missileCode === '004' && (laser.bouncesLeft ?? 0) > 0) {
            // 004: Ракета-рикошет — 1 отскок к ближайшей другой цели
            const nextTarget = this.findNearestRicochetTarget(hitX, hitY, 380, laser.hitEnemies);
            if (nextTarget) {
              laser.bouncesLeft = (laser.bouncesLeft ?? 1) - 1;
              const speed = Math.hypot(laser.vx, laser.vy) || 650;
              const bounceAngle = Phaser.Math.Angle.Between(
                hitX,
                hitY,
                nextTarget.sprite.x,
                nextTarget.sprite.y,
              );
              laser.vx = Math.cos(bounceAngle) * speed;
              laser.vy = Math.sin(bounceAngle) * speed;
              laser.sprite.setRotation(bounceAngle + Math.PI / 2);
              laser.lifetime = Math.max(laser.lifetime, 0.5);
              bouncedToTarget = true;
            }
          } else if (missileCode === '005' && !laser.isSubProjectile) {
            // 005: Ракета-взрыватель — дополнительный небольшой взрыв вокруг точки попадания
            this.spawnMissileExplosionRing(hitX, hitY, 85, 0xf97316);
            this.applyAreaDamage(
              hitX,
              hitY,
              85,
              baseDamage * 0.6,
              enemy,
              weaponSystem,
              particleManager,
              onEnemyKilled,
            );
          } else if (missileCode === '006' && !laser.isSubProjectile) {
            // 006: Импульсная ракета — ударная волна, слегка отталкивающая ближайших врагов
            this.spawnMissileExplosionRing(hitX, hitY, 125, 0x38bdf8);
            for (const target of this.enemies) {
              if (!target.sprite?.active || target.hp <= 0) continue;
              const dx = target.sprite.x - hitX;
              const dy = target.sprite.y - hitY;
              const pushDist = Math.hypot(dx, dy);
              if (pushDist <= 125) {
                const pushAngle = pushDist > 0.001
                  ? Math.atan2(dy, dx)
                  : Math.atan2(laser.vy, laser.vx);
                const impulse = target.isBoss ? 70 : 210;
                target.knockbackVx = (target.knockbackVx ?? 0) + Math.cos(pushAngle) * impulse;
                target.knockbackVy = (target.knockbackVy ?? 0) + Math.sin(pushAngle) * impulse;
              }
            }
          } else if (missileCode === '007' && !laser.isSubProjectile) {
            // 007: Гравитационная ракета — небольшая область притяжения
            const wellColor =
              missileRarity === 'legendary'
                ? 0xf87171
                : missileRarity === 'rare'
                  ? 0x34d399
                  : 0x60a5fa;
            this.gravityWells.push({
              x: hitX,
              y: hitY,
              radius: 145,
              life: 1.4,
              maxLife: 1.4,
              pullForce: 140,
              color: wellColor,
            });
          } else if (missileCode === '008' && !laser.isSubProjectile) {
            // 008: Ракета треугольник — 3 снаряда под углом 120° (форма логотипа Mercedes-Benz)
            const backAngle = Math.atan2(laser.vy, laser.vx) + Math.PI;
            const step120 = (Math.PI * 2) / 3;
            const subDamage = baseDamage * 0.55;
            for (let k = 0; k < 3; k++) {
              weaponSystem.spawnSubProjectile(
                hitX,
                hitY,
                backAngle + k * step120,
                subDamage,
                missileRarity,
                '010',
                0.62,
                0.32,
                enemy,
              );
            }
          } else if (missileCode === '009' && !laser.isSubProjectile) {
            // 009: Ракета-перехватчик — уничтожает один вражеский снаряд поблизости
            this.interceptNearestEnemyBullet(hitX, hitY, 280, particleManager);
          }

          const enemyIdx = this.enemies.indexOf(enemy);
          if (enemyIdx !== -1 && enemy.hp <= 0) {
            this.destroyEnemy(enemyIdx, particleManager, onEnemyKilled);
          }

          if (!bouncedToTarget) {
            if (laser.pierceCount && laser.pierceCount > 1) {
              laser.pierceCount -= 1;
            } else {
              weaponSystem.removeLaser(l);
            }
          }
          break;
        }
      }
    }
  }

  private applyAreaDamage(
    x: number,
    y: number,
    radius: number,
    splashBaseDamage: number,
    excludeEnemy: EnemyShip,
    weaponSystem: WeaponSystem,
    particleManager: ParticleManager,
    onEnemyKilled: (score: number, x: number, y: number, enemyType?: EnemyShip['type'], isBoss?: boolean) => void,
  ): void {
    particleManager.spawnExplosion(x, y);
    const hitInSplash = new Set<EnemyShip>();

    for (let s = this.enemies.length - 1; s >= 0; s--) {
      const splashTarget = this.enemies[s];
      if (!splashTarget || splashTarget === excludeEnemy || hitInSplash.has(splashTarget)) continue;

      const splashDist = Phaser.Math.Distance.Between(
        x,
        y,
        splashTarget.sprite.x,
        splashTarget.sprite.y,
      );
      if (splashDist <= radius) {
        hitInSplash.add(splashTarget);
        splashTarget.sprite.setTint(0xffffff);
        splashTarget.isHitFlash = 0.08;
        const splashIsBoss =
          splashTarget.type === 'boss' ||
          !!splashTarget.isBoss ||
          this.activeBoss === splashTarget;
        const splashDamage =
          splashIsBoss && weaponSystem.hasAnnihilationProtocol
            ? splashBaseDamage * 1.3
            : splashBaseDamage;
        splashTarget.hp -= splashDamage;
        if (splashTarget.hp <= 0) {
          this.destroyEnemy(s, particleManager, onEnemyKilled);
        }
      }
    }
  }

  private findNearestRicochetTarget(
    x: number,
    y: number,
    maxRange: number,
    excluded: Set<EnemyShip>,
  ): EnemyShip | null {
    let nearest: EnemyShip | null = null;
    let bestDist = maxRange;
    for (const candidate of this.enemies) {
      if (!candidate.sprite?.active || candidate.hp <= 0 || excluded.has(candidate)) {
        continue;
      }
      const d = Phaser.Math.Distance.Between(x, y, candidate.sprite.x, candidate.sprite.y);
      if (d < bestDist) {
        bestDist = d;
        nearest = candidate;
      }
    }
    return nearest;
  }

  private spawnMissileExplosionRing(x: number, y: number, radius: number, color: number): void {
    const ring = this.scene.add.circle(x, y, Math.max(12, radius * 0.25), color, 0.22);
    ring.setStrokeStyle(2.5, color, 0.9);
    ring.setDepth(13);
    this.scene.tweens.add({
      targets: ring,
      scale: radius / Math.max(12, radius * 0.25),
      alpha: 0,
      duration: 210,
      onComplete: () => ring.destroy(),
    });
  }

  private interceptNearestEnemyBullet(
    x: number,
    y: number,
    maxRange: number,
    particleManager: ParticleManager,
  ): void {
    let bestIdx = -1;
    let bestDist = maxRange;

    for (let i = 0; i < this.enemyBullets.length; i++) {
      const b = this.enemyBullets[i];
      if (!b.sprite?.active) continue;
      const d = Phaser.Math.Distance.Between(x, y, b.sprite.x, b.sprite.y);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) return;
    const bullet = this.enemyBullets[bestIdx];
    const bx = bullet.sprite.x;
    const by = bullet.sprite.y;
    bullet.sprite.destroy();
    this.enemyBullets.splice(bestIdx, 1);

    particleManager.spawnHitSparks(bx, by);
    const zap = this.scene.add.graphics();
    zap.setDepth(14);
    zap.lineStyle(2, 0x38bdf8, 0.95);
    zap.lineBetween(x, y, bx, by);
    this.scene.tweens.add({
      targets: zap,
      alpha: 0,
      duration: 140,
      onComplete: () => zap.destroy(),
    });
  }

  /**
   * Нанесение урона энергетическим следом (ракета 001)
   */
  public checkEnergyTrailDamage(
    weaponSystem: WeaponSystem,
    particleManager: ParticleManager,
    onEnemyKilled: (score: number, x: number, y: number, enemyType?: EnemyShip['type'], isBoss?: boolean) => void,
  ): void {
    const trails = weaponSystem.getEnergyTrails();
    if (trails.length === 0 || this.enemies.length === 0) return;

    for (let e = this.enemies.length - 1; e >= 0; e--) {
      const enemy = this.enemies[e];
      if (!enemy.sprite?.active || enemy.hp <= 0) continue;

      for (const seg of trails) {
        if ((seg.hitTickMap.get(enemy) ?? 0) > 0) continue;
        const dist = Phaser.Math.Distance.Between(seg.x, seg.y, enemy.sprite.x, enemy.sprite.y);
        if (dist <= seg.radius + enemy.radius) {
          seg.hitTickMap.set(enemy, 0.16);
          enemy.hp -= seg.damage;
          enemy.sprite.setTint(0xffffff);
          enemy.isHitFlash = 0.05;
          particleManager.spawnHitSparks(enemy.sprite.x, enemy.sprite.y);
          if (enemy.hp <= 0) {
            this.destroyEnemy(e, particleManager, onEnemyKilled);
            break;
          }
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
    if (this.gravityGraphics) {
      this.gravityGraphics.destroy();
      this.gravityGraphics = null;
    }
  }
}

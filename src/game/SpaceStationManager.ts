import Phaser from 'phaser';
import { SpaceStation } from './types';
import { WeaponSystem } from './WeaponSystem';
import { ParticleManager } from './ParticleManager';
import { EnemyManager } from './EnemyManager';
import { MeteorManager } from './MeteorManager';
import { PlayerShip } from './PlayerShip';
import { soundFx } from './audio';
import { BLASTER_DAMAGE } from './constants';

const STATION_TEXTURE_KEYS = [
  'space_station_020',
  'space_station_021',
  'space_station_024',
];

/**
 * Менеджер странствующих космических баз:
 * - Появление на карте баз 3-х видов (020, 021, 024)
 * - Медленный дрейф и величественное вращение в открытом космосе (не стреляют)
 * - Красная полоска здоровья (HP bar) сверху
 * - При уничтожении: колоссальный взрыв с нанесением урона окружающим объектам и начислением опыта
 */
export class SpaceStationManager {
  private scene: Phaser.Scene;
  private stations: SpaceStation[] = [];
  private spawnTimer = 3.0;
  private maxStations = 4;
  private spawnInterval = 14.0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public getStations(): SpaceStation[] {
    return this.stations;
  }

  public reset(): void {
    for (const station of this.stations) {
      this.destroyStationSprites(station);
    }
    this.stations = [];
    this.spawnTimer = 3.0;
  }

  private destroyStationSprites(station: SpaceStation): void {
    station.sprite.destroy();
    station.hpBarBg.destroy();
    station.hpBarFill.destroy();
  }

  /**
   * Начальный спавн баз при старте игры
   */
  public createInitialStations(count = 2): void {
    const cam = this.scene.cameras.main;
    const cx = cam.worldView ? cam.worldView.centerX : 1536;
    const cy = cam.worldView ? cam.worldView.centerY : 838;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.4, 0.4);
      const dist = Phaser.Math.FloatBetween(600, 1100);
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const typeIndex = (i % 3) as 0 | 1 | 2;
      this.spawnStationAt(x, y, typeIndex, angle + Math.PI / 2);
    }
  }

  /**
   * Периодический спавн баз вокруг текущей области обзора камеры в бесконечной карте
   */
  public update(seconds: number, cam: Phaser.Cameras.Scene2D.Camera): void {
    this.spawnTimer -= seconds;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Phaser.Math.FloatBetween(this.spawnInterval * 0.8, this.spawnInterval * 1.3);
      if (this.stations.length < this.maxStations) {
        this.spawnStationAroundCamera(cam);
      }
    }

    const camCenterX = cam.worldView ? cam.worldView.centerX : 0;
    const camCenterY = cam.worldView ? cam.worldView.centerY : 0;

    for (let i = this.stations.length - 1; i >= 0; i--) {
      const station = this.stations[i];

      // Медленное плавное странствие в космическом пространстве
      station.animPhase += seconds * 0.35;
      station.moveAngle += Math.sin(station.animPhase) * 0.14 * seconds;

      station.sprite.x += Math.cos(station.moveAngle) * station.speed * seconds;
      station.sprite.y += Math.sin(station.moveAngle) * station.speed * seconds;
      station.sprite.rotation += station.rotationSpeed * seconds;

      // Обновление таймера вспышки от попадания
      if (station.isHitFlash > 0) {
        station.isHitFlash -= seconds;
        if (station.isHitFlash <= 0) {
          station.sprite.clearTint();
        }
      }

      // Обновление красной полоски HP сверху базы
      const barWidth = station.radius * 1.8;
      const barY = station.sprite.y - station.radius - 18;
      const hpRatio = Phaser.Math.Clamp(station.hp / station.maxHp, 0, 1);
      const currentFillW = barWidth * hpRatio;

      station.hpBarBg.setPosition(station.sprite.x, barY);
      station.hpBarFill.width = currentFillW;
      station.hpBarFill.setPosition(station.sprite.x - barWidth / 2 + currentFillW / 2, barY);

      // Очистка баз, оставшихся далеко позади при исследовании бесконечного космоса
      const distToCamera = Phaser.Math.Distance.Between(
        station.sprite.x,
        station.sprite.y,
        camCenterX,
        camCenterY,
      );
      if (distToCamera > 3600) {
        this.destroyStationSprites(station);
        this.stations.splice(i, 1);
      }
    }
  }

  /**
   * Спавн станции на границе экрана
   */
  private spawnStationAroundCamera(cam: Phaser.Cameras.Scene2D.Camera): void {
    const vw = cam.worldView ? cam.worldView.width : 1600;
    const vh = cam.worldView ? cam.worldView.height : 900;
    const vx = cam.worldView ? cam.worldView.x : 0;
    const vy = cam.worldView ? cam.worldView.y : 0;
    const offset = Phaser.Math.Between(160, 260);

    const side = Phaser.Math.Between(0, 3);
    let startX = 0;
    let startY = 0;

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

    // Траектория движения направлена внутрь исследуемого сектора
    const targetCenterX = vx + vw / 2 + Phaser.Math.Between(-300, 300);
    const targetCenterY = vy + vh / 2 + Phaser.Math.Between(-300, 300);
    const moveAngle = Phaser.Math.Angle.Between(startX, startY, targetCenterX, targetCenterY);

    const typeRoll = Phaser.Math.Between(0, 2) as 0 | 1 | 2;
    this.spawnStationAt(startX, startY, typeRoll, moveAngle);
  }

  /**
   * Инициализация объекта космической базы выбранного типа
   */
  public spawnStationAt(
    x: number,
    y: number,
    typeIndex: 0 | 1 | 2,
    moveAngle: number,
  ): void {
    const textureKey = STATION_TEXTURE_KEYS[typeIndex];

    let maxHp = 40;
    let radius = 48;
    let scale = 1.15;
    let speed = Phaser.Math.FloatBetween(24, 34);
    let xpReward = 400;
    let explosionRadius = 240;
    let explosionDamage = 45;

    if (typeIndex === 1) {
      // 021: Орбитальный индустриальный комплекс
      maxHp = 70;
      radius = 62;
      scale = 1.35;
      speed = Phaser.Math.FloatBetween(18, 28);
      xpReward = 700;
      explosionRadius = 300;
      explosionDamage = 60;
    } else if (typeIndex === 2) {
      // 024: Тяжелая звездная цитадель
      maxHp = 110;
      radius = 78;
      scale = 1.55;
      speed = Phaser.Math.FloatBetween(14, 22);
      xpReward = 1100;
      explosionRadius = 360;
      explosionDamage = 80;
    }

    const sprite = this.scene.add.sprite(x, y, textureKey);
    sprite.setOrigin(0.5, 0.5);
    sprite.setScale(scale);
    sprite.setDepth(6.5);
    sprite.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));

    // Красная полоска HP сверху базы
    const barWidth = radius * 1.8;
    const barHeight = 7;
    const barY = y - radius - 18;

    const hpBarBg = this.scene.add.rectangle(x, barY, barWidth + 4, barHeight + 4, 0x020617, 0.85);
    hpBarBg.setStrokeStyle(1.2, 0x475569, 0.9);
    hpBarBg.setDepth(15);

    const hpBarFill = this.scene.add.rectangle(x, barY, barWidth, barHeight, 0xef4444, 1.0);
    hpBarFill.setDepth(15.1);

    this.stations.push({
      sprite,
      hpBarBg,
      hpBarFill,
      typeIndex,
      vx: Math.cos(moveAngle) * speed,
      vy: Math.sin(moveAngle) * speed,
      speed,
      moveAngle,
      rotationSpeed: Phaser.Math.FloatBetween(0.04, 0.09) * (Math.random() < 0.5 ? 1 : -1),
      animPhase: Math.random() * Math.PI * 2,
      hp: maxHp,
      maxHp,
      radius,
      scale,
      isHitFlash: 0,
      xpReward,
      explosionRadius,
      explosionDamage,
    });
  }

  /**
   * Проверка попаданий снарядов орудий в космические базы
   */
  public checkLaserCollisions(
    weaponSystem: WeaponSystem,
    particleManager: ParticleManager,
    onScoreGained: (score: number) => void,
    enemyManager: EnemyManager,
    meteorManager: MeteorManager,
    playerShip: PlayerShip,
  ): void {
    const lasers = weaponSystem.getLasers();

    for (let l = lasers.length - 1; l >= 0; l--) {
      const laser = lasers[l];

      for (let s = this.stations.length - 1; s >= 0; s--) {
        const station = this.stations[s];
        const dist = Phaser.Math.Distance.Between(
          laser.sprite.x,
          laser.sprite.y,
          station.sprite.x,
          station.sprite.y,
        );

        if (dist <= station.radius + 8) {
          soundFx.playHit();
          particleManager.spawnHitSparks(laser.sprite.x, laser.sprite.y);

          // Вспышка обшивки при получении урона
          station.sprite.setTint(0xffffff);
          station.isHitFlash = 0.08;

          const damage = laser.damage ?? BLASTER_DAMAGE;
          station.hp -= damage;

          // Взрывной сплеш снаряда
          if (laser.isExplosive) {
            particleManager.spawnExplosion(laser.sprite.x, laser.sprite.y);
          }

          // Бронебойный пробой
          if (laser.pierceCount && laser.pierceCount > 1) {
            laser.pierceCount -= 1;
          } else {
            weaponSystem.removeLaser(l);
          }

          // Уничтожение базы при потере всего здоровья
          if (station.hp <= 0) {
            this.destroyStation(
              s,
              particleManager,
              onScoreGained,
              enemyManager,
              meteorManager,
              playerShip,
            );
          }
          break;
        }
      }
    }
  }

  /**
   * Урон базам от напалмового огненного следа
   */
  public checkFireDamage(
    x: number,
    y: number,
    radius: number,
    damage: number,
    particleManager: ParticleManager,
    onScoreGained: (score: number) => void,
    enemyManager: EnemyManager,
    meteorManager: MeteorManager,
    playerShip: PlayerShip,
  ): void {
    for (let s = this.stations.length - 1; s >= 0; s--) {
      const station = this.stations[s];
      const dist = Phaser.Math.Distance.Between(x, y, station.sprite.x, station.sprite.y);
      if (dist <= radius + station.radius) {
        station.hp -= damage;
        station.sprite.setTint(0xf97316);
        station.isHitFlash = 0.06;

        if (station.hp <= 0) {
          this.destroyStation(
            s,
            particleManager,
            onScoreGained,
            enemyManager,
            meteorManager,
            playerShip,
          );
        }
      }
    }
  }

  /**
   * Разрушение базы:
   * - Колоссальный детонационный взрыв
   * - Нанесение сокрушительного урона окружающим объектам (метеоры, осколочные волны)
   * - Начисление опыта игроку с эффектным всплывающим индикатором
   */
  public destroyStation(
    index: number,
    particleManager: ParticleManager,
    onScoreGained: (score: number) => void,
    enemyManager: EnemyManager,
    meteorManager: MeteorManager,
    playerShip: PlayerShip,
  ): void {
    const station = this.stations[index];
    if (!station) return;

    const sx = station.sprite.x;
    const sy = station.sprite.y;
    const expRadius = station.explosionRadius;
    const expDamage = station.explosionDamage;
    const xpReward = station.xpReward;

    soundFx.playExplosion();
    this.scene.cameras.main.shake(360, 0.018);

    // Колоссальный взрыв станции и всплывающий текст опыта
    particleManager.spawnStationMegaExplosion(sx, sy, expRadius, xpReward);
    onScoreGained(xpReward);

    // 1. Урон окружающим вражеским кораблям
    const enemies = enemyManager.getEnemies();
    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];
      const dist = Phaser.Math.Distance.Between(sx, sy, enemy.sprite.x, enemy.sprite.y);
      if (dist <= expRadius) {
        particleManager.spawnExplosion(enemy.sprite.x, enemy.sprite.y);
        enemy.hp -= expDamage;
        enemy.sprite.setTint(0xffffff);
        enemy.isHitFlash = 0.12;
        if (enemy.hp <= 0) {
          enemyManager.destroyEnemy(e, particleManager, onScoreGained);
        }
      }
    }

    // 2. Раскалывание и урон окружающим метеоритам
    const meteors = meteorManager.getMeteors();
    for (let m = meteors.length - 1; m >= 0; m--) {
      const meteor = meteors[m];
      const dist = Phaser.Math.Distance.Between(sx, sy, meteor.sprite.x, meteor.sprite.y);
      if (dist <= expRadius) {
        meteor.hp -= expDamage;
        meteor.sprite.setTint(0xffffff);
        meteor.isHitFlash = 0.12;
        particleManager.spawnExplosion(meteor.sprite.x, meteor.sprite.y);

        if (meteor.hp <= 0) {
          meteor.sprite.destroy();
          meteors.splice(m, 1);
        }
      }
    }

    // 3. Урон кораблю игрока, если он оказался в эпицентре взрыва
    const distToPlayer = Phaser.Math.Distance.Between(sx, sy, playerShip.x, playerShip.y);
    if (distToPlayer <= expRadius * 0.75) {
      playerShip.takeDamage(18);
      soundFx.playHit();
      this.scene.cameras.main.shake(200, 0.012);
      particleManager.spawnHitSparks(playerShip.x, playerShip.y);
    }

    this.destroyStationSprites(station);
    this.stations.splice(index, 1);
  }

  public destroy(): void {
    this.reset();
  }
}

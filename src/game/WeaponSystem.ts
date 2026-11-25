import Phaser from 'phaser';
import { soundFx } from './audio';
import {
  BLASTER_COOLDOWN,
  BLASTER_SPEED,
  BLASTER_RANGE,
  SUPER_BLASTER_COOLDOWN,
  SUPER_BLASTER_SPEED,
  SUPER_BLASTER_DAMAGE,
  BLASTER_DAMAGE,
} from './constants';
import { LaserProjectile, EnemyShip, MissileTypeCodeRef, MissileRarityRef } from './types';
import { PlayerShip } from './PlayerShip';
import { ParticleManager } from './ParticleManager';
import { CalculatedShipStats } from './shipBuilder/modulesCatalog';
import {
  DEFAULT_MISSILE_ID,
  MISSILE_RARITY_CONFIG,
  parseMissileId,
} from './shop/missilesCatalog';

export interface EnergyTrailSegment {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  radius: number;
  damage: number;
  color: number;
  hitTickMap: Map<EnemyShip, number>;
}

/**
 * Оружейная система космического корабля:
 * носовые фотонно-плазменные орудия и режим перегрузки реактора (залповый огонь)
 */
export class WeaponSystem {
  private scene: Phaser.Scene;
  private lasers: LaserProjectile[] = [];
  private energyTrails: EnergyTrailSegment[] = [];
  private trailGraphics: Phaser.GameObjects.Graphics | null = null;
  private blasterTimer = 0;
  private superMuzzleAlternate = 0;
  private equippedMissileId: string | null = null;

  // Характеристики от установленных боевых модулей конструктора
  public bulletDamageBonus = 0;
  public fireRateMultiplier = 1.0;
  public bulletSpeedBonus = 0;
  public extraProjectiles = 0;

  // Тактические апгрейды оружейной системы
  public appliedUpgrades = new Set<string>();
  public hasExplosiveShells = false;
  public hasTwinCannon = false;
  public hasRapidPlasma = false;
  public hasPiercing = false;
  public cooldownMultiplier = 1.0;

  // Модификации корабля
  public modFireRateMultiplier = 1.0;
  public modDamageMultiplier = 1.0;
  public hasAnnihilationProtocol = false;

  public getBulletDamage(baseDamage: number): number {
    return (baseDamage + this.bulletDamageBonus) * this.modDamageMultiplier;
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.trailGraphics = this.scene.add.graphics();
    this.trailGraphics.setDepth(5.2);
  }

  public setEquippedMissile(missileId?: string | null): void {
    this.equippedMissileId = missileId || null;
  }

  public getEquippedMissileId(): string | null {
    return this.equippedMissileId;
  }

  private getActiveMissileSpec(): {
    textureKey: string;
    damage: number;
    typeCode: MissileTypeCodeRef;
    rarity: MissileRarityRef;
  } {
    const parsed = parseMissileId(this.equippedMissileId);
    if (parsed) {
      const texKey = this.scene.textures.exists(parsed.textureKey)
        ? parsed.textureKey
        : 'player_missile';
      return {
        textureKey: texKey,
        damage: parsed.damage,
        typeCode: parsed.typeCode,
        rarity: parsed.rarity,
      };
    }
    const fallback = parseMissileId(DEFAULT_MISSILE_ID);
    return {
      textureKey: 'player_missile',
      damage: fallback ? fallback.damage : BLASTER_DAMAGE,
      typeCode: '010',
      rarity: 'common',
    };
  }

  public getLasers(): LaserProjectile[] {
    return this.lasers;
  }

  public getEnergyTrails(): EnergyTrailSegment[] {
    return this.energyTrails;
  }

  public removeLaser(index: number): void {
    const laser = this.lasers[index];
    if (laser) {
      laser.sprite.destroy();
      this.lasers.splice(index, 1);
    }
  }

  public reset(): void {
    for (const laser of this.lasers) {
      laser.sprite.destroy();
    }
    this.lasers = [];
    this.energyTrails = [];
    this.trailGraphics?.clear();
    this.blasterTimer = 0;
    this.superMuzzleAlternate = 0;
    this.resetUpgrades();
  }

  public applyUpgrade(upgradeId: string): void {
    if (this.appliedUpgrades.has(upgradeId)) return;
    this.appliedUpgrades.add(upgradeId);
    if (upgradeId === 'turret_explosive_shells') {
      this.hasExplosiveShells = true;
    } else if (upgradeId === 'turret_twin_cannon') {
      this.hasTwinCannon = true;
    } else if (upgradeId === 'turret_rapid_plasma') {
      this.hasRapidPlasma = true;
      this.cooldownMultiplier = 0.55;
    } else if (upgradeId === 'turret_piercing_slugs') {
      this.hasPiercing = true;
    } else if (upgradeId === 'overclocked_capacitor') {
      this.modFireRateMultiplier *= 1.35;
    } else if (upgradeId === 'reinforced_barrels') {
      this.modDamageMultiplier *= 1.2;
      this.modFireRateMultiplier *= 0.9;
    } else if (upgradeId === 'annihilation_protocol') {
      this.hasAnnihilationProtocol = true;
    }
  }

  public resetUpgrades(): void {
    this.appliedUpgrades.clear();
    this.hasExplosiveShells = false;
    this.hasTwinCannon = false;
    this.hasRapidPlasma = false;
    this.hasPiercing = false;
    this.cooldownMultiplier = 1.0;
    this.modFireRateMultiplier = 1.0;
    this.modDamageMultiplier = 1.0;
    this.hasAnnihilationProtocol = false;
  }

  public applyAssemblyStats(stats: CalculatedShipStats): void {
    this.bulletDamageBonus = stats.bulletDamageBonus;
    this.fireRateMultiplier = stats.fireRateMultiplier;
    this.bulletSpeedBonus = stats.bulletSpeedBonus;
    this.extraProjectiles = stats.extraProjectiles;
  }

  public handleBlasterFire(
    seconds: number,
    player: PlayerShip,
    nearestEnemy: EnemyShip | null,
    particleManager: ParticleManager,
    hasTarget = true,
  ): void {
    const baseCooldown = player.isSuperMode ? SUPER_BLASTER_COOLDOWN : BLASTER_COOLDOWN;
    const currentCooldown = (baseCooldown * this.cooldownMultiplier) / (this.fireRateMultiplier * this.modFireRateMultiplier);
    this.blasterTimer += seconds;
    if (this.blasterTimer < currentCooldown) return;

    if (!hasTarget) {
      this.blasterTimer = currentCooldown;
      return;
    }

    this.blasterTimer = 0;

    if (player.isSuperMode) {
      this.fireSuperBolt(player, nearestEnemy, particleManager);
    } else {
      const fireAngle = player.aimAngle;
      soundFx.playCannon();
      player.recoilOffset = 6.0;

      if (player.customAssembly && player.customAssembly.gunOffsets.length > 0) {
        // Динамический расчет точек огня для всех установленных пушек
        const rot = player.shipFacingAngle + Math.PI / 2;
        const cR = Math.cos(rot);
        const sR = Math.sin(rot);

        for (const gun of player.customAssembly.gunOffsets) {
          const gx = player.x + cR * gun.x - sR * gun.y;
          const gy = player.y + sR * gun.x + cR * gun.y;

          if (this.hasTwinCannon) {
            const sideAngle = fireAngle + Math.PI / 2;
            const x1 = gx + Math.cos(sideAngle) * 8;
            const y1 = gy + Math.sin(sideAngle) * 8;
            const x2 = gx - Math.cos(sideAngle) * 8;
            const y2 = gy - Math.sin(sideAngle) * 8;
            this.fireSingleBolt(x1, y1, fireAngle);
            this.fireSingleBolt(x2, y2, fireAngle);
            particleManager.spawnMuzzleFlash(x1, y1, fireAngle);
            particleManager.spawnMuzzleFlash(x2, y2, fireAngle);
          } else {
            this.fireSingleBolt(gx, gy, fireAngle);
            particleManager.spawnMuzzleFlash(gx, gy, fireAngle);
          }
        }
      } else {
        if (this.hasTwinCannon) {
          const muzzleDist = 26;
          const muzzleX = player.x + Math.cos(fireAngle) * muzzleDist;
          const muzzleY = player.y + Math.sin(fireAngle) * muzzleDist;
          const sideAngle = fireAngle + Math.PI / 2;
          const x1 = muzzleX + Math.cos(sideAngle) * 11;
          const y1 = muzzleY + Math.sin(sideAngle) * 11;
          const x2 = muzzleX - Math.cos(sideAngle) * 11;
          const y2 = muzzleY - Math.sin(sideAngle) * 11;

          this.fireSingleBolt(x1, y1, fireAngle);
          this.fireSingleBolt(x2, y2, fireAngle);
          particleManager.spawnMuzzleFlash(x1, y1, fireAngle);
          particleManager.spawnMuzzleFlash(x2, y2, fireAngle);
        } else {
          const muzzleDist = 28;
          const muzzleX = player.x + Math.cos(fireAngle) * muzzleDist;
          const muzzleY = player.y + Math.sin(fireAngle) * muzzleDist;

          this.fireSingleBolt(muzzleX, muzzleY, fireAngle);
          particleManager.spawnMuzzleFlash(muzzleX, muzzleY, fireAngle);
        }
      }
    }
  }

  private rightClickCooldownTimer = 0;

  public fireRightClickSalvo(player: PlayerShip, particleManager?: ParticleManager): void {
    if (this.rightClickCooldownTimer > 0) return;
    this.rightClickCooldownTimer = 0.16;

    soundFx.playSuperCannon();
    player.recoilOffset = 5.0;

    const fireAngle = player.aimAngle;
    const leftAngle = fireAngle - Math.PI / 2;
    const rightAngle = fireAngle + Math.PI / 2;

    const x1 = player.x + Math.cos(fireAngle) * 20 + Math.cos(leftAngle) * 13;
    const y1 = player.y + Math.sin(fireAngle) * 20 + Math.sin(leftAngle) * 13;
    const x2 = player.x + Math.cos(fireAngle) * 20 + Math.cos(rightAngle) * 13;
    const y2 = player.y + Math.sin(fireAngle) * 20 + Math.sin(rightAngle) * 13;
    const xCenter = player.x + Math.cos(fireAngle) * 28;
    const yCenter = player.y + Math.sin(fireAngle) * 28;

    this.fireSingleBolt(x1, y1, fireAngle);
    this.fireSingleBolt(x2, y2, fireAngle);
    this.fireSingleBolt(xCenter, yCenter, fireAngle);

    if (particleManager) {
      particleManager.spawnMuzzleFlash(x1, y1, fireAngle);
      particleManager.spawnMuzzleFlash(x2, y2, fireAngle);
      particleManager.spawnMuzzleFlash(xCenter, yCenter, fireAngle);
    }
  }

  public fireSingleBolt(x: number, y: number, angle: number): void {
    const spec = this.getActiveMissileSpec();
    const baseSpeed = this.hasRapidPlasma ? BLASTER_SPEED * 1.25 : BLASTER_SPEED;
    const speed = baseSpeed + this.bulletSpeedBonus;
    const sprite = this.scene.add.sprite(x, y, spec.textureKey);
    sprite.setRotation(angle + Math.PI / 2);
    sprite.setScale(0.85, 0.85);
    sprite.setDepth(12);

    if (this.hasRapidPlasma && !this.equippedMissileId) {
      sprite.setTint(0x06b6d4);
    }

    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    this.lasers.push({
      sprite,
      vx,
      vy,
      lifetime: (BLASTER_RANGE * 1.15) / speed,
      damage: this.getBulletDamage(spec.damage),
      isExplosive: this.hasExplosiveShells,
      pierceCount: this.hasPiercing ? 2 : 1,
      hitEnemies: new Set(),
      missileTypeCode: spec.typeCode,
      missileRarity: spec.rarity,
      bouncesLeft: spec.typeCode === '004' ? 1 : 0,
      trailSpawnTimer: spec.typeCode === '001' ? 0.01 : undefined,
      isSubProjectile: false,
    });
  }

  public spawnSubProjectile(
    x: number,
    y: number,
    angle: number,
    damage: number,
    rarity: MissileRarityRef = 'common',
    typeCode: MissileTypeCodeRef = '010',
    scale = 0.56,
    lifetime = 0.3,
    excludeEnemy?: EnemyShip,
  ): void {
    const colorFolder = MISSILE_RARITY_CONFIG[rarity]?.colorFolder || 'blue';
    const preferredKey = `missile_${colorFolder}_${typeCode}`;
    const textureKey = this.scene.textures.exists(preferredKey) ? preferredKey : 'player_missile';

    const speed = BLASTER_SPEED * 0.92 + this.bulletSpeedBonus;
    const sprite = this.scene.add.sprite(x, y, textureKey);
    sprite.setRotation(angle + Math.PI / 2);
    sprite.setScale(scale, scale);
    sprite.setDepth(12);

    const hitEnemies = new Set<EnemyShip>();
    if (excludeEnemy) {
      hitEnemies.add(excludeEnemy);
    }

    this.lasers.push({
      sprite,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      lifetime,
      damage,
      isExplosive: false,
      pierceCount: 1,
      hitEnemies,
      missileTypeCode: typeCode,
      missileRarity: rarity,
      bouncesLeft: 0,
      isSubProjectile: true,
    });
  }

  private fireSuperBolt(
    player: PlayerShip,
    _nearestEnemy: EnemyShip | null,
    particleManager: ParticleManager,
  ): void {
    soundFx.playSuperCannon();
    player.recoilOffset = 4.0;

    const spec = this.getActiveMissileSpec();
    const fireAngle = player.aimAngle;

    this.superMuzzleAlternate = (this.superMuzzleAlternate + 1) % 3;
    let muzzleX = player.x + Math.cos(fireAngle) * 28;
    let muzzleY = player.y + Math.sin(fireAngle) * 28;

    if (this.superMuzzleAlternate === 1) {
      const leftAngle = fireAngle - Math.PI / 2;
      muzzleX = player.x + Math.cos(fireAngle) * 22 + Math.cos(leftAngle) * 12;
      muzzleY = player.y + Math.sin(fireAngle) * 22 + Math.sin(leftAngle) * 12;
    } else if (this.superMuzzleAlternate === 2) {
      const rightAngle = fireAngle + Math.PI / 2;
      muzzleX = player.x + Math.cos(fireAngle) * 22 + Math.cos(rightAngle) * 12;
      muzzleY = player.y + Math.sin(fireAngle) * 22 + Math.sin(rightAngle) * 12;
    }

    const sprite = this.scene.add.sprite(muzzleX, muzzleY, spec.textureKey);
    sprite.setRotation(fireAngle + Math.PI / 2);
    sprite.setScale(1.05, 1.05);
    sprite.setDepth(12);

    const vx = Math.cos(fireAngle) * SUPER_BLASTER_SPEED;
    const vy = Math.sin(fireAngle) * SUPER_BLASTER_SPEED;
    const superDamage = SUPER_BLASTER_DAMAGE + Math.max(0, spec.damage - BLASTER_DAMAGE);

    this.lasers.push({
      sprite,
      vx,
      vy,
      lifetime: BLASTER_RANGE / SUPER_BLASTER_SPEED,
      damage: this.getBulletDamage(superDamage),
      isExplosive: this.hasExplosiveShells,
      pierceCount: this.hasPiercing ? 2 : 1,
      hitEnemies: new Set(),
      missileTypeCode: spec.typeCode,
      missileRarity: spec.rarity,
      bouncesLeft: spec.typeCode === '004' ? 1 : 0,
      trailSpawnTimer: spec.typeCode === '001' ? 0.01 : undefined,
      isSubProjectile: false,
    });

    particleManager.spawnMuzzleFlash(muzzleX, muzzleY, fireAngle);
  }

  public update(seconds: number): void {
    if (this.rightClickCooldownTimer > 0) {
      this.rightClickCooldownTimer -= seconds;
    }
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.sprite.x += laser.vx * seconds;
      laser.sprite.y += laser.vy * seconds;
      laser.lifetime -= seconds;

      // 001: Энергетическая ракета оставляет энергетический след на 0.5 сек
      if (laser.missileTypeCode === '001' && !laser.isSubProjectile) {
        laser.trailSpawnTimer = (laser.trailSpawnTimer ?? 0) - seconds;
        if (laser.trailSpawnTimer <= 0) {
          laser.trailSpawnTimer = 0.045;
          const color =
            laser.missileRarity === 'legendary'
              ? 0xf87171
              : laser.missileRarity === 'rare'
                ? 0x34d399
                : 0x38bdf8;
          this.energyTrails.push({
            x: laser.sprite.x,
            y: laser.sprite.y,
            life: 0.5,
            maxLife: 0.5,
            radius: 15,
            damage: Math.max(0.25, (laser.damage ?? BLASTER_DAMAGE) * 0.25),
            color,
            hitTickMap: new Map(),
          });
        }
      }

      if (laser.lifetime <= 0) {
        laser.sprite.destroy();
        this.lasers.splice(i, 1);
      }
    }

    // Обновление и отрисовка энергетического следа (ракета 001)
    if (this.trailGraphics) {
      this.trailGraphics.clear();
      for (let t = this.energyTrails.length - 1; t >= 0; t--) {
        const seg = this.energyTrails[t];
        seg.life -= seconds;
        if (seg.life <= 0) {
          this.energyTrails.splice(t, 1);
          continue;
        }
        seg.hitTickMap.forEach((cd, enemy) => {
          const next = cd - seconds;
          if (next <= 0) seg.hitTickMap.delete(enemy);
          else seg.hitTickMap.set(enemy, next);
        });
        const ratio = seg.life / seg.maxLife;
        this.trailGraphics.fillStyle(seg.color, 0.22 * ratio);
        this.trailGraphics.fillCircle(seg.x, seg.y, seg.radius * (0.65 + ratio * 0.35));
        this.trailGraphics.fillStyle(0xffffff, 0.38 * ratio);
        this.trailGraphics.fillCircle(seg.x, seg.y, seg.radius * 0.32 * ratio);
      }
    }
  }

  public destroy(): void {
    this.reset();
    if (this.trailGraphics) {
      this.trailGraphics.destroy();
      this.trailGraphics = null;
    }
  }
}

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
import { LaserProjectile, EnemyShip } from './types';
import { PlayerShip } from './PlayerShip';
import { ParticleManager } from './ParticleManager';

/**
 * Оружейная система космического корабля:
 * носовые фотонно-плазменные орудия и режим перегрузки реактора (залповый огонь)
 */
export class WeaponSystem {
  private scene: Phaser.Scene;
  private lasers: LaserProjectile[] = [];
  private blasterTimer = 0;
  private superMuzzleAlternate = 0;

  // Тактические апгрейды оружейной системы
  public appliedUpgrades = new Set<string>();
  public hasExplosiveShells = false;
  public hasTwinCannon = false;
  public hasRapidPlasma = false;
  public hasPiercing = false;
  public cooldownMultiplier = 1.0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public getLasers(): LaserProjectile[] {
    return this.lasers;
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
    this.blasterTimer = 0;
    this.superMuzzleAlternate = 0;
    this.resetUpgrades();
  }

  public applyUpgrade(upgradeId: string): void {
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
    }
  }

  public resetUpgrades(): void {
    this.appliedUpgrades.clear();
    this.hasExplosiveShells = false;
    this.hasTwinCannon = false;
    this.hasRapidPlasma = false;
    this.hasPiercing = false;
    this.cooldownMultiplier = 1.0;
  }

  public handleBlasterFire(
    seconds: number,
    player: PlayerShip,
    nearestEnemy: EnemyShip | null,
    particleManager: ParticleManager,
  ): void {
    const baseCooldown = player.isSuperMode ? SUPER_BLASTER_COOLDOWN : BLASTER_COOLDOWN;
    const currentCooldown = baseCooldown * this.cooldownMultiplier;
    this.blasterTimer += seconds;
    if (this.blasterTimer < currentCooldown) return;

    this.blasterTimer = 0;

    if (player.isSuperMode) {
      this.fireSuperBolt(player, nearestEnemy, particleManager);
    } else if (this.hasTwinCannon) {
      const fireAngle = player.aimAngle;
      soundFx.playCannon();
      player.recoilOffset = 6.0;

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
      const fireAngle = player.aimAngle;

      soundFx.playCannon();
      player.recoilOffset = 6.0;

      const muzzleDist = 28;
      const muzzleX = player.x + Math.cos(fireAngle) * muzzleDist;
      const muzzleY = player.y + Math.sin(fireAngle) * muzzleDist;

      this.fireSingleBolt(muzzleX, muzzleY, fireAngle);
      particleManager.spawnMuzzleFlash(muzzleX, muzzleY, fireAngle);
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
    const speed = this.hasRapidPlasma ? BLASTER_SPEED * 1.25 : BLASTER_SPEED;
    const sprite = this.scene.add.sprite(x, y, 'player_missile');
    sprite.setRotation(angle + Math.PI / 2);
    sprite.setScale(0.85, 0.85);
    sprite.setDepth(12);

    if (this.hasRapidPlasma) {
      sprite.setTint(0x06b6d4);
    }

    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    this.lasers.push({
      sprite,
      vx,
      vy,
      lifetime: (BLASTER_RANGE * 1.15) / speed,
      damage: BLASTER_DAMAGE,
      isExplosive: this.hasExplosiveShells,
      pierceCount: this.hasPiercing ? 2 : 1,
      hitEnemies: new Set(),
    });
  }

  private fireSuperBolt(
    player: PlayerShip,
    _nearestEnemy: EnemyShip | null,
    particleManager: ParticleManager,
  ): void {
    soundFx.playSuperCannon();
    player.recoilOffset = 4.0;

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

    const sprite = this.scene.add.sprite(muzzleX, muzzleY, 'player_missile');
    sprite.setRotation(fireAngle + Math.PI / 2);
    sprite.setScale(1.05, 1.05);
    sprite.setDepth(12);

    const vx = Math.cos(fireAngle) * SUPER_BLASTER_SPEED;
    const vy = Math.sin(fireAngle) * SUPER_BLASTER_SPEED;

    this.lasers.push({
      sprite,
      vx,
      vy,
      lifetime: BLASTER_RANGE / SUPER_BLASTER_SPEED,
      damage: SUPER_BLASTER_DAMAGE,
      isExplosive: this.hasExplosiveShells,
      pierceCount: this.hasPiercing ? 2 : 1,
      hitEnemies: new Set(),
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

      if (laser.lifetime <= 0) {
        laser.sprite.destroy();
        this.lasers.splice(i, 1);
      }
    }
  }

  public destroy(): void {
    this.reset();
  }
}

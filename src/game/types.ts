import Phaser from 'phaser';

/**
 * Снаряд корабельного орудия (бластер / фотонная ракета)
 */
export interface LaserProjectile {
  sprite: Phaser.GameObjects.Sprite;
  vx: number;
  vy: number;
  lifetime: number;
  damage?: number;
  isExplosive?: boolean;
  pierceCount?: number;
  hitEnemies?: Set<EnemyShip>;
}

/**
 * Огненная зона плазменного шлейфа двигателей
 */
export interface FireHazard {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  damageTimer: number;
  radius: number;
}

/**
 * Плазменный заряд кораблей противника
 */
export interface EnemyBullet {
  sprite: Phaser.GameObjects.Sprite;
  vx: number;
  vy: number;
  lifetime: number;
  damage: number;
}

/**
 * Вражеский космический корабль (разведчик, перехватчик, тяжелый крейсер)
 */
export interface EnemyShip {
  sprite: Phaser.GameObjects.Sprite;
  hp: number;
  maxHp: number;
  speed: number;
  scoreValue: number;
  radius: number;
  isHitFlash: number;
  type?: 'scout' | 'interceptor' | 'gunship' | 'zaku' | 'dom' | 'terminator';
  shootCooldown?: number;
  shootTimer?: number;
  animPhase?: number;
  recoil?: number;
  isInvulnerable?: boolean;
}

// Алиас для обратной совместимости
export type EnemyMech = EnemyShip;

/**
 * Частицы взрывов, искр и световых вспышек
 */
export interface DebrisParticle {
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Shape;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
}

/**
 * Парящие частицы космической звездной пыли
 */
export interface CosmicDustParticle {
  sprite: Phaser.GameObjects.Sprite;
  vx: number;
  vy: number;
  baseAlpha: number;
  pulsePhase: number;
}

// Алиас для обратной совместимости
export type FalloutEmber = CosmicDustParticle;

/**
 * Двигающаяся звезда космического фона с эффектом параллакса
 */
export interface CosmicStar {
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Shape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  layer: number;
}

/**
 * Космический метеорит / астероид
 */
export interface Meteor {
  sprite: Phaser.GameObjects.Sprite;
  vx: number;
  vy: number;
  angularVelocity: number;
  radius: number;
  scale: number;
  hp: number;
  maxHp: number;
  isHitFlash: number;
  trailTimer: number;
  sizeCategory: 'small' | 'medium' | 'large' | 'giant';
}

/**
 * Странствующая космическая станция / база
 */
export interface SpaceStation {
  sprite: Phaser.GameObjects.Sprite;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  typeIndex: 0 | 1 | 2; // 0: station_020, 1: station_021, 2: station_024
  vx: number;
  vy: number;
  speed: number;
  moveAngle: number;
  rotationSpeed: number;
  animPhase: number;
  hp: number;
  maxHp: number;
  radius: number;
  scale: number;
  isHitFlash: number;
  xpReward: number;
  explosionRadius: number;
  explosionDamage: number;
}

import Phaser from 'phaser';

export type MissileTypeCodeRef =
  | '001'
  | '002'
  | '003'
  | '004'
  | '005'
  | '006'
  | '007'
  | '008'
  | '009'
  | '010';

export type MissileRarityRef = 'common' | 'rare' | 'legendary';

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
  hitStations?: Set<SpaceStation>;
  missileTypeCode?: MissileTypeCodeRef;
  missileRarity?: MissileRarityRef;
  bouncesLeft?: number;
  trailSpawnTimer?: number;
  visualTrailTimer?: number;
  trailPhase?: number;
  prevTrailX?: number;
  prevTrailY?: number;
  missileUid?: number;
  isSubProjectile?: boolean;
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

export type EnemyType =
  | 'scout'
  | 'interceptor'
  | 'assault'
  | 'frigate'
  | 'destroyer'
  | 'boss';

/**
 * Вражеский космический корабль (разведчик, перехватчик, штурмовик, фрегат, эсминец, босс)
 */
export interface EnemyShip {
  sprite: Phaser.GameObjects.Sprite;
  hp: number;
  maxHp: number;
  speed: number;
  scoreValue: number;
  radius: number;
  isHitFlash: number;
  type?: EnemyType;
  shootCooldown?: number;
  shootTimer?: number;
  secondaryCooldown?: number;
  secondaryShootTimer?: number;
  animPhase?: number;
  recoil?: number;
  isInvulnerable?: boolean;
  isBoss?: boolean;
  bossName?: string;
  spreadCount?: number;
  collisionDamage?: number;
  shootPattern?: 'single' | 'spread' | 'compact' | 'flagship';
  bulletSpeed?: number;
  bulletDamage?: number;
  slowTimer?: number;
  slowMultiplier?: number;
  knockbackVx?: number;
  knockbackVy?: number;
}

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
  isIndestructible?: boolean;
  isBoundary?: boolean;
}

/**
 * Странствующая космическая станция / база
 */
export interface SpaceStation {
  sprite: Phaser.GameObjects.Sprite;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  hologramRing?: Phaser.GameObjects.Graphics;
  hologramPhase?: number;
  typeIndex: number; // 0: station_018, 1: station_019, 2: station_022, 3: station_023
  vx: number;
  vy: number;
  speed: number;
  moveAngle: number;
  rotationSpeed: number;
  animPhase: number;
  hp: number;
  maxHp: number;
  radius: number;
  halfWidth: number;
  halfHeight: number;
  boundingRadius: number;
  barWidth: number;
  barHeight: number;
  scale: number;
  isHitFlash: number;
  xpReward: number;
  scrapReward?: number;
  explosionRadius: number;
  explosionDamage: number;
}

/**
 * Объект выпавшего металлолома (единственная игровая валюта)
 */
export interface ScrapPickup {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  isMagnetized: boolean;
  rotationSpeed: number;
  baseScale: number;
  pulseTimer: number;
}

/**
 * Летающий космический магазин с желтой сферой входа
 */
export interface FlyingShop {
  sprite: Phaser.GameObjects.Sprite;
  sphereGraphics: Phaser.GameObjects.Graphics;
  shopLabel: Phaser.GameObjects.Text;
  x: number;
  y: number;
  speed: number;
  moveAngle: number;
  rotationSpeed: number;
  animPhase: number;
  pulsePhase: number;
  boundingRadius: number;
  sphereRadius: number;
  dwellTimer: number;
  reenterCooldown: number;
  mustExitBeforeReenter: boolean;
}

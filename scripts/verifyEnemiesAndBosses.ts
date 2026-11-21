import assert from 'node:assert';
import {
  ENEMY_SCOUT_HP,
  ENEMY_SCOUT_SPEED,
  ENEMY_SCOUT_COLLISION_DAMAGE,
  ENEMY_INTERCEPTOR_HP,
  ENEMY_INTERCEPTOR_SPEED,
  ENEMY_INTERCEPTOR_COLLISION_DAMAGE,
  ENEMY_ASSAULT_HP,
  ENEMY_ASSAULT_SPEED,
  ENEMY_ASSAULT_COLLISION_DAMAGE,
  ENEMY_FRIGATE_HP,
  ENEMY_FRIGATE_SPEED,
  ENEMY_FRIGATE_COLLISION_DAMAGE,
  ENEMY_FRIGATE_SHOOT_COOLDOWN,
  ENEMY_DESTROYER_HP,
  ENEMY_DESTROYER_SPEED,
  ENEMY_DESTROYER_COLLISION_DAMAGE,
  ENEMY_DESTROYER_SHOOT_COOLDOWN,
  ENEMY_DESTROYER_SPREAD_COUNT,
  REGULAR_ENEMY_DEFS,
} from '../src/game/constants';
import { CAMPAIGN_MISSIONS } from '../src/game/campaign/campaignData';
import { SCRAP_CONFIG, getEnemyScrapDrop } from '../src/game/campaign/scrapConfig';

console.log('====================================================');
console.log('🚀 RUNNING VERIFICATION: 5 REGULAR ENEMIES & 3 BOSSES');
console.log('====================================================\n');

// 1. Проверка 5 типов обычных противников
console.log('--- 1. Checking 5 Regular Enemy Definitions ---');

const scout = REGULAR_ENEMY_DEFS.scout;
assert(scout, 'Scout definition must exist');
assert.strictEqual(scout.texture, 'enemy_ship_001', 'Scout must use spaceShips_001');
assert(scout.hp < 5, 'Scout must have very low HP');
assert(scout.speed > 150, 'Scout must have high speed');
assert.strictEqual(scout.canShoot, false, 'Scout must NOT shoot');
assert(scout.collisionDamage < 10, 'Scout must have low collision damage');
console.log('✓ Scout (spaceShips_001): Low HP, High Speed, Non-shooting, Low Collision DMG');

const interceptor = REGULAR_ENEMY_DEFS.interceptor;
assert(interceptor, 'Interceptor definition must exist');
assert.strictEqual(interceptor.texture, 'enemy_ship_002', 'Interceptor must use spaceShips_002');
assert(interceptor.hp > scout.hp, 'Interceptor HP must be higher than Scout');
assert(interceptor.speed > scout.speed, 'Interceptor speed must be very high');
assert.strictEqual(interceptor.canShoot, false, 'Interceptor must NOT shoot');
assert(interceptor.collisionDamage > scout.collisionDamage, 'Interceptor collision damage must be higher than Scout');
console.log('✓ Interceptor (spaceShips_002): Higher HP than Scout, Very High Speed, Non-shooting, Collision DMG > Scout');

const assault = REGULAR_ENEMY_DEFS.assault;
assert(assault, 'Assault definition must exist');
assert.strictEqual(assault.texture, 'enemy_ship_003', 'Assault must use spaceShips_003');
assert(assault.hp > interceptor.hp, 'Assault HP must be medium/substantial');
assert(assault.speed < 90, 'Assault must have low speed');
assert.strictEqual(assault.canShoot, false, 'Assault must NOT shoot');
assert(assault.collisionDamage >= 20, 'Assault must have high collision damage');
console.log('✓ Heavy Assault (spaceShips_003): Medium HP, Low Speed, Non-shooting, High Collision DMG');

const frigate = REGULAR_ENEMY_DEFS.frigate;
assert(frigate, 'Frigate definition must exist');
assert.strictEqual(frigate.texture, 'enemy_ship_004', 'Frigate must use spaceShips_004');
assert(frigate.hp > assault.hp, 'Frigate must have fairly high HP');
assert.strictEqual(frigate.canShoot, true, 'Frigate must shoot');
assert.strictEqual(frigate.shootPattern, 'single', 'Frigate must shoot single projectiles');
assert(frigate.shootCooldown && frigate.shootCooldown < 2.5, 'Frigate must have short cooldown');
console.log('✓ Missile Frigate (spaceShips_004): Fairly High HP, Shoots single projectiles with cooldown');

const destroyer = REGULAR_ENEMY_DEFS.destroyer;
assert(destroyer, 'Destroyer definition must exist');
assert.strictEqual(destroyer.texture, 'enemy_ship_005', 'Destroyer must use spaceShips_005');
assert(destroyer.hp >= 50, 'Destroyer must have very high HP');
assert(destroyer.speed <= 65, 'Destroyer must have low speed');
assert.strictEqual(destroyer.canShoot, true, 'Destroyer must shoot');
assert.strictEqual(destroyer.shootPattern, 'spread', 'Destroyer must shoot spread pattern');
assert.strictEqual(destroyer.spreadCount, 3, 'Destroyer spread must have 3 projectiles');
assert(destroyer.shootCooldown && destroyer.shootCooldown >= 3.0, 'Destroyer must have long cooldown between bursts');
assert(destroyer.collisionDamage >= 30, 'Destroyer must have high collision damage');
console.log('✓ Heavy Destroyer (spaceShips_005): Very High HP, Low Speed, 3-spread shot with long cooldown, High Collision DMG');

// 2. Проверка металлолома (Scrap Drops)
console.log('\n--- 2. Checking Scrap Drops ---');
assert(SCRAP_CONFIG.enemyDrops.destroyer.min >= 10, 'Destroyer must give increased scrap reward');
assert(SCRAP_CONFIG.enemyDrops.destroyer.max >= 16, 'Destroyer must give increased scrap reward');
for (let i = 0; i < 50; i++) {
  const dScrap = getEnemyScrapDrop('destroyer');
  assert(dScrap >= 12 && dScrap <= 18, `Destroyer scrap drop must be between 12 and 18, got ${dScrap}`);
}
console.log('✓ Destroyer increased scrap drop verified (12-18 scrap)');

// 3. Проверка 3 боссов
console.log('\n--- 3. Checking 3 Unique Bosses ---');
const boss1Mission = CAMPAIGN_MISSIONS.find((m) => m.id === '1-5');
assert(boss1Mission && boss1Mission.bossConfig, 'Boss 1-5 must exist with bossConfig');
const b1 = boss1Mission.bossConfig;
assert.strictEqual(b1.texture, 'boss_rocket_001', 'Boss 1 must use spaceRockets_001');
assert.strictEqual(b1.pattern, 'spread', 'Boss 1 must shoot spread');
assert.strictEqual(b1.spreadCount, 5, 'Boss 1 must shoot 5 projectiles in a fan');
assert(b1.hp >= 200, 'Boss 1 must have large HP');
assert(b1.speed <= 55, 'Boss 1 must have low speed');
console.log('✓ Boss 1 (1:5 - Ракетный крейсер, spaceRockets_001): High HP, Low Speed, 5-projectile spread');

const boss2Mission = CAMPAIGN_MISSIONS.find((m) => m.id === '2-5');
assert(boss2Mission && boss2Mission.bossConfig, 'Boss 2-5 must exist with bossConfig');
const b2 = boss2Mission.bossConfig;
assert.strictEqual(b2.texture, 'boss_rocket_002', 'Boss 2 must use spaceRockets_002');
assert.strictEqual(b2.pattern, 'compact', 'Boss 2 must shoot compact group');
assert.strictEqual(b2.spreadCount, 4, 'Boss 2 must shoot exactly 4 compact projectiles');
assert(b2.hp > b1.hp, 'Boss 2 HP must be significantly higher than Boss 1');
console.log('✓ Boss 2 (2:5 - Ударный авианосец, spaceRockets_002): Very High HP, 4-projectile compact group, no summons');

const boss3Mission = CAMPAIGN_MISSIONS.find((m) => m.id === '3-5');
assert(boss3Mission && boss3Mission.bossConfig, 'Boss 3-5 must exist with bossConfig');
const b3 = boss3Mission.bossConfig;
assert.strictEqual(b3.texture, 'boss_rocket_003', 'Boss 3 must use spaceRockets_003');
assert.strictEqual(b3.pattern, 'flagship', 'Boss 3 must use flagship pattern');
assert(b3.spreadCount >= 7, 'Boss 3 must shoot wide spread');
assert(b3.rapidCooldown && b3.rapidCooldown <= 1.2, 'Boss 3 must have frequent directed bursts');
assert(b3.bulletDamage > b1.bulletDamage && b3.bulletDamage > b2.bulletDamage, 'Boss 3 damage must be higher than previous bosses');
assert(b3.hp > b2.hp, 'Boss 3 HP must be massive');
console.log('✓ Boss 3 (3:5 - Флагманский линкор, spaceRockets_003): Massive HP, Wide spread + Frequent directed bursts, Higher damage, Single mode / No phase 2');

// 4. Проверка распределения врагов по секторам
console.log('\n--- 4. Checking Sector Distribution ---');

// Сектор 1 (1-1 .. 1-5): только Разведчик, Перехватчик, Тяжёлый штурмовик
for (let m = 1; m <= 5; m++) {
  const mission = CAMPAIGN_MISSIONS.find((mis) => mis.id === `1-${m}`);
  assert(mission, `Mission 1-${m} must exist`);
  const cfg = mission.enemyConfig;
  assert(cfg.scoutRatio > 0, `Mission 1-${m} must have scouts`);
  assert(cfg.interceptorRatio > 0, `Mission 1-${m} must have interceptors`);
  assert((cfg.assaultRatio ?? 0) > 0, `Mission 1-${m} must have assault ships`);
  assert.strictEqual(cfg.frigateRatio ?? 0, 0, `Sector 1 mission 1-${m} must NOT have frigates`);
  assert.strictEqual(cfg.destroyerRatio ?? 0, 0, `Sector 1 mission 1-${m} must NOT have destroyers`);
}
console.log('✓ Sector 1: Only Scout, Interceptor, and Heavy Assault present. 0% frigates, 0% destroyers.');

// Сектор 2 (2-1 .. 2-5): все 5 типов, нарастание сильных врагов
let prevStrongRatio = 0;
for (let m = 1; m <= 5; m++) {
  const mission = CAMPAIGN_MISSIONS.find((mis) => mis.id === `2-${m}`);
  assert(mission, `Mission 2-${m} must exist`);
  const cfg = mission.enemyConfig;
  assert(cfg.scoutRatio > 0, `Mission 2-${m} must have scouts`);
  assert(cfg.interceptorRatio > 0, `Mission 2-${m} must have interceptors`);
  assert((cfg.assaultRatio ?? 0) > 0, `Mission 2-${m} must have assault ships`);
  assert((cfg.frigateRatio ?? 0) > 0, `Mission 2-${m} must have frigates`);
  assert((cfg.destroyerRatio ?? 0) > 0, `Mission 2-${m} must have destroyers`);
  const strongRatio = (cfg.frigateRatio ?? 0) + (cfg.destroyerRatio ?? 0);
  assert(strongRatio >= prevStrongRatio, `Strong enemy ratio in 2-${m} (${strongRatio}) should increase from previous (${prevStrongRatio})`);
  prevStrongRatio = strongRatio;
}
console.log('✓ Sector 2: All 5 types present, progressive increase of stronger enemies.');

// Сектор 3 (3-1 .. 3-5): все 5 типов, более высокие характеристики противников, высокая доля сильных врагов
for (let m = 1; m <= 5; m++) {
  const mission = CAMPAIGN_MISSIONS.find((mis) => mis.id === `3-${m}`);
  assert(mission, `Mission 3-${m} must exist`);
  const cfg = mission.enemyConfig;
  assert(cfg.healthMultiplier >= 2.3, `Sector 3 mission 3-${m} must have high healthMultiplier`);
  assert(cfg.speedMultiplier >= 1.2, `Sector 3 mission 3-${m} must have high speedMultiplier`);
  assert((cfg.frigateRatio ?? 0) >= 0.3, `Sector 3 mission 3-${m} must have high frigate presence`);
  assert((cfg.destroyerRatio ?? 0) >= 0.2, `Sector 3 mission 3-${m} must have high destroyer presence`);
}
console.log('✓ Sector 3: Higher enemy multipliers (health >= 2.3x, speed >= 1.2x), high frigate and destroyer concentration.');

console.log('\n====================================================');
console.log('🎉 ALL ENEMY & BOSS VERIFICATIONS PASSED SUCCESSFULLY!');
console.log('====================================================\n');

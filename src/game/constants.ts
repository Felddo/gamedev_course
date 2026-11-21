// --- Константы космического мира и карты --
export const MAP_WIDTH = 4800;
export const MAP_HEIGHT = 3200;

// --- Игровые константы космического корабля игрока ---
export const PLAYER_SPEED = 240;
export const PLAYER_MAX_HP = 100;
export const PLAYER_INVULN_TIME = 0.6; // секунды неуязвимости после столкновения

// Механика форсажа (Shift)
export const DASH_COOLDOWN = 5.0; // таймер перезарядки: 5 секунд
export const DASH_DURATION = 0.44; // длительность форсажа в секундах
export const DASH_SPEED = 820; // скорость форсажа звездолета (импульс маршевых ускорителей)

// Механика овердрайва реактора (ПКМ)
export const SUPER_DURATION = 5.0; // длительность режима перегрузки в секундах
export const SUPER_COOLDOWN = 5.0; // перезарядка после возврата в норму: 5 секунд
export const SUPER_BLASTER_COOLDOWN = 0.1; // увеличенная скорострельность (выстрелы в 3.3 раза чаще)
export const SUPER_BLASTER_SPEED = 880;
export const SUPER_BLASTER_DAMAGE = 5.5; // увеличенный урон тяжелых ракет

// Параметры модели корабля игрока
export const SHIP_SCALE = 0.62;
export const TANK_SCALE = SHIP_SCALE; // Алиас для совместимости

// Параметры носового бластера и зоны поражения корабля игрока
export const PLAYER_ATTACK_RADIUS = 280; // Небольшой тактический радиус автонаведения и начала стрельбы
export const BLASTER_COOLDOWN = 0.2; // интервал между выстрелами
export const BLASTER_SPEED = 740;
export const BLASTER_RANGE = 330; // дальность полета плазменного заряда (покрывает радиус поражения)
export const BLASTER_DAMAGE = 1.5;

// Общее время жизни вражеского снаряда
export const ENEMY_BULLET_LIFETIME = 2.8;

// --- Параметры 5 типов обычных противников ---

// 1. Разведчик (spaceShips_001.png)
// Очень мало здоровья, высокая скорость, не стреляет, небольшой урон при столкновении
export const ENEMY_SCOUT_HP = 3;
export const ENEMY_SCOUT_SPEED = 170;
export const ENEMY_SCOUT_COLLISION_DAMAGE = 8;
export const ENEMY_SCOUT_SCORE = 15;
export const ENEMY_SCOUT_SCALE = 0.38;
export const ENEMY_SCOUT_RADIUS = 20;

// 2. Перехватчик (spaceShips_002.png)
// Здоровья немного больше, чем у разведчика, очень высокая скорость, не стреляет, урон выше разведчика
export const ENEMY_INTERCEPTOR_HP = 7;
export const ENEMY_INTERCEPTOR_SPEED = 215;
export const ENEMY_INTERCEPTOR_COLLISION_DAMAGE = 14;
export const ENEMY_INTERCEPTOR_SCORE = 35;
export const ENEMY_INTERCEPTOR_SCALE = 0.40;
export const ENEMY_INTERCEPTOR_RADIUS = 22;

// 3. Тяжёлый штурмовик (spaceShips_003.png)
// Среднее количество здоровья, низкая скорость, не стреляет, высокий урон при столкновении
export const ENEMY_ASSAULT_HP = 18;
export const ENEMY_ASSAULT_SPEED = 75;
export const ENEMY_ASSAULT_COLLISION_DAMAGE = 25;
export const ENEMY_ASSAULT_SCORE = 65;
export const ENEMY_ASSAULT_SCALE = 0.44;
export const ENEMY_ASSAULT_RADIUS = 26;

// 4. Ракетный фрегат (spaceShips_004.png)
// Достаточно много здоровья, средняя скорость, стреляет одиночными снарядами в сторону игрока
export const ENEMY_FRIGATE_HP = 32;
export const ENEMY_FRIGATE_SPEED = 95;
export const ENEMY_FRIGATE_COLLISION_DAMAGE = 18;
export const ENEMY_FRIGATE_SCORE = 120;
export const ENEMY_FRIGATE_SCALE = 0.44;
export const ENEMY_FRIGATE_RADIUS = 28;
export const ENEMY_FRIGATE_SHOOT_COOLDOWN = 1.8;
export const ENEMY_FRIGATE_SHOOT_RANGE = 520;
export const ENEMY_FRIGATE_BULLET_SPEED = 350;
export const ENEMY_FRIGATE_BULLET_DAMAGE = 12;

// 5. Тяжёлый эсминец (spaceShips_005.png)
// Очень много здоровья, низкая скорость, веер из 3 снарядов, большая перезарядка, высокий урон при столкновении
export const ENEMY_DESTROYER_HP = 60;
export const ENEMY_DESTROYER_SPEED = 60;
export const ENEMY_DESTROYER_COLLISION_DAMAGE = 30;
export const ENEMY_DESTROYER_SCORE = 260;
export const ENEMY_DESTROYER_SCALE = 0.50;
export const ENEMY_DESTROYER_RADIUS = 36;
export const ENEMY_DESTROYER_SHOOT_COOLDOWN = 3.5;
export const ENEMY_DESTROYER_SPREAD_COUNT = 3;
export const ENEMY_DESTROYER_SHOOT_RANGE = 560;
export const ENEMY_DESTROYER_BULLET_SPEED = 330;
export const ENEMY_DESTROYER_BULLET_DAMAGE = 15;

export type RegularEnemyType = 'scout' | 'interceptor' | 'assault' | 'frigate' | 'destroyer';

/**
 * Единая конфигурация характеристик 5 типов обычных противников
 */
export interface RegularEnemyDef {
  type: RegularEnemyType;
  texture: string;
  name: string;
  hp: number;
  speed: number;
  collisionDamage: number;
  scoreValue: number;
  radius: number;
  scale: number;
  canShoot: boolean;
  shootPattern?: 'single' | 'spread';
  spreadCount?: number;
  shootCooldown?: number;
  bulletSpeed?: number;
  bulletDamage?: number;
}

export const REGULAR_ENEMY_DEFS: Record<RegularEnemyType, RegularEnemyDef> = {
  scout: {
    type: 'scout',
    texture: 'enemy_ship_001',
    name: 'Разведчик',
    hp: ENEMY_SCOUT_HP,
    speed: ENEMY_SCOUT_SPEED,
    collisionDamage: ENEMY_SCOUT_COLLISION_DAMAGE,
    scoreValue: ENEMY_SCOUT_SCORE,
    radius: ENEMY_SCOUT_RADIUS,
    scale: ENEMY_SCOUT_SCALE,
    canShoot: false,
  },
  interceptor: {
    type: 'interceptor',
    texture: 'enemy_ship_002',
    name: 'Перехватчик',
    hp: ENEMY_INTERCEPTOR_HP,
    speed: ENEMY_INTERCEPTOR_SPEED,
    collisionDamage: ENEMY_INTERCEPTOR_COLLISION_DAMAGE,
    scoreValue: ENEMY_INTERCEPTOR_SCORE,
    radius: ENEMY_INTERCEPTOR_RADIUS,
    scale: ENEMY_INTERCEPTOR_SCALE,
    canShoot: false,
  },
  assault: {
    type: 'assault',
    texture: 'enemy_ship_003',
    name: 'Тяжёлый штурмовик',
    hp: ENEMY_ASSAULT_HP,
    speed: ENEMY_ASSAULT_SPEED,
    collisionDamage: ENEMY_ASSAULT_COLLISION_DAMAGE,
    scoreValue: ENEMY_ASSAULT_SCORE,
    radius: ENEMY_ASSAULT_RADIUS,
    scale: ENEMY_ASSAULT_SCALE,
    canShoot: false,
  },
  frigate: {
    type: 'frigate',
    texture: 'enemy_ship_004',
    name: 'Ракетный фрегат',
    hp: ENEMY_FRIGATE_HP,
    speed: ENEMY_FRIGATE_SPEED,
    collisionDamage: ENEMY_FRIGATE_COLLISION_DAMAGE,
    scoreValue: ENEMY_FRIGATE_SCORE,
    radius: ENEMY_FRIGATE_RADIUS,
    scale: ENEMY_FRIGATE_SCALE,
    canShoot: true,
    shootPattern: 'single',
    shootCooldown: ENEMY_FRIGATE_SHOOT_COOLDOWN,
    bulletSpeed: ENEMY_FRIGATE_BULLET_SPEED,
    bulletDamage: ENEMY_FRIGATE_BULLET_DAMAGE,
  },
  destroyer: {
    type: 'destroyer',
    texture: 'enemy_ship_005',
    name: 'Тяжёлый эсминец',
    hp: ENEMY_DESTROYER_HP,
    speed: ENEMY_DESTROYER_SPEED,
    collisionDamage: ENEMY_DESTROYER_COLLISION_DAMAGE,
    scoreValue: ENEMY_DESTROYER_SCORE,
    radius: ENEMY_DESTROYER_RADIUS,
    scale: ENEMY_DESTROYER_SCALE,
    canShoot: true,
    shootPattern: 'spread',
    spreadCount: ENEMY_DESTROYER_SPREAD_COUNT,
    shootCooldown: ENEMY_DESTROYER_SHOOT_COOLDOWN,
    bulletSpeed: ENEMY_DESTROYER_BULLET_SPEED,
    bulletDamage: ENEMY_DESTROYER_BULLET_DAMAGE,
  },
};

// --- Константы фаз игры ---
export const PHASE_2_SCORE_THRESHOLD = 1000;

export interface PhaseInfo {
  number: number;
  title: string;
  scoreThreshold: number;
  subtitle: string;
  spawnIntensity: number;
  healthMultiplier: number;
  maxMeteors: number;
  meteorSpawnInterval: number;
  initialMeteorCount: number;
}

export const GAME_PHASES: PhaseInfo[] = [
  {
    number: 1,
    title: 'Фаза 1',
    scoreThreshold: 0,
    subtitle: 'ПРОТОКОЛ: ЗАЧИСТКА СЕКТОРА',
    spawnIntensity: 0.4,
    healthMultiplier: 1.0,
    maxMeteors: 10,
    meteorSpawnInterval: 2.2,
    initialMeteorCount: 5,
  },
  {
    number: 2,
    title: 'Фаза 2',
    scoreThreshold: 200,
    subtitle: 'ВНИМАНИЕ: МЕТЕОРИТНЫЙ ПОТОК И ТЯЖЕЛЫЕ БОЕВЫЕ КРЕЙСЕРЫ!',
    spawnIntensity: 0.5,
    healthMultiplier: 1.5,
    maxMeteors: 22,
    meteorSpawnInterval: 1.1,
    initialMeteorCount: 8,
  },
  {
    number: 3,
    title: 'Фаза 3',
    scoreThreshold: 1000,
    subtitle: 'ВНИМАНИЕ: СИЛЬНЫЙ МЕТЕОРИТНЫЙ ПОТОК И ТЯЖЕЛЫЕ БОЕВЫЕ КРЕЙСЕРЫ!',
    spawnIntensity: 0.75,
    healthMultiplier: 1.5,
    maxMeteors: 25,
    meteorSpawnInterval: 1.05,
    initialMeteorCount: 10,
  },
  {
    number: 4,
    title: 'Фаза 4',
    scoreThreshold: 2000,
    subtitle: 'ТРЕВОГА: МАССИРОВАННЫЙ НАЛЕТ И ВЫСОКАЯ ПЛОТНОСТЬ АСТЕРОИДОВ!',
    spawnIntensity: 0.95,
    healthMultiplier: 1.55,
    maxMeteors: 24,
    meteorSpawnInterval: 1.0,
    initialMeteorCount: 9,
  },
  {
    number: 5,
    title: 'Фаза 5',
    scoreThreshold: 3000,
    subtitle: 'КРИТИЧЕСКАЯ УГРОЗА: ЭКСТРЕМАЛЬНЫЙ ШТОРМ И АРМАДА ПРОТИВНИКА!',
    spawnIntensity: 1.15,
    healthMultiplier: 1.65,
    maxMeteors: 26,
    meteorSpawnInterval: 0.95,
    initialMeteorCount: 11,
  },
];

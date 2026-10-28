// --- Константы космического мира и карты ---
export const MAP_WIDTH = 3072;
export const MAP_HEIGHT = 1677;

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
export const SUPER_BLASTER_COOLDOWN = 0.11; // увеличенная скорострельность (выстрелы в 3.3 раза чаще)
export const SUPER_BLASTER_SPEED = 880;
export const SUPER_BLASTER_DAMAGE = 3.5; // увеличенный урон тяжелых ракет

// Параметры модели корабля игрока
export const SHIP_SCALE = 0.62;
export const TANK_SCALE = SHIP_SCALE; // Алиас для совместимости

// Параметры носового бластера
export const BLASTER_COOLDOWN = 0.36; // интервал между выстрелами
export const BLASTER_SPEED = 740;
export const BLASTER_RANGE = 620;
export const BLASTER_DAMAGE = 1.5;

// Параметры легкого вражеского корабля-разведчика (spaceShips_005)
export const ENEMY_SCOUT_HP = 2;
export const ENEMY_SCOUT_SPEED = 115;
export const ENEMY_SCOUT_SCORE = 10;
export const ENEMY_SCOUT_SCALE = 0.34;
export const ENEMY_SCOUT_RADIUS = 14;

export const ENEMY_ZAKU_HP = ENEMY_SCOUT_HP;
export const ENEMY_ZAKU_SPEED = ENEMY_SCOUT_SPEED;
export const ENEMY_ZAKU_SCORE = ENEMY_SCOUT_SCORE;
export const ENEMY_ZAKU_SCALE = ENEMY_SCOUT_SCALE;
export const ENEMY_ZAKU_RADIUS = ENEMY_SCOUT_RADIUS;

// Параметры среднего вражеского перехватчика (spaceShips_004)
export const ENEMY_INTERCEPTOR_HP = 6;
export const ENEMY_INTERCEPTOR_SPEED = 75;
export const ENEMY_INTERCEPTOR_SCORE = 30;
export const ENEMY_INTERCEPTOR_SCALE = 0.38;
export const ENEMY_INTERCEPTOR_RADIUS = 18;

export const ENEMY_DOM_HP = ENEMY_INTERCEPTOR_HP;
export const ENEMY_DOM_SPEED = ENEMY_INTERCEPTOR_SPEED;
export const ENEMY_DOM_SCORE = ENEMY_INTERCEPTOR_SCORE;
export const ENEMY_DOM_SCALE = ENEMY_INTERCEPTOR_SCALE;
export const ENEMY_DOM_RADIUS = ENEMY_INTERCEPTOR_RADIUS;

// Параметры тяжелого стреляющего крейсера врагов (spaceShips_006)
export const ENEMY_GUNSHIP_HP = 20;
export const ENEMY_GUNSHIP_SPEED = 62;
export const ENEMY_GUNSHIP_SCORE = 120;
export const ENEMY_GUNSHIP_SCALE = 0.42;
export const ENEMY_GUNSHIP_RADIUS = 22;
export const ENEMY_GUNSHIP_SHOOT_COOLDOWN = 1.9;
export const ENEMY_GUNSHIP_SHOOT_RANGE = 680;
export const ENEMY_GUNSHIP_BULLET_SPEED = 340;
export const ENEMY_GUNSHIP_BULLET_DAMAGE = 14;
export const ENEMY_GUNSHIP_BULLET_LIFETIME = 2.4;

export const ENEMY_TERMINATOR_HP = ENEMY_GUNSHIP_HP;
export const ENEMY_TERMINATOR_SPEED = ENEMY_GUNSHIP_SPEED;
export const ENEMY_TERMINATOR_SCORE = ENEMY_GUNSHIP_SCORE;
export const ENEMY_TERMINATOR_SCALE = ENEMY_GUNSHIP_SCALE;
export const ENEMY_TERMINATOR_RADIUS = ENEMY_GUNSHIP_RADIUS;
export const ENEMY_TERMINATOR_SHOOT_COOLDOWN = ENEMY_GUNSHIP_SHOOT_COOLDOWN;
export const ENEMY_TERMINATOR_SHOOT_RANGE = ENEMY_GUNSHIP_SHOOT_RANGE;
export const ENEMY_TERMINATOR_BULLET_SPEED = ENEMY_GUNSHIP_BULLET_SPEED;
export const ENEMY_TERMINATOR_BULLET_DAMAGE = ENEMY_GUNSHIP_BULLET_DAMAGE;
export const ENEMY_TERMINATOR_BULLET_LIFETIME = ENEMY_GUNSHIP_BULLET_LIFETIME;

// --- Константы фаз игры ---
export const PHASE_2_SCORE_THRESHOLD = 1000; // Порог очков для перехода на 2 фазу

export interface PhaseInfo {
  number: number;
  title: string;
  scoreThreshold: number;
  subtitle: string;
  allowTerminator: boolean;
  spawnIntensity: number; // Множитель частоты появления врагов
  healthMultiplier: number; // Множитель прочности врагов
  maxMeteors: number; // Максимальное количество активных метеоритов в данной фазе
  meteorSpawnInterval: number; // Интервал появления новых метеоритов в секундах
  initialMeteorCount: number; // Начальное количество метеоритов на карте при входе в фазу
}

export const GAME_PHASES: PhaseInfo[] = [
  {
    number: 1,
    title: 'Фаза 1',
    scoreThreshold: 0,
    subtitle: 'ПРОТОКОЛ: ЗАЧИСТКА СЕКТОРА // СЛЕДУЮЩАЯ ФАЗА: 1000 ОЧКОВ',
    allowTerminator: false,
    spawnIntensity: 1.0,
    healthMultiplier: 1.0,
    maxMeteors: 10,
    meteorSpawnInterval: 2.2,
    initialMeteorCount: 5,
  },
  {
    number: 2,
    title: 'Фаза 2',
    scoreThreshold: PHASE_2_SCORE_THRESHOLD,
    subtitle: 'ВНИМАНИЕ: МЕТЕОРИТНЫЙ ПОТОК И ТЯЖЕЛЫЕ БОЕВЫЕ КРЕЙСЕРЫ!',
    allowTerminator: true,
    spawnIntensity: 1.4,
    healthMultiplier: 1.5,
    maxMeteors: 22,
    meteorSpawnInterval: 1.1,
    initialMeteorCount: 8,
  },
];

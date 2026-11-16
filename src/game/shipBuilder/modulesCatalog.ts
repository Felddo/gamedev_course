import { PLAYER_MAX_HP } from '../constants';

export type ModuleCategory = 'pilot' | 'body' | 'wings' | 'engines' | 'guns';

export interface ModuleStats {
  maxHpBonus?: number;
  damageReduction?: number; // 0.08 = 8% брони (снижение входящего урона)
  bulletDamageBonus?: number;
  fireRateMultiplier?: number;
  bulletSpeedBonus?: number;
  extraProjectiles?: number;
  speedMultiplier?: number;
  dashCooldownMultiplier?: number;
  dashSpeedMultiplier?: number;
  turnSpeedMultiplier?: number;
  maneuverabilityBonus?: number;
  superDurationBonus?: number;
  superCooldownMultiplier?: number;
  pilotBonusDamage?: number;
}

export interface ShipModule {
  id: string;
  name: string;
  englishName: string;
  category: ModuleCategory;
  partId: string; // ID в каталоге partsCatalog
  tier: number; // 0 = Стартовый, 1 = Сектор 1, 2 = Сектор 2, 3 = Сектор 3
  unlockMission: string;
  description: string;
  statsDescription: string;
  url?: string;
  stats: ModuleStats;
}

export interface CalculatedShipStats {
  maxHp: number;
  damageReduction: number;
  speedMultiplier: number;
  dashCooldownMultiplier: number;
  dashSpeedMultiplier: number;
  turnSpeedMultiplier: number;
  turnSpeedBonus: number;
  superDurationBonus: number;
  superCooldownMultiplier: number;
  bulletDamageBonus: number;
  fireRateMultiplier: number;
  bulletSpeedBonus: number;
  extraProjectiles: number;
  gunCount: number;
  moduleNames: string[];
}

export const MODULE_REWARD_MISSIONS = ['1-1', '1-3', '2-1', '2-3', '3-1', '3-3'];

export const DEFAULT_UNLOCKED_MODULES: string[] = [
  'mod_body_standard',
  'mod_pilot_standard',
  'mod_wings_standard',
  'mod_engine_standard',
  'mod_gun_standard',
];

export const SHIP_MODULES_CATALOG: ShipModule[] = [
  // ==========================================
  // КОРПУС // BODY (4 модуля: 1 стартовый + 3 открываемых)
  // ==========================================
  {
    id: 'mod_body_standard',
    name: 'Корпус «Вектор»',
    englishName: 'HULL // VECTOR MK-1',
    category: 'body',
    partId: 'body_black_spaceParts_047',
    tier: 0,
    unlockMission: 'Базовый модуль',
    description: 'Стандартный броневой несущий каркас из титаново-композитного сплава.',
    statsDescription: 'Базовая прочность (100 HP), стандартное распределение брони',
    stats: {
      maxHpBonus: 0,
      damageReduction: 0.0,
    },
  },
  {
    id: 'mod_body_reinforced',
    name: 'Усиленный корпус «Кевлар»',
    englishName: 'HULL // KEVLAR PLATES',
    category: 'body',
    partId: 'body_white_spaceParts_034',
    tier: 1,
    unlockMission: 'Сектор 1 // Миссия 1-1 или 1-3',
    description: 'Армированный керамическими пластинами каркас с повышенной энергоемкостью.',
    statsDescription: '+40 HP, +8% броня (сопротивление урону)',
    stats: {
      maxHpBonus: 40,
      damageReduction: 0.08,
    },
  },
  {
    id: 'mod_body_bastion',
    name: 'Тяжелая броня «Бастион»',
    englishName: 'HULL // BASTION BULWARK',
    category: 'body',
    partId: 'body_black_spaceParts_048',
    tier: 2,
    unlockMission: 'Сектор 2 // Миссия 2-1 или 2-3',
    description: 'Многослойная реактивная обшивка для выдерживания массированных плазменных залпов.',
    statsDescription: '+90 HP, +16% броня (сопротивление урону)',
    stats: {
      maxHpBonus: 90,
      damageReduction: 0.16,
    },
  },
  {
    id: 'mod_body_dreadnought',
    name: 'Бронеплиты «Дредноут»',
    englishName: 'HULL // DREADNOUGHT CITADEL',
    category: 'body',
    partId: 'body_black_spaceParts_055',
    tier: 3,
    unlockMission: 'Сектор 3 // Миссия 3-1 или 3-3',
    description: 'Титановый монокок военного класса со встроенной поглощающей решеткой.',
    statsDescription: '+150 HP, +25% броня (максимальная защита)',
    stats: {
      maxHpBonus: 150,
      damageReduction: 0.25,
    },
  },

  // ==========================================
  // ПУШКИ // GUNS (4 модуля: 1 стартовый + 3 открываемых)
  // ==========================================
  {
    id: 'mod_gun_standard',
    name: 'Бластер «Искра»',
    englishName: 'WEAPONS // SPARK BLASTER',
    category: 'guns',
    partId: 'guns_0',
    tier: 0,
    unlockMission: 'Базовый модуль',
    description: 'Надежное базовое импульсное орудие средней скорострельности.',
    statsDescription: 'Точка огня носового орудия, стандартный темп стрельбы',
    stats: {
      bulletDamageBonus: 0,
      fireRateMultiplier: 1.0,
      bulletSpeedBonus: 0,
    },
  },
  {
    id: 'mod_gun_rapid',
    name: 'Скорострел «Шквал»',
    englishName: 'WEAPONS // SQUALL RAPID-FIRE',
    category: 'guns',
    partId: 'guns_1',
    tier: 1,
    unlockMission: 'Сектор 1 // Миссия 1-1 или 1-3',
    description: 'Орудийный блок с охладителем для непрерывного подавления перехватчиков.',
    statsDescription: '+25% скорострельность, +60 к скорости полета снарядов',
    stats: {
      bulletDamageBonus: 1,
      fireRateMultiplier: 1.25,
      bulletSpeedBonus: 60,
    },
  },
  {
    id: 'mod_gun_heavy_cannon',
    name: 'Тяжелое орудие «Вулкан»',
    englishName: 'WEAPONS // VULCAN CANNON',
    category: 'guns',
    partId: 'guns_2',
    tier: 2,
    unlockMission: 'Сектор 2 // Миссия 2-1 или 2-3',
    description: 'Крупнокалиберное термоплазменное орудие с высоким разовым уроном.',
    statsDescription: '+6 к урону выстрела, +10% скорострельность',
    stats: {
      bulletDamageBonus: 6,
      fireRateMultiplier: 1.1,
      bulletSpeedBonus: 40,
    },
  },
  {
    id: 'mod_gun_twin_accelerator',
    name: 'Рельсотрон «Армагеддон»',
    englishName: 'WEAPONS // ARMAGEDDON RAILGUN',
    category: 'guns',
    partId: 'guns_3',
    tier: 3,
    unlockMission: 'Сектор 3 // Миссия 3-1 или 3-3',
    description: 'Электромагнитный разгонник повышенной мощности с бронебойными сердечниками.',
    statsDescription: '+12 к урону выстрела, +35% скорострельность, +120 скорость снаряда',
    stats: {
      bulletDamageBonus: 12,
      fireRateMultiplier: 1.35,
      bulletSpeedBonus: 120,
    },
  },

  // ==========================================
  // ДВИГАТЕЛИ // ENGINES (4 модуля: 1 стартовый + 3 открываемых)
  // ==========================================
  {
    id: 'mod_engine_standard',
    name: 'Фотонный двигатель «Ион-1»',
    englishName: 'THRUSTERS // ION-1 CORE',
    category: 'engines',
    partId: 'engines_0',
    tier: 0,
    unlockMission: 'Базовый модуль',
    description: 'Базовый маршевый двигатель с ионными камерами сгорания.',
    statsDescription: 'Стандартная тяга и базовый откат форсажного рывка',
    stats: {
      speedMultiplier: 1.0,
      dashCooldownMultiplier: 1.0,
      dashSpeedMultiplier: 1.0,
    },
  },
  {
    id: 'mod_engine_afterburner',
    name: 'Форсажный привод «Комета»',
    englishName: 'THRUSTERS // COMET AFTERBURNER',
    category: 'engines',
    partId: 'engines_1',
    tier: 1,
    unlockMission: 'Сектор 1 // Миссия 1-1 или 1-3',
    description: 'Оснащен форсажной камерой впрыска гелия-3 для быстрых маневров.',
    statsDescription: '+15% скорость полета, -15% перезарядка рывка',
    stats: {
      speedMultiplier: 1.15,
      dashCooldownMultiplier: 0.85,
      dashSpeedMultiplier: 1.15,
    },
  },
  {
    id: 'mod_engine_warp',
    name: 'Варп-турбина «Пульсар»',
    englishName: 'THRUSTERS // PULSAR WARP DRIVE',
    category: 'engines',
    partId: 'engines_2',
    tier: 2,
    unlockMission: 'Сектор 2 // Миссия 2-1 или 2-3',
    description: 'Импульсный фазовый привод с микро-искривлением пространства при рывке.',
    statsDescription: '+25% скорость полета, -28% откат рывка, +20% дальность рывка',
    stats: {
      speedMultiplier: 1.25,
      dashCooldownMultiplier: 0.72,
      dashSpeedMultiplier: 1.25,
    },
  },
  {
    id: 'mod_engine_singularity',
    name: 'Грави-привод «Сингулярность»',
    englishName: 'THRUSTERS // SINGULARITY DRIVE',
    category: 'engines',
    partId: 'engines_3',
    tier: 3,
    unlockMission: 'Сектор 3 // Миссия 3-1 или 3-3',
    description: 'Двигатель на основе микрочерных дыр, обеспечивающий колоссальную тягу.',
    statsDescription: '+40% скорость полета, -42% откат рывка, +35% скорость рывка',
    stats: {
      speedMultiplier: 1.4,
      dashCooldownMultiplier: 0.58,
      dashSpeedMultiplier: 1.35,
    },
  },

  // ==========================================
  // КРЫЛЬЯ // WINGS (4 модуля: 1 стартовый + 3 открываемых)
  // ==========================================
  {
    id: 'mod_wings_standard',
    name: 'Крылья «Дельта»',
    englishName: 'WINGS // DELTA STABILIZER',
    category: 'wings',
    partId: 'wings_blue_spaceParts_010',
    tier: 0,
    unlockMission: 'Базовый модуль',
    description: 'Стандартные аэродинамические плоскости с маневровыми дюзами.',
    statsDescription: 'Базовая скорость углового наведения и разворота',
    stats: {
      turnSpeedMultiplier: 1.0,
      maneuverabilityBonus: 0,
    },
  },
  {
    id: 'mod_wings_interceptor',
    name: 'Крылья перехватчика «Сокол»',
    englishName: 'WINGS // FALCON INTERCEPTOR',
    category: 'wings',
    partId: 'wings_green_spaceParts_011',
    tier: 1,
    unlockMission: 'Сектор 1 // Миссия 1-1 или 1-3',
    description: 'Облегченные плоскости с изменяемой стреловидностью для резких виражей.',
    statsDescription: '+30% скорость поворота корабля',
    stats: {
      turnSpeedMultiplier: 1.3,
      maneuverabilityBonus: 10,
    },
  },
  {
    id: 'mod_wings_phantom',
    name: 'Стабилизаторы «Фантом»',
    englishName: 'WINGS // PHANTOM AEROFOIL',
    category: 'wings',
    partId: 'wings_blue_spaceParts_012',
    tier: 2,
    unlockMission: 'Сектор 2 // Миссия 2-1 или 2-3',
    description: 'Магнитогидродинамические щитки для мгновенного изменения вектора инерции.',
    statsDescription: '+60% скорость поворота корабля, улучшенный дрифт',
    stats: {
      turnSpeedMultiplier: 1.6,
      maneuverabilityBonus: 22,
    },
  },
  {
    id: 'mod_wings_valkyrie',
    name: 'Штурмовые крылья «Валькирия»',
    englishName: 'WINGS // VALKYRIE STRIKER',
    category: 'wings',
    partId: 'wings_red_spaceParts_001',
    tier: 3,
    unlockMission: 'Сектор 3 // Миссия 3-1 или 3-3',
    description: 'Сверхлегкие гравитационные пилоны с дополнительными точками крепления.',
    statsDescription: '+100% скорость поворота, безупречная курсовая маневренность',
    stats: {
      turnSpeedMultiplier: 2.0,
      maneuverabilityBonus: 35,
    },
  },

  // ==========================================
  // КАБИНА // PILOT (4 модуля: 1 стартовый + 3 открываемых)
  // ==========================================
  {
    id: 'mod_pilot_standard',
    name: 'Кабина «Вектор-Орион»',
    englishName: 'COCKPIT // ORION AVIONICS',
    category: 'pilot',
    partId: 'pilot_black_spaceParts_054',
    tier: 0,
    unlockMission: 'Базовый модуль',
    description: 'Стандартный командный модуль пилота с оптико-электронным прицелом.',
    statsDescription: 'Базовая длительность боевой перегрузки (5 сек)',
    stats: {
      superDurationBonus: 0,
      superCooldownMultiplier: 1.0,
      pilotBonusDamage: 0,
    },
  },
  {
    id: 'mod_pilot_tactical',
    name: 'Кабина «Центурион»',
    englishName: 'COCKPIT // CENTURION HUD',
    category: 'pilot',
    partId: 'pilot_white_spaceParts_058',
    tier: 1,
    unlockMission: 'Сектор 1 // Миссия 1-1 или 1-3',
    description: 'Тактический вычислитель упреждения огня и оптимизированная система охлаждения.',
    statsDescription: '+1.5 сек длительность супер-режима, +2 к урону',
    stats: {
      superDurationBonus: 1.5,
      superCooldownMultiplier: 0.9,
      pilotBonusDamage: 2,
    },
  },
  {
    id: 'mod_pilot_command',
    name: 'Мостик «Оверлорд»',
    englishName: 'COCKPIT // OVERLORD BRIDGE',
    category: 'pilot',
    partId: 'pilot_black_spaceParts_057',
    tier: 2,
    unlockMission: 'Сектор 2 // Миссия 2-1 или 2-3',
    description: 'Нейроинтерфейс прямого сопряжения с реактором и орудийными шинами.',
    statsDescription: '+2.5 сек супер-режим, -25% перезарядка супер-режима, +4 к урону',
    stats: {
      superDurationBonus: 2.5,
      superCooldownMultiplier: 0.75,
      pilotBonusDamage: 4,
    },
  },
  {
    id: 'mod_pilot_nemesis',
    name: 'Нейрошлем «Немезида»',
    englishName: 'COCKPIT // NEMESIS APEX',
    category: 'pilot',
    partId: 'pilot_white_spaceParts_062',
    tier: 3,
    unlockMission: 'Сектор 3 // Миссия 3-1 или 3-3',
    description: 'Боевой квантовый комплекс управления огнем и перегрузкой плазменных ядер.',
    statsDescription: '+4.0 сек супер-режим, -40% откат супер-режима, +8 к урону',
    stats: {
      superDurationBonus: 4.0,
      superCooldownMultiplier: 0.6,
      pilotBonusDamage: 8,
    },
  },
];

// Кэш для быстрого поиска
const MODULE_BY_ID = new Map<string, ShipModule>();
const MODULE_BY_PART_ID = new Map<string, ShipModule>();
const CURATED_PART_IDS = new Set<string>();

SHIP_MODULES_CATALOG.forEach((mod) => {
  MODULE_BY_ID.set(mod.id, mod);
  MODULE_BY_PART_ID.set(mod.partId, mod);
  CURATED_PART_IDS.add(mod.partId);
});

export function getModuleById(id: string): ShipModule | undefined {
  return MODULE_BY_ID.get(id);
}

export function getModuleByPartId(partId: string): ShipModule | undefined {
  return MODULE_BY_PART_ID.get(partId);
}

export function getAllShipModules(): ShipModule[] {
  return [...SHIP_MODULES_CATALOG];
}

export function isCuratedPart(partId: string): boolean {
  return CURATED_PART_IDS.has(partId);
}

export function isModuleRewardMission(missionId: string): boolean {
  return MODULE_REWARD_MISSIONS.includes(missionId);
}

export function getMissionRewardTier(missionId: string): number {
  if (missionId === '1-1' || missionId === '1-3') return 1;
  if (missionId === '2-1' || missionId === '2-3') return 2;
  if (missionId === '3-1' || missionId === '3-3') return 3;
  return 1;
}

/**
 * Получение 3 случайных доступных модулей для награды за миссию.
 * - Учитывает текущий тир миссии (предлагает модули текущего тира или оставшиеся предыдущих)
 * - Никогда не предлагает уже разблокированные модули
 * - Если доступно меньше 3 модулей, возвращает сколько есть (1 или 2)
 * - Если все открыты, возвращает пустой массив
 */
export function getAvailableRewardModules(
  missionId: string,
  unlockedModuleIds: string[]
): ShipModule[] {
  const currentTier = getMissionRewardTier(missionId);
  const unlockedSet = new Set(unlockedModuleIds);

  // Находим все неоткрытые модули тира <= currentTier (исключая базовые тир 0)
  let eligible = SHIP_MODULES_CATALOG.filter(
    (mod) => mod.tier > 0 && mod.tier <= currentTier && !unlockedSet.has(mod.id)
  );

  // Если в текущем тире мало модулей, можно подключить любые оставшиеся неоткрытые модули
  if (eligible.length === 0) {
    eligible = SHIP_MODULES_CATALOG.filter((mod) => mod.tier > 0 && !unlockedSet.has(mod.id));
  }

  if (eligible.length === 0) return [];
  if (eligible.length <= 3) return [...eligible];

  // Перемешиваем и берем 3 случайных модуля
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

/**
 * Строгий расчет боевых характеристик корабля исключительно по фактически установленным модулям.
 * Если модуль не установлен в ангаре, он не дает никаких бонусов.
 */
export function calculateAssemblyStats(
  installedModules: Array<{ category: string; textureKey?: string }>
): CalculatedShipStats {
  let maxHpBonus = 0;
  let damageReduction = 0;
  let speedMultiplier = 1.0;
  let dashCooldownMultiplier = 1.0;
  let dashSpeedMultiplier = 1.0;
  let turnSpeedMultiplier = 1.0;
  let turnSpeedBonus = 0;
  let superDurationBonus = 0;
  let superCooldownMultiplier = 1.0;
  let bulletDamageBonus = 0;
  let fireRateMultiplier = 1.0;
  let bulletSpeedBonus = 0;
  let extraProjectiles = 0;
  let gunCount = 0;
  const moduleNames: string[] = [];

  installedModules.forEach((item) => {
    const mod = item.textureKey ? getModuleByPartId(item.textureKey) : undefined;
    if (mod) {
      moduleNames.push(mod.name);
      const st = mod.stats;

      if (mod.category === 'body') {
        maxHpBonus += st.maxHpBonus || 0;
        damageReduction += st.damageReduction || 0;
      } else if (mod.category === 'guns') {
        gunCount++;
        bulletDamageBonus += st.bulletDamageBonus || 0;
        fireRateMultiplier *= st.fireRateMultiplier || 1.0;
        bulletSpeedBonus += st.bulletSpeedBonus || 0;
        extraProjectiles += st.extraProjectiles || 0;
      } else if (mod.category === 'engines') {
        speedMultiplier *= st.speedMultiplier || 1.0;
        dashCooldownMultiplier *= st.dashCooldownMultiplier || 1.0;
        dashSpeedMultiplier *= st.dashSpeedMultiplier || 1.0;
      } else if (mod.category === 'wings') {
        turnSpeedMultiplier *= st.turnSpeedMultiplier || 1.0;
        turnSpeedBonus += st.maneuverabilityBonus || 0;
      } else if (mod.category === 'pilot') {
        superDurationBonus += st.superDurationBonus || 0;
        superCooldownMultiplier *= st.superCooldownMultiplier || 1.0;
        bulletDamageBonus += st.pilotBonusDamage || 0;
      }
    }
  });

  // Ограничиваем максимальную броню 40% во избежание бессмертия
  const finalDamageReduction = Math.min(0.4, Math.max(0, damageReduction));

  return {
    maxHp: PLAYER_MAX_HP + maxHpBonus,
    damageReduction: finalDamageReduction,
    speedMultiplier,
    dashCooldownMultiplier,
    dashSpeedMultiplier,
    turnSpeedMultiplier,
    turnSpeedBonus,
    superDurationBonus,
    superCooldownMultiplier,
    bulletDamageBonus,
    fireRateMultiplier,
    bulletSpeedBonus,
    extraProjectiles,
    gunCount: Math.max(1, gunCount),
    moduleNames,
  };
}

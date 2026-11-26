import { PLAYER_MAX_HP } from '../constants';

export type ModuleCategory = 'pilot' | 'body' | 'wings' | 'engines' | 'guns';
export type ModuleRarityType = 'common' | 'rare' | 'legendary';

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

export interface ModuleRarityConfig {
  type: ModuleRarityType;
  title: string;
  color: string;
  borderColor: string;
  glowColor: string;
  bgLight: string;
}

export const MODULE_RARITIES: Record<ModuleRarityType, ModuleRarityConfig> = {
  common: {
    type: 'common',
    title: 'ОБЫЧНЫЙ',
    color: '#94a3b8',
    borderColor: 'rgba(148, 163, 184, 0.75)',
    glowColor: 'rgba(148, 163, 184, 0.3)',
    bgLight: 'rgba(148, 163, 184, 0.12)',
  },
  rare: {
    type: 'rare',
    title: 'РЕДКИЙ',
    color: '#facc15',
    borderColor: '#eab308',
    glowColor: 'rgba(234, 179, 8, 0.4)',
    bgLight: 'rgba(234, 179, 8, 0.14)',
  },
  legendary: {
    type: 'legendary',
    title: 'ЛЕГЕНДАРНЫЙ',
    color: '#ef4444',
    borderColor: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.5)',
    bgLight: 'rgba(239, 68, 68, 0.16)',
  },
};

export interface ShipModule {
  id: string;
  name: string;
  category: ModuleCategory;
  partId: string; // ID в каталоге деталей
  rarity: ModuleRarityType;
  statsLines: string[]; // Характеристики в процентном соотношении (каждая с новой строки)
  tier: number; // 0 = Базовые, 1 = Сектор 1, 2 = Сектор 2 (Редкие), 3 = Сектор 3 (Легендарные)
  price: number; // Стоимость покупки за валюту «Металлолом»
  stats: ModuleStats;
  url?: string;
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

export const SHIP_MODULES_CATALOG: ShipModule[] = [
  // =========================================================================
  // 1. КАБИНА // PILOT (9 деталей: 4 обычные, 3 редкие, 2 легендарные)
  // =========================================================================
  // --- ОБЫЧНЫЕ (4 детали) ---
  {
    id: 'mod_pilot_orion',
    name: '«Орион»',
    category: 'pilot',
    partId: 'pilot_black_spaceParts_054',
    rarity: 'common',
    tier: 0,
    price: 100,
    statsLines: ['+15% овердрайва', '+10% урона'],
    stats: {
      superDurationBonus: 1.5,
      pilotBonusDamage: 2,
    },
  },
  {
    id: 'mod_pilot_centurion',
    name: '«Центурион»',
    category: 'pilot',
    partId: 'pilot_white_spaceParts_058',
    rarity: 'common',
    tier: 0,
    price: 100,
    statsLines: ['+20% овердрайва', '+5% урона'],
    stats: {
      superDurationBonus: 2.0,
      pilotBonusDamage: 1,
    },
  },
  {
    id: 'mod_pilot_apex',
    name: '«Апекс»',
    category: 'pilot',
    partId: 'pilot_black_spaceParts_059',
    rarity: 'common',
    tier: 0,
    price: 120,
    statsLines: ['+15% урона', '-10% отката ульты'],
    stats: {
      pilotBonusDamage: 3,
      superCooldownMultiplier: 0.9,
    },
  },
  {
    id: 'mod_pilot_guardian',
    name: '«Страж»',
    category: 'pilot',
    partId: 'pilot_white_spaceParts_060',
    rarity: 'common',
    tier: 0,
    price: 120,
    statsLines: ['+25% овердрайва', '+5% брони'],
    stats: {
      superDurationBonus: 2.5,
      damageReduction: 0.05,
    },
  },
  // --- РЕДКИЕ (3 детали) ---
  {
    id: 'mod_pilot_overlord',
    name: '«Оверлорд»',
    category: 'pilot',
    partId: 'pilot_black_spaceParts_057',
    rarity: 'rare',
    tier: 2,
    price: 280,
    statsLines: ['+35% овердрайва', '+20% урона'],
    stats: {
      superDurationBonus: 3.5,
      pilotBonusDamage: 5,
    },
  },
  {
    id: 'mod_pilot_phantom',
    name: '«Фантом»',
    category: 'pilot',
    partId: 'pilot_white_spaceParts_064',
    rarity: 'rare',
    tier: 2,
    price: 300,
    statsLines: ['+30% урона', '-25% отката ульты'],
    stats: {
      pilotBonusDamage: 6,
      superCooldownMultiplier: 0.75,
    },
  },
  {
    id: 'mod_pilot_spectre',
    name: '«Спектр»',
    category: 'pilot',
    partId: 'pilot_black_spaceParts_065',
    rarity: 'rare',
    tier: 2,
    price: 300,
    statsLines: ['+40% овердрайва', '+15% скорости'],
    stats: {
      superDurationBonus: 4.0,
      speedMultiplier: 1.15,
    },
  },
  // --- ЛЕГЕНДАРНЫЕ (2 детали) ---
  {
    id: 'mod_pilot_nemesis',
    name: '«Немезида»',
    category: 'pilot',
    partId: 'pilot_white_spaceParts_062',
    rarity: 'legendary',
    tier: 3,
    price: 720,
    statsLines: ['+60% овердрайва', '+45% урона'],
    stats: {
      superDurationBonus: 6.0,
      pilotBonusDamage: 10,
    },
  },
  {
    id: 'mod_pilot_archon',
    name: '«Архонт»',
    category: 'pilot',
    partId: 'pilot_black_spaceParts_069',
    rarity: 'legendary',
    tier: 3,
    price: 760,
    statsLines: ['+50% урона', '-45% отката ульты'],
    stats: {
      pilotBonusDamage: 12,
      superCooldownMultiplier: 0.55,
    },
  },

  // =========================================================================
  // 2. ТЕЛО // BODY (9 деталей: 4 обычные, 3 редкие, 2 легендарные)
  // =========================================================================
  // --- ОБЫЧНЫЕ (4 детали) ---
  {
    id: 'mod_body_standard',
    name: '«Вектор»',
    category: 'body',
    partId: 'body_black_spaceParts_047',
    rarity: 'common',
    tier: 0,
    price: 100,
    statsLines: ['+15% здоровья', '+5% брони'],
    stats: {
      maxHpBonus: 30,
      damageReduction: 0.05,
    },
  },
  {
    id: 'mod_body_reinforced',
    name: '«Кевлар»',
    category: 'body',
    partId: 'body_white_spaceParts_034',
    rarity: 'common',
    tier: 0,
    price: 120,
    statsLines: ['+20% здоровья', '+8% брони'],
    stats: {
      maxHpBonus: 40,
      damageReduction: 0.08,
    },
  },
  {
    id: 'mod_body_skat',
    name: '«Скат»',
    category: 'body',
    partId: 'body_black_spaceParts_049',
    rarity: 'common',
    tier: 0,
    price: 120,
    statsLines: ['+25% здоровья', '+5% скорости'],
    stats: {
      maxHpBonus: 50,
      speedMultiplier: 1.05,
    },
  },
  {
    id: 'mod_body_bastida',
    name: '«Бастида»',
    category: 'body',
    partId: 'body_white_spaceParts_035',
    rarity: 'common',
    tier: 0,
    price: 130,
    statsLines: ['+15% здоровья', '+12% брони'],
    stats: {
      maxHpBonus: 30,
      damageReduction: 0.12,
    },
  },
  // --- РЕДКИЕ (3 детали) ---
  {
    id: 'mod_body_bastion',
    name: '«Бастион»',
    category: 'body',
    partId: 'body_black_spaceParts_048',
    rarity: 'rare',
    tier: 2,
    price: 300,
    statsLines: ['+45% здоровья', '+18% брони'],
    stats: {
      maxHpBonus: 90,
      damageReduction: 0.18,
    },
  },
  {
    id: 'mod_body_titan',
    name: '«Титан»',
    category: 'body',
    partId: 'body_white_spaceParts_036',
    rarity: 'rare',
    tier: 2,
    price: 320,
    statsLines: ['+55% здоровья', '+15% брони'],
    stats: {
      maxHpBonus: 110,
      damageReduction: 0.15,
    },
  },
  {
    id: 'mod_body_citadel',
    name: '«Цитадель»',
    category: 'body',
    partId: 'body_black_spaceParts_050',
    rarity: 'rare',
    tier: 2,
    price: 340,
    statsLines: ['+40% здоровья', '+25% брони'],
    stats: {
      maxHpBonus: 80,
      damageReduction: 0.25,
    },
  },
  // --- ЛЕГЕНДАРНЫЕ (2 детали) ---
  {
    id: 'mod_body_dreadnought',
    name: '«Дредноут»',
    category: 'body',
    partId: 'body_black_spaceParts_055',
    rarity: 'legendary',
    tier: 3,
    price: 760,
    statsLines: ['+80% здоровья', '+30% брони'],
    stats: {
      maxHpBonus: 160,
      damageReduction: 0.3,
    },
  },
  {
    id: 'mod_body_leviathan',
    name: '«Левиафан»',
    category: 'body',
    partId: 'body_white_spaceParts_042',
    rarity: 'legendary',
    tier: 3,
    price: 800,
    statsLines: ['+100% здоровья', '+35% брони'],
    stats: {
      maxHpBonus: 200,
      damageReduction: 0.35,
    },
  },

  // =========================================================================
  // 3. КРЫЛЬЯ // WINGS (18 деталей: 8 обычные синие, 6 редкие зеленые, 4 легендарные красные)
  // =========================================================================
  // --- ОБЫЧНЫЕ (8 синих деталей) ---
  {
    id: 'mod_wings_standard',
    name: '«Дельта»',
    category: 'wings',
    partId: 'wings_blue_spaceParts_010',
    rarity: 'common',
    tier: 0,
    price: 70,
    statsLines: ['+15% поворота', '+10% скорости'],
    stats: {
      turnSpeedMultiplier: 1.15,
      speedMultiplier: 1.1,
    },
  },
  {
    id: 'mod_wings_interceptor',
    name: '«Сокол»',
    category: 'wings',
    partId: 'wings_blue_spaceParts_012',
    rarity: 'common',
    tier: 0,
    price: 70,
    statsLines: ['+20% поворота', '+15% маневра'],
    stats: {
      turnSpeedMultiplier: 1.2,
      maneuverabilityBonus: 10,
    },
  },
  {
    id: 'mod_wings_swift',
    name: '«Стриж»',
    category: 'wings',
    partId: 'wings_blue_spaceParts_014',
    rarity: 'common',
    tier: 0,
    price: 80,
    statsLines: ['+25% поворота', '+5% скорости'],
    stats: {
      turnSpeedMultiplier: 1.25,
      speedMultiplier: 1.05,
    },
  },
  {
    id: 'mod_wings_arrow',
    name: '«Стрела»',
    category: 'wings',
    partId: 'wings_blue_spaceParts_016',
    rarity: 'common',
    tier: 0,
    price: 80,
    statsLines: ['+15% скорости', '+15% поворота'],
    stats: {
      speedMultiplier: 1.15,
      turnSpeedMultiplier: 1.15,
    },
  },
  {
    id: 'mod_wings_hawk',
    name: '«Ястреб»',
    category: 'wings',
    partId: 'wings_blue_spaceParts_018',
    rarity: 'common',
    tier: 0,
    price: 90,
    statsLines: ['+20% маневра', '+20% поворота'],
    stats: {
      maneuverabilityBonus: 15,
      turnSpeedMultiplier: 1.2,
    },
  },
  {
    id: 'mod_wings_turn',
    name: '«Вираж»',
    category: 'wings',
    partId: 'wings_blue_spaceParts_020',
    rarity: 'common',
    tier: 0,
    price: 90,
    statsLines: ['+30% поворота', '+10% маневра'],
    stats: {
      turnSpeedMultiplier: 1.3,
      maneuverabilityBonus: 10,
    },
  },
  {
    id: 'mod_wings_glider',
    name: '«Планер»',
    category: 'wings',
    partId: 'wings_blue_spaceParts_022',
    rarity: 'common',
    tier: 0,
    price: 95,
    statsLines: ['+15% поворота', '+15% маневра'],
    stats: {
      turnSpeedMultiplier: 1.15,
      maneuverabilityBonus: 12,
    },
  },
  {
    id: 'mod_wings_azure',
    name: '«Азур»',
    category: 'wings',
    partId: 'wings_blue_spaceParts_024',
    rarity: 'common',
    tier: 0,
    price: 100,
    statsLines: ['+25% поворота', '+10% скорости'],
    stats: {
      turnSpeedMultiplier: 1.25,
      speedMultiplier: 1.1,
    },
  },
  // --- РЕДКИЕ (6 зеленых деталей) ---
  {
    id: 'mod_wings_petrel',
    name: '«Буревестник»',
    category: 'wings',
    partId: 'wings_green_spaceParts_013',
    rarity: 'rare',
    tier: 2,
    price: 220,
    statsLines: ['+45% поворота', '+20% скорости'],
    stats: {
      turnSpeedMultiplier: 1.45,
      speedMultiplier: 1.2,
    },
  },
  {
    id: 'mod_wings_blade',
    name: '«Клинок»',
    category: 'wings',
    partId: 'wings_green_spaceParts_011',
    rarity: 'rare',
    tier: 2,
    price: 230,
    statsLines: ['+50% поворота', '+25% маневра'],
    stats: {
      turnSpeedMultiplier: 1.5,
      maneuverabilityBonus: 20,
    },
  },
  {
    id: 'mod_wings_vortex',
    name: '«Вихрь»',
    category: 'wings',
    partId: 'wings_green_spaceParts_019',
    rarity: 'rare',
    tier: 2,
    price: 240,
    statsLines: ['+55% поворота', '+15% скорости'],
    stats: {
      turnSpeedMultiplier: 1.55,
      speedMultiplier: 1.15,
    },
  },
  {
    id: 'mod_wings_phantom',
    name: '«Фантом»',
    category: 'wings',
    partId: 'wings_green_spaceParts_015',
    rarity: 'rare',
    tier: 2,
    price: 250,
    statsLines: ['+60% поворота', '+30% маневра'],
    stats: {
      turnSpeedMultiplier: 1.6,
      maneuverabilityBonus: 25,
    },
  },
  {
    id: 'mod_wings_emerald',
    name: '«Изумруд»',
    category: 'wings',
    partId: 'wings_green_spaceParts_017',
    rarity: 'rare',
    tier: 2,
    price: 260,
    statsLines: ['+55% поворота', '+25% маневра'],
    stats: {
      turnSpeedMultiplier: 1.55,
      maneuverabilityBonus: 22,
    },
  },
  {
    id: 'mod_wings_cyclone',
    name: '«Циклон»',
    category: 'wings',
    partId: 'wings_green_spaceParts_021',
    rarity: 'rare',
    tier: 2,
    price: 270,
    statsLines: ['+65% поворота', '+20% скорости'],
    stats: {
      turnSpeedMultiplier: 1.65,
      speedMultiplier: 1.2,
    },
  },
  // --- ЛЕГЕНДАРНЫЕ (4 красные детали) ---
  {
    id: 'mod_wings_valkyrie',
    name: '«Валькирия»',
    category: 'wings',
    partId: 'wings_red_spaceParts_001',
    rarity: 'legendary',
    tier: 3,
    price: 560,
    statsLines: ['+90% поворота', '+40% скорости'],
    stats: {
      turnSpeedMultiplier: 1.9,
      speedMultiplier: 1.4,
    },
  },
  {
    id: 'mod_wings_armageddon',
    name: '«Армагеддон»',
    category: 'wings',
    partId: 'wings_red_spaceParts_002',
    rarity: 'legendary',
    tier: 3,
    price: 600,
    statsLines: ['+100% поворота', '+50% маневра'],
    stats: {
      turnSpeedMultiplier: 2.0,
      maneuverabilityBonus: 40,
    },
  },
  {
    id: 'mod_wings_crimson',
    name: '«Багрянец»',
    category: 'wings',
    partId: 'wings_red_spaceParts_003',
    rarity: 'legendary',
    tier: 3,
    price: 620,
    statsLines: ['+95% поворота', '+45% скорости'],
    stats: {
      turnSpeedMultiplier: 1.95,
      speedMultiplier: 1.45,
    },
  },
  {
    id: 'mod_wings_phoenix',
    name: '«Феникс»',
    category: 'wings',
    partId: 'wings_red_spaceParts_004',
    rarity: 'legendary',
    tier: 3,
    price: 650,
    statsLines: ['+110% поворота', '+55% маневра'],
    stats: {
      turnSpeedMultiplier: 2.1,
      maneuverabilityBonus: 45,
    },
  },

  // =========================================================================
  // 4. ДВИГАТЕЛИ // ENGINES (4 детали: 2 обычные, 1 редкая, 1 легендарная)
  // =========================================================================
  // --- ОБЫЧНЫЕ (2 детали) ---
  {
    id: 'mod_engine_standard',
    name: '«Ион-1»',
    category: 'engines',
    partId: 'engines_0',
    rarity: 'common',
    tier: 0,
    price: 90,
    statsLines: ['+15% скорости', '-15% отката рывка'],
    stats: {
      speedMultiplier: 1.15,
      dashCooldownMultiplier: 0.85,
      dashSpeedMultiplier: 1.15,
    },
  },
  {
    id: 'mod_engine_afterburner',
    name: '«Комета»',
    category: 'engines',
    partId: 'engines_1',
    rarity: 'common',
    tier: 0,
    price: 110,
    statsLines: ['+20% скорости', '+20% силы рывка'],
    stats: {
      speedMultiplier: 1.2,
      dashSpeedMultiplier: 1.2,
      dashCooldownMultiplier: 0.9,
    },
  },
  // --- РЕДКАЯ (1 деталь) ---
  {
    id: 'mod_engine_warp',
    name: '«Пульсар»',
    category: 'engines',
    partId: 'engines_2',
    rarity: 'rare',
    tier: 2,
    price: 260,
    statsLines: ['+35% скорости', '-30% отката рывка'],
    stats: {
      speedMultiplier: 1.35,
      dashCooldownMultiplier: 0.7,
      dashSpeedMultiplier: 1.25,
    },
  },
  // --- ЛЕГЕНДАРНАЯ (1 деталь) ---
  {
    id: 'mod_engine_singularity',
    name: '«Сингулярность»',
    category: 'engines',
    partId: 'engines_3',
    rarity: 'legendary',
    tier: 3,
    price: 640,
    statsLines: ['+60% скорости', '-50% отката рывка'],
    stats: {
      speedMultiplier: 1.6,
      dashCooldownMultiplier: 0.5,
      dashSpeedMultiplier: 1.4,
    },
  },

  // =========================================================================
  // 5. ПУШКИ // GUNS (4 детали: 2 обычные, 1 редкая, 1 легендарная)
  // =========================================================================
  // --- ОБЫЧНЫЕ (2 детали) ---
  {
    id: 'mod_gun_standard',
    name: '«Искра»',
    category: 'guns',
    partId: 'guns_0',
    rarity: 'common',
    tier: 0,
    price: 100,
    statsLines: ['+15% урона', '+15% скорострельности'],
    stats: {
      bulletDamageBonus: 2,
      fireRateMultiplier: 1.15,
      bulletSpeedBonus: 30,
    },
  },
  {
    id: 'mod_gun_rapid',
    name: '«Шквал»',
    category: 'guns',
    partId: 'guns_1',
    rarity: 'common',
    tier: 0,
    price: 120,
    statsLines: ['+10% урона', '+35% скорострельности'],
    stats: {
      bulletDamageBonus: 1,
      fireRateMultiplier: 1.35,
      bulletSpeedBonus: 60,
    },
  },
  // --- РЕДКАЯ (1 деталь) ---
  {
    id: 'mod_gun_heavy_cannon',
    name: '«Вулкан»',
    category: 'guns',
    partId: 'guns_2',
    rarity: 'rare',
    tier: 2,
    price: 300,
    statsLines: ['+40% урона', '+20% скорострельности'],
    stats: {
      bulletDamageBonus: 6,
      fireRateMultiplier: 1.2,
      bulletSpeedBonus: 80,
    },
  },
  // --- ЛЕГЕНДАРНАЯ (1 деталь) ---
  {
    id: 'mod_gun_twin_accelerator',
    name: '«Рельсотрон»',
    category: 'guns',
    partId: 'guns_3',
    rarity: 'legendary',
    tier: 3,
    price: 700,
    statsLines: ['+80% урона', '+45% скорострельности'],
    stats: {
      bulletDamageBonus: 12,
      fireRateMultiplier: 1.45,
      bulletSpeedBonus: 140,
    },
  },
];

// Все базовые модули (обычные, tier: 0) открыты по умолчанию для свободного конструктора
export const DEFAULT_UNLOCKED_MODULES: string[] = SHIP_MODULES_CATALOG
  .filter((m) => m.tier === 0)
  .map((m) => m.id);

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

/**
 * Проверка, открыт ли доступ к ПОКУПКЕ модуля в ангаре:
 * - Обычные (tier 0): доступны всегда
 * - Редкие (tier 2): становятся доступны для покупки после прохождения этапа 1-5
 * - Легендарные (tier 3): становятся доступны для покупки после прохождения этапа 2-5
 */
export function isModuleAvailableForPurchase(
  mod?: ShipModule | null,
  completedMissions: string[] = [],
  currentSector: number = 1,
): boolean {
  if (!mod || mod.tier <= 0) return true;
  if (mod.tier === 2) {
    return completedMissions.includes('1-5') || currentSector >= 2;
  }
  if (mod.tier === 3) {
    return completedMissions.includes('2-5') || currentSector >= 3;
  }
  return false;
}

export function getMissionRewardTier(missionId: string): number {
  if (missionId === '1-1' || missionId === '1-3') return 1;
  if (missionId === '2-1' || missionId === '2-3') return 2;
  if (missionId === '3-1' || missionId === '3-3') return 3;
  return 1;
}

export function getModuleRarity(mod?: ShipModule | null): ModuleRarityConfig {
  if (mod && mod.rarity) {
    return MODULE_RARITIES[mod.rarity];
  }
  if (!mod || mod.tier <= 1) {
    return MODULE_RARITIES.common;
  }
  if (mod.tier === 2) {
    return MODULE_RARITIES.rare;
  }
  return MODULE_RARITIES.legendary;
}

export function getModuleStatsLines(mod?: ShipModule | null, category?: string): string[] {
  if (mod && mod.statsLines && mod.statsLines.length > 0) {
    return mod.statsLines;
  }
  switch (category) {
    case 'guns':
      return ['+15% урона', '+15% скорострельности'];
    case 'body':
      return ['+15% здоровья', '+5% брони'];
    case 'engines':
      return ['+15% скорости', '-15% отката рывка'];
    case 'wings':
      return ['+15% поворота', '+10% скорости'];
    case 'pilot':
      return ['+15% овердрайва', '+10% урона'];
    default:
      return ['+10% мощности'];
  }
}

export function getModuleAdvantageText(mod?: ShipModule | null, category?: string): string {
  const lines = getModuleStatsLines(mod, category);
  return lines.join(' / ');
}

/**
 * Строгий расчет боевых характеристик корабля исключительно по фактически установленным модулям.
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
        // Крылья устанавливаются симметрично парами: каждое крыло дает половину бонуса пары (аддитивно)
        turnSpeedMultiplier += ((st.turnSpeedMultiplier || 1.0) - 1.0) * 0.5;
        turnSpeedBonus += (st.maneuverabilityBonus || 0) * 0.5;
      } else if (mod.category === 'pilot') {
        superDurationBonus += st.superDurationBonus || 0;
        superCooldownMultiplier *= st.superCooldownMultiplier || 1.0;
        bulletDamageBonus += st.pilotBonusDamage || 0;
      }
    }
  });

  // Ограничиваем максимальную броню 45% во избежание бессмертия
  const finalDamageReduction = Math.min(0.45, Math.max(0, damageReduction));
  const finalTurnSpeedMultiplier = Math.min(2.5, Math.max(0.5, turnSpeedMultiplier));
  const finalTurnSpeedBonus = Math.min(50, Math.max(0, turnSpeedBonus));

  return {
    maxHp: PLAYER_MAX_HP + maxHpBonus,
    damageReduction: finalDamageReduction,
    speedMultiplier,
    dashCooldownMultiplier,
    dashSpeedMultiplier,
    turnSpeedMultiplier: finalTurnSpeedMultiplier,
    turnSpeedBonus: finalTurnSpeedBonus,
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

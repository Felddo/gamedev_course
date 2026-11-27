import { BLASTER_DAMAGE } from '../constants';

export type MissileRarity = 'common' | 'rare' | 'legendary';
export type MissileColorFolder = 'blue' | 'green' | 'red';
export type MissileTypeCode =
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

export interface MissileRarityInfo {
  rarity: MissileRarity;
  colorFolder: MissileColorFolder;
  label: string;
  damage: number;
  spawnWeight: number;
  borderColor: string;
  glowColor: string;
  badgeBg: string;
  textColor: string;
  pricesBySector: Record<1 | 2 | 3, number>; // Цена по фазам (секторам) 1 -> 2 -> 3
}

export const MISSILE_RARITY_CONFIG: Record<MissileRarity, MissileRarityInfo> = {
  common: {
    rarity: 'common',
    colorFolder: 'blue',
    label: 'ОБЫЧНАЯ',
    damage: BLASTER_DAMAGE, // 1.5
    spawnWeight: 65,
    borderColor: '#94a3b8',
    glowColor: 'rgba(148, 163, 184, 0.35)',
    badgeBg: 'rgba(148, 163, 184, 0.16)',
    textColor: '#cbd5e1',
    pricesBySector: { 1: 15, 2: 55, 3: 100 },
  },
  rare: {
    rarity: 'rare',
    colorFolder: 'green',
    label: 'РЕДКАЯ',
    damage: 2.3,
    spawnWeight: 27,
    borderColor: '#facc15',
    glowColor: 'rgba(250, 204, 21, 0.4)',
    badgeBg: 'rgba(250, 204, 21, 0.18)',
    textColor: '#fde047',
    pricesBySector: { 1: 30, 2: 110, 3: 200 },
  },
  legendary: {
    rarity: 'legendary',
    colorFolder: 'red',
    label: 'ЛЕГЕНДАРНАЯ',
    damage: 3.3,
    spawnWeight: 8,
    borderColor: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.48)',
    badgeBg: 'rgba(239, 68, 68, 0.18)',
    textColor: '#fca5a5',
    pricesBySector: { 1: 55, 2: 200, 3: 350 },
  },
};

export interface MissileTypeDefinition {
  code: MissileTypeCode;
  name: string;
  description: string;
}

export const MISSILE_TYPE_DEFS: Record<MissileTypeCode, MissileTypeDefinition> = {
  '001': {
    code: '001',
    name: 'Энергетическая Ракета',
    description: 'Оставляет энергетический след на 0.5 сек. Коснувшиеся его враги получают небольшой урон.',
  },
  '002': {
    code: '002',
    name: 'Ракета-замедлитель',
    description: 'При попадании ненадолго замедляет врага. Эффект обновляется, но не складывается.',
  },
  '003': {
    code: '003',
    name: 'Веерная ракета',
    description: 'При столкновении разлетается веером, выпуская несколько небольших снарядов под разными углами.',
  },
  '004': {
    code: '004',
    name: 'Ракета-рикошет',
    description: 'После попадания отскакивает от врага и направляется к ближайшей цели (1 отскок).',
  },
  '005': {
    code: '005',
    name: 'Ракета-взрыватель',
    description: 'Наносит основной урон и сразу создаёт дополнительный небольшой взрыв вокруг точки попадания.',
  },
  '006': {
    code: '006',
    name: 'Импульсная ракета',
    description: 'При попадании создаёт небольшую ударную волну, слегка отталкивающую ближайших врагов.',
  },
  '007': {
    code: '007',
    name: 'Гравитационная ракета',
    description: 'При попадании создаёт область притяжения, стягивающую ближайших врагов к центру.',
  },
  '008': {
    code: '008',
    name: 'Ракета треугольник',
    description: 'При столкновении выпускает три снаряда в разные стороны под углом 120° друг к другу.',
  },
  '009': {
    code: '009',
    name: 'Ракета-перехватчик',
    description: 'При попадании уничтожает один небольшой вражеский снаряд поблизости.',
  },
  '010': {
    code: '010',
    name: 'Обычная ракета',
    description: 'Просто летит и наносит урон при попадании. Без дополнительных механик.',
  },
};

export const ALL_MISSILE_CODES: MissileTypeCode[] = [
  '001',
  '002',
  '003',
  '004',
  '005',
  '006',
  '007',
  '008',
  '009',
  '010',
];

const missileGlob = import.meta.glob<string>(
  '../../assets/Sprites/Missiles/{blue,green,red}/*.png',
  { eager: true, import: 'default' },
);

const spriteUrlByColorAndCode = new Map<string, string>();
export const ALL_MISSILE_TEXTURE_ASSETS: Array<{ key: string; url: string }> = [];

for (const [path, url] of Object.entries(missileGlob)) {
  const match = path.match(/Missiles\/(blue|green|red)\/spaceMissiles_(\d{3})\.png$/);
  if (match) {
    const color = match[1] as MissileColorFolder;
    const code = match[2] as MissileTypeCode;
    const key = `missile_${color}_${code}`;
    spriteUrlByColorAndCode.set(`${color}_${code}`, url);
    ALL_MISSILE_TEXTURE_ASSETS.push({ key, url });
  }
}

export interface ShopMissileOffer {
  id: string; // e.g. 'common_001', 'rare_004', 'legendary_007'
  rarity: MissileRarity;
  colorFolder: MissileColorFolder;
  typeCode: MissileTypeCode;
  name: string;
  description: string;
  damage: number;
  price: number;
  textureKey: string;
  spriteUrl: string;
}

export const DEFAULT_MISSILE_ID = 'common_010';

export function getMissilePriceForSector(rarity: MissileRarity, sector = 1): number {
  const clamped = Math.max(1, Math.min(3, Math.round(sector))) as 1 | 2 | 3;
  return MISSILE_RARITY_CONFIG[rarity].pricesBySector[clamped];
}

export function buildMissileSpec(
  rarity: MissileRarity,
  typeCode: MissileTypeCode,
  sector = 1,
): ShopMissileOffer {
  const rarityInfo = MISSILE_RARITY_CONFIG[rarity];
  const typeDef = MISSILE_TYPE_DEFS[typeCode];
  const textureKey = `missile_${rarityInfo.colorFolder}_${typeCode}`;
  const spriteUrl = spriteUrlByColorAndCode.get(`${rarityInfo.colorFolder}_${typeCode}`) || '';

  return {
    id: `${rarity}_${typeCode}`,
    rarity,
    colorFolder: rarityInfo.colorFolder,
    typeCode,
    name: typeDef.name,
    description: typeDef.description,
    damage: rarityInfo.damage,
    price: getMissilePriceForSector(rarity, sector),
    textureKey,
    spriteUrl,
  };
}

export function parseMissileId(missileId?: string | null): ShopMissileOffer | null {
  if (!missileId) return null;
  const parts = missileId.split('_');
  if (parts.length !== 2) return null;
  const rarity = parts[0] as MissileRarity;
  const code = parts[1] as MissileTypeCode;
  if (!MISSILE_RARITY_CONFIG[rarity] || !MISSILE_TYPE_DEFS[code]) {
    return null;
  }
  return buildMissileSpec(rarity, code, 1);
}

export function getRarityForSector(sector = 1): MissileRarity {
  const clamped = resolveSectorNumber(sector);
  if (clamped === 1) return 'common';
  if (clamped === 2) return 'rare';
  return 'legendary';
}

function resolveSectorNumber(sectorOrMissionId?: number | string | null): number {
  if (typeof sectorOrMissionId === 'number' && Number.isFinite(sectorOrMissionId)) {
    return Math.max(1, Math.min(3, Math.round(sectorOrMissionId)));
  }
  if (typeof sectorOrMissionId === 'string') {
    const parsed = parseInt(sectorOrMissionId.split('-')[0], 10);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.min(3, parsed));
    }
  }
  return 1;
}

/**
 * Случайная генерация 3 уникальных ракет для магазина с градацией редкости по фазам:
 * - Фаза (сектор) 1 — только обычные ракеты
 * - Фаза (сектор) 2 — только редкие ракеты
 * - Фаза (сектор) 3 — только легендарные ракеты
 */
export function rollShopMissileOffers(
  sectorOrMissionId?: number | string | null,
  count = 3,
): ShopMissileOffer[] {
  const sector = resolveSectorNumber(sectorOrMissionId);
  const rarity = getRarityForSector(sector);
  const shuffledCodes = [...ALL_MISSILE_CODES];

  for (let i = shuffledCodes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledCodes[i], shuffledCodes[j]] = [shuffledCodes[j], shuffledCodes[i]];
  }

  return shuffledCodes
    .slice(0, Math.min(count, shuffledCodes.length))
    .map((code) => buildMissileSpec(rarity, code, sector));
}

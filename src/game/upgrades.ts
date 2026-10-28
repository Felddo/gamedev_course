/**
 * Пул тактических улучшений боевого космического корабля.
 * Улучшения разделены на бортовое вооружение (turret/weapons) и двигательные системы (tracks/thrusters).
 */

export type UpgradeTarget = 'turret' | 'tracks';

export interface ShipUpgrade {
  id: string;
  target: UpgradeTarget;
  title: string;
  shortDesc: string;
  description: string;
  badgeText: string;
  accentColor: string;
  secondaryColor: string;
  iconSvg: string;
}

// Алиас для обратной совместимости
export type TankUpgrade = ShipUpgrade;

export const UPGRADE_POOL: ShipUpgrade[] = [
  // --- УЛУЧШЕНИЯ ДВИГАТЕЛЬНЫХ СИСТЕМ ---
  {
    id: 'tracks_fire_trail',
    target: 'tracks',
    title: 'Плазменный шлейф',
    shortDesc: 'След раскаленной плазмы',
    description: 'Маршевые сопла оставляют за кораблем высокотемпературный плазменный след. Вражеские корабли, попавшие в шлейф, получают непрерывный урон.',
    badgeText: 'ДВИГАТЕЛИ',
    accentColor: '#f97316',
    secondaryColor: '#ea580c',
    iconSvg: `
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="8" width="10" height="32" rx="3" stroke="#f97316" stroke-width="2.5" fill="#2e1005"/>
        <line x1="6" y1="16" x2="16" y2="16" stroke="#fb923c" stroke-width="2"/>
        <line x1="6" y1="24" x2="16" y2="24" stroke="#fb923c" stroke-width="2"/>
        <line x1="6" y1="32" x2="16" y2="32" stroke="#fb923c" stroke-width="2"/>
        
        <rect x="32" y="8" width="10" height="32" rx="3" stroke="#f97316" stroke-width="2.5" fill="#2e1005"/>
        <line x1="32" y1="16" x2="42" y2="16" stroke="#fb923c" stroke-width="2"/>
        <line x1="32" y1="24" x2="42" y2="24" stroke="#fb923c" stroke-width="2"/>
        <line x1="32" y1="32" x2="42" y2="32" stroke="#fb923c" stroke-width="2"/>

        <path d="M24 10 C20 18 16 26 19 36 C21 42 27 42 29 36 C32 26 28 18 24 10 Z" fill="#ef4444" opacity="0.9"/>
        <path d="M24 18 C22 23 19 28 21 34 C22 38 26 38 27 34 C29 28 26 23 24 18 Z" fill="#f59e0b"/>
        <path d="M24 25 C23 28 22 30 23 33 C23.5 35 24.5 35 25 33 C26 30 25 28 24 25 Z" fill="#fef08a"/>
      </svg>
    `,
  },
  {
    id: 'tracks_turbo',
    target: 'tracks',
    title: 'Ионный форсаж',
    shortDesc: '+35% к скорости, быстрее форсаж',
    description: 'Облегченный титановый корпус и ионные ускорители. Увеличивают скорость движения на +35% и ускоряют перезарядку форсажа на 25%.',
    badgeText: 'ДВИГАТЕЛИ',
    accentColor: '#10b981',
    secondaryColor: '#059669',
    iconSvg: `
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="18" stroke="#10b981" stroke-width="2.5" stroke-dasharray="4 3"/>
        <path d="M14 28 L24 14 L23 23 L32 23 L22 36 L23 28 Z" fill="#34d399" stroke="#059669" stroke-width="1.5" stroke-linejoin="round"/>
        <line x1="8" y1="24" x2="12" y2="24" stroke="#34d399" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="36" y1="24" x2="40" y2="24" stroke="#34d399" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `,
  },
  {
    id: 'tracks_ram_spikes',
    target: 'tracks',
    title: 'Кинетический таран',
    shortDesc: 'Сокрушение врагов носовым щитом',
    description: 'Усиленный силовой щит носовой части. Во время форсажа корабль мгновенно разрушает легкие вражеские дроны и наносит тяжелый урон крейсерам.',
    badgeText: 'ДВИГАТЕЛИ',
    accentColor: '#eab308',
    secondaryColor: '#ca8a04',
    iconSvg: `
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 20 L24 6 L40 20 L36 38 L12 38 Z" stroke="#eab308" stroke-width="2.5" fill="#2a1f05"/>
        <path d="M24 10 L24 24" stroke="#fde047" stroke-width="2.5" stroke-linecap="round"/>
        <polygon points="6,26 12,28 8,34" fill="#fde047"/>
        <polygon points="42,26 36,28 40,34" fill="#fde047"/>
        <polygon points="24,2 20,8 28,8" fill="#fde047"/>
        <polygon points="14,12 11,18 18,17" fill="#fde047"/>
        <polygon points="34,12 37,18 30,17" fill="#fde047"/>
      </svg>
    `,
  },
  {
    id: 'tracks_emp_drift',
    target: 'tracks',
    title: 'ЭМИ-поле перегрузки',
    shortDesc: 'ЭМИ-разряды замедляют врагов',
    description: 'При маневрировании двигатели генерируют импульсное электромагнитное поле, замедляя ближайшие корабли противника на 45%.',
    badgeText: 'ДВИГАТЕЛИ',
    accentColor: '#38bdf8',
    secondaryColor: '#0284c7',
    iconSvg: `
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 24 C16 14 32 14 36 24 C32 34 16 34 12 24 Z" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3 3"/>
        <path d="M26 8 L18 24 L24 24 L20 38 L32 20 L25 20 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5" stroke-linejoin="round"/>
        <circle cx="10" cy="24" r="3" fill="#7dd3fc"/>
        <circle cx="38" cy="24" r="3" fill="#7dd3fc"/>
      </svg>
    `,
  },

  // --- УЛУЧШЕНИЯ БОРТОВОГО ВООРУЖЕНИЯ ---
  {
    id: 'turret_explosive_shells',
    target: 'turret',
    title: 'Фотонные торпеды',
    shortDesc: 'Взрывной урон по площади',
    description: 'Снаряды детонируют при попадании во врага, вызывая мощный плазменный взрыв и нанося урон всем окружающим кораблям в радиусе 110px.',
    badgeText: 'ВООРУЖЕНИЕ',
    accentColor: '#f43f5e',
    secondaryColor: '#e11d48',
    iconSvg: `
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="21" y="16" width="6" height="16" rx="2" fill="#fb7185" stroke="#f43f5e" stroke-width="1.5"/>
        <path d="M21 16 Q24 10 27 16 Z" fill="#fda4af"/>
        <line x1="24" y1="4" x2="24" y2="9" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="24" y1="39" x2="24" y2="44" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="4" y1="24" x2="9" y2="24" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="39" y1="24" x2="44" y2="24" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="10" y1="10" x2="14" y2="14" stroke="#fb7185" stroke-width="2" stroke-linecap="round"/>
        <line x1="34" y1="34" x2="38" y2="38" stroke="#fb7185" stroke-width="2" stroke-linecap="round"/>
        <line x1="34" y1="14" x2="38" y2="10" stroke="#fb7185" stroke-width="2" stroke-linecap="round"/>
        <line x1="10" y1="38" x2="14" y2="34" stroke="#fb7185" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `,
  },
  {
    id: 'turret_twin_cannon',
    target: 'turret',
    title: 'Сдвоенные орудия',
    shortDesc: 'Двойной параллельный залп',
    description: 'На нос корабля устанавливаются спаренные импульсные орудия: каждый выстрел выпускает два параллельных заряда одновременно.',
    badgeText: 'ВООРУЖЕНИЕ',
    accentColor: '#a855f7',
    secondaryColor: '#9333ea',
    iconSvg: `
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="30" r="12" fill="#221235" stroke="#a855f7" stroke-width="2"/>
        <circle cx="24" cy="30" r="5" fill="#c084fc"/>
        <rect x="18" y="6" width="3.5" height="18" rx="1.5" fill="#c084fc" stroke="#a855f7" stroke-width="1.2"/>
        <rect x="16.5" y="4" width="6.5" height="4" rx="1" fill="#e9d5ff"/>
        <rect x="26.5" y="6" width="3.5" height="18" rx="1.5" fill="#c084fc" stroke="#a855f7" stroke-width="1.2"/>
        <rect x="25" y="4" width="6.5" height="4" rx="1" fill="#e9d5ff"/>
      </svg>
    `,
  },
  {
    id: 'turret_rapid_plasma',
    target: 'turret',
    title: 'Плазменный ускоритель',
    shortDesc: '+45% скорострельности, плазменный луч',
    description: 'Катушки индукционного ускорения. Темп стрельбы носовых орудий возрастает на +45%, скорость снарядов на +25%, снаряды заряжаются плазмой.',
    badgeText: 'ВООРУЖЕНИЕ',
    accentColor: '#06b6d4',
    secondaryColor: '#0891b2',
    iconSvg: `
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="16" stroke="#06b6d4" stroke-width="2" stroke-dasharray="5 3"/>
        <circle cx="24" cy="24" r="8" fill="#164e63" stroke="#22d3ee" stroke-width="2"/>
        <circle cx="24" cy="24" r="3.5" fill="#a5f3fc"/>
        <line x1="24" y1="2" x2="24" y2="12" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="24" y1="36" x2="24" y2="46" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="2" y1="24" x2="12" y2="24" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="36" y1="24" x2="46" y2="24" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `,
  },
  {
    id: 'turret_piercing_slugs',
    target: 'turret',
    title: 'Кинетический сердечник',
    shortDesc: 'Сквозное пробитие строя врагов',
    description: 'Тяжелые бронебойные сердечники пробивают обшивку насквозь, поражая до 2 вражеских кораблей подряд по траектории выстрела.',
    badgeText: 'ВООРУЖЕНИЕ',
    accentColor: '#ec4899',
    secondaryColor: '#db2777',
    iconSvg: `
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="8" y1="40" x2="40" y2="8" stroke="#ec4899" stroke-width="3" stroke-linecap="round"/>
        <polygon points="40,8 30,12 36,18" fill="#f472b6"/>
        <line x1="14" y1="28" x2="26" y2="40" stroke="#f472b6" stroke-width="2" stroke-dasharray="2 2"/>
        <line x1="22" y1="20" x2="34" y2="32" stroke="#f472b6" stroke-width="2" stroke-dasharray="2 2"/>
      </svg>
    `,
  },
];

/**
 * Выбрать n случайных уникальных улучшений из пула (исключая уже установленные)
 */
export function getRandomUpgrades(count = 3, appliedIds: Set<string> = new Set()): ShipUpgrade[] {
  let available = UPGRADE_POOL.filter((u) => !appliedIds.has(u.id));

  if (available.length < count) {
    available = [...UPGRADE_POOL];
  }

  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const result: ShipUpgrade[] = [];
  const thrusters = shuffled.filter((u) => u.target === 'tracks');
  const weapons = shuffled.filter((u) => u.target === 'turret');

  if (thrusters.length > 0 && weapons.length > 0) {
    result.push(thrusters[0]);
    result.push(weapons[0]);
    for (const item of shuffled) {
      if (result.length >= count) break;
      if (!result.some((r) => r.id === item.id)) {
        result.push(item);
      }
    }
  } else {
    result.push(...shuffled.slice(0, count));
  }

  return result.slice(0, count);
}

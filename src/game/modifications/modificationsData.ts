/**
 * Система модификаций корабля (Ship Modifications System).
 * Централизованный каталог 10 модификаций по мотивам Soul Knight.
 */

export type ModificationCategory = 'utility' | 'weapon' | 'resources' | 'defense' | 'mobility';

export interface ShipModification {
  id: string;
  name: string;
  category: ModificationCategory;
  categoryLabel: string;
  bonusValue: string;
  shortDesc: string;
  description?: string;
  accentColor: string;
  secondaryColor: string;
  badgeBg: string;
  iconSvg: string;
}

export const SHIP_MODIFICATIONS: ShipModification[] = [
  // 1. Улучшенная система наведения
  {
    id: 'enhanced_targeting',
    name: 'Улучшенная система наведения',
    category: 'utility',
    categoryLabel: 'ПОЛЕЗНОСТЬ',
    bonusValue: '+25% ДАЛЬНОСТЬ НАВЕДЕНИЯ',
    shortDesc: 'Увеличивает радиус обнаружения и автонаведения на врагов на 25%',
    accentColor: '#06b6d4',
    secondaryColor: '#0891b2',
    badgeBg: 'rgba(6, 182, 212, 0.16)',
    iconSvg: `
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="28" stroke="#06b6d4" stroke-width="1.8" stroke-dasharray="6 4" opacity="0.6"/>
        <circle cx="32" cy="32" r="20" stroke="#22d3ee" stroke-width="2"/>
        <circle cx="32" cy="32" r="10" stroke="#67e8f9" stroke-width="1.5" stroke-dasharray="3 3"/>
        <circle cx="32" cy="32" r="3.5" fill="#a5f3fc"/>
        <!-- Прицельные риски -->
        <line x1="32" y1="4" x2="32" y2="15" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="32" y1="49" x2="32" y2="60" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="4" y1="32" x2="15" y2="32" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="49" y1="32" x2="60" y2="32" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Тактические угловые метки -->
        <path d="M18 24 L18 18 L24 18" stroke="#a5f3fc" stroke-width="2" stroke-linecap="round"/>
        <path d="M46 24 L46 18 L40 18" stroke="#a5f3fc" stroke-width="2" stroke-linecap="round"/>
        <path d="M18 40 L18 46 L24 46" stroke="#a5f3fc" stroke-width="2" stroke-linecap="round"/>
        <path d="M46 40 L46 46 L40 46" stroke="#a5f3fc" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `,
  },

  // 2. Магнитный сборщик
  {
    id: 'magnetic_collector',
    name: 'Магнитный сборщик',
    category: 'utility',
    categoryLabel: 'ПОЛЕЗНОСТЬ',
    bonusValue: '+60% РАДИУС СБОРА',
    shortDesc: 'Притягивает металлолом к кораблю с увеличенной на 60% дистанции',
    accentColor: '#38bdf8',
    secondaryColor: '#0284c7',
    badgeBg: 'rgba(56, 189, 248, 0.16)',
    iconSvg: `
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Подкова магнита -->
        <path d="M18 14 L18 34 C18 41.7 24.3 48 32 48 C39.7 48 46 34 46 34 L46 14" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
        <!-- Полюса магнита -->
        <rect x="15" y="10" width="6" height="8" rx="1.5" fill="#f43f5e"/>
        <rect x="43" y="10" width="6" height="8" rx="1.5" fill="#0284c7"/>
        <!-- Силовые линии поля -->
        <path d="M21 24 C24 20 28 18 32 18 C36 18 40 20 43 24" stroke="#7dd3fc" stroke-width="1.8" stroke-dasharray="3 2" fill="none"/>
        <path d="M19 32 C23 27 27 25 32 25 C37 25 41 27 45 32" stroke="#bae6fd" stroke-width="1.8" stroke-dasharray="3 2" fill="none"/>
        <!-- Металлоломные осколки, летящие к магниту -->
        <polygon points="32,54 35,51 32,48 29,51" fill="#facc15"/>
        <polygon points="22,58 24,56 22,54 20,56" fill="#facc15" opacity="0.8"/>
        <polygon points="42,57 44,55 42,53 40,55" fill="#facc15" opacity="0.8"/>
        <line x1="32" y1="58" x2="32" y2="52" stroke="#fef08a" stroke-width="1.5" stroke-dasharray="2 2"/>
      </svg>
    `,
  },

  // 3. Ускоренный конденсатор
  {
    id: 'overclocked_capacitor',
    name: 'Ускоренный конденсатор',
    category: 'weapon',
    categoryLabel: 'ОРУЖИЕ',
    bonusValue: '+35% СКОРОСТРЕЛЬНОСТЬ',
    shortDesc: 'Увеличивает темп стрельбы всех установленных пушек на 35%',
    accentColor: '#f59e0b',
    secondaryColor: '#d97706',
    badgeBg: 'rgba(245, 158, 11, 0.16)',
    iconSvg: `
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Внешний реакторный контур -->
        <rect x="14" y="16" width="36" height="32" rx="6" stroke="#f59e0b" stroke-width="2.5" fill="#261704"/>
        <rect x="22" y="10" width="8" height="6" rx="2" fill="#d97706"/>
        <rect x="34" y="10" width="8" height="6" rx="2" fill="#d97706"/>
        <!-- Энергетические ячейки конденсатора -->
        <rect x="20" y="24" width="6" height="16" rx="2" fill="#fde047" opacity="0.9"/>
        <rect x="29" y="24" width="6" height="16" rx="2" fill="#fde047" opacity="0.9"/>
        <rect x="38" y="24" width="6" height="16" rx="2" fill="#fde047" opacity="0.9"/>
        <!-- Импульсная молния ускорения -->
        <path d="M34 16 L27 33 L33 33 L29 48 L40 31 L33 31 Z" fill="#ffffff" stroke="#f59e0b" stroke-width="1.2" stroke-linejoin="round"/>
        <!-- Индикатор перегрузки -->
        <circle cx="32" cy="54" r="2.5" fill="#10b981"/>
      </svg>
    `,
  },

  // 4. Усиленные стволы
  {
    id: 'reinforced_barrels',
    name: 'Усиленные стволы',
    category: 'weapon',
    categoryLabel: 'ОРУЖИЕ',
    bonusValue: '+20% УРОН / -10% ТЕМП',
    shortDesc: 'Увеличивает урон пушек на 20%, но снижает скорострельность на 10%',
    accentColor: '#ef4444',
    secondaryColor: '#b91c1c',
    badgeBg: 'rgba(239, 68, 68, 0.16)',
    iconSvg: `
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Базовый лафет орудия -->
        <rect x="18" y="38" width="28" height="18" rx="4" fill="#2d0d0d" stroke="#ef4444" stroke-width="2"/>
        <circle cx="32" cy="47" r="5" fill="#7f1d1d" stroke="#f87171" stroke-width="1.5"/>
        <!-- Сдвоенные тяжелые усиленные стволы -->
        <rect x="23" y="10" width="7" height="28" rx="2" fill="#450a0a" stroke="#ef4444" stroke-width="2"/>
        <rect x="34" y="10" width="7" height="28" rx="2" fill="#450a0a" stroke="#ef4444" stroke-width="2"/>
        <!-- Надульные компенсаторы / утолщения -->
        <rect x="21" y="8" width="11" height="6" rx="1.5" fill="#f87171" stroke="#ef4444" stroke-width="1"/>
        <rect x="32" y="8" width="11" height="6" rx="1.5" fill="#f87171" stroke="#ef4444" stroke-width="1"/>
        <!-- Ребра радиаторов охлаждения -->
        <line x1="22" y1="20" x2="31" y2="20" stroke="#fca5a5" stroke-width="1.5"/>
        <line x1="22" y1="26" x2="31" y2="26" stroke="#fca5a5" stroke-width="1.5"/>
        <line x1="33" y1="20" x2="42" y2="20" stroke="#fca5a5" stroke-width="1.5"/>
        <line x1="33" y1="26" x2="42" y2="26" stroke="#fca5a5" stroke-width="1.5"/>
      </svg>
    `,
  },

  // 5. Плазменные боеприпасы
  {
    id: 'plasma_munitions',
    name: 'Плазменные боеприпасы',
    category: 'weapon',
    categoryLabel: 'ОРУЖИЕ',
    bonusValue: 'ВЗРЫВ ПРИ ПОПАДАНИИ',
    shortDesc: 'Снаряды создают взрыв при попадании, нанося урон врагам поблизости',
    accentColor: '#f43f5e',
    secondaryColor: '#e11d48',
    badgeBg: 'rgba(244, 63, 94, 0.16)',
    iconSvg: `
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Центральное плазменное ядро -->
        <circle cx="32" cy="32" r="9" fill="#f43f5e"/>
        <circle cx="32" cy="32" r="5" fill="#fecdd3"/>
        <!-- Радиальная ударная волна -->
        <circle cx="32" cy="32" r="22" stroke="#f43f5e" stroke-width="1.8" stroke-dasharray="4 3" opacity="0.8"/>
        <!-- Осколочные плазменные лучи детонации -->
        <path d="M32 8 L32 18" stroke="#fb7185" stroke-width="3" stroke-linecap="round"/>
        <path d="M32 46 L32 56" stroke="#fb7185" stroke-width="3" stroke-linecap="round"/>
        <path d="M8 32 L18 32" stroke="#fb7185" stroke-width="3" stroke-linecap="round"/>
        <path d="M46 32 L56 32" stroke="#fb7185" stroke-width="3" stroke-linecap="round"/>
        <path d="M15 15 L22 22" stroke="#fda4af" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M42 42 L49 49" stroke="#fda4af" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M49 15 L42 22" stroke="#fda4af" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M15 49 L22 42" stroke="#fda4af" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `,
  },

  // 6. Электромагнитный разряд
  {
    id: 'emp_discharge',
    name: 'Электромагнитный разряд',
    category: 'weapon',
    categoryLabel: 'ОРУЖИЕ',
    bonusValue: '35% ШАНС ЭЛЕКТРОДУГИ',
    shortDesc: 'Каждый выстрел имеет 35% шанс поразить электрической дугой соседнего врага',
    accentColor: '#38bdf8',
    secondaryColor: '#0284c7',
    badgeBg: 'rgba(56, 189, 248, 0.16)',
    iconSvg: `
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Цель 1 (источник) -->
        <circle cx="16" cy="32" r="7" fill="#0c4a6e" stroke="#38bdf8" stroke-width="2"/>
        <circle cx="16" cy="32" r="3" fill="#7dd3fc"/>
        <!-- Цель 2 (приемник дуги) -->
        <circle cx="48" cy="22" r="7" fill="#0c4a6e" stroke="#38bdf8" stroke-width="2"/>
        <circle cx="48" cy="22" r="3" fill="#7dd3fc"/>
        <!-- Ветвящаяся электрическая дуга между целями -->
        <path d="M22 30 L28 24 L32 34 L38 22 L42 26" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M22 30 L28 24 L32 34 L38 22 L42 26" stroke="#38bdf8" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
        <!-- Искры и вспомогательные ветви -->
        <path d="M30 28 L34 38 L38 35" stroke="#bae6fd" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="28" cy="24" r="1.5" fill="#ffffff"/>
        <circle cx="38" cy="22" r="1.5" fill="#ffffff"/>
        <!-- Ионизированный ореол -->
        <circle cx="32" cy="28" r="22" stroke="#0ea5e9" stroke-width="1" stroke-dasharray="3 3" opacity="0.4"/>
      </svg>
    `,
  },

  // 7. Переработчик обломков
  {
    id: 'scrap_recycler',
    name: 'Переработчик обломков',
    category: 'resources',
    categoryLabel: 'РЕСУРСЫ',
    bonusValue: '+20% МЕТАЛЛОЛОМА',
    shortDesc: 'Увеличивает количество металлолома, выпадающего из врагов, на 20%',
    accentColor: '#eab308',
    secondaryColor: '#ca8a04',
    badgeBg: 'rgba(234, 179, 8, 0.16)',
    iconSvg: `
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Шестереночный ресайклинг-контур -->
        <path d="M32 10 A22 22 0 0 1 54 32" stroke="#eab308" stroke-width="3" stroke-linecap="round"/>
        <polygon points="54,26 58,34 50,34" fill="#facc15"/>
        <path d="M54 32 A22 22 0 0 1 32 54" stroke="#eab308" stroke-width="3" stroke-linecap="round"/>
        <polygon points="38,54 30,58 30,50" fill="#facc15"/>
        <path d="M32 54 A22 22 0 0 1 10 32" stroke="#eab308" stroke-width="3" stroke-linecap="round"/>
        <polygon points="10,38 6,30 14,30" fill="#facc15"/>
        <path d="M10 32 A22 22 0 0 1 32 10" stroke="#eab308" stroke-width="3" stroke-linecap="round"/>
        <polygon points="26,10 34,6 34,14" fill="#facc15"/>
        <!-- Слиток металлолома в центре -->
        <polygon points="32,22 43,28 32,34 21,28" fill="#fde047" stroke="#ca8a04" stroke-width="1.2"/>
        <polygon points="21,28 32,34 32,42 21,36" fill="#eab308" stroke="#ca8a04" stroke-width="1.2"/>
        <polygon points="43,28 32,34 32,42 43,36" fill="#ca8a04" stroke="#a16207" stroke-width="1.2"/>
      </svg>
    `,
  },

  // 8. Усиленная броня
  {
    id: 'reinforced_armor',
    name: 'Усиленная броня',
    category: 'defense',
    categoryLabel: 'ЗАЩИТА',
    bonusValue: '-35% ВХОДЯЩИЙ УРОН',
    shortDesc: 'Уменьшает весь получаемый кораблём урон на 35%',
    accentColor: '#10b981',
    secondaryColor: '#059669',
    badgeBg: 'rgba(168, 85, 247, 0.16)',
    iconSvg: `
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Силовой бронещит -->
        <path d="M32 8 L50 16 L50 34 C50 44 42 53 32 58 C22 53 14 44 14 34 L14 16 Z" fill="#042219" stroke="#10b981" stroke-width="2.5"/>
        <!-- Внутренний броневой каркас -->
        <path d="M32 14 L44 20 L44 33 C44 41 38 48 32 52 C26 48 20 41 20 33 L20 20 Z" stroke="#34d399" stroke-width="1.8" stroke-dasharray="3 3"/>
        <!-- Центральная эмблема стойкости -->
        <polygon points="32,24 38,32 32,40 26,32" fill="#6ee7b7"/>
        <line x1="32" y1="14" x2="32" y2="52" stroke="#34d399" stroke-width="1.5"/>
        <line x1="20" y1="32" x2="44" y2="32" stroke="#34d399" stroke-width="1.5"/>
      </svg>
    `,
  },

  // 9. Форсажные двигатели
  {
    id: 'afterburner_thrusters',
    name: 'Форсажные двигатели',
    category: 'mobility',
    categoryLabel: 'МОБИЛЬНОСТЬ',
    bonusValue: '+35% СКОРОСТЬ ХОДА',
    shortDesc: 'Увеличивает скорость передвижения корабля на 35%',
    accentColor: '#0ea5e9',
    secondaryColor: '#0284c7',
    badgeBg: 'rgba(14, 165, 233, 0.16)',
    iconSvg: `
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Сопло маршевого двигателя -->
        <path d="M22 16 L42 16 L38 36 L26 36 Z" fill="#0c4a6e" stroke="#0ea5e9" stroke-width="2.5"/>
        <rect x="20" y="12" width="24" height="6" rx="2" fill="#0284c7"/>
        <!-- Пламя форсажной струи -->
        <path d="M26 36 C24 44 28 54 32 60 C36 54 40 44 38 36 Z" fill="#38bdf8" opacity="0.95"/>
        <path d="M28 36 C27 42 30 48 32 52 C34 48 37 42 36 36 Z" fill="#fef08a"/>
        <!-- Скоростные стрелы / вектор тяги -->
        <path d="M12 28 L18 34 L12 40" stroke="#7dd3fc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M52 28 L46 34 L52 40" stroke="#7dd3fc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="8" y1="34" x2="16" y2="34" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round"/>
        <line x1="56" y1="34" x2="48" y2="34" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `,
  },

  // 10. Протокол уничтожения
  {
    id: 'annihilation_protocol',
    name: 'Протокол уничтожения',
    category: 'weapon',
    categoryLabel: 'ОРУЖИЕ',
    bonusValue: '+30% УРОН ПО БОССАМ',
    shortDesc: 'Увеличивает наносимый урон по боссам на 30%',
    accentColor: '#a855f7',
    secondaryColor: '#7e22ce',
    badgeBg: 'rgba(168, 85, 247, 0.16)',
    iconSvg: `
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Силуэт вражеского флагмана/босса -->
        <path d="M14 22 L32 12 L50 22 L44 38 L32 46 L20 38 Z" fill="#2e1065" stroke="#a855f7" stroke-width="2"/>
        <!-- Прицельный череп/крест ликвидации -->
        <circle cx="32" cy="28" r="8" fill="#581c87" stroke="#c084fc" stroke-width="1.8"/>
        <circle cx="29" cy="27" r="1.8" fill="#f43f5e"/>
        <circle cx="35" cy="27" r="1.8" fill="#f43f5e"/>
        <path d="M29 32 L35 32" stroke="#c084fc" stroke-width="1.5"/>
        <!-- Лазерный прицел захвата босса -->
        <line x1="32" y1="6" x2="32" y2="16" stroke="#f43f5e" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="32" y1="42" x2="32" y2="58" stroke="#f43f5e" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="6" y1="28" x2="16" y2="28" stroke="#f43f5e" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="48" y1="28" x2="58" y2="28" stroke="#f43f5e" stroke-width="2.2" stroke-linecap="round"/>
      </svg>
    `,
  },
];

/**
 * Контрольные миссии, после завершения которых открывается экран выбора модификации:
 * 1:2, 1:4, 2:1, 2:3, 3:1, 3:3 (ровно 6 экранов за кампанию)
 */
export const MODIFICATION_REWARD_MISSIONS = ['1-2', '1-4', '2-1', '2-3', '3-1', '3-3'];

export function isModificationRewardMission(missionId: string): boolean {
  return MODIFICATION_REWARD_MISSIONS.includes(missionId);
}

export function getModificationById(id: string): ShipModification | undefined {
  return SHIP_MODIFICATIONS.find((m) => m.id === id);
}

/**
 * Выбрать n случайных уникальных модификаций из пула еще не полученных игроком
 * - Исключает уже полученные модификации
 * - Без дубликатов в одном предложении
 * - Честное случайное перемешивание (Fisher-Yates)
 */
export function getRandomModifications(
  count = 3,
  appliedIds: Set<string> | string[] = new Set(),
): ShipModification[] {
  const appliedSet = appliedIds instanceof Set ? appliedIds : new Set(appliedIds);
  const available = SHIP_MODIFICATIONS.filter((m) => !appliedSet.has(m.id));

  if (available.length <= count) {
    return [...available];
  }

  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

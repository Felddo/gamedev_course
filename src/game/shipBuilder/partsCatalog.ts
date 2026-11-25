import { SHIP_MODULES_CATALOG } from './modulesCatalog';

export interface PartItem {
  id: string;
  name: string;
  url: string;
  category: string;
  subfolder?: string;
}

export interface FolderNode {
  name: string;
  title: string;
  items: PartItem[];
}

export interface CategoryData {
  id: string;
  title: string;
  englishName: string;
  description: string;
  iconSvg: string;
  hasSubfolders: boolean;
  folders: FolderNode[];
  directItems: PartItem[];
}

// Загрузка всех изображений деталей через Vite glob import
const partImages = import.meta.glob<string>(
  '../../assets/Sprites/Parts/**/*.{png,jpg,svg}',
  { eager: true, import: 'default' }
);

/**
 * Поиск фактического resolved URL изображения по partId
 */
function findPartImageUrl(partId: string): string {
  // 1. Точный поиск по нормализованному пути из partId
  for (const [filePath, url] of Object.entries(partImages)) {
    const fileName = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '');
    if (!fileName) continue;

    // Для engines_0 -> fileName === '0', guns_1 -> fileName === '1'
    if (partId === `engines_${fileName}` && filePath.includes('/engines/')) {
      return url;
    }
    if (partId === `guns_${fileName}` && filePath.includes('/guns/')) {
      return url;
    }

    // Для деталей вида pilot_black_spaceParts_054, wings_blue_spaceParts_010 и т.д.
    const keyNormalized = filePath
      .replace(/.*\/Parts\//, '')
      .replace(/\//g, '_')
      .replace(/\.[^/.]+$/, '');
    if (keyNormalized === partId) {
      return url;
    }
  }

  // 2. Дополнительный поиск по вхождению имени файла
  for (const [filePath, url] of Object.entries(partImages)) {
    const fileName = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '');
    if (fileName && partId.includes(fileName)) {
      return url;
    }
  }

  return '';
}

const CATEGORIES_CONFIG: Array<{
  id: string;
  title: string;
  englishName: string;
  description: string;
  iconSvg: string;
}> = [
  {
    id: 'body',
    title: 'Корпус',
    englishName: 'HULL // BODY',
    description: 'Несущий каркас, броневые плиты и блоки корпуса',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 3h6l3.5 7.5-1.5 8-3 2.5h-4l-3-2.5-1.5-8L9 3z"/>
      <path d="M10.5 7.5h3l1.5 4-1 5h-4l-1-5 1.5-4z" stroke-width="1.3"/>
      <path d="M12 3v4.5" stroke-width="1.3"/>
    </svg>`,
  },
  {
    id: 'pilot',
    title: 'Кабина',
    englishName: 'COCKPIT // PILOT',
    description: 'Командные модули, визоры и кабины пилота',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2.5C9.2 5 7.5 9.5 7.5 15l2 5.5h5l2-5.5c0-5.5-1.7-10-4.5-12.5z"/>
      <path d="M9.5 10.5L12 7.5l2.5 3v4.5L12 16.5 9.5 15v-4.5z" stroke-width="1.3"/>
      <path d="M12 7.5v9" stroke-width="1.2"/>
    </svg>`,
  },
  {
    id: 'wings',
    title: 'Крылья',
    englishName: 'WINGS // AERO',
    description: 'Маневровые крылья, аэродинамические плоскости и пилоны',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9.5 4.5L6.5 10 2.5 13v4l4 2.5 3-2V4.5z"/>
      <path d="M14.5 4.5l3 5.5 4 3v4l-4 2.5-3-2V4.5z"/>
      <path d="M9.5 12h5" stroke-width="1.4"/>
    </svg>`,
  },
  {
    id: 'engines',
    title: 'Двигатели',
    englishName: 'THRUSTERS // ENGINES',
    description: 'Маршевые фотонно-плазменные сопла и реактивные приводы',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 3h8l1.5 2v5l-2 2.5h-7L6.5 10V5L8 3z"/>
      <path d="M9.5 12.5h5l1.5 4h-8l1.5-4z"/>
      <path d="M9 16.5l3 5 3-5"/>
      <path d="M9.5 7.5h5" stroke-width="1.4"/>
    </svg>`,
  },
  {
    id: 'guns',
    title: 'Пушки',
    englishName: 'WEAPONS // GUNS',
    description: 'Импульсные орудия, бластеры и спаренные стволы',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8.5 3v8"/>
      <path d="M15.5 3v8"/>
      <path d="M7.5 4.5h2"/>
      <path d="M14.5 4.5h2"/>
      <path d="M6 11h12l1 2.5v5l-2 2.5H7l-2-2.5v-5L6 11z"/>
      <path d="M9.5 15.5h5" stroke-width="1.4"/>
    </svg>`,
  },
];

/**
 * Построение каталога деталей корабля
 */
export function buildPartsCatalog(): CategoryData[] {
  const catalogMap = new Map<string, CategoryData>();

  for (const config of CATEGORIES_CONFIG) {
    catalogMap.set(config.id, {
      id: config.id,
      title: config.title,
      englishName: config.englishName,
      description: config.description,
      iconSvg: config.iconSvg,
      hasSubfolders: false,
      folders: [],
      directItems: [],
    });
  }

  // Заполняем категории кураторскими модулями (по строго заданным количествам и редкостям)
  for (const mod of SHIP_MODULES_CATALOG) {
    const cat = catalogMap.get(mod.category);
    if (!cat) continue;

    const resolvedUrl = findPartImageUrl(mod.partId);

    cat.directItems.push({
      id: mod.partId,
      name: mod.name,
      url: resolvedUrl,
      category: mod.category,
    });
  }

  return CATEGORIES_CONFIG.map((cfg) => catalogMap.get(cfg.id)!);
}

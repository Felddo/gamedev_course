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
    id: 'pilot',
    title: 'Кабина',
    englishName: 'COCKPIT // PILOT',
    description: 'Командные модули, визоры и кабины пилота',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z"/>
      <circle cx="12" cy="11" r="3"/>
      <path d="M12 14v4"/>
    </svg>`,
  },
  {
    id: 'body',
    title: 'Тело',
    englishName: 'HULL // BODY',
    description: 'Несущий каркас, броневые плиты и блоки корпуса',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="5" y="4" width="14" height="16" rx="3"/>
      <line x1="9" y1="9" x2="15" y2="9"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
      <line x1="12" y1="4" x2="12" y2="20"/>
    </svg>`,
  },
  {
    id: 'wings',
    title: 'Крылья',
    englishName: 'WINGS // AERO',
    description: 'Маневровые крылья, аэродинамические плоскости и пилоны',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M12 4l-9 8 9 8 9-8-9-8z"/>
      <path d="M3 12h18"/>
      <path d="M12 4v16"/>
    </svg>`,
  },
  {
    id: 'engines',
    title: 'Двигатели',
    englishName: 'THRUSTERS // ENGINES',
    description: 'Маршевые фотонно-плазменные сопла и реактивные приводы',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M8 3h8l-1 9H9L8 3z"/>
      <path d="M7 12h10l-2 5H9l-2-5z"/>
      <path d="M10 17l2 4 2-4"/>
    </svg>`,
  },
  {
    id: 'guns',
    title: 'Пушки',
    englishName: 'WEAPONS // GUNS',
    description: 'Импульсные орудия, бластеры и спаренные стволы',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="10" y="2" width="4" height="12" rx="1"/>
      <path d="M7 14h10v6H7v-6z"/>
      <line x1="12" y1="2" x2="12" y2="14"/>
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

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
 * Русские человекочитаемые названия для папок подкатегорий
 */
const SUBFOLDER_NAMES: Record<string, string> = {
  black: 'Черные детали // Black',
  white: 'Белые детали // White',
  blue: 'Синие сплавы // Blue',
  green: 'Изумрудные // Green',
  red: 'Титановые (Красные) // Red',
};

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
    description: 'Командные модули, оптические визоры и кабины пилота',
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
    description: 'Несущий каркас, броневые плиты и центральные блоки корпуса',
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
    description: 'Маневровые крылья, аэродинамические стабилизаторы и пилоны',
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
    description: 'Маршевые фотонно-плазменные сопла и реактивные ускорители',
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
    description: 'Импульсные орудия, бластеры и спаренные турельные стволы',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="10" y="2" width="4" height="12" rx="1"/>
      <path d="M7 14h10v6H7v-6z"/>
      <line x1="12" y1="2" x2="12" y2="14"/>
    </svg>`,
  },
];

/**
 * Парсинг и построение иерархического каталога деталей
 */
export function buildPartsCatalog(): CategoryData[] {
  // Словарь для категоризации
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

  // Обход всех загруженных Vite изображений
  for (const [filePath, resolvedUrl] of Object.entries(partImages)) {
    // Пример filePath: '../../assets/Sprites/Parts/pilot/black/spaceParts_054.png'
    // или '../../assets/Sprites/Parts/engines/0.png'
    const match = filePath.match(/Parts\/([^/]+)\/(.+)$/);
    if (!match) continue;

    const catId = match[1];
    const rest = match[2];
    const category = catalogMap.get(catId);
    if (!category) continue;

    const parts = rest.split('/');
    if (parts.length === 1) {
      // Прямой файл в категории (например, engines/0.png)
      const fileName = parts[0];
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      category.directItems.push({
        id: `${catId}_${baseName}`,
        name: baseName,
        url: resolvedUrl,
        category: catId,
      });
    } else {
      // Файл внутри подпапки (например, pilot/black/spaceParts_054.png)
      const folderName = parts[0];
      const fileName = parts[1];
      const baseName = fileName.replace(/\.[^/.]+$/, '');

      category.hasSubfolders = true;
      let folderNode = category.folders.find((f) => f.name === folderName);
      if (!folderNode) {
        folderNode = {
          name: folderName,
          title: SUBFOLDER_NAMES[folderName] || folderName.toUpperCase(),
          items: [],
        };
        category.folders.push(folderNode);
      }

      folderNode.items.push({
        id: `${catId}_${folderName}_${baseName}`,
        name: baseName,
        url: resolvedUrl,
        category: catId,
        subfolder: folderName,
      });
    }
  }

  // Сортировка деталей для аккуратного отображения
  for (const cat of catalogMap.values()) {
    cat.directItems.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (const folder of cat.folders) {
      folder.items.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }
  }

  return CATEGORIES_CONFIG.map((cfg) => catalogMap.get(cfg.id)!);
}

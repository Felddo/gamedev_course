/**
 * Конфигурация единственной игровой валюты — «Металлолом» (Scrap Metal).
 * Все параметры наград и выпадения валюты централизованы здесь.
 */

export interface ScrapDropRange {
  min: number;
  max: number;
}

export interface ScrapRewardConfig {
  /**
   * Выпадение металлолома на поле боя при уничтожении кораблей противника
   */
  enemyDrops: {
    scout: ScrapDropRange;         // Обычный легкий противник (2–4)
    interceptor: ScrapDropRange;   // Обычный скоростной противник (2–4)
    gunship: ScrapDropRange;       // Тяжёлый крейсер (6–10)
    terminator: ScrapDropRange;    // Тяжёлый бронированный крейсер (6–10)
    boss: ScrapDropRange;          // Босс миссии (отдельная повышенная награда при взрыве, 30–50)
    defaultRegular: ScrapDropRange;// Значение по умолчанию для обычных противников (2–4)
  };

  /**
   * Награды металлолома, начисляемые при успешном завершении миссии
   */
  missionRewards: {
    regular: ScrapDropRange;       // Обычная миссия (15–25)
    bossMission: ScrapDropRange;   // Боссовая миссия (40–60)
    bossKillBonus: number;         // Дополнительный фиксированный бонус за ликвидацию босса (~50)
  };
}

/**
 * Единая глобальная конфигурация наград валюты «Металлолом»
 */
export const SCRAP_CONFIG: ScrapRewardConfig = {
  enemyDrops: {
    scout: { min: 2, max: 4 },
    interceptor: { min: 2, max: 4 },
    gunship: { min: 6, max: 10 },
    terminator: { min: 6, max: 10 },
    boss: { min: 30, max: 50 },
    defaultRegular: { min: 2, max: 4 },
  },
  missionRewards: {
    regular: { min: 15, max: 25 },
    bossMission: { min: 40, max: 60 },
    bossKillBonus: 50,
  },
};

/**
 * Генерация случайного количества металлолома в заданном диапазоне [min, max] включительно.
 */
export function rollScrap(range: ScrapDropRange): number {
  const min = Math.min(range.min, range.max);
  const max = Math.max(range.min, range.max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Определение количества металлолома при уничтожении конкретного врага.
 * @param enemyType Тип уничтоженного корабля противника
 * @param isBoss Является ли корабль боссом миссии
 */
export function getEnemyScrapDrop(enemyType?: string, isBoss?: boolean): number {
  if (isBoss) {
    return rollScrap(SCRAP_CONFIG.enemyDrops.boss);
  }

  switch (enemyType) {
    case 'gunship':
    case 'terminator':
      return rollScrap(SCRAP_CONFIG.enemyDrops.gunship);
    case 'scout':
      return rollScrap(SCRAP_CONFIG.enemyDrops.scout);
    case 'interceptor':
      return rollScrap(SCRAP_CONFIG.enemyDrops.interceptor);
    default:
      return rollScrap(SCRAP_CONFIG.enemyDrops.defaultRegular);
  }
}

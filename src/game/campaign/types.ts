/**
 * Типы данных системы кампании Iron Resolve
 */

export interface MissionEnemyConfig {
  spawnIntensity: number;       // Множитель частоты появления врагов (0.4 - 2.0)
  healthMultiplier: number;     // Множитель здоровья врагов
  speedMultiplier: number;      // Множитель скорости врагов
  scoutRatio: number;           // Доля легких разведчиков (0.0 - 1.0)
  interceptorRatio: number;     // Доля скоростных перехватчиков (0.0 - 1.0)
  gunshipRatio: number;         // Доля тяжелых крейсеров (0.0 - 1.0)
  allowGunship: boolean;        // Разрешено ли появление тяжелых стреляющих крейсеров
  maxMeteors: number;           // Максимум метеоритов на карте
  meteorSpawnInterval: number;  // Интервал появления метеоритов в секундах
  initialMeteorCount: number;   // Начальное количество метеоритов
}

export interface MissionBossConfig {
  name: string;                 // Имя босса (например, 'Дредноут-1')
  title: string;                // Тактическое обозначение босса
  hp: number;                   // Запас прочности босса
  speed: number;                // Скорость перемещения
  scale: number;                // Масштаб спрайта
  shootCooldown: number;        // Интервал между залпами
  bulletDamage: number;         // Урон снарядов босса
  bulletSpeed: number;          // Скорость снарядов
  spawnDelay: number;           // Задержка появления босса от начала миссии (в секундах)
  spreadCount: number;          // Количество снарядов в залпе (3, 5 и т.д.)
  tint?: number;                // Цветовой оттенок спрайта
}

export interface CampaignMission {
  id: string;                   // '1-1', '1-2', ... '3-5'
  sector: number;               // 1, 2, 3
  mission: number;              // 1, 2, 3, 4, 5
  title: string;                // Название миссии
  subtitle: string;             // Обозначение сектора / подзаголовок
  briefing: string;             // Краткое тактическое описание
  isBoss: boolean;              // Является ли миссия боссовой (1-5, 2-5, 3-5)
  targetDuration: number;       // Продолжительность миссии в секундах (обычные: 120-150s, боссы: 180-220s)
  enemyConfig: MissionEnemyConfig;
  bossConfig?: MissionBossConfig;
}

export interface ScrapVictoryBreakdown {
  enemyScrap: number;          // Металлолом, подобранный с поверженных врагов
  missionReward: number;       // Награда за успешное завершение миссии
  bossBonus: number;           // Бонус за ликвидацию босса
  totalEarned: number;         // Суммарный заработок металлолома за вылет
  newBalance: number;          // Итоговый баланс после начисления
  alreadyRewarded: boolean;    // Защита от дублирования: флаг, начислялась ли награда ранее
}

export interface SavedDroppedPart {
  uid: string;
  partId: string;
  x: number;
  y: number;
  zIndex: number;
  rotation: number;
  flipX: boolean;
  width: number;
  height: number;
}

export interface CampaignSaveData {
  currentSector: number;        // 1..3
  currentMission: number;       // 1..5
  completedMissions: string[];  // Список пройденных миссий, например: ['1-1', '1-2']
  state: 'in_progress' | 'completed';
  totalScore: number;
  missionScores: Record<string, number>;
  scrapBalance: number;         // Баланс единственной валюты «Металлолом»
  rewardedMissions: string[];   // Список миссий, за которые уже была выдана награда (защита от повторного начисления)
  unlockedModuleIds: string[];  // Разблокированные ID боевых модулей корабля
  rewardedModuleMissions: string[]; // Миссии, за которые уже получен выбор модуля (1-1, 1-3, 2-1, 2-3, 3-1, 3-3)
  appliedUpgradeIds: string[];  // Выбранные ID тактических улучшений (сохраняются до конца кампании)
  rewardedTacticalMissions: string[]; // Миссии, за которые уже получен выбор тактического улучшения (1-2, 1-4, 2-2, 2-4, 3-2, 3-4)
  savedShipAssembly?: SavedDroppedPart[]; // Сохраненная кастомная сборка корабля
  updatedAt: number;
}

import { CAMPAIGN_MISSIONS } from './campaignData';
import { CampaignMission, CampaignSaveData, SavedDroppedPart, ScrapVictoryBreakdown } from './types';
import { SCRAP_CONFIG, rollScrap } from './scrapConfig';
import {
  DEFAULT_UNLOCKED_MODULES,
  isModuleRewardMission,
  SHIP_MODULES_CATALOG,
  getModuleById,
  isModuleAvailableForPurchase,
} from '../shipBuilder/modulesCatalog';

const STORAGE_KEY = 'iron_resolve_campaign_save';

/**
 * Менеджер сохранения и управления кампанией (15 миссий, 3 сектора).
 * Отвечает за:
 * - Сохранение и загрузку состояния кампании в localStorage
 * - Переход между миссиями при победе
 * - Защиту от повторного запуска уже завершенной миссии при перезагрузке
 * - Возможность повтора текущей миссии при поражении
 */
export class CampaignManager {
  private static instance: CampaignManager | null = null;
  private saveData: CampaignSaveData;

  private constructor() {
    this.saveData = this.loadFromStorage();
  }

  public static getInstance(): CampaignManager {
    if (!CampaignManager.instance) {
      CampaignManager.instance = new CampaignManager();
    }
    return CampaignManager.instance;
  }

  /**
   * Загрузка сохраненного состояния из localStorage
   */
  private loadFromStorage(): CampaignSaveData {
    const defaultData: CampaignSaveData = {
      currentSector: 1,
      currentMission: 1,
      completedMissions: [],
      state: 'in_progress',
      totalScore: 0,
      missionScores: {},
      scrapBalance: 0,
      rewardedMissions: [],
      unlockedModuleIds: [...DEFAULT_UNLOCKED_MODULES],
      rewardedModuleMissions: [],
      appliedUpgradeIds: [],
      rewardedTacticalMissions: [],
      updatedAt: Date.now(),
    };

    try {
      if (typeof localStorage === 'undefined') return defaultData;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultData;

      const parsed = JSON.parse(raw) as Partial<CampaignSaveData>;
      const sector = typeof parsed.currentSector === 'number' ? Math.max(1, Math.min(3, parsed.currentSector)) : 1;
      const mission = typeof parsed.currentMission === 'number' ? Math.max(1, Math.min(5, parsed.currentMission)) : 1;
      const completed = Array.isArray(parsed.completedMissions) ? parsed.completedMissions : [];
      const state = parsed.state === 'completed' ? 'completed' : 'in_progress';
      const totalScore = typeof parsed.totalScore === 'number' ? parsed.totalScore : 0;
      const missionScores = (parsed.missionScores && typeof parsed.missionScores === 'object') ? parsed.missionScores : {};
      const scrapBalance = typeof parsed.scrapBalance === 'number' && parsed.scrapBalance >= 0 ? Math.floor(parsed.scrapBalance) : 0;
      const rewardedMissions = Array.isArray(parsed.rewardedMissions) ? parsed.rewardedMissions : [];

      // Гарантируем, что базовые модули всегда включены в список открытых
      const unlockedRaw = Array.isArray(parsed.unlockedModuleIds) ? parsed.unlockedModuleIds : [];
      const unlockedSet = new Set<string>([...DEFAULT_UNLOCKED_MODULES, ...unlockedRaw]);
      const unlockedModuleIds = Array.from(unlockedSet);

      const rewardedModuleMissions = Array.isArray(parsed.rewardedModuleMissions) ? parsed.rewardedModuleMissions : [];
      const appliedUpgradeIds = Array.isArray(parsed.appliedUpgradeIds) ? parsed.appliedUpgradeIds : [];
      const rewardedTacticalMissions = Array.isArray(parsed.rewardedTacticalMissions) ? parsed.rewardedTacticalMissions : [];
      const savedShipAssembly = Array.isArray(parsed.savedShipAssembly) ? parsed.savedShipAssembly : undefined;

      return {
        currentSector: sector,
        currentMission: mission,
        completedMissions: completed,
        state,
        totalScore,
        missionScores,
        scrapBalance,
        rewardedMissions,
        unlockedModuleIds,
        rewardedModuleMissions,
        appliedUpgradeIds,
        rewardedTacticalMissions,
        savedShipAssembly,
        updatedAt: parsed.updatedAt || Date.now(),
      };
    } catch (e) {
      console.warn('[CampaignManager] Failed to read save from localStorage:', e);
      return defaultData;
    }
  }

  /**
   * Запись состояния кампании в localStorage
   */
  public saveToStorage(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      this.saveData.updatedAt = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.saveData));
    } catch (e) {
      console.warn('[CampaignManager] Failed to write save to localStorage:', e);
    }
  }

  /**
   * Получить текущее сохраненное состояние
   */
  public getSaveData(): CampaignSaveData {
    return {
      ...this.saveData,
      completedMissions: [...this.saveData.completedMissions],
      rewardedMissions: [...this.saveData.rewardedMissions],
      unlockedModuleIds: [...this.saveData.unlockedModuleIds],
      rewardedModuleMissions: [...this.saveData.rewardedModuleMissions],
      appliedUpgradeIds: [...this.saveData.appliedUpgradeIds],
      rewardedTacticalMissions: [...this.saveData.rewardedTacticalMissions],
      savedShipAssembly: this.saveData.savedShipAssembly ? [...this.saveData.savedShipAssembly] : undefined,
    };
  }

  /**
   * Получить список всех установленных тактических улучшений кампании
   */
  public getAppliedUpgradeIds(): string[] {
    return [...this.saveData.appliedUpgradeIds];
  }

  /**
   * Проверить, было ли уже выбрано тактическое улучшение за данную миссию
   */
  public isTacticalMissionRewarded(missionId: string): boolean {
    return this.saveData.rewardedTacticalMissions.includes(missionId);
  }

  /**
   * Зафиксировать получение тактического улучшения за миссию
   */
  public recordTacticalUpgradeReward(missionId: string, upgradeId: string): void {
    if (!this.saveData.appliedUpgradeIds.includes(upgradeId)) {
      this.saveData.appliedUpgradeIds.push(upgradeId);
    }
    if (!this.saveData.rewardedTacticalMissions.includes(missionId)) {
      this.saveData.rewardedTacticalMissions.push(missionId);
    }
    this.saveToStorage();
  }

  /**
   * Получить список всех разблокированных модулей
   */
  public getUnlockedModuleIds(): string[] {
    return [...this.saveData.unlockedModuleIds];
  }

  /**
   * Проверить, разблокирован ли указанный модуль
   */
  public isModuleUnlocked(moduleId: string): boolean {
    return this.saveData.unlockedModuleIds.includes(moduleId);
  }

  /**
   * Проверить, открыт ли доступ к покупке модуля (по прогрессу кампании)
   */
  public isModuleAvailableForPurchase(moduleId: string): boolean {
    const mod = getModuleById(moduleId);
    if (!mod) return false;
    return isModuleAvailableForPurchase(
      mod,
      this.saveData.completedMissions,
      this.saveData.currentSector,
    );
  }

  /**
   * Покупка модуля в ангаре за металлолом:
   * Проверяет наличие детали, доступность по прогрессу (1-5 для редких, 2-5 для легендарных),
   * достаточность баланса металлолома, списывает валюту и добавляет деталь в разблокированные.
   */
  public buyModule(moduleId: string): {
    success: boolean;
    reason?: 'NOT_FOUND' | 'ALREADY_OWNED' | 'LOCKED_BY_STAGE' | 'INSUFFICIENT_SCRAP';
    newBalance?: number;
    moduleName?: string;
    price?: number;
  } {
    const mod = getModuleById(moduleId);
    if (!mod) {
      return { success: false, reason: 'NOT_FOUND' };
    }
    if (this.isModuleUnlocked(moduleId)) {
      return { success: false, reason: 'ALREADY_OWNED', moduleName: mod.name, price: mod.price };
    }
    if (!this.isModuleAvailableForPurchase(moduleId)) {
      return { success: false, reason: 'LOCKED_BY_STAGE', moduleName: mod.name, price: mod.price };
    }
    if (this.saveData.scrapBalance < mod.price) {
      return {
        success: false,
        reason: 'INSUFFICIENT_SCRAP',
        moduleName: mod.name,
        price: mod.price,
        newBalance: this.saveData.scrapBalance,
      };
    }

    this.saveData.scrapBalance -= mod.price;
    this.saveData.unlockedModuleIds.push(moduleId);
    this.saveToStorage();
    return {
      success: true,
      newBalance: this.saveData.scrapBalance,
      moduleName: mod.name,
      price: mod.price,
    };
  }

  /**
   * Разблокировать модуль по ID с немедленным сохранением
   */
  public unlockModule(moduleId: string): boolean {
    if (!this.saveData.unlockedModuleIds.includes(moduleId)) {
      this.saveData.unlockedModuleIds.push(moduleId);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * Проверить, была ли уже выдана награда-модуль за данную миссию
   */
  public isModuleMissionRewarded(missionId: string): boolean {
    return this.saveData.rewardedModuleMissions.includes(missionId);
  }

  /**
   * Зафиксировать получение награды-модуля за миссию (защита от повторного начисления)
   */
  public recordModuleReward(missionId: string, chosenModuleId?: string): void {
    if (chosenModuleId) {
      this.unlockModule(chosenModuleId);
    }
    if (!this.saveData.rewardedModuleMissions.includes(missionId)) {
      this.saveData.rewardedModuleMissions.push(missionId);
      this.saveToStorage();
    }
  }

  /**
   * Сохранить текущую раскладку деталей сборки корабля
   */
  public saveShipAssembly(assembly: SavedDroppedPart[]): void {
    this.saveData.savedShipAssembly = assembly.map((p) => ({ ...p }));
    this.saveToStorage();
  }

  /**
   * Получить сохраненную сборку корабля
   */
  public getSavedShipAssembly(): SavedDroppedPart[] | undefined {
    return this.saveData.savedShipAssembly ? [...this.saveData.savedShipAssembly] : undefined;
  }

  /**
   * Получить текущий баланс металлолома
   */
  public getScrapBalance(): number {
    return this.saveData.scrapBalance;
  }

  /**
   * Начисление металлолома с моментальным сохранением в localStorage
   */
  public addScrap(amount: number): number {
    if (amount > 0) {
      this.saveData.scrapBalance += Math.floor(amount);
      this.saveToStorage();
    }
    return this.saveData.scrapBalance;
  }

  /**
   * Получить текущую активную миссию кампании
   */
  public getCurrentMission(): CampaignMission {
    const currentId = `${this.saveData.currentSector}-${this.saveData.currentMission}`;
    const found = CAMPAIGN_MISSIONS.find((m) => m.id === currentId);
    return found || CAMPAIGN_MISSIONS[0];
  }

  /**
   * Получить информацию о конкретной миссии по сектору и номеру
   */
  public getMission(sector: number, mission: number): CampaignMission | undefined {
    return CAMPAIGN_MISSIONS.find((m) => m.sector === sector && m.mission === mission);
  }

  /**
   * Проверка, пройдена ли миссия с данным ID
   */
  public isMissionCompleted(missionId: string): boolean {
    return this.saveData.completedMissions.includes(missionId);
  }

  /**
   * Проверка, завершена ли вся кампания (все 15 миссий)
   */
  public isCampaignCompleted(): boolean {
    return this.saveData.state === 'completed';
  }

  /**
   * Фиксация победы в текущей миссии:
   * 1. Сохраняет очки миссии.
   * 2. Начисляет валюту «Металлолом» (с поверженных врагов, награда за сектор, бонус за босса).
   *    Защита от дублирования: начисление происходит ровно один раз за миссию.
   * 3. Добавляет текущую миссию в список пройденных.
   * 4. МГНОВЕННО переводит указатель текущей миссии на следующую в localStorage,
   *    чтобы при обновлении экрана игрок не проходил её повторно.
   * 5. Если завершена миссия 3-5, отмечает всю кампанию как пройденную ('completed').
   */
  public recordVictory(
    score: number,
    _kills: number,
    _timeSeconds: number,
    scrapData?: {
      enemyScrap?: number;
      isBossMission?: boolean;
      wasBossKilled?: boolean;
    },
  ): {
    completedSector: number;
    completedMission: number;
    nextSector: number;
    nextMission: number;
    isCampaignComplete: boolean;
    scrapBreakdown: ScrapVictoryBreakdown;
  } {
    const currentSector = this.saveData.currentSector;
    const currentMission = this.saveData.currentMission;
    const missionId = `${currentSector}-${currentMission}`;

    // Добавляем в пройденные
    if (!this.saveData.completedMissions.includes(missionId)) {
      this.saveData.completedMissions.push(missionId);
    }

    // Сохраняем лучший счет за эту миссию
    const prevBest = this.saveData.missionScores[missionId] || 0;
    if (score > prevBest) {
      this.saveData.missionScores[missionId] = score;
    }
    this.saveData.totalScore += score;

    // Расчет наград валюты «Металлолом»
    const isBossMission = scrapData?.isBossMission ?? (currentMission === 5);
    const wasBossKilled = scrapData?.wasBossKilled ?? isBossMission;
    const enemyScrap = Math.max(0, Math.floor(scrapData?.enemyScrap ?? 0));
    const missionReward = isBossMission
      ? rollScrap(SCRAP_CONFIG.missionRewards.bossMission)
      : rollScrap(SCRAP_CONFIG.missionRewards.regular);
    const bossBonus = wasBossKilled ? SCRAP_CONFIG.missionRewards.bossKillBonus : 0;
    const totalEarned = enemyScrap + missionReward + bossBonus;

    // Защита от повторного начисления: проверяем, выдавалась ли награда за эту миссию
    const alreadyRewarded = this.saveData.rewardedMissions.includes(missionId);
    if (!alreadyRewarded) {
      this.saveData.scrapBalance += totalEarned;
      this.saveData.rewardedMissions.push(missionId);
    }

    // Рассчитываем следующую миссию
    let nextSector = currentSector;
    let nextMission = currentMission;
    let isCampaignComplete = false;

    if (currentSector === 3 && currentMission === 5) {
      // Финальная миссия 3-5 побеждена!
      this.saveData.state = 'completed';
      isCampaignComplete = true;
    } else if (currentMission < 5) {
      nextMission = currentMission + 1;
      this.saveData.currentSector = nextSector;
      this.saveData.currentMission = nextMission;
    } else {
      // Переход к следующему сектору (миссия 1)
      nextSector = currentSector + 1;
      nextMission = 1;
      this.saveData.currentSector = nextSector;
      this.saveData.currentMission = nextMission;
    }

    // При победе в миссиях детали не разблокируются бесплатно:
    // По завершении этапа 1-5 становятся доступны для покупки редкие части корабля (tier 2),
    // а по завершении этапа 2-5 становятся доступны для покупки легендарные части корабля (tier 3).
    // Покупка осуществляется игроком в ангаре за накопленный металлолом.

    // Мгновенная фиксация в localStorage
    this.saveToStorage();

    return {
      completedSector: currentSector,
      completedMission: currentMission,
      nextSector,
      nextMission,
      isCampaignComplete,
      scrapBreakdown: {
        enemyScrap,
        missionReward,
        bossBonus,
        totalEarned,
        newBalance: this.saveData.scrapBalance,
        alreadyRewarded,
      },
    };
  }

  /**
   * Повтор текущей миссии (при поражении указатель прогресса не смещается)
   */
  public prepareRetry(): void {
    // Сохранение остается на текущей миссии, ничего не меняем
    this.saveToStorage();
  }

  /**
   * Полный сброс кампании (для старта заново)
   */
  public resetCampaign(): void {
    this.saveData = {
      currentSector: 1,
      currentMission: 1,
      completedMissions: [],
      state: 'in_progress',
      totalScore: 0,
      missionScores: {},
      scrapBalance: 0,
      rewardedMissions: [],
      unlockedModuleIds: [...DEFAULT_UNLOCKED_MODULES],
      rewardedModuleMissions: [],
      appliedUpgradeIds: [],
      rewardedTacticalMissions: [],
      savedShipAssembly: undefined,
      updatedAt: Date.now(),
    };
    this.saveToStorage();
  }

  /**
   * Установка произвольной миссии (для тестов или выбора)
   */
  public setMission(sector: number, mission: number): void {
    this.saveData.currentSector = Math.max(1, Math.min(3, sector));
    this.saveData.currentMission = Math.max(1, Math.min(5, mission));
    if (this.saveData.state === 'completed' && (sector < 3 || mission < 5)) {
      this.saveData.state = 'in_progress';
    }
    this.saveToStorage();
  }

  /**
   * Текстовая сводка прогресса кампании для UI (например, "СЕКТОР 1 // МИССИЯ 1-2")
   */
  public getProgressLabel(): string {
    if (this.saveData.state === 'completed') {
      return 'КАМПАНИЯ ЗАВЕРШЕНА (15/15)';
    }
    return `СЕКТОР ${this.saveData.currentSector} // МИССИЯ ${this.saveData.currentSector}-${this.saveData.currentMission}`;
  }

  /**
   * Количество завершенных миссий
   */
  public getCompletedCount(): number {
    return this.saveData.completedMissions.length;
  }
}

export const campaignManager = CampaignManager.getInstance();

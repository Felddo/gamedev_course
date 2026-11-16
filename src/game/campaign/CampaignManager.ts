import { CAMPAIGN_MISSIONS } from './campaignData';
import { CampaignMission, CampaignSaveData } from './types';

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

      return {
        currentSector: sector,
        currentMission: mission,
        completedMissions: completed,
        state,
        totalScore,
        missionScores,
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
    return { ...this.saveData, completedMissions: [...this.saveData.completedMissions] };
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
   * 2. Добавляет текущую миссию в список пройденных.
   * 3. МГНОВЕННО переводит указатель текущей миссии на следующую в localStorage,
   *    чтобы при обновлении экрана игрок не проходил её повторно.
   * 4. Если завершена миссия 3-5, отмечает всю кампанию как пройденную ('completed').
   */
  public recordVictory(
    score: number,
    _kills: number,
    _timeSeconds: number,
  ): {
    completedSector: number;
    completedMission: number;
    nextSector: number;
    nextMission: number;
    isCampaignComplete: boolean;
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

    // Мгновенная фиксация в localStorage
    this.saveToStorage();

    return {
      completedSector: currentSector,
      completedMission: currentMission,
      nextSector,
      nextMission,
      isCampaignComplete,
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

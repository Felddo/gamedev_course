import { buildPartsCatalog, CategoryData, FolderNode, PartItem } from './partsCatalog';
import { soundFx } from '../audio';
import { campaignManager } from '../campaign/CampaignManager';
import { SavedDroppedPart } from '../campaign/types';
import {
  getModuleByPartId,
  getModuleRarity,
  getModuleStatsLines,
} from './modulesCatalog';

export interface DroppedPartInstance {
  uid: string;
  part: PartItem;
  x: number;
  y: number;
  zIndex: number;
  rotation: number; // 0, 45, 90, 135, 180, 225, 270, 315
  flipX: boolean;   // true = горизонтальное отражение
  width: number;
  height: number;
}

export interface CustomShipModule {
  id: string;
  category: string;
  textureKey: string;
  url: string;
  offsetX: number;
  offsetY: number;
  rotationDeg: number;
  flipX: boolean;
  zIndex: number;
}

export interface CustomShipAssembly {
  modules: CustomShipModule[];
  bounds: { width: number; height: number };
  engineOffsets: Array<{ x: number; y: number; angleOffset: number }>;
  gunOffsets: Array<{ x: number; y: number; angleOffset: number }>;
}

export interface CohesionValidationResult {
  isValid: boolean;
  errorMessage?: string;
  disconnectedUids?: string[];
}

// Лимиты на установку модулей по категориям
export const CATEGORY_LIMITS: Record<string, { max: number; title: string; icon: string }> = {
  pilot: { max: 1, title: 'Кабина', icon: '👤' },
  body: { max: 1, title: 'Корпус', icon: '🛡️' },
  wings: { max: 2, title: 'Крылья', icon: '🪽' },
  engines: { max: 1, title: 'Двигатели', icon: '🚀' },
  guns: { max: 2, title: 'Пушки', icon: '⚡' },
};

export class ShipBuilderModal {
  private container: HTMLElement;
  private catalog: CategoryData[];
  private activeCategoryId: string;
  private activeSubfolderName: string | null = null;
  private activeRarityFilter: 'all' | 'common' | 'rare' | 'legendary' = 'all';
  private droppedParts: DroppedPartInstance[] = [];
  private selectedPartUid: string | null = null;

  // DOM References
  private modalEl!: HTMLElement;
  private centerBayEl!: HTMLElement;
  private categoriesListEl!: HTMLElement;
  private subfoldersColEl!: HTMLElement;
  private subfoldersTagEl!: HTMLElement;
  private subfoldersListEl!: HTMLElement;
  private partsColEl!: HTMLElement;
  private partsTagEl!: HTMLElement;
  private partsGridEl!: HTMLElement;
  private partsCounterEl!: HTMLElement;
  private limitsGridEl!: HTMLElement;
  private alertToastEl!: HTMLElement;
  private alertMsgEl!: HTMLElement;
  private selectedToolbarEl!: HTMLElement;
  private scrapValEl!: HTMLElement;

  // Toolbar Action Buttons
  private btnLayerUp!: HTMLButtonElement;
  private btnLayerDown!: HTMLButtonElement;
  private btnRotate45!: HTMLButtonElement;
  private btnRotate90!: HTMLButtonElement;
  private btnFlipX!: HTMLButtonElement;
  private btnDeleteSelected!: HTMLButtonElement;

  // Touch / Pointer Drag State (каталог -> ангар)
  private touchDragPart: PartItem | null = null;
  private touchGhostEl: HTMLElement | null = null;
  private isPointerDragging = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private hasMovedSignificantly = false;

  // Moving Dropped Part State (перетаскивание внутри ангара)
  private isMovingDroppedPart = false;
  private movingPartUid: string | null = null;
  private moveOffsetX = 0;
  private moveOffsetY = 0;

  // Alert Timer
  private alertTimer: number | null = null;

  // Callbacks
  public onLaunch: ((assembly: CustomShipAssembly) => void) | null = null;
  public onReturnToMenu: (() => void) | null = null;

  constructor() {
    this.container = document.body;
    this.catalog = buildPartsCatalog();

    const firstCat = this.catalog[0];
    this.activeCategoryId = firstCat?.id || 'pilot';
    if (firstCat && firstCat.hasSubfolders && firstCat.folders.length > 0) {
      this.activeSubfolderName = firstCat.folders[0].name;
    }

    this.createDom();
    this.bindEvents();
    if (!this.loadSavedShipAssembly() || this.droppedParts.length === 0) {
      this.loadDefaultShipPreset();
    }
    this.render();
  }

  private createDom(): void {
    const modal = document.createElement('div');
    modal.id = 'modal-ship-builder';
    modal.className = 'holo-modal-backdrop shipyard-backdrop hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Голографический конструктор корабля');

    modal.innerHTML = `
      <div class="holo-modal-window shipyard-window">
        <div class="modal-card-scanlines"></div>
        <span class="corner-bracket corner-tl"></span>
        <span class="corner-bracket corner-tr"></span>
        <span class="corner-bracket corner-bl"></span>
        <span class="corner-bracket corner-br"></span>

        <!-- Всплывающее тактическое предупреждение о лимитах -->
        <div class="shipyard-alert-toast hidden" id="shipyard-alert-toast">
          <span class="alert-icon">⚠️</span>
          <span class="alert-msg" id="shipyard-alert-msg">ЛИМИТ ДОСТИГНУТ</span>
        </div>

        <!-- Шапка конструктора -->
        <header class="shipyard-header">
          <div class="shipyard-title-wrap">
            <div class="shipyard-title-row">
              <h2 class="shipyard-title">КОНСТРУКТОР КОРАБЛЯ</h2>
              <div class="shipyard-scrap-badge" id="shipyard-scrap-badge" title="Запас металлолома">
                <span class="shipyard-scrap-icon">⚙</span>
                <span class="shipyard-scrap-label">ЛОМ:</span>
                <span class="shipyard-scrap-val" id="shipyard-scrap-val">0</span>
              </div>
            </div>
          </div>
          <div class="shipyard-header-actions">
            <button id="shipyard-btn-launch-top" class="shipyard-action-btn btn-launch" type="button" title="Завершить сборку и начать бой">
              <span class="btn-glow-pulse"></span>
              <span class="btn-text">В БОЙ // ЗАПУСК</span>
            </button>
            <button id="shipyard-btn-menu-top" class="shipyard-action-btn btn-menu" type="button" title="Вернуться в главное меню">
              В МЕНЮ
            </button>
          </div>
        </header>

        <!-- Главное рабочее пространство (расширенная сетка) -->
        <div class="shipyard-workspace">
          
          <!-- СЕКЦИЯ КОЛОНОК НАВИГАЦИИ (СЛЕВА НАПРАВО) -->
          <div class="shipyard-columns-flow" id="shipyard-columns-flow">
            
            <!-- 1. СТОЛБЕЦ: МОДУЛИ (Кабина, Тело, Крылья, Двигатели, Пушки) -->
            <div class="flow-col col-categories" id="col-categories">
              <div class="col-head">
                <span class="col-head-tag">01 // МОДУЛИ</span>
              </div>
              <div class="col-scroll">
                <nav class="categories-list" id="shipyard-categories-list"></nav>
              </div>
            </div>

            <!-- 2. СТОЛБЕЦ: РАЗДЕЛЕНИЕ (если в группе есть папки, например цвета крыльев) -->
            <div class="flow-col col-subfolders" id="col-subfolders">
              <div class="col-head">
                <span class="col-head-tag" id="subfolders-head-tag">02 // РАЗДЕЛЕНИЕ</span>
              </div>
              <div class="col-scroll">
                <nav class="subfolders-list" id="shipyard-subfolders-list"></nav>
              </div>
            </div>

            <!-- 3. СТОЛБЕЦ: ФОТОГРАФИИ ДЕТАЛЕЙ (выбранного раздела или группы) -->
            <div class="flow-col col-parts" id="col-parts">
              <div class="col-head">
                <span class="col-head-tag" id="parts-head-tag">03 // ДЕТАЛИ</span>
              </div>
              <div class="col-scroll parts-scroll">
                <div class="parts-grid" id="shipyard-parts-grid"></div>
              </div>
              <div class="parts-col-footer-hint">
                <span>ПЕРЕТАЩИТЕ В АНГАР ИЛИ КЛИКНИТЕ</span>
              </div>
            </div>

          </div>

          <!-- ЦЕНТРАЛЬНОЕ ОКНО СБОРКИ КОРАБЛЯ -->
          <section class="shipyard-center-col" aria-label="Сборочный ангар корабля">
            <div class="hangar-container">
              <div class="hangar-main-row">

                <!-- 1. БЛОК С УКАЗАНИЕМ СКОЛЬКО ЧАСТЕЙ НУЖНО (ЕЩЕ ЛЕВЕЕ) -->
                <div class="hangar-panel-col hangar-limits-panel" id="hangar-limits-panel">
                  <div class="panel-col-head">
                    <span class="panel-col-head-tag">04 // ЧАСТИ</span>
                  </div>
                  <div class="panel-col-body">
                    <div class="hangar-limits-grid" id="hangar-limits-grid" title="Требуемое количество частей">
                      <!-- Динамически: Кабина, Корпус, Крылья, Двигатели, Пушки -->
                    </div>
                  </div>
                </div>

                <!-- 2. БЛОК С УПРАВЛЕНИЕМ МОДУЛЯМИ (СЛЕВА ОТ ОКНА КОРАБЛЯ) -->
                <div class="hangar-panel-col selected-module-toolbar" id="selected-module-toolbar">
                  <div class="panel-col-head">
                    <span class="panel-col-head-tag">05 // УПРАВЛЕНИЕ</span>
                  </div>
                  <div class="panel-col-body">
                    <div class="sel-tools">
                      <button id="btn-layer-up" class="sel-tool-btn" type="button" title="Переместить модуль на 1 слой вперед" disabled>
                        <span class="tool-icon">▲</span> Слой +1
                      </button>
                      <button id="btn-layer-down" class="sel-tool-btn" type="button" title="Переместить модуль на 1 слой назад" disabled>
                        <span class="tool-icon">▼</span> Слой -1
                      </button>
                      <button id="btn-rotate-45" class="sel-tool-btn" type="button" title="Повернуть модуль на 45 градусов" disabled>
                        <span class="tool-icon">⟳</span> +45°
                      </button>
                      <button id="btn-rotate-90" class="sel-tool-btn" type="button" title="Повернуть модуль на 90 градусов" disabled>
                        <span class="tool-icon">↷</span> +90°
                      </button>
                      <button id="btn-flip-x" class="sel-tool-btn" type="button" title="Отразить модуль по горизонтали" disabled>
                        <span class="tool-icon">⇄</span> Отразить
                      </button>
                      <button id="btn-delete-selected" class="sel-tool-btn btn-danger" type="button" title="Удалить выбранный модуль" disabled>
                        <span class="tool-icon">✕</span> Удалить
                      </button>
                    </div>
                  </div>
                </div>

                <!-- 3. БЛОК С КОРАБЛЕМ (СВЕРХУ НАДПИСЬ, В ЦЕНТРЕ АНГАР, СНИЗУ КНОПКИ) -->
                <div class="hangar-ship-column">
                  <!-- Заметная выделенная надпись над блоком с кораблем -->
                  <div class="shipyard-field-prompt">
                    <span class="prompt-icon">🚀</span>
                    <span class="prompt-text">Создай свой корабль, перемещая его части в это поле</span>
                  </div>

                  <!-- Просторное специальное окно сбора корабля с тактической сеткой -->
                  <div class="shipyard-center-bay" id="shipyard-center-bay" role="region" aria-label="Отсек сборки корабля">
                    <div class="hangar-grid-lines"></div>
                    <div class="hangar-reticle"></div>
                    <span class="corner-bracket corner-tl"></span>
                    <span class="corner-bracket corner-tr"></span>
                    <span class="corner-bracket corner-bl"></span>
                    <span class="corner-bracket corner-br"></span>

                    <!-- Плейсхолдер при пустом отсеке -->
                    <div class="hangar-empty-hint" id="hangar-empty-hint">
                      <div class="hangar-ghost-silhouette">
                        <svg viewBox="0 0 100 100" class="ghost-ship-svg">
                          <polygon points="50,15 65,40 60,82 50,75 40,82 35,40" fill="none" stroke="rgba(52,211,153,0.3)" stroke-width="1.5" stroke-dasharray="4 3"/>
                          <polygon points="50,25 58,45 50,65 42,45" fill="none" stroke="rgba(16,185,129,0.35)" stroke-width="1.2"/>
                          <line x1="20" y1="50" x2="80" y2="50" stroke="rgba(52,211,153,0.2)" stroke-dasharray="2 3"/>
                          <line x1="50" y1="20" x2="50" y2="80" stroke="rgba(52,211,153,0.2)" stroke-dasharray="2 3"/>
                        </svg>
                      </div>
                      <span class="hangar-hint-text">ПЕРЕТАЩИТЕ МОДУЛИ В АНГАР</span>
                      <span class="hangar-hint-sub">1 Корпус, 1 Кабина, 2 Крыла, 1 Двигатель, до 2 Пушек</span>
                    </div>

                    <!-- Поверхность для размещения сброшенных деталей -->
                    <div class="hangar-drop-surface" id="hangar-drop-surface"></div>
                  </div>

                  <!-- Панель управления отсеком -->
                  <div class="hangar-controls-bar">
                    <button id="shipyard-btn-preset" class="hangar-tool-btn btn-preset" type="button" title="Загрузить готовую сбалансированную сборку корабля">
                      ⚡ БАЗОВЫЙ СБОР
                    </button>
                    <button id="shipyard-btn-clear" class="hangar-tool-btn" type="button" title="Очистить все детали из отсека сборки">
                      ✕ ОЧИСТИТЬ ВСЕ
                    </button>
                    <div id="shipyard-parts-counter" class="hangar-parts-counter">
                      ДЕТАЛЕЙ: 0 / 7
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </section>

        </div>

        <!-- Нижняя панель действий -->
        <footer class="shipyard-footer">
          <div class="footer-left">
            <button id="shipyard-btn-menu-bottom" class="shipyard-action-btn btn-secondary" type="button">
              В ГЛАВНОЕ МЕНЮ
            </button>
          </div>
          <div class="footer-right">
            <button id="shipyard-btn-launch-bottom" class="shipyard-action-btn btn-launch-big" type="button">
              <span class="btn-glow-pulse"></span>
              <span class="btn-main-text">В БОЙ // ЗАПУСК СИСТЕМ</span>
            </button>
          </div>
        </footer>
      </div>
    `;

    this.container.appendChild(modal);

    this.modalEl = modal;
    this.centerBayEl = modal.querySelector('#shipyard-center-bay') as HTMLElement;
    this.categoriesListEl = modal.querySelector('#shipyard-categories-list') as HTMLElement;
    this.subfoldersColEl = modal.querySelector('#col-subfolders') as HTMLElement;
    this.subfoldersTagEl = modal.querySelector('#subfolders-head-tag') as HTMLElement;
    this.subfoldersListEl = modal.querySelector('#shipyard-subfolders-list') as HTMLElement;
    this.partsColEl = modal.querySelector('#col-parts') as HTMLElement;
    this.partsTagEl = modal.querySelector('#parts-head-tag') as HTMLElement;
    this.partsGridEl = modal.querySelector('#shipyard-parts-grid') as HTMLElement;
    this.partsCounterEl = modal.querySelector('#shipyard-parts-counter') as HTMLElement;
    this.limitsGridEl = modal.querySelector('#hangar-limits-grid') as HTMLElement;
    this.alertToastEl = modal.querySelector('#shipyard-alert-toast') as HTMLElement;
    this.alertMsgEl = modal.querySelector('#shipyard-alert-msg') as HTMLElement;
    this.selectedToolbarEl = modal.querySelector('#selected-module-toolbar') as HTMLElement;
    this.scrapValEl = modal.querySelector('#shipyard-scrap-val') as HTMLElement;

    this.btnLayerUp = modal.querySelector('#btn-layer-up') as HTMLButtonElement;
    this.btnLayerDown = modal.querySelector('#btn-layer-down') as HTMLButtonElement;
    this.btnRotate45 = modal.querySelector('#btn-rotate-45') as HTMLButtonElement;
    this.btnRotate90 = modal.querySelector('#btn-rotate-90') as HTMLButtonElement;
    this.btnFlipX = modal.querySelector('#btn-flip-x') as HTMLButtonElement;
    this.btnDeleteSelected = modal.querySelector('#btn-delete-selected') as HTMLButtonElement;
  }

  private bindEvents(): void {
    // 1. Кнопки запуска боя ("В БОЙ") с валидацией связности деталей
    const launchBtns = [
      this.modalEl.querySelector('#shipyard-btn-launch-top'),
      this.modalEl.querySelector('#shipyard-btn-launch-bottom'),
    ];
    launchBtns.forEach((btn) => {
      btn?.addEventListener('click', () => {
        this.tryLaunch();
      });
    });

    // 2. Кнопки возврата в меню
    const menuBtns = [
      this.modalEl.querySelector('#shipyard-btn-menu-top'),
      this.modalEl.querySelector('#shipyard-btn-menu-bottom'),
    ];
    menuBtns.forEach((btn) => {
      btn?.addEventListener('click', () => {
        soundFx.playUiClick();
        this.close();
        if (this.onReturnToMenu) this.onReturnToMenu();
      });
    });

    // 3. Кнопка загрузки базовой готовой сборки корабля
    const presetBtn = this.modalEl.querySelector('#shipyard-btn-preset');
    presetBtn?.addEventListener('click', () => {
      soundFx.playUpgradeSelect();
      this.loadDefaultShipPreset();
    });

    // 4. Кнопка очистки всех деталей
    const clearBtn = this.modalEl.querySelector('#shipyard-btn-clear');
    clearBtn?.addEventListener('click', () => {
      soundFx.playUiClick();
      this.clearAllDroppedParts();
    });

    // 4. Кнопки панели управления выбранным модулем:
    // Слой вперед
    this.btnLayerUp.addEventListener('click', () => {
      soundFx.playUiClick();
      this.moveSelectedLayer(1);
    });

    // Слой назад
    this.btnLayerDown.addEventListener('click', () => {
      soundFx.playUiClick();
      this.moveSelectedLayer(-1);
    });

    // Поворот на 45 градусов
    this.btnRotate45.addEventListener('click', () => {
      soundFx.playUiClick();
      this.rotateSelected(45);
    });

    // Поворот на 90 градусов
    this.btnRotate90.addEventListener('click', () => {
      soundFx.playUiClick();
      this.rotateSelected(90);
    });

    // Отражение по горизонтали
    this.btnFlipX.addEventListener('click', () => {
      soundFx.playUiClick();
      this.flipSelectedX();
    });

    // Удаление выбранного модуля
    this.btnDeleteSelected.addEventListener('click', () => {
      if (this.selectedPartUid) {
        this.removeDroppedPart(this.selectedPartUid);
      }
    });

    // Клик по свободной области ангара для сброса выделения
    this.centerBayEl.addEventListener('pointerdown', (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropped-part-item') && !target.closest('.selected-module-toolbar')) {
        this.selectPart(null);
      }
    });

    // 5. HTML5 Drag & Drop для центрального отсека
    this.centerBayEl.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      this.centerBayEl.classList.add('drag-active');
    });

    this.centerBayEl.addEventListener('dragleave', (e: DragEvent) => {
      const related = e.relatedTarget as Node | null;
      if (!this.centerBayEl.contains(related)) {
        this.centerBayEl.classList.remove('drag-active');
      }
    });

    this.centerBayEl.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      this.centerBayEl.classList.remove('drag-active');

      const dataStr = e.dataTransfer?.getData('application/json');
      if (!dataStr) return;

      try {
        const part = JSON.parse(dataStr) as PartItem;
        const rect = this.centerBayEl.getBoundingClientRect();
        const dropX = e.clientX - rect.left;
        const dropY = e.clientY - rect.top;

        this.tryAddPart(part, dropX, dropY);
      } catch (err) {
        console.error('Ошибка добавления детали в ангар:', err);
      }
    });

    // 6. Глобальные Pointer / Touch события для перемещения
    window.addEventListener('pointermove', this.handleGlobalPointerMove);
    window.addEventListener('pointerup', this.handleGlobalPointerUp);
    window.addEventListener('pointercancel', this.handleGlobalPointerUp);
  }

  /**
   * Проверка лимитов на установку:
   * 1 Корпус, 1 Кабина, 2 Крыла, 1 Двигатель, 1 Пушка
   */
  public getCategoryCount(catId: string): number {
    return this.droppedParts.filter((p) => p.part.category === catId).length;
  }

  public canAddCategoryPart(catId: string): boolean {
    const limitCfg = CATEGORY_LIMITS[catId];
    if (!limitCfg) return true;
    return this.getCategoryCount(catId) < limitCfg.max;
  }

  /**
   * Попытка добавления детали с проверкой лимита и разблокировки
   */
  public tryAddPart(part: PartItem, x: number, y: number): boolean {
    const catId = part.category;
    const limitCfg = CATEGORY_LIMITS[catId];

    // 1. Проверка разблокировки модуля
    const mod = getModuleByPartId(part.id);
    if (mod && !campaignManager.isModuleUnlocked(mod.id)) {
      soundFx.playHit();
      const isAvailable = campaignManager.isModuleAvailableForPurchase(mod.id);
      if (isAvailable) {
        this.showAlert(`🛒 ДЕТАЛЬ НЕ КУПЛЕНА: нажмите «КУПИТЬ» (${mod.price} ⚙)`);
      } else {
        const reqStage = mod.tier === 3 ? '2-5' : '1-5';
        this.showAlert(`🔒 ДЕТАЛЬ НЕДОСТУПНА: завершите этап ${reqStage} для открытия покупки!`);
      }
      return false;
    }

    // 2. Проверка лимита категории
    if (!this.canAddCategoryPart(catId)) {
      soundFx.playHit();
      this.showAlert(
        `ЛИМИТ ИСЧЕРПАН: ${limitCfg?.title.toUpperCase() || catId.toUpperCase()} (МАКС: ${limitCfg?.max || 1}). УДАЛИТЕ ДЕТАЛЬ ДЛЯ ЗАМЕНЫ!`
      );
      return false;
    }

    this.addDroppedPart(part, x, y);
    soundFx.playUpgradeSelect();
    return true;
  }

  /**
   * Отображение тактического уведомления о лимитах
   */
  private showAlert(message: string): void {
    if (this.alertTimer !== null) {
      window.clearTimeout(this.alertTimer);
      this.alertTimer = null;
    }

    if (this.alertMsgEl) this.alertMsgEl.textContent = message;
    if (this.alertToastEl) {
      this.alertToastEl.classList.remove('hidden');
      void this.alertToastEl.offsetWidth; // Reflow
      this.alertToastEl.classList.add('pulse');
    }

    this.alertTimer = window.setTimeout(() => {
      this.alertToastEl?.classList.add('hidden');
      this.alertToastEl?.classList.remove('pulse');
      this.alertTimer = null;
    }, 2800);
  }

  /**
   * Загрузка стандартной сбалансированной сборки корабля:
   * 1 Корпус, 1 Кабина, 2 Крыла, 1 Двигатель, 1 Пушка
   */
  public loadDefaultShipPreset(): void {
    this.clearAllDroppedParts();

    const findPart = (catId: string): PartItem | null => {
      const cat = this.catalog.find((c) => c.id === catId);
      if (!cat) return null;
      if (cat.directItems.length > 0) return cat.directItems[0];
      if (cat.folders.length > 0 && cat.folders[0].items.length > 0) return cat.folders[0].items[0];
      return null;
    };

    const bodyPart = this.findPartById('body_black_spaceParts_047') || findPart('body');
    const pilotPart = this.findPartById('pilot_black_spaceParts_054') || findPart('pilot');
    const wingsPart = this.findPartById('wings_blue_spaceParts_010') || findPart('wings');
    const enginesPart = this.findPartById('engines_0') || findPart('engines');
    const gunsPart = this.findPartById('guns_0') || findPart('guns');

    const bayRect = this.centerBayEl ? this.centerBayEl.getBoundingClientRect() : null;
    const cx = bayRect && bayRect.width > 0 ? bayRect.width / 2 : 200;
    const cy = bayRect && bayRect.height > 0 ? bayRect.height / 2 : 200;

    // 1. Корпус (центр)
    if (bodyPart) {
      this.droppedParts.push({
        uid: 'preset_body_' + Math.random().toString(36).substr(2, 6),
        part: bodyPart,
        x: cx,
        y: cy,
        zIndex: 1,
        rotation: 0,
        flipX: false,
        width: 70,
        height: 70,
      });
    }

    // 2. Двигатель (снизу)
    if (enginesPart) {
      this.droppedParts.push({
        uid: 'preset_engine_' + Math.random().toString(36).substr(2, 6),
        part: enginesPart,
        x: cx,
        y: cy + 38,
        zIndex: 2,
        rotation: 0,
        flipX: false,
        width: 70,
        height: 70,
      });
    }

    // 3. Крылья левое и правое
    if (wingsPart) {
      this.droppedParts.push({
        uid: 'preset_wing_l_' + Math.random().toString(36).substr(2, 6),
        part: wingsPart,
        x: cx - 44,
        y: cy + 4,
        zIndex: 2,
        rotation: 0,
        flipX: false,
        width: 70,
        height: 70,
      });
      this.droppedParts.push({
        uid: 'preset_wing_r_' + Math.random().toString(36).substr(2, 6),
        part: wingsPart,
        x: cx + 44,
        y: cy + 4,
        zIndex: 2,
        rotation: 0,
        flipX: true,
        width: 70,
        height: 70,
      });
    }

    // 4. Кабина (сверху корпуса)
    if (pilotPart) {
      this.droppedParts.push({
        uid: 'preset_pilot_' + Math.random().toString(36).substr(2, 6),
        part: pilotPart,
        x: cx,
        y: cy - 36,
        zIndex: 3,
        rotation: 0,
        flipX: false,
        width: 70,
        height: 70,
      });
    }

    // 5. Пушка (на носу)
    if (gunsPart) {
      this.droppedParts.push({
        uid: 'preset_gun_' + Math.random().toString(36).substr(2, 6),
        part: gunsPart,
        x: cx,
        y: cy - 64,
        zIndex: 4,
        rotation: 0,
        flipX: false,
        width: 70,
        height: 70,
      });
    }

    const first = this.droppedParts[0];
    if (first) {
      this.selectedPartUid = first.uid;
    }
    this.renderLimitsGrid();
    this.renderCategoriesColumn();
    this.renderDroppedParts();
    this.updateSelectedToolbar();
    this.persistAssembly();
  }

  /**
   * Проверка связности/цельности корабля:
   * Все детали должны пересекаться или соприкасаться между собой, образуя единое целое.
   */
  public validateShipCohesion(): CohesionValidationResult {
    const parts = this.droppedParts;
    if (parts.length === 0) {
      return {
        isValid: false,
        errorMessage: 'АНГАР ПУСТ! Установите модули для сборки корабля перед вылетом в бой.',
        disconnectedUids: [],
      };
    }

    // 1. Проверяем наличие хотя бы одного базового несущего модуля (корпус или кабина)
    const hasCore = parts.some(
      (p) => p.part.category === 'body' || p.part.category === 'pilot'
    );
    if (!hasCore && parts.length > 1) {
      return {
        isValid: false,
        errorMessage: 'КОРАБЛЮ НУЖЕН КОРПУС ИЛИ КАБИНА! Установите центральный несущий модуль.',
        disconnectedUids: [],
      };
    }

    if (parts.length === 1) {
      return { isValid: true };
    }

    // 2. Функция проверки пересечения или касания двух деталей
    const doPartsIntersect = (a: DroppedPartInstance, b: DroppedPartInstance): boolean => {
      const margin = 12; // Допуск в пикселях для мягкого касания
      const getHalfBounds = (p: DroppedPartInstance) => {
        const rad = (p.rotation * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const baseW = 60;
        const baseH = 60;
        return {
          hw: (baseW * cos + baseH * sin) / 2 + margin,
          hh: (baseW * sin + baseH * cos) / 2 + margin,
        };
      };

      const bA = getHalfBounds(a);
      const bB = getHalfBounds(b);

      const overlapX = Math.abs(a.x - b.x) <= bA.hw + bB.hw;
      const overlapY = Math.abs(a.y - b.y) <= bA.hh + bB.hh;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const radialTouch = dist <= 74;

      return (overlapX && overlapY) || radialTouch;
    };

    // 3. Построение графа связности
    const n = parts.length;
    const adj: number[][] = Array.from({ length: n }, () => []);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (doPartsIntersect(parts[i], parts[j])) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }

    // 4. Поиск центрального узла для старта обхода (предпочтительно корпус, затем кабина)
    let startIndex = parts.findIndex((p) => p.part.category === 'body');
    if (startIndex === -1) {
      startIndex = parts.findIndex((p) => p.part.category === 'pilot');
    }
    if (startIndex === -1) {
      startIndex = 0;
    }

    // 5. BFS обход графа связности
    const visited = new Set<number>();
    const queue: number[] = [startIndex];
    visited.add(startIndex);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const neighbor of adj[curr]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // 6. Если все детали соединены в единую конструкцию
    if (visited.size === n) {
      return { isValid: true };
    }

    // 7. Если есть изолированные части
    const disconnectedUids = parts
      .filter((_, idx) => !visited.has(idx))
      .map((p) => p.uid);

    return {
      isValid: false,
      errorMessage:
        'КОНСТРУКЦИЯ НЕ ЦЕЛЬНА! Все детали корабля должны соприкасаться между собой (обнаружены оторванные модули).',
      disconnectedUids,
    };
  }

  /**
   * Подсветка отсоединенных модулей красным контуром
   */
  public markDisconnectedParts(uids: string[]): void {
    this.clearDisconnectedMarks();
    uids.forEach((uid) => {
      const el = this.modalEl.querySelector(`#dropped-${uid}`);
      if (el) {
        el.classList.add('disconnected');
      }
    });
  }

  /**
   * Снятие красной подсветки отсоединенных модулей
   */
  public clearDisconnectedMarks(): void {
    const els = this.modalEl.querySelectorAll('.dropped-part-item.disconnected');
    els.forEach((el) => el.classList.remove('disconnected'));
  }

  /**
   * Получение экспортируемой модели сборки для передачи в Phaser
   */
  public getShipAssembly(): CustomShipAssembly {
    const parts = this.droppedParts;
    if (parts.length === 0) {
      return {
        modules: [],
        bounds: { width: 70, height: 70 },
        engineOffsets: [],
        gunOffsets: [],
      };
    }

    // Якорная точка (центр сборки)
    let anchorX = 0;
    let anchorY = 0;
    const bodyPart = parts.find((p) => p.part.category === 'body');
    const pilotPart = parts.find((p) => p.part.category === 'pilot');

    if (bodyPart) {
      anchorX = bodyPart.x;
      anchorY = bodyPart.y;
    } else if (pilotPart) {
      anchorX = pilotPart.x;
      anchorY = pilotPart.y;
    } else {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      parts.forEach((p) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      });
      anchorX = (minX + maxX) / 2;
      anchorY = (minY + maxY) / 2;
    }

    const scale = 0.5;
    const modules: CustomShipModule[] = [];
    const engineOffsets: Array<{ x: number; y: number; angleOffset: number }> = [];
    const gunOffsets: Array<{ x: number; y: number; angleOffset: number }> = [];

    parts.forEach((p) => {
      const offsetX = (p.x - anchorX) * scale;
      const offsetY = (p.y - anchorY) * scale;

      modules.push({
        id: p.uid,
        category: p.part.category,
        textureKey: p.part.id,
        url: p.part.url,
        offsetX,
        offsetY,
        rotationDeg: p.rotation,
        flipX: p.flipX,
        zIndex: p.zIndex,
      });

      if (p.part.category === 'engines') {
        const rad = (p.rotation * Math.PI) / 180;
        const nozzleLocalY = 18 * scale;
        const nozzleRelX = -Math.sin(rad) * nozzleLocalY;
        const nozzleRelY = Math.cos(rad) * nozzleLocalY;
        engineOffsets.push({
          x: offsetX + nozzleRelX,
          y: offsetY + nozzleRelY,
          angleOffset: p.rotation,
        });
      }

      if (p.part.category === 'guns') {
        const rad = (p.rotation * Math.PI) / 180;
        const muzzleLocalY = -20 * scale;
        const muzzleRelX = -Math.sin(rad) * muzzleLocalY;
        const muzzleRelY = Math.cos(rad) * muzzleLocalY;
        gunOffsets.push({
          x: offsetX + muzzleRelX,
          y: offsetY + muzzleRelY,
          angleOffset: p.rotation,
        });
      }
    });

    return {
      modules,
      bounds: { width: 100, height: 100 },
      engineOffsets,
      gunOffsets,
    };
  }

  /**
   * Запуск боевого вылета с валидацией связности/цельности корабля
   */
  public tryLaunch(): boolean {
    const check = this.validateShipCohesion();
    if (!check.isValid) {
      soundFx.playHit();
      this.showAlert(check.errorMessage || 'КОРАБЛЬ НЕ ЦЕЛЬНЫЙ!');
      if (check.disconnectedUids && check.disconnectedUids.length > 0) {
        this.markDisconnectedParts(check.disconnectedUids);
      }
      return false;
    }

    this.clearDisconnectedMarks();
    soundFx.playUiClick();
    const assembly = this.getShipAssembly();
    this.close();
    if (this.onLaunch) {
      this.onLaunch(assembly);
    }
    return true;
  }

  /**
   * Открытие модального окна
   */
  public open(): void {
    this.modalEl.classList.remove('hidden');
    const flowEl = this.modalEl.querySelector('#shipyard-columns-flow');
    if (flowEl) flowEl.scrollLeft = 0;
    this.updateScrapDisplay();
    this.render();
  }

  /**
   * Закрытие модального окна
   */
  public close(): void {
    this.modalEl.classList.add('hidden');
    this.cleanupTouchGhost();
    this.isMovingDroppedPart = false;
    this.movingPartUid = null;
  }

  public isOpen(): boolean {
    return !this.modalEl.classList.contains('hidden');
  }

  /**
   * Обновление отображения баланса лома в шапке
   */
  public updateScrapDisplay(): void {
    if (this.scrapValEl) {
      const balance = campaignManager.getScrapBalance();
      this.scrapValEl.textContent = balance.toLocaleString('ru-RU');
    }
  }

  /**
   * Полный рендеринг интерфейса
   */
  private render(): void {
    this.updateScrapDisplay();
    this.renderCategoriesColumn();
    this.renderSubfoldersAndParts();
    this.renderLimitsGrid();
    this.renderDroppedParts();
    this.updateSelectedToolbar();
  }

  /**
   * Рендеринг тактических индикаторов лимитов:
   * Кабина 0/1, Корпус 0/1, Крылья 0/2, Двигатели 0/1, Пушки 0/1
   */
  private renderLimitsGrid(): void {
    if (!this.limitsGridEl) return;
    this.limitsGridEl.innerHTML = '';

    const catOrder = ['body', 'pilot', 'wings', 'engines', 'guns'];

    catOrder.forEach((catId) => {
      const cfg = CATEGORY_LIMITS[catId];
      if (!cfg) return;

      const current = this.getCategoryCount(catId);
      const isFull = current >= cfg.max;
      const badge = document.createElement('div');
      badge.className = `limit-chip ${isFull ? 'full' : 'available'}`;
      badge.setAttribute('title', `${cfg.title}: установлено ${current} из ${cfg.max}`);

      badge.innerHTML = `
        <div class="limit-chip-left">
          <span class="limit-icon">${cfg.icon}</span>
          <span class="limit-label">${cfg.title}</span>
        </div>
        <div class="limit-chip-right">
          <span class="limit-val ${isFull ? 'full-val' : ''}">${current}/${cfg.max}</span>
          ${isFull ? '<span class="limit-check">✓</span>' : ''}
        </div>
      `;

      this.limitsGridEl.appendChild(badge);
    });

    if (this.partsCounterEl) {
      const total = this.droppedParts.length;
      this.partsCounterEl.textContent = `ДЕТАЛЕЙ: ${total} / 7`;
    }
  }

  /**
   * 1. РЕНДЕРИНГ ЛЕВОГО СТОЛБЦА: МОДУЛИ (Кабина, Тело, Крылья, Двигатели, Пушки)
   */
  private renderCategoriesColumn(): void {
    this.categoriesListEl.innerHTML = '';

    this.catalog.forEach((cat) => {
      const btn = document.createElement('button');
      const isActive = cat.id === this.activeCategoryId;
      const count = this.getCategoryCount(cat.id);
      const limit = CATEGORY_LIMITS[cat.id]?.max || 1;
      const isFull = count >= limit;

      btn.className = `category-col-btn ${isActive ? 'active' : ''} ${isFull ? 'category-full' : ''}`;
      btn.type = 'button';
      btn.setAttribute('data-category', cat.id);

      btn.innerHTML = `
        <div class="col-btn-inner">
          <div class="cat-icon-box">${cat.iconSvg}</div>
          <div class="cat-text-box">
            <span class="cat-title">${cat.title}</span>
            <span class="cat-count-badge ${isFull ? 'badge-full' : ''}">${count}/${limit}</span>
          </div>
          <span class="active-chevron">▶</span>
        </div>
      `;

      btn.addEventListener('mouseenter', () => soundFx.playUiHover());

      btn.addEventListener('click', () => {
        soundFx.playUiClick();
        this.selectCategory(cat.id);
      });

      this.categoriesListEl.appendChild(btn);
    });
  }

  /**
   * Выбор категории в первом столбце
   */
  private selectCategory(categoryId: string): void {
    this.activeCategoryId = categoryId;
    this.activeRarityFilter = 'all';

    this.renderCategoriesColumn();
    this.renderSubfoldersAndParts();

    const flowEl = this.modalEl.querySelector('#shipyard-columns-flow');
    if (flowEl) flowEl.scrollLeft = 0;
  }

  /**
   * 2 & 3. РЕНДЕРИНГ СТОЛБЦА ПОДПАПОК И СТОЛБЦА ДЕТАЛЕЙ
   * Все 3 колонки (МОДУЛИ, РАЗДЕЛЕНИЕ, ДЕТАЛИ) всегда одновременно видны!
   */
  private renderSubfoldersAndParts(): void {
    const activeCat = this.catalog.find((c) => c.id === this.activeCategoryId);
    if (!activeCat) return;

    const items = activeCat.directItems;
    const commonCount = items.filter((p) => {
      const m = getModuleByPartId(p.id);
      return getModuleRarity(m).type === 'common';
    }).length;
    const rareCount = items.filter((p) => {
      const m = getModuleByPartId(p.id);
      return getModuleRarity(m).type === 'rare';
    }).length;
    const legendaryCount = items.filter((p) => {
      const m = getModuleByPartId(p.id);
      return getModuleRarity(m).type === 'legendary';
    }).length;

    // Столбец 2: Разделение по редкости (Все / Обычные / Редкие / Легендарные)
    this.subfoldersColEl.style.display = 'flex';
    this.subfoldersTagEl.textContent = `02 // РАЗДЕЛЕНИЕ`;
    this.subfoldersListEl.innerHTML = '';

    const filterOptions: Array<{
      id: 'all' | 'common' | 'rare' | 'legendary';
      name: string;
      icon: string;
      count: number;
      color?: string;
    }> = [
      { id: 'all', name: 'Все детали', icon: '📂', count: items.length },
      { id: 'common', name: 'Обычные', icon: '⚪', count: commonCount, color: '#94a3b8' },
      { id: 'rare', name: 'Редкие', icon: '🟡', count: rareCount, color: '#facc15' },
      { id: 'legendary', name: 'Легендарные', icon: '🔴', count: legendaryCount, color: '#ef4444' },
    ];

    filterOptions.forEach((opt) => {
      const btn = document.createElement('button');
      const isSelected = this.activeRarityFilter === opt.id;
      btn.className = `subfolder-col-btn ${isSelected ? 'active' : ''}`;
      btn.type = 'button';

      btn.innerHTML = `
        <div class="subfolder-btn-inner">
          <span class="subfolder-icon" ${opt.color ? `style="color: ${opt.color};"` : ''}>${opt.icon}</span>
          <div class="subfolder-text-wrap">
            <span class="subfolder-name" ${isSelected && opt.color ? `style="color: ${opt.color};"` : ''}>${opt.name}</span>
            <span class="subfolder-count">${opt.count} дет.</span>
          </div>
          <span class="active-chevron">▶</span>
        </div>
      `;

      btn.addEventListener('mouseenter', () => soundFx.playUiHover());
      btn.addEventListener('click', () => {
        soundFx.playUiClick();
        this.activeRarityFilter = opt.id;
        this.renderSubfoldersAndParts();
      });

      this.subfoldersListEl.appendChild(btn);
    });

    // Столбец 3: Сетка деталей
    this.partsColEl.style.display = 'flex';
    this.partsTagEl.textContent = `03 // ${activeCat.title.toUpperCase()} (${items.length})`;
    this.renderPartsGrid(items);

    const flowEl = this.modalEl.querySelector('#shipyard-columns-flow');
    if (flowEl) flowEl.scrollLeft = 0;
  }

  /**
   * Создание карточки отдельного модуля с учетом его редкости, характеристик и цены.
   * При открытии новых частей корабля (1-5 для редких, 2-5 для легендарных)
   * они становятся доступны для ПОКУПКИ за металлолом.
   */
  private createPartCard(part: PartItem): HTMLElement {
    const mod = getModuleByPartId(part.id);
    const isUnlocked = mod ? campaignManager.isModuleUnlocked(mod.id) : true;
    const isAvailable = mod ? campaignManager.isModuleAvailableForPurchase(mod.id) : true;
    const displayName = mod ? mod.name : part.name;
    const rarity = getModuleRarity(mod);
    const statsLines = getModuleStatsLines(mod, part.category);
    const price = mod?.price ?? 50;
    const scrapBalance = campaignManager.getScrapBalance();
    const canAfford = scrapBalance >= price;
    const reqStage = mod?.tier === 3 ? '2-5' : '1-5';

    const card = document.createElement('div');
    const statusClass = isUnlocked
      ? 'part-card-owned'
      : isAvailable
      ? 'part-card-purchasable'
      : 'part-card-locked';
    card.className = `part-card rarity-${rarity.type} ${statusClass}`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('data-rarity', rarity.type);

    const statsHtml = `
      <div class="part-stats-list">
        ${statsLines.map((line) => `<span class="stat-line">${line}</span>`).join('')}
      </div>
    `;

    if (isUnlocked) {
      // 1. Деталь куплена и находится в арсенале: доступна для установки и перетаскивания
      card.setAttribute('draggable', 'true');
      card.setAttribute('title', `${displayName} [${rarity.title}] // В арсенале`);

      card.innerHTML = `
        <div class="part-card-inner">
          <div class="part-preview-wrap">
            <img src="${part.url}" alt="${displayName}" class="part-preview-img" loading="lazy" draggable="false" />
          </div>
          <div class="part-meta">
            <span class="part-name-tag" title="${displayName}">${displayName}</span>
            ${statsHtml}
            <div class="part-price-block part-price-owned">
              <span class="part-price-val"><span class="price-icon">⚙</span> ${price}</span>
              <span class="part-status-badge owned">✓ В АРСЕНАЛЕ</span>
            </div>
          </div>
        </div>
      `;

      card.addEventListener('mouseenter', () => soundFx.playUiHover());

      // Быстрый клик для добавления
      card.addEventListener('click', () => {
        if (this.hasMovedSignificantly) return;
        const bayRect = this.centerBayEl.getBoundingClientRect();
        const dropX = bayRect.width > 0 ? bayRect.width / 2 + (Math.random() * 30 - 15) : 200;
        const dropY = bayRect.height > 0 ? bayRect.height / 2 + (Math.random() * 30 - 15) : 200;
        this.tryAddPart(part, dropX, dropY);
      });

      // HTML5 DragStart
      card.addEventListener('dragstart', (e: DragEvent) => {
        soundFx.playUiHover();
        if (e.dataTransfer) {
          e.dataTransfer.setData('application/json', JSON.stringify(part));
          e.dataTransfer.effectAllowed = 'copy';
        }
      });

      // Pointer / Touch Down
      card.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        this.startPointerDrag(part, e);
      });
    } else if (isAvailable) {
      // 2. Деталь открыта для покупки (пройден 1-5 для редких или 2-5 для легендарных)
      card.setAttribute('draggable', 'false');
      card.setAttribute('title', `${displayName} [${rarity.title}] // 🛒 Доступно для покупки: ${price} ⚙`);

      card.innerHTML = `
        <div class="part-card-inner">
          <div class="part-preview-wrap">
            <img src="${part.url}" alt="${displayName}" class="part-preview-img" loading="lazy" draggable="false" />
            <div class="part-shop-badge" title="Доступно для покупки!">🛒</div>
          </div>
          <div class="part-meta">
            <span class="part-name-tag" title="${displayName}">${displayName}</span>
            ${statsHtml}
            <div class="part-price-block part-price-shop">
              <span class="part-price-val ${canAfford ? 'can-afford' : 'cannot-afford'}">
                <span class="price-icon">⚙</span> ${price}
              </span>
              <button class="part-buy-btn ${canAfford ? 'can-afford' : 'cannot-afford'}" type="button" title="Купить ${displayName} за ${price} лома">
                ${canAfford ? 'КУПИТЬ' : 'МАЛО ⚙'}
              </button>
            </div>
          </div>
        </div>
      `;

      const performPurchase = () => {
        if (!mod) return;
        const res = campaignManager.buyModule(mod.id);
        if (res.success) {
          soundFx.playUpgradeSelect();
          this.updateScrapDisplay();
          this.showAlert(`✅ КУПЛЕНО: ${displayName.toUpperCase()} ЗА ${price} ⚙!`);
          this.render();
        } else if (res.reason === 'INSUFFICIENT_SCRAP') {
          soundFx.playHit();
          this.showAlert(`⚠️ НЕДОСТАТОЧНО ЛОМА: ТРЕБУЕТСЯ ${price} ⚙ (У ВАС ${campaignManager.getScrapBalance()} ⚙)`);
        } else {
          soundFx.playHit();
          this.showAlert(`🔒 ДЕТАЛЬ НЕДОСТУПНА`);
        }
      };

      card.addEventListener('mouseenter', () => soundFx.playUiHover());
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        performPurchase();
      });

      const buyBtn = card.querySelector('.part-buy-btn') as HTMLButtonElement | null;
      if (buyBtn) {
        buyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          performPurchase();
        });
      }

      card.addEventListener('dragstart', (e: DragEvent) => {
        e.preventDefault();
        soundFx.playHit();
        this.showAlert(`🛒 СНАЧАЛА КУПИТЕ ДЕТАЛЬ: нажмите «КУПИТЬ» (${price} ⚙)`);
      });
    } else {
      // 3. Деталь еще заблокирована прогрессом этапов кампании
      card.setAttribute('draggable', 'false');
      card.setAttribute('title', `${displayName} // 🔒 Доступно после этапа ${reqStage}`);

      card.innerHTML = `
        <div class="part-card-inner">
          <div class="part-preview-wrap">
            <img src="${part.url}" alt="${displayName}" class="part-preview-img part-locked-img" loading="lazy" draggable="false" />
            <div class="part-lock-overlay">
              <span class="lock-icon">🔒</span>
            </div>
          </div>
          <div class="part-meta">
            <span class="part-name-tag" title="${displayName}">${displayName}</span>
            ${statsHtml}
            <div class="part-price-block part-price-locked">
              <span class="part-price-val locked"><span class="price-icon">⚙</span> ${price}</span>
              <span class="part-status-badge stage-locked">🔒 ЭТАП ${reqStage}</span>
            </div>
          </div>
        </div>
      `;

      card.addEventListener('mouseenter', () => soundFx.playUiHover());
      card.addEventListener('click', () => {
        soundFx.playHit();
        this.showAlert(`🔒 ДЕТАЛЬ НЕДОСТУПНА: завершите этап ${reqStage} для открытия покупки!`);
      });
      card.addEventListener('dragstart', (e: DragEvent) => {
        e.preventDefault();
        soundFx.playHit();
        this.showAlert(`🔒 ДЕТАЛЬ НЕДОСТУПНА: завершите этап ${reqStage} для открытия покупки!`);
      });
    }

    return card;
  }

  /**
   * Рендеринг карточек деталей в 3 колонки (по редкости: Обычный, Редкий, Легендарный)
   * с плавной вертикальной прокруткой мышью и пальцем
   */
  private renderPartsGrid(items: PartItem[]): void {
    this.partsGridEl.innerHTML = '';

    const commonItems: PartItem[] = [];
    const rareItems: PartItem[] = [];
    const legendaryItems: PartItem[] = [];

    items.forEach((part) => {
      const mod = getModuleByPartId(part.id);
      const rarity = getModuleRarity(mod);
      if (rarity.type === 'common') {
        commonItems.push(part);
      } else if (rarity.type === 'rare') {
        rareItems.push(part);
      } else {
        legendaryItems.push(part);
      }
    });

    const lanesContainer = document.createElement('div');
    lanesContainer.className = 'rarity-lanes-container';

    let lanesData = [
      { type: 'common', title: 'ОБЫЧНЫЕ', color: '#94a3b8', items: commonItems },
      { type: 'rare', title: 'РЕДКИЕ', color: '#facc15', items: rareItems },
      { type: 'legendary', title: 'ЛЕГЕНДАРНЫЕ', color: '#ef4444', items: legendaryItems },
    ];

    if (this.activeRarityFilter !== 'all') {
      lanesData = lanesData.filter((l) => l.type === this.activeRarityFilter);
      lanesContainer.classList.add('single-lane');
    }

    lanesData.forEach((lane) => {
      const laneEl = document.createElement('div');
      laneEl.className = `rarity-lane lane-${lane.type}`;

      laneEl.innerHTML = `
        <div class="rarity-lane-header" style="color: ${lane.color}; border-bottom-color: ${lane.color}80;">
          <span class="rarity-dot" style="background-color: ${lane.color}; box-shadow: 0 0 6px ${lane.color};"></span>
          <span class="rarity-lane-title">${lane.title}</span>
          <span class="rarity-lane-count">(${lane.items.length})</span>
        </div>
        <div class="rarity-lane-cards"></div>
      `;

      const cardsContainer = laneEl.querySelector('.rarity-lane-cards') as HTMLElement;

      if (lane.items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'rarity-empty-lane';
        empty.textContent = '—';
        cardsContainer.appendChild(empty);
      } else {
        lane.items.forEach((part) => {
          const card = this.createPartCard(part);
          cardsContainer.appendChild(card);
        });
      }

      lanesContainer.appendChild(laneEl);
    });

    this.partsGridEl.appendChild(lanesContainer);
  }

  /**
   * Начало перетаскивания через Pointer/Touch из каталога
   */
  private startPointerDrag(part: PartItem, e: PointerEvent): void {
    const mod = getModuleByPartId(part.id);
    if (mod && !campaignManager.isModuleUnlocked(mod.id)) {
      soundFx.playHit();
      const isAvailable = campaignManager.isModuleAvailableForPurchase(mod.id);
      if (isAvailable) {
        this.showAlert(`🛒 ДЕТАЛЬ НЕ КУПЛЕНА: сначала купите её за ${mod.price} ⚙`);
      } else {
        const reqStage = mod.tier === 3 ? '2-5' : '1-5';
        this.showAlert(`🔒 ДЕТАЛЬ НЕДОСТУПНА: завершите этап ${reqStage} для открытия покупки!`);
      }
      return;
    }

    this.touchDragPart = part;
    this.isPointerDragging = true;
    this.pointerStartX = e.clientX;
    this.pointerStartY = e.clientY;
    this.hasMovedSignificantly = false;

    // Для мыши сразу создаем призрак, для тача — при начале реального смещения (move > 10px),
    // чтобы вертикальная прокрутка пальцем работала идеально гладко и без ложных призраков
    if (e.pointerType !== 'touch') {
      this.createTouchGhost(part, e.clientX, e.clientY);
    }
  }

  private createTouchGhost(part: PartItem, clientX: number, clientY: number): void {
    this.cleanupTouchGhost();

    const ghost = document.createElement('div');
    ghost.className = 'shipyard-drag-ghost';
    ghost.innerHTML = `<img src="${part.url}" alt="${part.name}" />`;
    ghost.style.left = `${clientX}px`;
    ghost.style.top = `${clientY}px`;

    document.body.appendChild(ghost);
    this.touchGhostEl = ghost;
  }

  private handleGlobalPointerMove = (e: PointerEvent): void => {
    // 1. Если перетаскиваем деталь из каталога в ангар
    if (this.isPointerDragging && this.touchDragPart) {
      const dx = e.clientX - this.pointerStartX;
      const dy = e.clientY - this.pointerStartY;
      const dist = Math.hypot(dx, dy);

      if (dist > 10) {
        this.hasMovedSignificantly = true;
        if (!this.touchGhostEl) {
          this.createTouchGhost(this.touchDragPart, e.clientX, e.clientY);
        }
      }

      if (this.touchGhostEl) {
        this.touchGhostEl.style.left = `${e.clientX}px`;
        this.touchGhostEl.style.top = `${e.clientY}px`;

        const bayRect = this.centerBayEl.getBoundingClientRect();
        const isOverBay =
          e.clientX >= bayRect.left &&
          e.clientX <= bayRect.right &&
          e.clientY >= bayRect.top &&
          e.clientY <= bayRect.bottom;

        if (isOverBay) {
          this.centerBayEl.classList.add('drag-active');
        } else {
          this.centerBayEl.classList.remove('drag-active');
        }
      }
      return;
    }

    // 2. Если перемещаем уже сброшенную деталь внутри ангара
    if (this.isMovingDroppedPart && this.movingPartUid) {
      this.clearDisconnectedMarks();
      const bayRect = this.centerBayEl.getBoundingClientRect();
      const dropInstance = this.droppedParts.find((p) => p.uid === this.movingPartUid);
      if (dropInstance) {
        const newX = e.clientX - bayRect.left - this.moveOffsetX;
        const newY = e.clientY - bayRect.top - this.moveOffsetY;

        dropInstance.x = Math.max(25, Math.min(bayRect.width - 25, newX));
        dropInstance.y = Math.max(25, Math.min(bayRect.height - 25, newY));

        this.updateDroppedPartElement(dropInstance);
      }
    }
  };

  private handleGlobalPointerUp = (e: PointerEvent): void => {
    // 1. Окончание перемещения детали внутри ангара
    if (this.isMovingDroppedPart) {
      this.isMovingDroppedPart = false;
      this.movingPartUid = null;
      this.persistAssembly();
    }

    // 2. Окончание перетаскивания из каталога
    if (!this.isPointerDragging) return;

    this.centerBayEl.classList.remove('drag-active');
    const draggedPart = this.touchDragPart;
    const hasMoved = this.hasMovedSignificantly;

    const bayRect = this.centerBayEl.getBoundingClientRect();
    const isOverBay =
      e.clientX >= bayRect.left &&
      e.clientX <= bayRect.right &&
      e.clientY >= bayRect.top &&
      e.clientY <= bayRect.bottom;

    this.cleanupTouchGhost();
    this.isPointerDragging = false;
    this.touchDragPart = null;

    if (!draggedPart) return;

    if (isOverBay) {
      // Сброс в указанные координаты ангара
      const dropX = e.clientX - bayRect.left;
      const dropY = e.clientY - bayRect.top;
      this.tryAddPart(draggedPart, dropX, dropY);
    } else if (!hasMoved) {
      // Быстрый тап по карточке добавляет деталь в центр ангара
      const dropX = bayRect.width / 2;
      const dropY = bayRect.height / 2;
      this.tryAddPart(draggedPart, dropX, dropY);
    }
  };

  private cleanupTouchGhost(): void {
    if (this.touchGhostEl && this.touchGhostEl.parentNode) {
      this.touchGhostEl.parentNode.removeChild(this.touchGhostEl);
    }
    this.touchGhostEl = null;
  }

  /**
   * Добавление сброшенной детали в центральный отсек
   */
  public addDroppedPart(part: PartItem, x: number, y: number): void {
    this.clearDisconnectedMarks();
    const uid = 'part_' + Math.random().toString(36).substr(2, 9);
    const nextZ = this.droppedParts.length + 1;

    const newPart: DroppedPartInstance = {
      uid,
      part,
      x,
      y,
      zIndex: nextZ,
      rotation: 0,
      flipX: false,
      width: 70,
      height: 70,
    };

    this.droppedParts.push(newPart);
    this.selectPart(uid);
    this.renderLimitsGrid();
    this.renderCategoriesColumn();
    this.renderDroppedParts();
    this.persistAssembly();
  }

  /**
   * Выбор детали для редактирования (слой, поворот, отражение)
   */
  public selectPart(uid: string | null): void {
    this.selectedPartUid = uid;
    this.renderDroppedPartsSelection();
    this.updateSelectedToolbar();
  }

  /**
   * Обновление панели инструментов выбранного модуля
   */
  private updateSelectedToolbar(): void {
    const selected = this.droppedParts.find((p) => p.uid === this.selectedPartUid);

    if (!selected) {
      this.btnLayerUp.disabled = true;
      this.btnLayerDown.disabled = true;
      this.btnRotate45.disabled = true;
      this.btnRotate90.disabled = true;
      this.btnFlipX.disabled = true;
      this.btnDeleteSelected.disabled = true;
      this.selectedToolbarEl.classList.remove('has-selection');
      return;
    }

    this.btnLayerUp.disabled = false;
    this.btnLayerDown.disabled = false;
    this.btnRotate45.disabled = false;
    this.btnRotate90.disabled = false;
    this.btnFlipX.disabled = false;
    this.btnDeleteSelected.disabled = false;
    this.selectedToolbarEl.classList.add('has-selection');
  }

  /**
   * Перемещение слоя выбранного модуля: +1 (вперед) или -1 (назад)
   */
  public moveSelectedLayer(direction: 1 | -1): void {
    if (!this.selectedPartUid) return;

    const idx = this.droppedParts.findIndex((p) => p.uid === this.selectedPartUid);
    if (idx === -1) return;

    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= this.droppedParts.length) return;

    // Меняем местами элементы в массиве
    const temp = this.droppedParts[idx];
    this.droppedParts[idx] = this.droppedParts[targetIdx];
    this.droppedParts[targetIdx] = temp;

    // Пересчитываем zIndex
    this.droppedParts.forEach((p, i) => {
      p.zIndex = i + 1;
    });

    this.renderDroppedParts();
    this.updateSelectedToolbar();
    this.persistAssembly();
  }

  /**
   * Поворот выбранного модуля на заданное количество градусов (45° или 90°)
   */
  public rotateSelected(degrees: 45 | 90): void {
    if (!this.selectedPartUid) return;

    const part = this.droppedParts.find((p) => p.uid === this.selectedPartUid);
    if (!part) return;

    this.clearDisconnectedMarks();
    part.rotation = (part.rotation + degrees) % 360;
    this.updateDroppedPartElement(part);
    this.updateSelectedToolbar();
    this.persistAssembly();
  }

  /**
   * Отражение выбранного модуля по горизонтали (зеркально)
   */
  public flipSelectedX(): void {
    if (!this.selectedPartUid) return;

    const part = this.droppedParts.find((p) => p.uid === this.selectedPartUid);
    if (!part) return;

    this.clearDisconnectedMarks();
    part.flipX = !part.flipX;
    this.updateDroppedPartElement(part);
    this.updateSelectedToolbar();
    this.persistAssembly();
  }

  /**
   * Очистить все детали
   */
  public clearAllDroppedParts(): void {
    this.clearDisconnectedMarks();
    this.droppedParts = [];
    this.selectedPartUid = null;
    this.renderLimitsGrid();
    this.renderCategoriesColumn();
    this.renderDroppedParts();
    this.updateSelectedToolbar();
    this.persistAssembly();
  }

  /**
   * Удалить конкретную деталь
   */
  public removeDroppedPart(uid: string): void {
    this.clearDisconnectedMarks();
    this.droppedParts = this.droppedParts.filter((p) => p.uid !== uid);
    if (this.selectedPartUid === uid) {
      this.selectedPartUid = null;
    }

    // Пересчет zIndex
    this.droppedParts.forEach((p, i) => {
      p.zIndex = i + 1;
    });

    this.renderLimitsGrid();
    this.renderCategoriesColumn();
    this.renderDroppedParts();
    this.updateSelectedToolbar();
    this.persistAssembly();
    soundFx.playUiClick();
  }

  /**
   * Поиск детали по ее partId во всем каталоге
   */
  public findPartById(id: string): PartItem | null {
    for (const cat of this.catalog) {
      const direct = cat.directItems.find((p) => p.id === id);
      if (direct) return direct;
      for (const folder of cat.folders) {
        const found = folder.items.find((p) => p.id === id);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Загрузка сохраненной сборки корабля из CampaignManager
   */
  public loadSavedShipAssembly(): boolean {
    const saved = campaignManager.getSavedShipAssembly();
    if (!saved || saved.length === 0) return false;

    const restored: DroppedPartInstance[] = [];
    for (const s of saved) {
      const part = this.findPartById(s.partId);
      if (!part) return false;

      // Проверяем, разблокирован ли модуль
      const mod = getModuleByPartId(part.id);
      if (mod && !campaignManager.isModuleUnlocked(mod.id)) {
        return false;
      }

      restored.push({
        uid: s.uid,
        part,
        x: s.x,
        y: s.y,
        zIndex: s.zIndex,
        rotation: s.rotation,
        flipX: s.flipX,
        width: s.width || 70,
        height: s.height || 70,
      });
    }

    if (restored.length === 0) return false;

    this.droppedParts = restored;
    if (this.droppedParts.length > 0) {
      this.selectedPartUid = this.droppedParts[0].uid;
    }
    return true;
  }

  /**
   * Сохранение текущей сборки корабля в localStorage через CampaignManager
   */
  public persistAssembly(): void {
    const saved: SavedDroppedPart[] = this.droppedParts.map((p) => ({
      uid: p.uid,
      partId: p.part.id,
      x: p.x,
      y: p.y,
      zIndex: p.zIndex,
      rotation: p.rotation,
      flipX: p.flipX,
      width: p.width,
      height: p.height,
    }));
    campaignManager.saveShipAssembly(saved);
  }

  /**
   * Рендеринг всех деталей в центральном сборочном отсеке
   */
  private renderDroppedParts(): void {
    const surface = this.modalEl.querySelector('#hangar-drop-surface') as HTMLElement;
    const emptyHint = this.modalEl.querySelector('#hangar-empty-hint') as HTMLElement;

    if (!surface || !emptyHint) return;

    if (this.droppedParts.length === 0) {
      emptyHint.style.display = 'flex';
      surface.innerHTML = '';
      return;
    }

    emptyHint.style.display = 'none';
    surface.innerHTML = '';

    this.droppedParts.forEach((inst) => {
      const isSelected = inst.uid === this.selectedPartUid;
      const el = document.createElement('div');
      el.className = `dropped-part-item ${isSelected ? 'selected' : ''}`;
      el.id = `dropped-${inst.uid}`;
      el.style.left = `${inst.x}px`;
      el.style.top = `${inst.y}px`;
      el.style.zIndex = `${inst.zIndex}`;

      const transformStr = `rotate(${inst.rotation}deg) scaleX(${inst.flipX ? -1 : 1})`;

      el.innerHTML = `
        <div class="dropped-part-wrap" style="transform: ${transformStr};">
          <img src="${inst.part.url}" alt="${inst.part.name}" draggable="false" />
          <button class="part-remove-btn" type="button" title="Удалить деталь">✕</button>
        </div>
        <div class="dropped-part-selection-ring"></div>
      `;

      // Кнопка удаления
      const removeBtn = el.querySelector('.part-remove-btn') as HTMLButtonElement;
      removeBtn?.addEventListener('pointerdown', (e) => e.stopPropagation());
      removeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeDroppedPart(inst.uid);
      });

      // Перемещение и выбор детали внутри ангара
      el.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.target === removeBtn) return;
        e.preventDefault();
        e.stopPropagation();

        this.selectPart(inst.uid);

        this.isMovingDroppedPart = true;
        this.movingPartUid = inst.uid;
        const rect = el.getBoundingClientRect();
        this.moveOffsetX = e.clientX - (rect.left + rect.width / 2);
        this.moveOffsetY = e.clientY - (rect.top + rect.height / 2);

        soundFx.playUiHover();
      });

      surface.appendChild(el);
    });
  }

  private renderDroppedPartsSelection(): void {
    const surface = this.modalEl.querySelector('#hangar-drop-surface') as HTMLElement;
    if (!surface) return;

    const items = surface.querySelectorAll('.dropped-part-item');
    items.forEach((item) => {
      const uid = item.id.replace('dropped-', '');
      if (uid === this.selectedPartUid) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  private updateDroppedPartElement(inst: DroppedPartInstance): void {
    const el = this.modalEl.querySelector(`#dropped-${inst.uid}`) as HTMLElement;
    if (el) {
      el.style.left = `${inst.x}px`;
      el.style.top = `${inst.y}px`;
      el.style.zIndex = `${inst.zIndex}`;

      const wrap = el.querySelector('.dropped-part-wrap') as HTMLElement;
      if (wrap) {
        wrap.style.transform = `rotate(${inst.rotation}deg) scaleX(${inst.flipX ? -1 : 1})`;
      }
    }
  }
}

import { buildPartsCatalog, CategoryData, FolderNode, PartItem } from './partsCatalog';
import { soundFx } from '../audio';

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

// Лимиты на установку модулей по категориям
export const CATEGORY_LIMITS: Record<string, { max: number; title: string; icon: string }> = {
  pilot: { max: 1, title: 'Кабина', icon: '👤' },
  body: { max: 1, title: 'Корпус', icon: '🛡️' },
  wings: { max: 2, title: 'Крылья', icon: '🪽' },
  engines: { max: 1, title: 'Двигатели', icon: '🚀' },
  guns: { max: 1, title: 'Пушки', icon: '⚡' },
};

export class ShipBuilderModal {
  private container: HTMLElement;
  private catalog: CategoryData[];
  private activeCategoryId: string;
  private activeSubfolderName: string | null = null;
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
  private selectedPartTagEl!: HTMLElement;

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
  public onLaunch: (() => void) | null = null;
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
            <div class="shipyard-badge">
              <span class="shipyard-dot"></span>
              <span class="shipyard-code">SYS_SHIPYARD // ПРОТОКОЛ СБОРКИ V2.0</span>
            </div>
            <h2 class="shipyard-title">КОНСТРУКТОР КОРАБЛЯ</h2>
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

          <!-- ЦЕНТРАЛЬНОЕ ОКНО СБОРКИ КОРАБЛЯ (ШИРОКИЙ АНГАР) -->
          <section class="shipyard-center-col" aria-label="Сборочный ангар корабля">
            <div class="hangar-container">
              
              <!-- Индикаторы лимитов по 5 категориям -->
              <div class="hangar-limits-grid" id="hangar-limits-grid" title="Лимиты на установку модулей">
                <!-- Генерируется динамически: Кабина 0/1, Корпус 0/1, Крылья 0/2, Двигатели 0/1, Пушки 0/1 -->
              </div>

              <!-- Панель управления выбранным модулем (Слой, Поворот, Отражение, Удаление) -->
              <div class="selected-module-toolbar" id="selected-module-toolbar">
                <div class="sel-meta">
                  <span class="sel-tag" id="sel-part-tag">ВЫБЕРИТЕ МОДУЛЬ ДЛЯ НАСТРОЙКИ</span>
                </div>
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
                    ✕
                  </button>
                </div>
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
                  <span class="hangar-hint-sub">1 Корпус, 1 Кабина, 2 Крыла, 1 Двигатель, 1 Пушка</span>
                </div>

                <!-- Поверхность для размещения сброшенных деталей -->
                <div class="hangar-drop-surface" id="hangar-drop-surface"></div>
              </div>

              <!-- Панель управления отсеком -->
              <div class="hangar-controls-bar">
                <button id="shipyard-btn-clear" class="hangar-tool-btn" type="button" title="Очистить все детали из отсека сборки">
                  ✕ ОЧИСТИТЬ ВСЕ
                </button>
                <div id="shipyard-parts-counter" class="hangar-parts-counter">
                  ДЕТАЛЕЙ: 0 / 6
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
    this.selectedPartTagEl = modal.querySelector('#sel-part-tag') as HTMLElement;

    this.btnLayerUp = modal.querySelector('#btn-layer-up') as HTMLButtonElement;
    this.btnLayerDown = modal.querySelector('#btn-layer-down') as HTMLButtonElement;
    this.btnRotate45 = modal.querySelector('#btn-rotate-45') as HTMLButtonElement;
    this.btnRotate90 = modal.querySelector('#btn-rotate-90') as HTMLButtonElement;
    this.btnFlipX = modal.querySelector('#btn-flip-x') as HTMLButtonElement;
    this.btnDeleteSelected = modal.querySelector('#btn-delete-selected') as HTMLButtonElement;
  }

  private bindEvents(): void {
    // 1. Кнопки запуска боя ("В БОЙ")
    const launchBtns = [
      this.modalEl.querySelector('#shipyard-btn-launch-top'),
      this.modalEl.querySelector('#shipyard-btn-launch-bottom'),
    ];
    launchBtns.forEach((btn) => {
      btn?.addEventListener('click', () => {
        soundFx.playUiClick();
        this.close();
        if (this.onLaunch) this.onLaunch();
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

    // 3. Кнопка очистки всех деталей
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
   * Попытка добавления детали с проверкой лимита
   */
  public tryAddPart(part: PartItem, x: number, y: number): boolean {
    const catId = part.category;
    const limitCfg = CATEGORY_LIMITS[catId];

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
   * Открытие модального окна
   */
  public open(): void {
    this.modalEl.classList.remove('hidden');
    const flowEl = this.modalEl.querySelector('#shipyard-columns-flow');
    if (flowEl) flowEl.scrollLeft = 0;
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
   * Полный рендеринг интерфейса
   */
  private render(): void {
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
        <span class="limit-icon">${cfg.icon}</span>
        <span class="limit-label">${cfg.title}:</span>
        <span class="limit-val ${isFull ? 'full-val' : ''}">${current}/${cfg.max}</span>
        ${isFull ? '<span class="limit-check">✓</span>' : ''}
      `;

      this.limitsGridEl.appendChild(badge);
    });

    if (this.partsCounterEl) {
      const total = this.droppedParts.length;
      this.partsCounterEl.textContent = `ДЕТАЛЕЙ: ${total} / 6`;
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
    const cat = this.catalog.find((c) => c.id === categoryId);

    if (cat && cat.hasSubfolders && cat.folders.length > 0) {
      this.activeSubfolderName = cat.folders[0].name;
    } else {
      this.activeSubfolderName = null;
    }

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

    if (activeCat.hasSubfolders && activeCat.folders.length > 0) {
      // Показываем второй столбец (Разделение на цвета/подпапки)
      this.subfoldersColEl.style.display = 'flex';
      this.subfoldersTagEl.textContent = `02 // РАЗДЕЛЕНИЕ`;
      this.subfoldersListEl.innerHTML = '';

      activeCat.folders.forEach((folder) => {
        const btn = document.createElement('button');
        const isFolderActive = folder.name === this.activeSubfolderName;
        btn.className = `subfolder-col-btn ${isFolderActive ? 'active' : ''}`;
        btn.type = 'button';

        btn.innerHTML = `
          <div class="subfolder-btn-inner">
            <span class="subfolder-icon">${isFolderActive ? '📂' : '📁'}</span>
            <div class="subfolder-text-wrap">
              <span class="subfolder-name">${folder.title}</span>
              <span class="subfolder-count">${folder.items.length} дет.</span>
            </div>
            <span class="active-chevron">▶</span>
          </div>
        `;

        btn.addEventListener('mouseenter', () => soundFx.playUiHover());

        btn.addEventListener('click', () => {
          soundFx.playUiClick();
          this.activeSubfolderName = folder.name;
          this.renderSubfoldersAndParts();
        });

        this.subfoldersListEl.appendChild(btn);
      });

      // Третий столбец: Фотографии деталей из выбранной подпапки
      const activeFolder = activeCat.folders.find((f) => f.name === this.activeSubfolderName) || activeCat.folders[0];
      const items = activeFolder ? activeFolder.items : [];

      this.partsColEl.style.display = 'flex';
      this.partsTagEl.textContent = `03 // ${activeFolder?.name.toUpperCase() || 'ДЕТАЛИ'} (${items.length})`;
      this.renderPartsGrid(items);
    } else {
      // Для категорий без подпапок (Двигатели, Пушки) колонка 2 НЕ исчезает,
      // чтобы все 3 колонки всегда были на экране и верстка не прыгала!
      this.subfoldersColEl.style.display = 'flex';
      this.subfoldersTagEl.textContent = `02 // РАЗДЕЛЕНИЕ`;
      this.subfoldersListEl.innerHTML = '';

      const btn = document.createElement('button');
      btn.className = 'subfolder-col-btn active';
      btn.type = 'button';
      btn.innerHTML = `
        <div class="subfolder-btn-inner">
          <span class="subfolder-icon">📂</span>
          <div class="subfolder-text-wrap">
            <span class="subfolder-name">Все модули</span>
            <span class="subfolder-count">${activeCat.directItems.length} дет.</span>
          </div>
          <span class="active-chevron">▶</span>
        </div>
      `;
      this.subfoldersListEl.appendChild(btn);

      this.partsColEl.style.display = 'flex';
      this.partsTagEl.textContent = `03 // ${activeCat.title.toUpperCase()} (${activeCat.directItems.length})`;
      this.renderPartsGrid(activeCat.directItems);
    }

    const flowEl = this.modalEl.querySelector('#shipyard-columns-flow');
    if (flowEl) flowEl.scrollLeft = 0;
  }

  /**
   * Рендеринг карточек деталей в столбце фотографий
   */
  private renderPartsGrid(items: PartItem[]): void {
    this.partsGridEl.innerHTML = '';

    items.forEach((part) => {
      const card = document.createElement('div');
      card.className = 'part-card';
      card.setAttribute('draggable', 'true');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('title', `Перетащите ${part.name} в ангар или нажмите для добавления`);

      card.innerHTML = `
        <div class="part-card-inner">
          <div class="part-preview-wrap">
            <img src="${part.url}" alt="${part.name}" class="part-preview-img" loading="lazy" draggable="false" />
          </div>
          <div class="part-meta">
            <span class="part-name-tag">${part.name}</span>
          </div>
          <span class="part-drag-badge">DRAG</span>
        </div>
      `;

      card.addEventListener('mouseenter', () => soundFx.playUiHover());

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

      this.partsGridEl.appendChild(card);
    });
  }

  /**
   * Начало перетаскивания через Pointer/Touch из каталога
   */
  private startPointerDrag(part: PartItem, e: PointerEvent): void {
    this.touchDragPart = part;
    this.isPointerDragging = true;
    this.pointerStartX = e.clientX;
    this.pointerStartY = e.clientY;
    this.hasMovedSignificantly = false;

    this.createTouchGhost(part, e.clientX, e.clientY);
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
    if (this.isPointerDragging && this.touchGhostEl && this.touchDragPart) {
      const dx = e.clientX - this.pointerStartX;
      const dy = e.clientY - this.pointerStartY;
      if (Math.hypot(dx, dy) > 8) {
        this.hasMovedSignificantly = true;
      }

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
      return;
    }

    // 2. Если перемещаем уже сброшенную деталь внутри ангара
    if (this.isMovingDroppedPart && this.movingPartUid) {
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
      this.selectedPartTagEl.textContent = 'ВЫБЕРИТЕ МОДУЛЬ В АНГАРЕ ДЛЯ НАСТРОЙКИ';
      this.btnLayerUp.disabled = true;
      this.btnLayerDown.disabled = true;
      this.btnRotate45.disabled = true;
      this.btnRotate90.disabled = true;
      this.btnFlipX.disabled = true;
      this.btnDeleteSelected.disabled = true;
      this.selectedToolbarEl.classList.remove('has-selection');
      return;
    }

    const catName = CATEGORY_LIMITS[selected.part.category]?.title || selected.part.category;
    this.selectedPartTagEl.innerHTML = `
      <span class="active-tag-accent">${catName.toUpperCase()}:</span> ${selected.part.name} 
      <span class="active-tag-props">[Слой: ${selected.zIndex} | Угол: ${selected.rotation}° ${selected.flipX ? '| ⇄ Отражен' : ''}]</span>
    `;

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
  }

  /**
   * Поворот выбранного модуля на заданное количество градусов (45° или 90°)
   */
  public rotateSelected(degrees: 45 | 90): void {
    if (!this.selectedPartUid) return;

    const part = this.droppedParts.find((p) => p.uid === this.selectedPartUid);
    if (!part) return;

    part.rotation = (part.rotation + degrees) % 360;
    this.updateDroppedPartElement(part);
    this.updateSelectedToolbar();
  }

  /**
   * Отражение выбранного модуля по горизонтали (зеркально)
   */
  public flipSelectedX(): void {
    if (!this.selectedPartUid) return;

    const part = this.droppedParts.find((p) => p.uid === this.selectedPartUid);
    if (!part) return;

    part.flipX = !part.flipX;
    this.updateDroppedPartElement(part);
    this.updateSelectedToolbar();
  }

  /**
   * Очистить все детали
   */
  public clearAllDroppedParts(): void {
    this.droppedParts = [];
    this.selectedPartUid = null;
    this.renderLimitsGrid();
    this.renderCategoriesColumn();
    this.renderDroppedParts();
    this.updateSelectedToolbar();
  }

  /**
   * Удалить конкретную деталь
   */
  public removeDroppedPart(uid: string): void {
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
    soundFx.playUiClick();
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

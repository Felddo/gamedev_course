import { buildPartsCatalog, CategoryData, FolderNode, PartItem } from './partsCatalog';
import { soundFx } from '../audio';
import { campaignManager } from '../campaign/CampaignManager';
import { SavedDroppedPart } from '../campaign/types';
import { isMobilePhone } from '../deviceUtils';
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

const CATEGORY_LIMIT_METADATA: Record<string, { title: string; icon: string }> = {
  pilot: { title: 'Кабина', icon: '' },
  body: { title: 'Корпус', icon: '' },
  wings: { title: 'Крылья', icon: '' },
  engines: { title: 'Двигатели', icon: '' },
  guns: { title: 'Пушки', icon: '' },
};

export function getCategoryMaxLimit(catId: string): number {
  return campaignManager.getShipPartLimit(catId);
}

// Лимиты на установку модулей по категориям (рассчитываются динамически от прогресса кампании)
export const CATEGORY_LIMITS = new Proxy(CATEGORY_LIMIT_METADATA as any, {
  get(_target, prop: string) {
    if (typeof prop !== 'string') return undefined;
    const meta = CATEGORY_LIMIT_METADATA[prop] || { title: prop, icon: '' };
    return {
      max: campaignManager.getShipPartLimit(prop),
      title: meta.title,
      icon: meta.icon,
    };
  },
  has(_target, prop: string) {
    return prop in CATEGORY_LIMIT_METADATA;
  },
  ownKeys() {
    return Object.keys(CATEGORY_LIMIT_METADATA);
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    return {
      configurable: true,
      enumerable: true,
      value: {
        max: campaignManager.getShipPartLimit(prop),
        title: (CATEGORY_LIMIT_METADATA[prop] || { title: prop }).title,
        icon: (CATEGORY_LIMIT_METADATA[prop] || { icon: '' }).icon,
      },
    };
  },
}) as Record<string, { max: number; title: string; icon: string }>;

/**
 * Точные размеры спрайтов модулей в пикселях (w, h).
 * Используются для точного геометрического расчета касания деталей корабля.
 */
const MODULE_SPRITE_DIMENSIONS: Record<string, { w: number; h: number }> = {
  // Кабины (pilot)
  pilot_black_spaceParts_054: { w: 16, h: 16 },
  pilot_white_spaceParts_058: { w: 14, h: 29 },
  pilot_black_spaceParts_059: { w: 12, h: 30 },
  pilot_white_spaceParts_060: { w: 12, h: 30 },
  pilot_black_spaceParts_057: { w: 14, h: 29 },
  pilot_white_spaceParts_064: { w: 14, h: 28 },
  pilot_black_spaceParts_065: { w: 24, h: 29 },
  pilot_white_spaceParts_062: { w: 17, h: 26 },
  pilot_black_spaceParts_069: { w: 17, h: 32 },

  // Корпуса (body)
  body_black_spaceParts_047: { w: 37, h: 56 },
  body_white_spaceParts_034: { w: 37, h: 56 },
  body_black_spaceParts_049: { w: 48, h: 62 },
  body_white_spaceParts_035: { w: 32, h: 63 },
  body_black_spaceParts_048: { w: 32, h: 63 },
  body_white_spaceParts_036: { w: 48, h: 62 },
  body_black_spaceParts_050: { w: 35, h: 71 },
  body_black_spaceParts_055: { w: 59, h: 66 },
  body_white_spaceParts_042: { w: 52, h: 67 },

  // Крылья (wings)
  wings_blue_spaceParts_010: { w: 38, h: 71 },
  wings_blue_spaceParts_012: { w: 48, h: 70 },
  wings_blue_spaceParts_014: { w: 50, h: 67 },
  wings_blue_spaceParts_016: { w: 39, h: 71 },
  wings_blue_spaceParts_018: { w: 41, h: 71 },
  wings_blue_spaceParts_020: { w: 37, h: 72 },
  wings_blue_spaceParts_022: { w: 26, h: 84 },
  wings_blue_spaceParts_024: { w: 36, h: 79 },
  wings_green_spaceParts_011: { w: 38, h: 71 },
  wings_green_spaceParts_013: { w: 48, h: 70 },
  wings_green_spaceParts_015: { w: 50, h: 67 },
  wings_green_spaceParts_017: { w: 39, h: 71 },
  wings_green_spaceParts_019: { w: 41, h: 71 },
  wings_green_spaceParts_021: { w: 37, h: 72 },
  wings_red_spaceParts_001: { w: 39, h: 71 },
  wings_red_spaceParts_002: { w: 41, h: 71 },
  wings_red_spaceParts_003: { w: 37, h: 72 },
  wings_red_spaceParts_004: { w: 26, h: 84 },

  // Двигатели (engines)
  engines_0: { w: 29, h: 47 },
  engines_1: { w: 43, h: 62 },
  engines_2: { w: 40, h: 66 },
  engines_3: { w: 34, h: 66 },

  // Пушки (guns)
  guns_0: { w: 17, h: 38 },
  guns_1: { w: 26, h: 41 },
  guns_2: { w: 27, h: 41 },
  guns_3: { w: 9, h: 33 },
};

/**
 * Получение фактических отображаемых размеров детали с учетом масштабирования под предел 66x66
 */
function getDroppedPartDimensions(part: PartItem): { w: number; h: number } {
  let raw = MODULE_SPRITE_DIMENSIONS[part.id];
  if (!raw) {
    switch (part.category) {
      case 'pilot': raw = { w: 18, h: 26 }; break;
      case 'body': raw = { w: 40, h: 60 }; break;
      case 'wings': raw = { w: 40, h: 70 }; break;
      case 'engines': raw = { w: 35, h: 60 }; break;
      case 'guns': raw = { w: 22, h: 40 }; break;
      default: raw = { w: 40, h: 40 }; break;
    }
  }
  const maxDim = Math.max(raw.w, raw.h);
  const scale = maxDim > 66 ? 66 / maxDim : 1;
  return {
    w: raw.w * scale,
    h: raw.h * scale,
  };
}

interface Point2D {
  x: number;
  y: number;
}

/**
 * Получение 4 вершин ориентированного прямоугольника детали с учетом поворота и допуска касания
 */
function getPartPolygon(p: DroppedPartInstance, margin = 5): Point2D[] {
  const { w, h } = getDroppedPartDimensions(p.part);
  const hw = w / 2 + margin;
  const hh = h / 2 + margin;
  const rad = ((p.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const localCorners: Point2D[] = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];

  return localCorners.map((c) => ({
    x: p.x + c.x * cos - c.y * sin,
    y: p.y + c.x * sin + c.y * cos,
  }));
}

/**
 * Проверка физического пересечения/соприкосновения двух деталей по теореме о разделяющей оси (SAT).
 * Точно определяет касание модулей при любых углах поворота и запрещает зазор между деталями.
 */
function doPartsTouch(a: DroppedPartInstance, b: DroppedPartInstance, margin = 5): boolean {
  // Быстрая проверка расстояния между центрами (broad-phase)
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  if (dx * dx + dy * dy > 11500) {
    return false;
  }

  const polyA = getPartPolygon(a, margin);
  const polyB = getPartPolygon(b, margin);

  const polys = [polyA, polyB];
  for (let i = 0; i < 2; i++) {
    const poly = polys[i];
    for (let j = 0; j < poly.length; j++) {
      const k = (j + 1) % poly.length;
      const edgeX = poly[k].x - poly[j].x;
      const edgeY = poly[k].y - poly[j].y;
      // Нормаль к ребру
      const normalX = -edgeY;
      const normalY = edgeX;

      let minA = Infinity;
      let maxA = -Infinity;
      for (const pt of polyA) {
        const dot = pt.x * normalX + pt.y * normalY;
        if (dot < minA) minA = dot;
        if (dot > maxA) maxA = dot;
      }

      let minB = Infinity;
      let maxB = -Infinity;
      for (const pt of polyB) {
        const dot = pt.x * normalX + pt.y * normalY;
        if (dot < minB) minB = dot;
        if (dot > maxB) maxB = dot;
      }

      // Если проекции разделены — фигуры не соприкасаются
      if (maxA < minB || maxB < minA) {
        return false;
      }
    }
  }

  return true;
}

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
  private partsColEl!: HTMLElement;
  private partsTagEl!: HTMLElement;
  private partsGridEl!: HTMLElement;
  private partsCounterEl: HTMLElement | null = null;
  private limitsGridEl!: HTMLElement;
  private alertToastEl!: HTMLElement;
  private alertMsgEl!: HTMLElement;
  private selectedToolbarEl!: HTMLElement;
  private scrapValEl!: HTMLElement;

  // Toolbar Action Buttons
  private btnLayerUp!: HTMLButtonElement;
  private btnLayerDown!: HTMLButtonElement;
  private btnRotate45!: HTMLButtonElement;
  private btnRotateMinus45!: HTMLButtonElement;
  private btnRotate90!: HTMLButtonElement;
  private btnFlipX!: HTMLButtonElement;
  private btnDeleteSelected!: HTMLButtonElement;

  // Arrow Nudge Buttons (перемещение детали по 4 направлениям)
  private btnNudgeLeft!: HTMLButtonElement;
  private btnNudgeDown!: HTMLButtonElement;
  private btnNudgeUp!: HTMLButtonElement;
  private btnNudgeRight!: HTMLButtonElement;

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

  // Analytics: замер времени в конструкторе корабля
  private shipBuilderStartTime: number | null = null;
  private totalShipBuilderTime = 0;

  // Callbacks
  public onLaunch: ((assembly: CustomShipAssembly) => void) | null = null;
  public onReturnToMenu: (() => void) | null = null;

  constructor() {
    this.container = document.body;
    this.catalog = buildPartsCatalog();
    this.totalShipBuilderTime = campaignManager.getTotalShipBuilderTime();

    const firstCat = this.catalog[0];
    this.activeCategoryId = firstCat?.id || 'body';
    if (firstCat && firstCat.hasSubfolders && firstCat.folders.length > 0) {
      this.activeSubfolderName = firstCat.folders[0].name;
    }

    this.createDom();
    this.bindEvents();
    if (!this.loadSavedShipAssembly() || this.droppedParts.length === 0) {
      this.loadDefaultShipPreset();
    }
    this.render();

    if (typeof window !== 'undefined') {
      (window as any).shipBuilderModal = this;
      window.addEventListener('beforeunload', () => {
        this.finishShipBuilderSession();
      });
    }
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
            
            <!-- 1. СТОЛБЕЦ: МОДУЛИ (Корпус, Кабина, Крылья, Двигатели, Пушки) -->
            <div class="flow-col col-categories" id="col-categories">
              <div class="col-head">
                <span class="col-head-tag">МОДУЛИ</span>
              </div>
              <div class="col-scroll">
                <nav class="categories-list" id="shipyard-categories-list"></nav>
              </div>
            </div>

            <!-- СТОЛБЕЦ: ФОТОГРАФИИ ДЕТАЛЕЙ (выбранного раздела или группы) -->
            <div class="flow-col col-parts" id="col-parts">
              <div class="col-head">
                <span class="col-head-tag" id="parts-head-tag">ДЕТАЛИ</span>
              </div>
              <div class="col-scroll parts-scroll">
                <div class="parts-grid" id="shipyard-parts-grid"></div>
              </div>
              <div class="parts-col-footer-hint">
                <span>ПЕРЕТАЩИТЕ МОДУЛЬ В АНГАР</span>
              </div>
            </div>

          </div>

          <!-- ЦЕНТРАЛЬНОЕ ОКНО СБОРКИ КОРАБЛЯ -->
          <section class="shipyard-center-col" aria-label="Сборочный ангар корабля">
            <div class="hangar-container">

              <!-- СООБЩЕНИЕ СВЕРХУ ОТ ОКНА С КОСМОЛЕТОМ -->
              <div class="shipyard-field-prompt">
                <span class="prompt-text">Создай свой корабль, перемещая части в это поле</span>
              </div>

              <!-- СРЕДНИЙ РЯД: СЛЕВА КНОПКА БАЗОВЫЙ СБОР И БЛОК УПРАВЛЕНИЯ, В ЦЕНТРЕ ОКНО С КОСМОЛЕТОМ И СТРЕЛКИ, СПРАВА КНОПКА ОЧИСТКИ И БЛОК ЧАСТИ -->
              <div class="hangar-bay-wrapper">
                <!-- ЛЕВАЯ КОЛОНКА: ПРЯМОУГОЛЬНАЯ КНОПКА БАЗОВОГО СБОРА И ПОД НЕЙ БЛОК УПРАВЛЕНИЯ -->
                <div class="hangar-side-col hangar-side-col-left">
                  <!-- ПРЯМОУГОЛЬНАЯ КНОПКА БАЗОВЫЙ СБОР НАД БЛОКОМ УПРАВЛЕНИЯ -->
                  <button id="shipyard-btn-preset" class="hangar-tool-btn hangar-side-btn btn-preset" type="button" title="Загрузить готовую сбалансированную сборку корабля">
                    ⚡ БАЗОВЫЙ<br>СБОР
                  </button>
                  <div class="hangar-panel-col selected-module-toolbar" id="selected-module-toolbar">
                    <div class="panel-col-head">
                      <span class="panel-col-head-tag">УПРАВЛЕНИЕ</span>
                    </div>
                    <div class="panel-col-body">
                      <div class="sel-tools">
                        <button id="btn-layer-up" class="sel-tool-btn" type="button" title="Переместить модуль на 1 слой вперед" disabled>
                          <span class="tool-icon">▲</span> Слой +1
                        </button>
                        <button id="btn-layer-down" class="sel-tool-btn" type="button" title="Переместить модуль на 1 слой назад" disabled>
                          <span class="tool-icon">▼</span> Слой -1
                        </button>
                        <button id="btn-rotate-45" class="sel-tool-btn" type="button" title="Повернуть модуль на +45 градусов" disabled>
                          <span class="tool-icon">⟳</span> +45°
                        </button>
                        <button id="btn-rotate-minus-45" class="sel-tool-btn" type="button" title="Повернуть модуль на -45 градусов" disabled>
                          <span class="tool-icon">⟲</span> -45°
                        </button>
                        <button id="btn-rotate-90" class="sel-tool-btn" type="button" title="Повернуть модуль на 90 градусов" disabled>
                          <span class="tool-icon">↷</span> +90°
                        </button>
                        <button id="btn-delete-selected" class="sel-tool-btn btn-danger" type="button" title="Удалить выбранный модуль" disabled>
                          <span class="tool-icon">✕</span> Удалить
                        </button>
                        <button id="btn-flip-x" class="sel-tool-btn" type="button" title="Отразить модуль по горизонтали" disabled>
                          <span class="tool-icon">⇄</span> Отразить
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- ЦЕНТРАЛЬНАЯ КОЛОНКА: ОКНО С КОСМОЛЕТОМ И ПОД НИМ КНОПКИ СО СТРЕЛКАМИ -->
                <div class="hangar-center-col-wrapper">
                  <!-- ОТЦЕНТРИРОВАННОЕ ОКНО, ГДЕ СОБИРАЕТСЯ САМ КОСМОЛЕТ -->
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

                  <!-- ПОД ОКНОМ С КОСМОЛЕТОМ 4 КНОПКИ СО СТРЕЛКАМИ (ТАКОЙ ЖЕ ШИРИНЫ) -->
                  <div class="hangar-nudge-bar" id="hangar-nudge-bar">
                    <button id="btn-nudge-left" class="nudge-btn" type="button" title="Сдвинуть деталь влево" disabled>
                      <span class="nudge-arrow">◀</span>
                    </button>
                    <button id="btn-nudge-down" class="nudge-btn" type="button" title="Сдвинуть деталь вниз" disabled>
                      <span class="nudge-arrow">▼</span>
                    </button>
                    <button id="btn-nudge-up" class="nudge-btn" type="button" title="Сдвинуть деталь вверх" disabled>
                      <span class="nudge-arrow">▲</span>
                    </button>
                    <button id="btn-nudge-right" class="nudge-btn" type="button" title="Сдвинуть деталь вправо" disabled>
                      <span class="nudge-arrow">▶</span>
                    </button>
                  </div>
                </div>

                <!-- ПРАВАЯ КОЛОНКА: ПРЯМОУГОЛЬНАЯ КНОПКА ОЧИСТКИ ВСЕГО И ПОД НЕЙ БЛОК ЧАСТИ -->
                <div class="hangar-side-col hangar-side-col-right">
                  <!-- ПРЯМОУГОЛЬНАЯ КНОПКА ОЧИСТИТЬ ВСЕ НАД БЛОКОМ ЧАСТИ -->
                  <button id="shipyard-btn-clear" class="hangar-tool-btn hangar-side-btn btn-clear" type="button" title="Очистить все детали из отсека сборки">
                    ✕ ОЧИСТИТЬ<br>ВСЕ
                  </button>
                  <div class="hangar-panel-col hangar-limits-panel" id="hangar-limits-panel">
                    <div class="panel-col-head">
                      <span class="panel-col-head-tag">ЧАСТИ</span>
                    </div>
                    <div class="panel-col-body">
                      <div class="hangar-limits-grid" id="hangar-limits-grid" title="Требуемое количество частей">
                        <!-- Динамически: Кабина, Корпус, Крылья, Двигатели, Пушки -->
                      </div>
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
    this.partsColEl = modal.querySelector('#col-parts') as HTMLElement;
    this.partsTagEl = modal.querySelector('#parts-head-tag') as HTMLElement;
    this.partsGridEl = modal.querySelector('#shipyard-parts-grid') as HTMLElement;
    this.partsCounterEl = modal.querySelector('#shipyard-parts-counter') as HTMLElement | null;
    this.limitsGridEl = modal.querySelector('#hangar-limits-grid') as HTMLElement;
    this.alertToastEl = modal.querySelector('#shipyard-alert-toast') as HTMLElement;
    this.alertMsgEl = modal.querySelector('#shipyard-alert-msg') as HTMLElement;
    this.selectedToolbarEl = modal.querySelector('#selected-module-toolbar') as HTMLElement;
    this.scrapValEl = modal.querySelector('#shipyard-scrap-val') as HTMLElement;

    this.btnLayerUp = modal.querySelector('#btn-layer-up') as HTMLButtonElement;
    this.btnLayerDown = modal.querySelector('#btn-layer-down') as HTMLButtonElement;
    this.btnRotate45 = modal.querySelector('#btn-rotate-45') as HTMLButtonElement;
    this.btnRotateMinus45 = modal.querySelector('#btn-rotate-minus-45') as HTMLButtonElement;
    this.btnRotate90 = modal.querySelector('#btn-rotate-90') as HTMLButtonElement;
    this.btnFlipX = modal.querySelector('#btn-flip-x') as HTMLButtonElement;
    this.btnDeleteSelected = modal.querySelector('#btn-delete-selected') as HTMLButtonElement;

    this.btnNudgeLeft = modal.querySelector('#btn-nudge-left') as HTMLButtonElement;
    this.btnNudgeDown = modal.querySelector('#btn-nudge-down') as HTMLButtonElement;
    this.btnNudgeUp = modal.querySelector('#btn-nudge-up') as HTMLButtonElement;
    this.btnNudgeRight = modal.querySelector('#btn-nudge-right') as HTMLButtonElement;
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

    // Поворот на -45 градусов
    this.btnRotateMinus45.addEventListener('click', () => {
      soundFx.playUiClick();
      this.rotateSelected(-45);
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

    // 4 кнопки перемещения выбранной детали (влево, вниз, вверх, вправо)
    const bindNudge = (btn: HTMLButtonElement, dx: number, dy: number) => {
      let repeatTimer: number | null = null;
      let delayTimer: number | null = null;

      const stopRepeat = () => {
        if (delayTimer) {
          window.clearTimeout(delayTimer);
          delayTimer = null;
        }
        if (repeatTimer) {
          window.clearInterval(repeatTimer);
          repeatTimer = null;
        }
      };

      btn.addEventListener('pointerdown', (e: PointerEvent) => {
        if (btn.disabled || !this.selectedPartUid) return;
        e.preventDefault();
        soundFx.playUiClick();
        this.nudgeSelectedPart(dx, dy);

        stopRepeat();
        delayTimer = window.setTimeout(() => {
          repeatTimer = window.setInterval(() => {
            if (btn.disabled || !this.selectedPartUid) {
              stopRepeat();
              return;
            }
            this.nudgeSelectedPart(dx, dy);
          }, 120);
        }, 280);
      });

      btn.addEventListener('pointerup', stopRepeat);
      btn.addEventListener('pointerleave', stopRepeat);
      btn.addEventListener('pointercancel', stopRepeat);
    };

    bindNudge(this.btnNudgeLeft, -1, 0);
    bindNudge(this.btnNudgeDown, 0, 1);
    bindNudge(this.btnNudgeUp, 0, -1);
    bindNudge(this.btnNudgeRight, 1, 0);

    // Клик по свободной области ангара для сброса выделения
    this.centerBayEl.addEventListener('pointerdown', (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropped-part-item') && !target.closest('.selected-module-toolbar') && !target.closest('.hangar-nudge-bar')) {
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

    const { cellW, cellH, maxW, maxH } = this.getGridMetrics();
    const cx = this.snapToSquareCenter(maxW / 2, cellW);
    const cy = this.snapToSquareCenter(maxH / 2, cellH);

    // 1. Корпус (центр квадрата)
    if (bodyPart) {
      this.droppedParts.push({
        uid: 'preset_body_' + Math.random().toString(36).substr(2, 6),
        part: bodyPart,
        x: cx,
        y: cy,
        zIndex: 2,
        rotation: 0,
        flipX: false,
        width: 70,
        height: 70,
      });
    }

    // 2. Двигатель (ровно на 2 клетки ниже корпуса)
    if (enginesPart) {
      this.droppedParts.push({
        uid: 'preset_engine_' + Math.random().toString(36).substr(2, 6),
        part: enginesPart,
        x: cx,
        y: this.snapToHalfGrid(cy + cellH * 2, cellH),
        zIndex: 2,
        rotation: 0,
        flipX: false,
        width: 70,
        height: 70,
      });
    }

    // 3. Крылья левое и правое (симметрично по сетке с шагом полклетки)
    if (wingsPart) {
      this.droppedParts.push({
        uid: 'preset_wing_l_' + Math.random().toString(36).substr(2, 6),
        part: wingsPart,
        x: this.snapToHalfGrid(cx - cellW * 1.5, cellW),
        y: cy,
        zIndex: 2,
        rotation: 0,
        flipX: false,
        width: 70,
        height: 70,
      });
      this.droppedParts.push({
        uid: 'preset_wing_r_' + Math.random().toString(36).substr(2, 6),
        part: wingsPart,
        x: this.snapToHalfGrid(cx + cellW * 1.5, cellW),
        y: cy,
        zIndex: 2,
        rotation: 0,
        flipX: true,
        width: 70,
        height: 70,
      });
    }

    // 4. Кабина (на полклетки выше центра корпуса)
    if (pilotPart) {
      this.droppedParts.push({
        uid: 'preset_pilot_' + Math.random().toString(36).substr(2, 6),
        part: pilotPart,
        x: cx,
        y: this.snapToHalfGrid(cy - cellH * 0.5, cellH),
        zIndex: 3,
        rotation: 0,
        flipX: false,
        width: 70,
        height: 70,
      });
    }

    // 5. Пушка (на 1.5 клетки выше центра корпуса)
    if (gunsPart) {
      this.droppedParts.push({
        uid: 'preset_gun_' + Math.random().toString(36).substr(2, 6),
        part: gunsPart,
        x: cx,
        y: this.snapToHalfGrid(cy - cellH * 1.5, cellH),
        zIndex: 1,
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
    this.persistAssembly();
  }

  /**
   * Проверка связности/цельности корабля:
   * Все установленные детали должны соприкасаться или пересекаться, образуя единое целое.
   * Если хотя бы одна деталь стоит отдельно от остальных, вылет в бой строго блокируется!
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

    if (parts.length === 1) {
      return {
        isValid: false,
        errorMessage: 'КОРАБЛЬ НЕ СОБРАН! Установлена только одна деталь. Добавьте остальные части.',
        disconnectedUids: [parts[0].uid],
      };
    }

    // 1. Построение графа смежности (соприкосновения) всех установленных деталей
    const n = parts.length;
    const adj: number[][] = Array.from({ length: n }, () => []);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (doPartsTouch(parts[i], parts[j], 5)) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }

    // 2. Определение базового несущего модуля корабля (предпочтительно корпус, затем кабина)
    let coreIndex = parts.findIndex((p) => p.part.category === 'body');
    if (coreIndex === -1) {
      coreIndex = parts.findIndex((p) => p.part.category === 'pilot');
    }
    if (coreIndex === -1) {
      coreIndex = 0;
    }

    // 3. Обход графа в ширину (BFS) от центрального модуля корабля
    const visited = new Set<number>();
    const queue: number[] = [coreIndex];
    visited.add(coreIndex);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const neighbor of adj[curr]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // 4. Если абсолютно все установленные детали соединены с кораблем в единую конструкцию
    if (visited.size === n) {
      return { isValid: true };
    }

    // 5. Если обнаружены оторванные / изолированные детали
    const disconnectedParts = parts.filter((_, idx) => !visited.has(idx));
    const disconnectedUids = disconnectedParts.map((p) => p.uid);
    const disconnectedNames = Array.from(new Set(disconnectedParts.map((p) => p.part.name))).join(', ');

    return {
      isValid: false,
      errorMessage: `НЕЛЬЗЯ В БОЙ: деталь стоит отдельно от корабля (${disconnectedNames})! Все части должны быть соединены вместе.`,
      disconnectedUids,
    };
  }

  /**
   * Подсветка отсоединенных модулей красным контуром
   */
  public markDisconnectedParts(uids: string[]): void {
    this.clearDisconnectedMarks();
    uids.forEach((uid) => {
      const el =
        (this.modalEl ? this.modalEl.querySelector(`#dropped-${CSS.escape(uid)}`) : null) ||
        document.getElementById(`dropped-${uid}`);
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
   * Проверка обязательной комплектации корабля:
   * Для выхода в бой необходимо минимум по одной детали из каждой категории:
   * Кабина, Корпус, Крылья, Двигатель, Пушка.
   */
  public validateShipComposition(): { isValid: boolean; errorMessage?: string; missingNames?: string[] } {
    const requiredCategories: Array<{ id: string; name: string }> = [
      { id: 'body', name: 'Корпус' },
      { id: 'pilot', name: 'Кабина' },
      { id: 'wings', name: 'Крылья' },
      { id: 'engines', name: 'Двигатель' },
      { id: 'guns', name: 'Пушка' },
    ];

    const missing = requiredCategories.filter((cat) => this.getCategoryCount(cat.id) < 1);
    if (missing.length > 0) {
      const names = missing.map((m) => m.name).join(', ');
      return {
        isValid: false,
        missingNames: missing.map((m) => m.name),
        errorMessage: `ДЛЯ ВЫХОДА В БОЙ НУЖНО ХОТЯ БЫ ПО 1 ДЕТАЛИ ИЗ КАЖДОЙ ЧАСТИ! Не хватает: ${names}`,
      };
    }

    // Проверка, что ни по одной категории не превышен лимит
    for (const cat of requiredCategories) {
      const count = this.getCategoryCount(cat.id);
      const limit = CATEGORY_LIMITS[cat.id]?.max || 1;
      if (count > limit) {
        return {
          isValid: false,
          errorMessage: `ПРЕВЫШЕН ЛИМИТ: ${cat.name.toUpperCase()} (${count}/${limit})! Удалите лишнюю деталь.`,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Запуск боевого вылета с валидацией связности/цельности корабля и обязательной комплектации.
   * Если хотя бы одна деталь стоит отдельно от остальных, вылет в бой строго запрещен.
   */
  public tryLaunch(): boolean {
    // 1. Проверка связности деталей: если хоть одна деталь стоит отдельно от остальных, в бой зайти нельзя!
    const cohesionCheck = this.validateShipCohesion();
    if (!cohesionCheck.isValid) {
      soundFx.playHit();
      this.showAlert(
        cohesionCheck.errorMessage ||
          'НЕЛЬЗЯ В БОЙ: деталь стоит отдельно от корабля! Все части должны быть соединены вместе.'
      );
      if (cohesionCheck.disconnectedUids && cohesionCheck.disconnectedUids.length > 0) {
        this.markDisconnectedParts(cohesionCheck.disconnectedUids);
      }
      return false;
    }

    // 2. Проверка обязательной комплектации (минимум по одной детали из каждой категории)
    const compCheck = this.validateShipComposition();
    if (!compCheck.isValid) {
      soundFx.playHit();
      this.showAlert(compCheck.errorMessage || 'НЕ ХВАТАЕТ ОБЯЗАТЕЛЬНЫХ ДЕТАЛЕЙ ДЛЯ ВЫЛЕТА!');
      return false;
    }

    this.clearDisconnectedMarks();
    soundFx.playUiClick();
    this.finishShipBuilderSession();
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
    if (this.shipBuilderStartTime === null) {
      this.shipBuilderStartTime = Date.now();
    }
    this.totalShipBuilderTime = campaignManager.getTotalShipBuilderTime();
    this.modalEl.classList.remove('hidden');
    const flowEl = this.modalEl.querySelector('#shipyard-columns-flow');
    if (flowEl) flowEl.scrollLeft = 0;
    this.updateScrapDisplay();
    this.ensurePartsInBay();
    this.render();
  }

  private finishShipBuilderSession(): void {
    if (this.shipBuilderStartTime === null) return;
    const elapsedSeconds = Math.max(0, (Date.now() - this.shipBuilderStartTime) / 1000);
    this.shipBuilderStartTime = null;
    this.totalShipBuilderTime = campaignManager.addShipBuilderTime(elapsedSeconds);
  }

  /**
   * Проверка и центрирование деталей корабля внутри отсека сборки
   * (предотвращает выход деталей за границы 9х9 сетки на телефонах при загрузке сборки с ПК)
   */
  private ensurePartsInBay(): void {
    if (!this.centerBayEl || this.droppedParts.length === 0) return;
    const { cellW, cellH, maxW: bayW, maxH: bayH } = this.getGridMetrics();

    const bodyPart = this.droppedParts.find((p) => p.part.category === 'body');
    const pilotPart = this.droppedParts.find((p) => p.part.category === 'pilot');
    let anchorX = 0;
    let anchorY = 0;
    if (bodyPart) {
      anchorX = bodyPart.x;
      anchorY = bodyPart.y;
    } else if (pilotPart) {
      anchorX = pilotPart.x;
      anchorY = pilotPart.y;
    } else {
      let sumX = 0;
      let sumY = 0;
      this.droppedParts.forEach((p) => {
        sumX += p.x;
        sumY += p.y;
      });
      anchorX = sumX / this.droppedParts.length;
      anchorY = sumY / this.droppedParts.length;
    }

    const targetX = this.snapToSquareCenter(bayW / 2, cellW);
    const targetY = this.snapToSquareCenter(bayH / 2, cellH);

    let isOutOfBounds = false;
    for (const p of this.droppedParts) {
      if (p.x < 15 || p.x > bayW - 15 || p.y < 15 || p.y > bayH - 15) {
        isOutOfBounds = true;
        break;
      }
    }

    if (isOutOfBounds || Math.abs(anchorX - targetX) > 40 || Math.abs(anchorY - targetY) > 40) {
      const shiftX = this.snapToHalfGrid(targetX - anchorX, cellW);
      const shiftY = this.snapToHalfGrid(targetY - anchorY, cellH);
      this.droppedParts.forEach((p) => {
        p.x = Number(Math.max(15, Math.min(bayW - 15, p.x + shiftX)).toFixed(2));
        p.y = Number(Math.max(15, Math.min(bayH - 15, p.y + shiftY)).toFixed(2));
      });
      this.renderDroppedParts();
      this.persistAssembly();
    }
  }

  /**
   * Закрытие модального окна
   */
  public close(): void {
    this.finishShipBuilderSession();
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
    this.renderPartsColumn();
    this.renderLimitsGrid();
    this.renderDroppedParts();
    this.updateSelectedToolbar();
  }

  /**
   * Рендеринг тактических индикаторов лимитов:
   * Корпус, Кабина, Крылья, Двигатели, Пушки
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
      const isMissing = current < 1;
      const badge = document.createElement('div');
      badge.className = `limit-chip ${isFull ? 'full' : isMissing ? 'missing' : 'available'}`;
      badge.setAttribute('data-category', catId);
      badge.setAttribute(
        'title',
        `${cfg.title}: установлено ${current} из ${cfg.max}${isMissing ? ' (ОБЯЗАТЕЛЬНО: минимум 1 для вылета)' : ''}`
      );

      badge.innerHTML = `
        <div class="limit-chip-left">
          <span class="limit-label">${cfg.title}</span>
        </div>
        <div class="limit-chip-right">
          <span class="limit-val ${isFull ? 'full-val' : isMissing ? 'missing-val' : ''}">${current}/${cfg.max}</span>
          ${isFull ? '<span class="limit-check">✓</span>' : isMissing ? '<span class="limit-missing-warn" title="Требуется минимум 1 деталь">!</span>' : ''}
        </div>
      `;

      badge.addEventListener('click', () => {
        const matchingParts = this.droppedParts.filter((p) => p.part.category === catId);
        if (matchingParts.length === 0) return;

        const currentIdx = matchingParts.findIndex((p) => p.uid === this.selectedPartUid);
        const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % matchingParts.length;
        const targetPart = matchingParts[nextIdx];

        soundFx.playUiClick();
        this.selectPart(targetPart.uid);
      });

      this.limitsGridEl.appendChild(badge);
    });

    this.renderLimitsSelection();

    if (this.partsCounterEl) {
      const total = this.droppedParts.length;
      let maxTotal = 0;
      catOrder.forEach((id) => {
        maxTotal += CATEGORY_LIMITS[id]?.max || 1;
      });
      this.partsCounterEl.textContent = `ДЕТАЛЕЙ: ${total} / ${maxTotal}`;
    }
  }

  /**
   * 1. РЕНДЕРИНГ ЛЕВОГО СТОЛБЦА: МОДУЛИ (Корпус, Кабина, Крылья, Двигатели, Пушки)
   * Вертикальный порядок: Значок -> Название части -> Количество
   */
  private renderCategoriesColumn(): void {
    this.categoriesListEl.innerHTML = '';

    this.catalog.forEach((cat) => {
      const btn = document.createElement('button');
      const isActive = cat.id === this.activeCategoryId;
      const count = this.getCategoryCount(cat.id);
      const limit = CATEGORY_LIMITS[cat.id]?.max || 1;
      const isFull = count >= limit;
      const isMissing = count < 1;

      btn.className = `category-col-btn ${isActive ? 'active' : ''} ${isFull ? 'category-full' : ''} ${isMissing ? 'category-missing' : ''}`;
      btn.type = 'button';
      btn.setAttribute('data-category', cat.id);

      btn.innerHTML = `
        <div class="col-btn-inner">
          <div class="cat-icon-box">${cat.iconSvg}</div>
          <span class="cat-title">${cat.title}</span>
          <span class="cat-count-badge ${isFull ? 'badge-full' : isMissing ? 'badge-missing' : ''}">${count}/${limit}</span>
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
    this.renderPartsColumn();

    const flowEl = this.modalEl.querySelector('#shipyard-columns-flow');
    if (flowEl) flowEl.scrollLeft = 0;
  }

  /**
   * 2. РЕНДЕРИНГ СТОЛБЦА ДЕТАЛЕЙ (03 // ДЕТАЛИ)
   * Все детали выбранной категории распределяются по 3 колонкам редкости.
   */
  private renderPartsColumn(): void {
    const activeCat = this.catalog.find((c) => c.id === this.activeCategoryId);
    if (!activeCat) return;

    const items = activeCat.directItems;

    // Столбец деталей
    this.partsColEl.style.display = 'flex';
    this.partsTagEl.textContent = `${activeCat.title.toUpperCase()} (${items.length})`;
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
    const isCommon = rarity.type === 'common';
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
            <div class="part-price-block part-price-owned ${isCommon ? 'no-price' : ''}">
              ${isCommon ? '' : `<span class="part-price-val"><span class="price-icon">⚙</span> ${price}</span>`}
              <span class="part-status-badge owned">✓ В АРСЕНАЛЕ</span>
            </div>
          </div>
        </div>
      `;

      card.addEventListener('mouseenter', () => soundFx.playUiHover());

      // При клике на карточку подсказываем, что модуль нужно перетащить в ангар
      card.addEventListener('click', () => {
        if (this.hasMovedSignificantly) return;
        soundFx.playUiHover();
        this.showAlert(`👆 ПЕРЕТАЩИТЕ МОДУЛЬ «${displayName.toUpperCase()}» В АНГАР`);
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
    this.renderLimitsSelection();
  }

  /**
   * Подсветка соответствующей категории выбранной детали в блоке 04 (Части)
   */
  private renderLimitsSelection(): void {
    if (!this.limitsGridEl) return;
    const selectedPart = this.droppedParts.find((p) => p.uid === this.selectedPartUid);
    const selectedCatId = selectedPart?.part.category ?? null;

    const chips = this.limitsGridEl.querySelectorAll('.limit-chip');
    chips.forEach((chip) => {
      const catId = chip.getAttribute('data-category');
      if (selectedCatId && catId === selectedCatId) {
        chip.classList.add('selected');
      } else {
        chip.classList.remove('selected');
      }
    });
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
      this.btnRotateMinus45.disabled = true;
      this.btnRotate90.disabled = true;
      this.btnFlipX.disabled = true;
      this.btnDeleteSelected.disabled = true;
      if (this.btnNudgeLeft) this.btnNudgeLeft.disabled = true;
      if (this.btnNudgeDown) this.btnNudgeDown.disabled = true;
      if (this.btnNudgeUp) this.btnNudgeUp.disabled = true;
      if (this.btnNudgeRight) this.btnNudgeRight.disabled = true;
      this.selectedToolbarEl.classList.remove('has-selection');
      return;
    }

    this.btnLayerUp.disabled = false;
    this.btnLayerDown.disabled = false;
    this.btnRotate45.disabled = false;
    this.btnRotateMinus45.disabled = false;
    this.btnRotate90.disabled = false;
    this.btnFlipX.disabled = false;
    this.btnDeleteSelected.disabled = false;
    if (this.btnNudgeLeft) this.btnNudgeLeft.disabled = false;
    if (this.btnNudgeDown) this.btnNudgeDown.disabled = false;
    if (this.btnNudgeUp) this.btnNudgeUp.disabled = false;
    if (this.btnNudgeRight) this.btnNudgeRight.disabled = false;
    this.selectedToolbarEl.classList.add('has-selection');
  }

  /**
   * Определение фактического размера ячейки фоновой сетки и рабочей области отсека
   */
  private getGridMetrics(): { cellW: number; cellH: number; maxW: number; maxH: number } {
    const surface = this.modalEl.querySelector('#hangar-drop-surface') as HTMLElement | null;
    const gridEl = this.centerBayEl?.querySelector('.hangar-grid-lines') as HTMLElement | null;
    const isCompactBay =
      isMobilePhone() ||
      (typeof window !== 'undefined' && (window.innerWidth <= 960 || window.innerHeight <= 500));

    const maxW =
      surface && surface.clientWidth > 0
        ? surface.clientWidth
        : this.centerBayEl && this.centerBayEl.clientWidth > 0
          ? this.centerBayEl.clientWidth
          : isCompactBay
            ? 195.6
            : 346.4;
    const maxH =
      surface && surface.clientHeight > 0
        ? surface.clientHeight
        : this.centerBayEl && this.centerBayEl.clientHeight > 0
          ? this.centerBayEl.clientHeight
          : isCompactBay
            ? 195.6
            : 346.4;

    const fallbackW = isCompactBay ? maxW / 9 : 22;
    const fallbackH = isCompactBay ? maxH / 9 : 22;
    let cellW = fallbackW;
    let cellH = fallbackH;

    if (gridEl && typeof window !== 'undefined' && window.getComputedStyle) {
      const bgSize = window.getComputedStyle(gridEl).backgroundSize;
      if (bgSize) {
        const firstLayer = bgSize.split(',')[0].trim();
        const parts = firstLayer.split(/\s+/);
        cellW = this.parseGridCellDimension(parts[0], maxW, fallbackW);
        cellH = this.parseGridCellDimension(parts[1] ?? parts[0], maxH, fallbackH);
      }
    }

    return { cellW, cellH, maxW, maxH };
  }

  private parseGridCellDimension(
    rawToken: string | undefined,
    axisSize: number,
    fallback: number,
  ): number {
    if (!rawToken) return fallback;
    const token = rawToken.trim().toLowerCase();
    if (token.endsWith('px')) {
      const px = parseFloat(token);
      return Number.isFinite(px) && px > 4 ? px : fallback;
    }
    if (token.endsWith('%')) {
      const pct = parseFloat(token);
      const px = (pct / 100) * axisSize;
      return Number.isFinite(px) && px > 4 ? px : fallback;
    }
    return fallback;
  }

  private snapToSquareCenter(value: number, cellSize: number): number {
    const cellIdx = Math.round(value / cellSize - 0.5);
    return Number(((cellIdx + 0.5) * cellSize).toFixed(2));
  }

  private snapToHalfGrid(value: number, cellSize: number): number {
    const halfStep = cellSize / 2;
    return Number((Math.round(value / halfStep) * halfStep).toFixed(2));
  }

  /**
   * Вычисление следующей координаты по сетке с шагом в полклетки (центр квадрата или граница)
   */
  private stepAlongHalfGrid(
    current: number,
    direction: number,
    cellSize: number,
    minPos: number,
    maxPos: number,
  ): number {
    if (direction === 0) return current;

    const halfStep = cellSize / 2;
    const idx = current / halfStep;
    const nearestIdx = Math.round(idx);
    const dirSign = Math.sign(direction);

    const nextIdx =
      Math.abs(idx - nearestIdx) < 0.08
        ? nearestIdx + dirSign
        : dirSign > 0
          ? Math.ceil(idx)
          : Math.floor(idx);

    const minIdx = Math.ceil(minPos / halfStep);
    const maxIdx = Math.floor(maxPos / halfStep);
    const clampedIdx = Math.max(minIdx, Math.min(maxIdx, nextIdx));

    return Number((clampedIdx * halfStep).toFixed(2));
  }

  /**
   * Сдвиг выбранной детали по сетке на полквадратика в направлении (dx, dy)
   */
  public nudgeSelectedPart(dx: number, dy: number): void {
    if (!this.selectedPartUid) return;

    const part = this.droppedParts.find((p) => p.uid === this.selectedPartUid);
    if (!part) return;

    this.clearDisconnectedMarks();
    const { cellW, cellH, maxW, maxH } = this.getGridMetrics();

    if (dx !== 0) {
      part.x = this.stepAlongHalfGrid(part.x, dx, cellW, 15, maxW - 15);
    }
    if (dy !== 0) {
      part.y = this.stepAlongHalfGrid(part.y, dy, cellH, 15, maxH - 15);
    }

    this.updateDroppedPartElement(part);
    this.persistAssembly();
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
   * Поворот выбранного модуля на заданное количество градусов (например, +45°, -45°, +90°)
   */
  public rotateSelected(degrees: number): void {
    if (!this.selectedPartUid) return;

    const part = this.droppedParts.find((p) => p.uid === this.selectedPartUid);
    if (!part) return;

    this.clearDisconnectedMarks();
    part.rotation = (part.rotation + degrees) % 360;
    if (part.rotation < 0) {
      part.rotation += 360;
    }
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
    const catCounts: Record<string, number> = {};
    for (const s of saved) {
      const part = this.findPartById(s.partId);
      if (!part) return false;

      // Проверяем, разблокирован ли модуль
      const mod = getModuleByPartId(part.id);
      if (mod && !campaignManager.isModuleUnlocked(mod.id)) {
        return false;
      }

      // Не восстанавливаем детали сверх текущего лимита категории
      const currentCatCount = catCounts[part.category] || 0;
      const maxLimit = CATEGORY_LIMITS[part.category]?.max || 1;
      if (currentCatCount >= maxLimit) {
        continue;
      }
      catCounts[part.category] = currentCatCount + 1;

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

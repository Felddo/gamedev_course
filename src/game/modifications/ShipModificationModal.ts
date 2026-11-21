import { soundFx } from '../audio';
import { ShipModification, getRandomModifications } from './modificationsData';
import { campaignManager } from '../campaign/CampaignManager';

export class ShipModificationModal {
  private modalEl: HTMLElement | null = null;
  private cardsContainer: HTMLElement | null = null;
  private isOpenState = false;
  private currentOffers: ShipModification[] = [];
  private onSelectCallback: ((selected: ShipModification) => void) | null = null;
  private activeMissionId = '';
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.ensureDom();
  }

  private ensureDom(): void {
    let el = document.getElementById('modal-modification');
    if (!el) {
      el = document.createElement('div');
      el.id = 'modal-modification';
      el.className = 'hidden';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', 'Выберите модификацию корабля');

      el.innerHTML = `
        <div class="modal-modification-window">
          <div class="modal-card-scanlines"></div>
          <header class="mod-header-wrap">
            <div class="mod-badge">UPGRADE // СИСТЕМА МОДИФИКАЦИЙ</div>
            <h2 class="mod-title">ВЫБЕРИТЕ МОДИФИКАЦИЮ</h2>
            <div class="mod-subtitle" id="mod-modal-subtitle">ВЫБЕРИТЕ 1 ИЗ 3 СИСТЕМ // ДЕЙСТВУЕТ ДО КОНЦА КАМПАНИИ</div>
          </header>

          <div class="mod-cards-grid" id="mod-cards-grid"></div>

          <footer class="mod-footer">
            <span class="mod-hint-text">СОВЕТ: НАЖМИТЕ НА КАРТОЧКУ ИЛИ КЛАВИШИ [1], [2], [3] ДЛЯ ВЫБОРА</span>
          </footer>
        </div>
      `;

      document.body.appendChild(el);
    }

    this.modalEl = el;
    this.cardsContainer = el.querySelector('#mod-cards-grid');
  }

  public isOpen(): boolean {
    return this.isOpenState;
  }

  public open(
    missionId: string,
    onSelect: (selected: ShipModification) => void,
  ): void {
    this.ensureDom();
    if (!this.modalEl || !this.cardsContainer) return;

    this.activeMissionId = missionId;
    this.onSelectCallback = onSelect;
    this.isOpenState = true;

    // Получаем список уже установленных модификаций
    const appliedIds = campaignManager.getAppliedUpgradeIds();

    // Генерируем 3 случайных уникальных модификаций
    this.currentOffers = getRandomModifications(3, appliedIds);

    const subtitleEl = this.modalEl.querySelector('#mod-modal-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = `КОНТРОЛЬНЫЙ РУБЕЖ [${missionId}] // ВЫБЕРИТЕ 1 ИЗ ${this.currentOffers.length} СИСТЕМ ДО КОНЦА КАМПАНИИ`;
    }

    this.renderCards();

    // Удаляем предыдущий слушатель, если остался
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
    }

    // Слушатель клавиатурных шорткатов (1, 2, 3)
    this.keydownListener = (e: KeyboardEvent) => {
      if (!this.isOpenState) return;
      if (e.key === '1' && this.currentOffers[0]) {
        e.preventDefault();
        this.selectModification(this.currentOffers[0], 0);
      } else if (e.key === '2' && this.currentOffers[1]) {
        e.preventDefault();
        this.selectModification(this.currentOffers[1], 1);
      } else if (e.key === '3' && this.currentOffers[2]) {
        e.preventDefault();
        this.selectModification(this.currentOffers[2], 2);
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.modalEl.classList.remove('hidden');
    soundFx.playSuperReady();
  }

  public close(): void {
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
    }
    this.isOpenState = false;
  }

  private renderCards(): void {
    const container = this.cardsContainer;
    if (!container) return;
    container.innerHTML = '';

    this.currentOffers.forEach((mod, index) => {
      const card = document.createElement('div');
      card.className = 'mod-card';
      card.setAttribute('data-mod-id', mod.id);
      card.setAttribute('data-index', index.toString());

      // CSS переменные для уникального визуального оформления категории
      card.style.setProperty('--card-accent', mod.accentColor);
      card.style.setProperty('--card-secondary', mod.secondaryColor);
      card.style.setProperty('--card-badge-bg', mod.badgeBg);
      card.style.setProperty('--card-border', `${mod.accentColor}88`);
      card.style.setProperty('--card-glow', `${mod.accentColor}55`);
      card.style.setProperty('--card-inner-glow', `${mod.accentColor}22`);

      card.innerHTML = `
        <div class="mod-card-top">
          <span class="mod-category-badge">${mod.categoryLabel}</span>
          <span class="mod-card-index">[${index + 1}]</span>
        </div>

        <div class="mod-icon-wrapper">
          <div class="mod-icon-svg">${mod.iconSvg}</div>
        </div>

        <h3 class="mod-name">${mod.name}</h3>

        <div class="mod-bonus-badge">${mod.bonusValue}</div>

        <div class="mod-short-desc">${mod.shortDesc}</div>

        <button type="button" class="mod-select-btn" data-btn-index="${index}">
          ВЫБРАТЬ // [${index + 1}]
        </button>
      `;

      // Звук при наведении
      card.addEventListener('mouseenter', () => {
        if (!card.classList.contains('dimmed') && !card.classList.contains('selected')) {
          soundFx.playUiHover();
        }
      });

      // Клик по карточке или кнопке
      card.addEventListener('click', () => {
        this.selectModification(mod, index);
      });

      container.appendChild(card);
    });
  }

  private selectModification(mod: ShipModification, index: number): void {
    if (!this.isOpenState || !this.cardsContainer) return;

    soundFx.playUpgradeSelect();

    const allCards = this.cardsContainer.querySelectorAll<HTMLElement>('.mod-card');
    allCards.forEach((c, idx) => {
      if (idx === index) {
        c.classList.add('selected');
        const btn = c.querySelector<HTMLButtonElement>('.mod-select-btn');
        if (btn) {
          btn.textContent = 'ВЫБРАНО ✓';
        }
      } else {
        c.classList.add('dimmed');
      }
    });

    // Фиксация в менеджере кампании
    campaignManager.recordModificationReward(this.activeMissionId, mod.id);

    // Задержка на визуальную анимацию подтверждения выбора перед закрытием
    window.setTimeout(() => {
      this.close();
      if (this.onSelectCallback) {
        this.onSelectCallback(mod);
        this.onSelectCallback = null;
      }
    }, 420);
  }
}

export const shipModificationModal = new ShipModificationModal();

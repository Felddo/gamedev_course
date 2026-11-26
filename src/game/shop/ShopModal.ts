import { soundFx } from '../audio';
import { MISSILE_RARITY_CONFIG, ShopMissileOffer } from './missilesCatalog';

export interface ShopOpenOptions {
  offers: ShopMissileOffer[];
  purchasedIds: Set<string>;
  getScrap: () => number;
  onBuy: (offer: ShopMissileOffer) => boolean;
  onClose: () => void;
}

/**
 * Окно летающего космического магазина:
 * - Отображает 3 случайные ракеты с модельками, названиями, описанием и ценами
 * - Цвет обводки зависит от редкости (обычный — серый, редкий — желтый, легендарный — красный)
 * - Сверху справа отображается доступный металлолом игрока
 * - Адаптивно для ПК и телефонов (портрет и ландшафт)
 */
export class ShopModal {
  private modalEl: HTMLElement | null = null;
  private cardsGridEl: HTMLElement | null = null;
  private scrapValEl: HTMLElement | null = null;
  private statusNoticeEl: HTMLElement | null = null;
  private exitBtn: HTMLButtonElement | null = null;
  private isOpenState = false;
  private options: ShopOpenOptions | null = null;

  constructor() {
    this.ensureDom();
  }

  private ensureDom(): void {
    let el = document.getElementById('modal-flying-shop');
    if (!el) {
      el = document.createElement('div');
      el.id = 'modal-flying-shop';
      el.className = 'holo-modal-backdrop hidden';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', 'Летающий магазин');

      el.innerHTML = `
        <div class="holo-modal-window shop-modal-window">
          <div class="modal-card-scanlines"></div>
          <span class="corner-bracket corner-tl"></span>
          <span class="corner-bracket corner-tr"></span>
          <span class="corner-bracket corner-bl"></span>
          <span class="corner-bracket corner-br"></span>

          <header class="modal-card-header shop-modal-header">
            <div class="modal-card-title-wrap">
              <span class="modal-badge shop-badge">SHOP</span>
              <h2>КОСМИЧЕСКИЙ МАГАЗИН</h2>
            </div>

            <div class="shop-scrap-pill" title="Доступный металлолом">
              <span class="shop-scrap-icon">⚙</span>
              <span class="shop-scrap-label">ЛОМ:</span>
              <span id="shop-scrap-balance" class="shop-scrap-val">0</span>
            </div>
          </header>

          <div class="modal-card-body shop-modal-body">
            <div id="shop-cards-grid" class="shop-cards-grid"></div>
            <div id="shop-status-notice" class="shop-status-notice" aria-live="polite"></div>
          </div>

          <footer class="modal-card-footer shop-modal-footer">
            <button id="btn-shop-exit" class="modal-action-btn shop-exit-btn" type="button">
              ВЫЙТИ
            </button>
          </footer>
        </div>
      `;

      document.body.appendChild(el);
    }

    this.modalEl = el;
    this.cardsGridEl = el.querySelector('#shop-cards-grid');
    this.scrapValEl = el.querySelector('#shop-scrap-balance');
    this.statusNoticeEl = el.querySelector('#shop-status-notice');

    const btn = el.querySelector<HTMLButtonElement>('#btn-shop-exit');
    if (btn && btn !== this.exitBtn) {
      this.exitBtn = btn;
      this.exitBtn.addEventListener('mouseenter', () => soundFx.playUiHover());
      this.exitBtn.addEventListener('click', () => {
        soundFx.playUiClick();
        this.close();
      });
    }
  }

  public isOpen(): boolean {
    return this.isOpenState;
  }

  public open(options: ShopOpenOptions): void {
    this.ensureDom();
    if (!this.modalEl) return;

    this.options = options;
    this.isOpenState = true;
    this.setNotice('');
    this.updateScrapDisplay();
    this.renderCards();
    this.modalEl.classList.remove('hidden');
  }

  public close(): void {
    if (!this.isOpenState) {
      this.modalEl?.classList.add('hidden');
      this.options = null;
      return;
    }

    this.isOpenState = false;
    this.modalEl?.classList.add('hidden');
    const cb = this.options?.onClose;
    this.options = null;
    if (cb) {
      cb();
    }
  }

  private updateScrapDisplay(): void {
    if (!this.scrapValEl || !this.options) return;
    this.scrapValEl.textContent = `${this.options.getScrap()}`;
  }

  private setNotice(text: string, isError = false): void {
    if (!this.statusNoticeEl) return;
    this.statusNoticeEl.textContent = text;
    this.statusNoticeEl.classList.toggle('is-error', isError);
    this.statusNoticeEl.classList.toggle('visible', text.length > 0);
  }

  private renderCards(): void {
    const grid = this.cardsGridEl;
    const opts = this.options;
    if (!grid || !opts) return;

    grid.innerHTML = '';
    const scrap = opts.getScrap();

    for (const offer of opts.offers) {
      const rarityInfo = MISSILE_RARITY_CONFIG[offer.rarity];
      const isPurchased = opts.purchasedIds.has(offer.id);
      const canAfford = scrap >= offer.price;

      const card = document.createElement('div');
      card.className = `shop-missile-card rarity-${offer.rarity}${isPurchased ? ' purchased' : ''}`;
      card.style.setProperty('--rarity-border', rarityInfo.borderColor);
      card.style.setProperty('--rarity-glow', rarityInfo.glowColor);
      card.style.setProperty('--rarity-badge-bg', rarityInfo.badgeBg);
      card.style.setProperty('--rarity-text', rarityInfo.textColor);

      const priceLabel = isPurchased ? 'КУПЛЕНО ✓' : `⚙ ${offer.price}`;

      card.innerHTML = `
        <div class="shop-card-header">
          <h3 class="shop-card-title">${offer.name}</h3>
          <div class="shop-card-meta">
            <span class="shop-rarity-tag">${rarityInfo.label}</span>
            <span class="shop-dmg-tag"><span class="shop-dmg-icon">⚡</span>УРОН: <strong class="shop-dmg-val">${offer.damage}</strong></span>
          </div>
        </div>

        <div class="shop-card-model-box">
          <img class="shop-missile-img" src="${offer.spriteUrl}" alt="${offer.name}" draggable="false" />
        </div>

        <p class="shop-card-desc">${offer.description}</p>

        <button type="button" class="shop-buy-btn${!canAfford && !isPurchased ? ' insufficient' : ''}" ${isPurchased ? 'disabled' : ''}>
          ${priceLabel}
        </button>
      `;

      const buyBtn = card.querySelector<HTMLButtonElement>('.shop-buy-btn');
      if (buyBtn && !isPurchased) {
        buyBtn.addEventListener('mouseenter', () => soundFx.playUiHover());
        buyBtn.addEventListener('click', () => {
          if (!this.options) return;
          if (this.options.getScrap() < offer.price) {
            soundFx.playUiClick();
            this.setNotice(`Недостаточно металлолома: нужно ⚙ ${offer.price}`, true);
            return;
          }
          const ok = this.options.onBuy(offer);
          if (ok) {
            soundFx.playUpgradeSelect();
            this.close();
          }
        });
      }

      grid.appendChild(card);
    }
  }
}

export const shopModal = new ShopModal();

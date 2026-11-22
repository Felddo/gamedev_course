/**
 * Виртуальный сенсорный джойстик для управления кораблем на мобильных устройствах.
 * - Располагается в левом нижнем углу экрана
 * - Обеспечивает плавное отклонение стика с нормализацией вектора
 * - Обрабатывает Pointer Events (pointerdown, pointermove, pointerup, pointercancel, lostpointercapture)
 * - Автоматически возвращается в центр при отпускании пальца
 */
export class VirtualJoystick {
  private container: HTMLElement | null = null;
  private baseEl: HTMLElement | null = null;
  private stickEl: HTMLElement | null = null;
  private activePointerId: number | null = null;
  private onMoveCallback: (x: number, y: number) => void;
  private isVisible = false;

  constructor(onMove: (x: number, y: number) => void) {
    this.onMoveCallback = onMove;
    this.initDom();
    this.initEvents();
  }

  private initDom(): void {
    let el = document.getElementById('virtual-joystick');
    if (!el) {
      el = document.createElement('div');
      el.id = 'virtual-joystick';
      el.className = 'virtual-joystick hidden';
      el.setAttribute('aria-label', 'Виртуальный джойстик');
      el.innerHTML = `
        <div class="joystick-base" id="joystick-base">
          <div class="joystick-ring"></div>
          <div class="joystick-crosshair"></div>
          <div class="joystick-stick" id="joystick-stick"></div>
        </div>
      `;
      const app = document.getElementById('app') || document.body;
      app.appendChild(el);
    }
    this.container = el;
    this.baseEl = el.querySelector('#joystick-base');
    this.stickEl = el.querySelector('#joystick-stick');
  }

  private initEvents(): void {
    if (!this.baseEl || !this.stickEl) return;

    const base = this.baseEl;

    base.addEventListener('pointerdown', (e: PointerEvent) => {
      // Игнорируем второстепенные пальцы, если джойстик уже захвачен
      if (this.activePointerId !== null) return;

      e.preventDefault();
      e.stopPropagation();

      this.activePointerId = e.pointerId;
      try {
        base.setPointerCapture(e.pointerId);
      } catch {
        // Fallback если pointer capture недоступен
      }
      base.classList.add('active');
      this.handlePointer(e.clientX, e.clientY);
    });

    base.addEventListener('pointermove', (e: PointerEvent) => {
      if (this.activePointerId === e.pointerId) {
        e.preventDefault();
        e.stopPropagation();
        this.handlePointer(e.clientX, e.clientY);
      }
    });

    const stopTracking = (e: PointerEvent) => {
      if (this.activePointerId === e.pointerId) {
        e.preventDefault();
        e.stopPropagation();
        this.reset();
      }
    };

    base.addEventListener('pointerup', stopTracking);
    base.addEventListener('pointercancel', stopTracking);
    base.addEventListener('lostpointercapture', stopTracking);

    window.addEventListener('blur', () => {
      this.reset();
    });
  }

  private handlePointer(clientX: number, clientY: number): void {
    if (!this.baseEl || !this.stickEl) return;

    const rect = this.baseEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    // Максимальный радиус отклонения стика внутри базы
    const maxRadius = 40;
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const stickX = Math.cos(angle) * clampedDist;
    const stickY = Math.sin(angle) * clampedDist;

    this.stickEl.style.transform = `translate(${stickX.toFixed(1)}px, ${stickY.toFixed(1)}px)`;

    // Нормализованный вектор управления от 0 до 1
    const normX = clampedDist > 0 ? stickX / maxRadius : 0;
    const normY = clampedDist > 0 ? stickY / maxRadius : 0;

    this.onMoveCallback(normX, normY);
  }

  public reset(): void {
    if (this.baseEl && this.activePointerId !== null) {
      try {
        if (this.baseEl.hasPointerCapture && this.baseEl.hasPointerCapture(this.activePointerId)) {
          this.baseEl.releasePointerCapture(this.activePointerId);
        }
      } catch {
        // Игнорируем ошибки сброса захвата
      }
    }
    this.activePointerId = null;
    if (this.baseEl) {
      this.baseEl.classList.remove('active');
    }
    if (this.stickEl) {
      this.stickEl.style.transform = 'translate(0px, 0px)';
    }
    this.onMoveCallback(0, 0);
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (!this.container) return;
    if (visible) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
      this.reset();
    }
  }

  public getIsVisible(): boolean {
    return this.isVisible;
  }

  public destroy(): void {
    this.reset();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

/**
 * Утилиты для точного определения типа устройства игрока:
 * - Смартфон / Телефон (iPhone, Android Mobile) — НЕ ПЛАНШЕТ
 * - Планшет (iPad, iPadOS, Android Tablet)
 * - ПК / Десктоп
 */

/**
 * Определение, играет ли пользователь с мобильного телефона / смартфона (НЕ ПЛАНШЕТА).
 *
 * Критерии:
 * 1. Наличие сенсорного ввода (touch).
 * 2. Исключение планшетов:
 *    - iPad (включая iPadOS в режиме десктопного Safari с maxTouchPoints > 1)
 *    - Android-планшеты (в Android User-Agent на планшетах отсутствует токен "Mobile")
 *    - Планшеты и сенсорные мониторы с наименьшей стороной экрана >= 600px
 * 3. Подтверждение смартфона:
 *    - Наличие в User-Agent явных маркеров мобильного телефона (iPhone, Android Mobile и т.д.)
 *    - Наименьшая сторона экрана < 520px (типичный диапазон смартфонов: 360-430px в ландшафте)
 */
export function isMobilePhone(): boolean {
  if (typeof window === 'undefined') return false;

  const hasTouch = Boolean('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
  if (!hasTouch) return false;

  const ua = navigator.userAgent || '';

  // 1. Исключение iPad и iPadOS (Safari на iPadOS маскируется под Macintosh, но имеет touchPoints > 1)
  const isIPad = Boolean(/iPad/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)));
  if (isIPad) return false;

  // 2. Исключение Android-планшетов: официальный стандарт Google Chrome гласит,
  // что в User-Agent планшетов Android есть токен "Android", но НЕТ токена "Mobile"
  const isAndroid = /Android/i.test(ua);
  const isMobileToken = /Mobile/i.test(ua);
  if (isAndroid && !isMobileToken) {
    return false; // Это планшет на Android
  }

  // 3. Анализ габаритов экрана:
  // У всех смартфонов наименьшая сторона экрана (высота в ландшафте или ширина в портрете) < 520px.
  // У планшетов (iPad Mini, iPad 10, Galaxy Tab) наименьшая сторона >= 600px (обычно 768-820px+).
  const screenMin = Math.min(
    window.screen?.width || window.innerWidth,
    window.screen?.height || window.innerHeight,
  );
  const viewportMin = Math.min(window.innerWidth, window.innerHeight);
  const shortestSide = Math.min(screenMin, viewportMin);

  if (shortestSide >= 600) {
    return false; // Сенсорное устройство с большим экраном (планшет / тач-ноутбук)
  }

  // 4. Подтверждение смартфона по User-Agent
  const isExplicitPhoneUA = /iPhone|iPod|Android.*Mobile|Mobile.*Android|BlackBerry|IEMobile|Opera Mini|webOS/i.test(ua);
  if (isExplicitPhoneUA) {
    return true;
  }

  // Резервный случай (эмуляция DevTools Responsive / кастомные мобильные браузеры):
  // Если есть сенсорный ввод и наименьшая сторона экрана < 520px — считаем телефоном
  return shortestSide < 520;
}

/**
 * Определение, играет ли пользователь с планшета (iPad, Android Tablet и др.).
 */
export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const hasTouch = Boolean('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
  if (!hasTouch) return false;

  if (isMobilePhone()) return false;

  const ua = navigator.userAgent || '';
  const isIPad = Boolean(/iPad/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)));
  const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);

  const screenMin = Math.min(
    window.screen?.width || window.innerWidth,
    window.screen?.height || window.innerHeight,
  );
  const viewportMin = Math.min(window.innerWidth, window.innerHeight);
  const shortestSide = Math.min(screenMin, viewportMin);

  return Boolean(isIPad || isAndroidTablet || (hasTouch && shortestSide >= 600 && shortestSide < 1200));
}

/**
 * Определение сенсорного устройства (смартфон или планшет).
 */
export function isMobileOrTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (isMobilePhone() || isTabletDevice()) return true;
  const hasTouch = Boolean('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  const isIPad = Boolean((navigator.maxTouchPoints && navigator.maxTouchPoints > 1) && /Macintosh/i.test(ua));
  return Boolean((hasTouch && (isMobileUA || isIPad)) || isMobileUA);
}

/**
 * Определение вертикальной ориентации экрана.
 */
export function isPortraitOrientation(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia && window.matchMedia('(orientation: portrait)').matches) {
    return true;
  }
  return window.innerHeight > window.innerWidth;
}

/**
 * Определение iPhone / iPod (устройства iOS, где Apple WebKit блокирует Element.requestFullscreen).
 */
export function isIPhoneDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPod/i.test(navigator.userAgent || '');
}

/**
 * Определение любого устройства Apple iOS / iPadOS.
 */
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return Boolean(/iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)));
}

/**
 * Синхронизация CSS-классов устройства на элементе document.body.
 */
export function updateDeviceClasses(): void {
  if (typeof document === 'undefined') return;

  const isPhone = isMobilePhone();
  const isTablet = isTabletDevice();
  const isMobileOrTablet = isMobileOrTabletDevice();

  if (isPhone) {
    document.body.classList.add('is-phone');
  } else {
    document.body.classList.remove('is-phone');
  }

  if (isTablet) {
    document.body.classList.add('is-tablet');
  } else {
    document.body.classList.remove('is-tablet');
  }

  if (isMobileOrTablet) {
    document.body.classList.add('is-mobile', 'touch-device');
    document.body.classList.remove('is-desktop');
  } else {
    document.body.classList.remove('is-mobile');
    document.body.classList.add('is-desktop');
  }
}

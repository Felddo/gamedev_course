import './style.css';
import { createGame } from './game/config';
import { soundFx } from './game/audio';
import { getRandomUpgrades, TankUpgrade } from './game/upgrades';
import { GAME_PHASES } from './game/constants';
import { GameScene } from './game/GameScene';
import menuBgUrl from './assets/menu_bg.jpg';

let phaserGame: Phaser.Game | null = null;
let isGameStarted = false;
let isGamePaused = false;

// DOM Elements
const mainMenu = document.getElementById('main-menu') as HTMLElement;
const gameContainer = document.getElementById('game') as HTMLElement;

// Установка фона главного экрана menu_bg.jpg
if (mainMenu) {
  mainMenu.style.backgroundImage = `
    linear-gradient(
      90deg,
      rgba(2, 6, 12, 0.88) 0%,
      rgba(2, 6, 12, 0.65) 30%,
      rgba(2, 6, 12, 0.25) 60%,
      rgba(2, 6, 12, 0.10) 80%,
      rgba(2, 6, 12, 0.35) 100%
    ),
    url("${menuBgUrl}")
  `;
  mainMenu.style.backgroundSize = 'cover';
  mainMenu.style.backgroundPosition = 'center center';
  mainMenu.style.backgroundRepeat = 'no-repeat';
}

const btnStart = document.getElementById('btn-start') as HTMLButtonElement;
const btnSettings = document.getElementById('btn-settings') as HTMLButtonElement;
const btnExit = document.getElementById('btn-exit') as HTMLButtonElement;

// Pause Modal Elements
const modalPause = document.getElementById('modal-pause') as HTMLElement;
const btnPauseResume = document.getElementById('btn-pause-resume') as HTMLButtonElement;
const btnPauseSettings = document.getElementById('btn-pause-settings') as HTMLButtonElement;
const btnPauseMenu = document.getElementById('btn-pause-menu') as HTMLButtonElement;
const btnPauseExit = document.getElementById('btn-pause-exit') as HTMLButtonElement;
const pauseVolumeSlider = document.getElementById('pause-volume-slider') as HTMLInputElement;
const pauseVolumeVal = document.getElementById('pause-volume-val') as HTMLElement;

// Modal Elements
const modalSettings = document.getElementById('modal-settings') as HTMLElement;
const modalSettingsCloseBtn = document.getElementById('modal-settings-close-btn') as HTMLButtonElement;
const modalSettingsX = document.getElementById('modal-settings-x') as HTMLButtonElement;
const toggleAudioBtn = document.getElementById('toggle-audio-btn') as HTMLButtonElement;
const toggleFullscreenBtn = document.getElementById('toggle-fullscreen-btn') as HTMLButtonElement;

const modalExit = document.getElementById('modal-exit') as HTMLElement;
const modalExitCancelBtn = document.getElementById('modal-exit-cancel-btn') as HTMLButtonElement;
const modalExitConfirmBtn = document.getElementById('modal-exit-confirm-btn') as HTMLButtonElement;

// Game Over Modal Elements
const modalGameOver = document.getElementById('modal-gameover') as HTMLElement;
const modalGoRestartBtn = document.getElementById('modal-go-restart-btn') as HTMLButtonElement;
const modalGoMenuBtn = document.getElementById('modal-go-menu-btn') as HTMLButtonElement;
const goTime = document.getElementById('go-time') as HTMLElement;
const goKills = document.getElementById('go-kills') as HTMLElement;
const goScore = document.getElementById('go-score') as HTMLElement;

// Rocket Dash HUD Elements
const dashHud = document.getElementById('dash-hud') as HTMLElement;
const dashTriggerCard = document.getElementById('dash-trigger-card') as HTMLElement;
const dashKeyBtn = document.getElementById('dash-key-btn') as HTMLElement;
const dashStatusText = document.getElementById('dash-status-text') as HTMLElement;
const dashCooldownBar = document.getElementById('dash-cooldown-bar') as HTMLElement;
const dashTimerText = document.getElementById('dash-timer-text') as HTMLElement;

// Super Tank Overdrive HUD Elements (ПКМ)
const superTriggerCard = document.getElementById('super-trigger-card') as HTMLElement;
const superMouseBtn = document.getElementById('super-mouse-btn') as HTMLElement;
const superStatusText = document.getElementById('super-status-text') as HTMLElement;
const superCooldownBar = document.getElementById('super-cooldown-bar') as HTMLElement;
const superTimerText = document.getElementById('super-timer-text') as HTMLElement;
const superLabelText = document.getElementById('super-label-text') as HTMLElement;

// Phase Banner & Upgrades Elements (Голограмма фаз боя и выбор тактических апгрейдов)
const phaseBanner = document.getElementById('phase-banner') as HTMLElement;
const phaseMainTitle = document.getElementById('phase-main-title') as HTMLElement;
const phaseSubtitle = document.getElementById('phase-subtitle') as HTMLElement;
const phaseHeaderCode = document.getElementById('phase-header-code') as HTMLElement;
const phaseUpgradesSection = document.getElementById('phase-upgrades-section') as HTMLElement;
const phaseUpgradesGrid = document.getElementById('phase-upgrades-grid') as HTMLElement;
let phaseBannerTimer: number | null = null;
const appliedUpgradeIds = new Set<string>();

/**
 * Отрисовка 3 блоков улучшений башни и гусениц
 */
function renderUpgradeCards(upgrades: TankUpgrade[]): void {
  if (!phaseUpgradesGrid) return;
  phaseUpgradesGrid.innerHTML = '';

  upgrades.forEach((upgrade) => {
    const card = document.createElement('div');
    card.className = `upgrade-card target-${upgrade.target}`;
    card.style.setProperty('--card-accent', upgrade.accentColor);
    card.style.setProperty('--card-glow', `${upgrade.accentColor}80`);
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    card.innerHTML = `
      <span class="corner-bracket corner-tl"></span>
      <span class="corner-bracket corner-tr"></span>
      <span class="corner-bracket corner-bl"></span>
      <span class="corner-bracket corner-br"></span>

      <span class="upgrade-badge">${upgrade.badgeText}</span>
      <div class="upgrade-icon-wrap" style="border-color: ${upgrade.accentColor}70; box-shadow: 0 0 16px ${upgrade.accentColor}40;">
        ${upgrade.iconSvg}
      </div>
      <h3 class="upgrade-title">${upgrade.title}</h3>
      <div class="upgrade-short-desc" style="color: ${upgrade.accentColor};">${upgrade.shortDesc}</div>
      <p class="upgrade-desc">${upgrade.description}</p>
      <button class="upgrade-select-btn" type="button">ВЫБРАТЬ МОДУЛЬ</button>
    `;

    card.addEventListener('mouseenter', () => {
      soundFx.playUiHover();
    });

    const selectUpgrade = () => {
      if (card.classList.contains('selected')) return;
      card.classList.add('selected');
      soundFx.playUpgradeSelect();

      // Фиксация выбранного улучшения в пуле и отправка в сцену
      appliedUpgradeIds.add(upgrade.id);
      window.dispatchEvent(
        new CustomEvent('apply-tank-upgrade', {
          detail: { id: upgrade.id },
        }),
      );

      // Короткая пауза для светового эффекта подтверждения перед возвратом в бой
      window.setTimeout(() => {
        hidePhaseAnnouncement();
        if (phaserGame) {
          const scene = phaserGame.scene.getScene('GameScene');
          if (scene && scene.scene.isPaused() && !isGamePaused) {
            scene.scene.resume();
          }
        }
      }, 340);
    };

    card.addEventListener('click', selectUpgrade);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectUpgrade();
      }
    });

    phaseUpgradesGrid.appendChild(card);
  });
}

/**
 * Отображение голографического оповещения о смене/старте боевой фазы
 */
function showPhaseAnnouncement(phaseNumber: number, title?: string, subtitle?: string): void {
  if (!phaseBanner) return;

  if (phaseBannerTimer !== null) {
    window.clearTimeout(phaseBannerTimer);
    phaseBannerTimer = null;
  }

  const phaseTitle = title || `Фаза ${phaseNumber}`;
  let defaultSubtitle = '';
  if (phaseNumber === 1) {
    defaultSubtitle = 'ПРОТОКОЛ: ЗАЧИСТКА ПЕРИМЕТРА // СЛЕДУЮЩАЯ ФАЗА: 1000 ОЧКОВ';
  } else if (phaseNumber === 2) {
    defaultSubtitle = 'ВНИМАНИЕ: ОБНАРУЖЕНЫ ТЯЖЕЛЫЕ КИБОРГИ Т-800!';
  } else {
    defaultSubtitle = `БОЕВОЙ СЕКТОР ОБНОВЛЕН // ФАЗА ${phaseNumber}`;
  }

  if (phaseMainTitle) phaseMainTitle.textContent = phaseTitle;
  if (phaseSubtitle) phaseSubtitle.textContent = subtitle || defaultSubtitle;
  if (phaseHeaderCode) {
    phaseHeaderCode.textContent =
      phaseNumber === 2
        ? 'SYS_WARNING // ТАКТИЧЕСКАЯ УГРОЗА ВЫСШЕГО УРОВНЯ'
        : 'SYS_TACTICAL // ОБНОВЛЕНИЕ БОЕВОГО СЕКТОРА';
  }

  if (phaseNumber >= 2) {
    phaseBanner.classList.add('phase-alert');
    phaseBanner.classList.add('has-upgrades');

    // Во всех фазах кроме первой снизу генерируются 3 блока с улучшениями (башня/гусеницы)
    if (phaseUpgradesSection && phaseUpgradesGrid) {
      phaseUpgradesSection.classList.remove('hidden');
      const selectedUpgrades = getRandomUpgrades(3, appliedUpgradeIds);
      renderUpgradeCards(selectedUpgrades);
    }

    // Приостанавливаем игру на время выбора улучшений, чтобы игрока не атаковали
    if (phaserGame) {
      const scene = phaserGame.scene.getScene('GameScene');
      if (scene && scene.scene.isActive()) {
        scene.scene.pause();
      }
    }
  } else {
    phaseBanner.classList.remove('phase-alert');
    phaseBanner.classList.remove('has-upgrades');
    if (phaseUpgradesSection) {
      phaseUpgradesSection.classList.add('hidden');
    }
    if (phaseUpgradesGrid) {
      phaseUpgradesGrid.innerHTML = '';
    }

    // В первой фазе плашка автоматически скрывается через 3.8 сек
    phaseBannerTimer = window.setTimeout(() => {
      phaseBanner.classList.add('hidden');
      phaseBanner.classList.remove('animate-pulse');
      phaseBannerTimer = null;
    }, 3800);
  }

  phaseBanner.classList.remove('hidden');
  phaseBanner.classList.remove('animate-pulse');
  void phaseBanner.offsetWidth; // Принудительный reflow для перезапуска CSS анимации
  phaseBanner.classList.add('animate-pulse');
}

function hidePhaseAnnouncement(): void {
  if (phaseBannerTimer !== null) {
    window.clearTimeout(phaseBannerTimer);
    phaseBannerTimer = null;
  }
  if (phaseBanner) {
    phaseBanner.classList.add('hidden');
    phaseBanner.classList.remove('animate-pulse');
    phaseBanner.classList.remove('has-upgrades');
  }
  if (phaseUpgradesSection) {
    phaseUpgradesSection.classList.add('hidden');
  }
}

/**
 * Инициализация звуковых эффектов при наведении на голографические кнопки
 */
function attachAudioHover(button: HTMLElement): void {
  button.addEventListener('mouseenter', () => {
    soundFx.playUiHover();
  });
}

[
  btnStart,
  btnSettings,
  btnExit,
  btnPauseResume,
  btnPauseSettings,
  btnPauseMenu,
  btnPauseExit,
  toggleAudioBtn,
  toggleFullscreenBtn,
  modalSettingsCloseBtn,
  modalSettingsX,
  modalExitCancelBtn,
  modalExitConfirmBtn,
  modalGoRestartBtn,
  modalGoMenuBtn,
  dashTriggerCard,
  superTriggerCard,
].forEach((btn) => {
  if (btn) attachAudioHover(btn);
});

/**
 * Поставить игру на тактическую паузу (Escape)
 */
function pauseGame(): void {
  if (!isGameStarted || !mainMenu.classList.contains('hidden')) return;
  if (modalGameOver && !modalGameOver.classList.contains('hidden')) return;
  if (!modalPause.classList.contains('hidden')) return;

  isGamePaused = true;
  soundFx.playUiClick();
  modalPause.classList.remove('hidden');

  if (phaserGame) {
    const scene = phaserGame.scene.getScene('GameScene');
    if (scene && scene.scene.isActive()) {
      scene.scene.pause();
    }
  }
}

/**
 * Снять игру с паузы и продолжить бой
 */
function resumeGame(): void {
  isGamePaused = false;
  soundFx.playUiClick();
  modalPause.classList.add('hidden');
  modalSettings.classList.add('hidden');
  modalExit.classList.add('hidden');

  if (phaserGame) {
    const scene = phaserGame.scene.getScene('GameScene');
    if (scene && scene.scene.isPaused()) {
      scene.scene.resume();
    }
  }
}

/**
 * Запуск боевой игры из главного меню (переход в боевой режим с нормальной камерой)
 */
function launchGame(): void {
  soundFx.playUiClick();

  // Плавное скрытие главного меню и отображение игрового холста
  mainMenu.classList.add('hidden');
  gameContainer?.classList.remove('hidden');
  dashHud?.classList.remove('hidden');
  modalPause?.classList.add('hidden');
  isGamePaused = false;
  isGameStarted = true;

  // Сброс установленных улучшений
  appliedUpgradeIds.clear();

  // Отображение зеленой голограммы "Фаза 1" при старте игры
  showPhaseAnnouncement(1);

  if (phaserGame) {
    phaserGame.scale.refresh();
    const scene = phaserGame.scene.getScene('GameScene') as GameScene;
    if (scene) {
      if (scene.scene.isPaused()) {
        scene.scene.resume();
      }
      scene.startCombatSession();
    }
  }

  // Обновление размеров полноэкранного холста
  window.requestAnimationFrame(() => {
    phaserGame?.scale.refresh();
  });
}

/**
 * Возврат в главное меню с отображением menu_bg.jpg и кнопок управления
 */
function returnToMainMenu(): void {
  appliedUpgradeIds.clear();
  hideGameOver();
  hidePhaseAnnouncement();
  modalPause?.classList.add('hidden');
  modalSettings?.classList.add('hidden');
  modalExit?.classList.add('hidden');
  isGamePaused = false;
  isGameStarted = false;

  dashHud?.classList.add('hidden');
  gameContainer?.classList.add('hidden');
  mainMenu.classList.remove('hidden');

  if (phaserGame) {
    const scene = phaserGame.scene.getScene('GameScene') as GameScene;
    if (scene) {
      if (scene.scene.isPaused()) {
        scene.scene.resume();
      }
      scene.enterMenuMode();
    }
  }
}

window.addEventListener('return-to-menu', () => {
  returnToMainMenu();
});

window.addEventListener('resize', () => {
  if (phaserGame && isGameStarted) {
    phaserGame.scale.refresh();
  }
});

// Кнопка "Начать игру"
btnStart?.addEventListener('click', () => {
  launchGame();
});

// Кнопка "Настройки"
function openSettings(): void {
  soundFx.playUiClick();
  modalSettings.classList.remove('hidden');
}

function closeSettings(): void {
  soundFx.playUiClick();
  modalSettings.classList.add('hidden');
}

btnSettings?.addEventListener('click', openSettings);
modalSettingsCloseBtn?.addEventListener('click', closeSettings);
modalSettingsX?.addEventListener('click', closeSettings);

// Регулировка громкости и синхронизация со слайдером
function updateVolumeSliderUI(val: number): void {
  if (pauseVolumeSlider) {
    pauseVolumeSlider.value = val.toString();
    pauseVolumeSlider.style.setProperty('--slider-fill', `${val}%`);
  }
  if (pauseVolumeVal) {
    pauseVolumeVal.textContent = val === 0 ? '0% (ВЫКЛ)' : `${val}%`;
  }

  const waves = document.querySelectorAll<SVGElement>('.vol-wave');
  waves.forEach((w) => {
    w.style.opacity = val === 0 ? '0.2' : val < 50 ? '0.5' : '1';
  });

  const indicator = toggleAudioBtn?.querySelector('.toggle-text');
  if (val === 0 || soundFx.isMuted()) {
    toggleAudioBtn?.classList.remove('active');
    if (indicator) indicator.textContent = 'ВЫКЛ [OFF]';
  } else {
    toggleAudioBtn?.classList.add('active');
    if (indicator) indicator.textContent = 'ВКЛ [ON]';
  }
}

let lastSliderAudioTime = 0;
pauseVolumeSlider?.addEventListener('input', () => {
  const val = parseInt(pauseVolumeSlider.value, 10);
  soundFx.setVolume(val / 100);
  updateVolumeSliderUI(val);

  const now = Date.now();
  if (now - lastSliderAudioTime > 80) {
    soundFx.playUiHover();
    lastSliderAudioTime = now;
  }
});

pauseVolumeSlider?.addEventListener('change', () => {
  soundFx.playUiClick();
});

// Инициализация громкости (по умолчанию 100%)
updateVolumeSliderUI(100);

// Кнопки меню паузы
btnPauseResume?.addEventListener('click', resumeGame);

btnPauseSettings?.addEventListener('click', openSettings);

btnPauseMenu?.addEventListener('click', () => {
  soundFx.playUiClick();
  returnToMainMenu();
});

btnPauseExit?.addEventListener('click', openExit);

// Переключатель звука в настройках
toggleAudioBtn?.addEventListener('click', () => {
  const isMuted = soundFx.toggleMute();
  soundFx.playUiClick();

  const indicator = toggleAudioBtn.querySelector('.toggle-text');
  if (isMuted) {
    toggleAudioBtn.classList.remove('active');
    if (indicator) indicator.textContent = 'ВЫКЛ [OFF]';
    updateVolumeSliderUI(0);
  } else {
    toggleAudioBtn.classList.add('active');
    if (indicator) indicator.textContent = 'ВКЛ [ON]';
    const vol = Math.round(soundFx.getVolume() * 100);
    updateVolumeSliderUI(vol > 0 ? vol : 100);
  }
});

// Переключатель полного экрана
toggleFullscreenBtn?.addEventListener('click', () => {
  soundFx.playUiClick();
  const indicator = toggleFullscreenBtn.querySelector('.toggle-text');

  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    toggleFullscreenBtn.classList.add('active');
    if (indicator) indicator.textContent = 'ВЫЙТИ';
  } else {
    document.exitFullscreen().catch(() => {});
    toggleFullscreenBtn.classList.remove('active');
    if (indicator) indicator.textContent = 'ЭКРАН';
  }
});

document.addEventListener('fullscreenchange', () => {
  const indicator = toggleFullscreenBtn.querySelector('.toggle-text');
  if (document.fullscreenElement) {
    toggleFullscreenBtn.classList.add('active');
    if (indicator) indicator.textContent = 'ВЫЙТИ';
  } else {
    toggleFullscreenBtn.classList.remove('active');
    if (indicator) indicator.textContent = 'ЭКРАН';
  }
});

// Настройка количества метеоритов в фазах из меню настроек
const toggleMeteorDensityBtn = document.getElementById('toggle-meteor-density-btn') as HTMLButtonElement;
const meteorDensityText = document.getElementById('meteor-density-text') as HTMLElement;
const meteorDensityHint = document.getElementById('meteor-density-hint') as HTMLElement;

const METEOR_PRESETS = [
  { name: 'МАЛО [5 / 10]', p1: 5, p2: 10, int1: 3.0, int2: 1.8 },
  { name: 'НОРМА [10 / 22]', p1: 10, p2: 22, int1: 2.2, int2: 1.1 },
  { name: 'ШТОРМ [18 / 36]', p1: 18, p2: 36, int1: 1.4, int2: 0.7 },
  { name: 'ХАОС [30 / 60]', p1: 30, p2: 60, int1: 0.8, int2: 0.4 },
];
let currentMeteorPresetIndex = 1;

toggleMeteorDensityBtn?.addEventListener('click', () => {
  soundFx.playUiClick();
  currentMeteorPresetIndex = (currentMeteorPresetIndex + 1) % METEOR_PRESETS.length;
  const preset = METEOR_PRESETS[currentMeteorPresetIndex];

  // Применяем настройки в GAME_PHASES
  if (GAME_PHASES[0]) {
    GAME_PHASES[0].maxMeteors = preset.p1;
    GAME_PHASES[0].meteorSpawnInterval = preset.int1;
  }
  if (GAME_PHASES[1]) {
    GAME_PHASES[1].maxMeteors = preset.p2;
    GAME_PHASES[1].meteorSpawnInterval = preset.int2;
  }

  if (meteorDensityText) meteorDensityText.textContent = preset.name;
  if (meteorDensityHint) {
    meteorDensityHint.textContent = `Настройка количества активных метеоров (Фаза 1: ${preset.p1}, Фаза 2: ${preset.p2})`;
  }

  // Применяем сразу в активную сцену игры
  if (phaserGame) {
    const scene = phaserGame.scene.getScene('GameScene') as any;
    if (scene && scene.meteorManager) {
      scene.meteorManager.setPhase(scene.currentPhase || 1);
    }
  }
});

// Кнопка "Выход"
function openExit(): void {
  soundFx.playUiClick();
  modalExit.classList.remove('hidden');
}

function closeExit(): void {
  soundFx.playUiClick();
  modalExit.classList.add('hidden');
}

btnExit?.addEventListener('click', openExit);
modalExitCancelBtn?.addEventListener('click', closeExit);

modalExitConfirmBtn?.addEventListener('click', () => {
  soundFx.playUiClick();
  closeExit();
  modalPause?.classList.add('hidden');
  isGamePaused = false;
  gameContainer.classList.add('hidden');
  dashHud?.classList.add('hidden');

  if (phaserGame) {
    const scene = phaserGame.scene.getScene('GameScene');
    if (scene && scene.scene.isActive()) {
      scene.scene.pause();
    }
  }

  mainMenu.classList.remove('hidden');
  mainMenu.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      background: #020c08;
      font-family: 'Orbitron', monospace;
      color: #34d399;
      text-align: center;
      gap: 16px;
      letter-spacing: 2px;
    ">
      <div style="font-size: 24px; font-weight: 800;">СЕССИЯ ЗАВЕРШЕНА // TERMINATED</div>
      <div style="font-size: 14px; color: #a7f3d0; font-family: 'Rajdhani', sans-serif;">
        Для повторного запуска обновите страницу в браузере (F5)
      </div>
    </div>
  `;
});

// Закрытие модальных окон по клику на фон
modalSettings?.addEventListener('click', (e) => {
  if (e.target === modalSettings) closeSettings();
});

modalExit?.addEventListener('click', (e) => {
  if (e.target === modalExit) closeExit();
});

// Управление голографическим окном гибели танка (Game Over)
function showGameOver(time: string, kills: number, score: number, reason?: string): void {
  if (goTime) goTime.textContent = time;
  if (goKills) goKills.textContent = kills.toString();
  if (goScore) goScore.textContent = score.toString();
  const descEl = document.getElementById('go-desc');
  if (descEl) {
    if (reason === 'meteor') {
      descEl.textContent = 'КРУШЕНИЕ: Космический корабль мгновенно уничтожен в результате столкновения с метеоритом!';
    } else {
      descEl.textContent = 'Космический корабль уничтожен в секторе боя. Протокол прерван.';
    }
  }
  dashHud?.classList.add('hidden');
  modalPause?.classList.add('hidden');
  isGamePaused = false;
  modalGameOver?.classList.remove('hidden');
}

function hideGameOver(): void {
  modalGameOver?.classList.add('hidden');
  modalPause?.classList.add('hidden');
  isGamePaused = false;
}

function restartFromGameOver(): void {
  soundFx.playUiClick();
  hideGameOver();
  hidePhaseAnnouncement();
  appliedUpgradeIds.clear();
  gameContainer?.classList.remove('hidden');
  dashHud?.classList.remove('hidden');
  isGameStarted = true;
  showPhaseAnnouncement(1);
  if (phaserGame) {
    const scene = phaserGame.scene.getScene('GameScene') as GameScene;
    if (scene) {
      if (scene.scene.isPaused()) {
        scene.scene.resume();
      }
      scene.startCombatSession();
    }
  }
}

function returnToMenuFromGameOver(): void {
  soundFx.playUiClick();
  hideGameOver();
  returnToMainMenu();
}

modalGoRestartBtn?.addEventListener('click', restartFromGameOver);
modalGoMenuBtn?.addEventListener('click', returnToMenuFromGameOver);

window.addEventListener('tank-destroyed', ((e: CustomEvent) => {
  const detail = e.detail || {};
  showGameOver(detail.time || '00:00', detail.kills || 0, detail.score || 0, detail.reason);
}) as EventListener);

// Голографическое оповещение при смене фазы боя
window.addEventListener('phase-changed', ((e: CustomEvent) => {
  const detail = e.detail || {};
  showPhaseAnnouncement(detail.phase || 1, detail.title, detail.subtitle);
}) as EventListener);

// Горячая клавиша [U] для быстрого тестирования апгрейдов
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyU' && !e.repeat) {
    if (isGameStarted && !gameContainer.classList.contains('hidden')) {
      showPhaseAnnouncement(2);
    }
  }
});

// Интерактивный клик по плашке ракетного рывка внизу экрана
dashTriggerCard?.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('request-tank-dash'));
});

// Интерактивный клик по плашке супертанка внизу экрана
superTriggerCard?.addEventListener('click', (e) => {
  e.preventDefault();
  window.dispatchEvent(new CustomEvent('request-tank-super'));
});

// Отключение контекстного меню правой кнопки мыши
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// Синхронизация состояния ракетного рывка с тактическим HUD
window.addEventListener('tank-dash-state', ((e: CustomEvent<{
  cooldown: number;
  maxCooldown: number;
  isReady: boolean;
  isDashing: boolean;
}>) => {
  const state = e.detail;
  if (!state || !dashTriggerCard) return;

  if (state.isDashing) {
    dashTriggerCard.classList.remove('cooling');
    dashTriggerCard.classList.add('dashing');
    if (dashStatusText) {
      dashStatusText.textContent = 'ФОРСАЖ!';
      dashStatusText.className = 'dash-status-badge active';
    }
    if (dashCooldownBar) {
      dashCooldownBar.style.width = '100%';
    }
    if (dashTimerText) {
      dashTimerText.textContent = 'РЫВОК';
    }
  } else if (!state.isReady) {
    dashTriggerCard.classList.remove('dashing');
    dashTriggerCard.classList.add('cooling');

    const progressPercent = Math.max(0, Math.min(100, ((state.maxCooldown - state.cooldown) / state.maxCooldown) * 100));
    if (dashCooldownBar) {
      dashCooldownBar.style.width = `${progressPercent.toFixed(1)}%`;
    }
    if (dashStatusText) {
      dashStatusText.textContent = 'ОХЛАЖДЕНИЕ';
      dashStatusText.className = 'dash-status-badge cooling';
    }
    if (dashTimerText) {
      dashTimerText.textContent = `${state.cooldown.toFixed(1)}s`;
    }
  } else {
    dashTriggerCard.classList.remove('cooling', 'dashing');
    if (dashCooldownBar) {
      dashCooldownBar.style.width = '100%';
    }
    if (dashStatusText) {
      dashStatusText.textContent = 'ГОТОВ';
      dashStatusText.className = 'dash-status-badge ready';
    }
    if (dashTimerText) {
      dashTimerText.textContent = '5.0s';
    }
  }
}) as EventListener);

// Синхронизация состояния овердрайва супертанка (ПКМ) с тактическим HUD
window.addEventListener('tank-super-state', ((e: CustomEvent<{
  cooldown: number;
  maxCooldown: number;
  duration: number;
  maxDuration: number;
  isReady: boolean;
  isActive: boolean;
}>) => {
  const state = e.detail;
  if (!state || !superTriggerCard) return;

  if (state.isActive) {
    superTriggerCard.classList.remove('cooling');
    superTriggerCard.classList.add('active');
    if (superStatusText) {
      superStatusText.textContent = 'АКТИВЕН!';
      superStatusText.className = 'dash-status-badge active';
    }
    const durationPercent = Math.max(0, Math.min(100, (state.duration / state.maxDuration) * 100));
    if (superCooldownBar) {
      superCooldownBar.style.width = `${durationPercent.toFixed(1)}%`;
    }
    if (superLabelText) {
      superLabelText.textContent = 'ДЕЙСТВИЕ:';
    }
    if (superTimerText) {
      superTimerText.textContent = `${state.duration.toFixed(1)}s`;
    }
  } else if (!state.isReady) {
    superTriggerCard.classList.remove('active');
    superTriggerCard.classList.add('cooling');

    const progressPercent = Math.max(0, Math.min(100, ((state.maxCooldown - state.cooldown) / state.maxCooldown) * 100));
    if (superCooldownBar) {
      superCooldownBar.style.width = `${progressPercent.toFixed(1)}%`;
    }
    if (superStatusText) {
      superStatusText.textContent = 'ОХЛАЖДЕНИЕ';
      superStatusText.className = 'dash-status-badge cooling';
    }
    if (superLabelText) {
      superLabelText.textContent = 'ПЕРЕЗАРЯДКА:';
    }
    if (superTimerText) {
      superTimerText.textContent = `${state.cooldown.toFixed(1)}s`;
    }
  } else {
    superTriggerCard.classList.remove('cooling', 'active');
    if (superCooldownBar) {
      superCooldownBar.style.width = '100%';
    }
    if (superStatusText) {
      superStatusText.textContent = 'ГОТОВ';
      superStatusText.className = 'dash-status-badge ready';
    }
    if (superLabelText) {
      superLabelText.textContent = 'ПЕРЕЗАРЯДКА:';
    }
    if (superTimerText) {
      superTimerText.textContent = '5.0s';
    }
  }
}) as EventListener);

// Горячие клавиши
window.addEventListener('keydown', (e) => {
  // Если открыто окно поражения
  if (modalGameOver && !modalGameOver.classList.contains('hidden')) {
    if (e.key === 'Escape') {
      returnToMenuFromGameOver();
      return;
    }
    if (e.key === 'Enter' || e.code === 'Space') {
      restartFromGameOver();
      return;
    }
  }

  if (e.key === 'Escape') {
    // 1. Окно настроек
    if (!modalSettings.classList.contains('hidden')) {
      closeSettings();
      return;
    }

    // 2. Окно подтверждения выхода
    if (!modalExit.classList.contains('hidden')) {
      closeExit();
      return;
    }

    // 3. Окно паузы (снятие с паузы и возврат в бой)
    if (!modalPause.classList.contains('hidden')) {
      resumeGame();
      return;
    }

    // 4. Во время игры (холст активен, не в главном меню) -> пауза
    if (isGameStarted && mainMenu.classList.contains('hidden')) {
      pauseGame();
      return;
    }
  }

  // Запуск по Enter / Пробел, если открыто главное меню и закрыты все модалки
  if (
    (e.key === 'Enter' || e.code === 'Space') &&
    !mainMenu.classList.contains('hidden') &&
    modalSettings.classList.contains('hidden') &&
    modalExit.classList.contains('hidden') &&
    modalPause.classList.contains('hidden')
  ) {
    // Игнорируем если фокус на кнопке, чтобы не дублировать клик
    if (document.activeElement?.tagName !== 'BUTTON') {
      launchGame();
    }
  }
});

// Инициализация Phaser игрового мира сразу при загрузке страницы для главного экрана
phaserGame = createGame('game');


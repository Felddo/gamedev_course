import './style.css';
import { createGame } from './game/config';
import { soundFx } from './game/audio';
import { GAME_PHASES } from './game/constants';
import { GameScene } from './game/GameScene';
import { ShipBuilderModal, CustomShipAssembly } from './game/shipBuilder/ShipBuilderModal';
import { shipModificationModal } from './game/modifications/ShipModificationModal';
import { campaignManager } from './game/campaign/CampaignManager';
import { CampaignMission, ScrapVictoryBreakdown } from './game/campaign/types';
import menuBgUrl from './assets/menu_bg.jpg';

let phaserGame: Phaser.Game | null = null;
let isGameStarted = false;
let isGamePaused = false;

// Голографический конструктор корабля (Ship Builder)
const shipBuilderModal = new ShipBuilderModal();

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
const btnStartTitle = document.getElementById('btn-start-title') as HTMLElement;
const btnStartSub = document.getElementById('btn-start-sub') as HTMLElement;
const menuCampaignStatus = document.getElementById('menu-campaign-status') as HTMLElement;
const btnSettings = document.getElementById('btn-settings') as HTMLButtonElement;
const btnResetProgress = document.getElementById('btn-reset-progress') as HTMLButtonElement;
const btnExit = document.getElementById('btn-exit') as HTMLButtonElement;

// Pause Modal Elements
const modalPause = document.getElementById('modal-pause') as HTMLElement;
const btnPauseResume = document.getElementById('btn-pause-resume') as HTMLButtonElement;
const btnPauseSettings = document.getElementById('btn-pause-settings') as HTMLButtonElement;
const btnPauseReset = document.getElementById('btn-pause-reset') as HTMLButtonElement;
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

// Mission Complete Modal Elements
const modalMissionComplete = document.getElementById('modal-mission-complete') as HTMLElement;
const mcTitle = document.getElementById('mc-title') as HTMLElement;
const mcSubtitle = document.getElementById('mc-subtitle') as HTMLElement | null;
const mcTime = document.getElementById('mc-time') as HTMLElement;
const mcKills = document.getElementById('mc-kills') as HTMLElement;
const mcScore = document.getElementById('mc-score') as HTMLElement | null;
const mcUnlockBanner = document.getElementById('mc-unlock-banner') as HTMLElement | null;
const mcUnlockText = document.getElementById('mc-unlock-text') as HTMLElement | null;
const mcUnlockIcon = document.getElementById('mc-unlock-icon') as HTMLElement | null;
const btnMcNext = document.getElementById('btn-mc-next') as HTMLButtonElement;
const btnMcNextText = document.getElementById('btn-mc-next-text') as HTMLElement;
const btnMcMenu = document.getElementById('btn-mc-menu') as HTMLButtonElement;

// Campaign Complete Modal Elements
const modalCampaignComplete = document.getElementById('modal-campaign-complete') as HTMLElement;
const ccTotalScore = document.getElementById('cc-total-score') as HTMLElement;
const ccTotalScrap = document.getElementById('cc-total-scrap') as HTMLElement;
const btnCcMenu = document.getElementById('btn-cc-menu') as HTMLButtonElement;
const btnCcRestart = document.getElementById('btn-cc-restart') as HTMLButtonElement;

// Scrap Currency UI Elements
const menuScrapBalance = document.getElementById('menu-scrap-balance') as HTMLElement;
const mcScrapEnemies = document.getElementById('mc-scrap-enemies') as HTMLElement;
const mcScrapMission = document.getElementById('mc-scrap-mission') as HTMLElement;
const mcScrapBoss = document.getElementById('mc-scrap-boss') as HTMLElement;
const mcScrapBossRow = document.getElementById('mc-scrap-boss-row') as HTMLElement;
const mcScrapTotal = document.getElementById('mc-scrap-total') as HTMLElement;
const mcScrapBalance = document.getElementById('mc-scrap-balance') as HTMLElement;

// Rocket Dash HUD Elements
const dashHud = document.getElementById('dash-hud') as HTMLElement;
const dashTriggerCard = document.getElementById('dash-trigger-card') as HTMLElement;
const dashKeyBtn = document.getElementById('dash-key-btn') as HTMLElement;
const dashStatusText = document.getElementById('dash-status-text') as HTMLElement;
const dashCooldownBar = document.getElementById('dash-cooldown-bar') as HTMLElement;
const dashTimerText = document.getElementById('dash-timer-text') as HTMLElement;

// Super Tank Overdrive HUD Elements (ПКМ / Клавиша Q)
const superTriggerCard = document.getElementById('super-trigger-card') as HTMLElement;
const superKeyBtn = document.getElementById('super-key-btn') as HTMLElement;
const superStatusText = document.getElementById('super-status-text') as HTMLElement;
const superCooldownBar = document.getElementById('super-cooldown-bar') as HTMLElement;
const superTimerText = document.getElementById('super-timer-text') as HTMLElement;
const superLabelText = document.getElementById('super-label-text') as HTMLElement;

// Top-left Esc Pause Button Element
const topEscBtn = document.getElementById('btn-top-esc') as HTMLButtonElement;

// Окошко фаз полностью убрано из игры
function showPhaseAnnouncement(_phaseNumber?: number, _title?: string, _subtitle?: string): void {}
function hidePhaseAnnouncement(): void {}

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
  btnResetProgress,
  btnExit,
  btnPauseResume,
  btnPauseSettings,
  btnPauseReset,
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
  btnMcNext,
  btnMcMenu,
  btnCcMenu,
  btnCcRestart,
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
 * Запуск игры: игра замирает, корабль исчезает и появляется зеленое
 * голографическое окно с возможностью сделать свой корабль
 */
function launchGame(): void {
  soundFx.playUiClick();

  if (campaignManager.isCampaignCompleted()) {
    campaignManager.resetCampaign();
  }
  updateMenuCampaignInfo();

  // Плавное скрытие главного меню и отображение игрового холста
  mainMenu.classList.add('hidden');
  gameContainer?.classList.remove('hidden');
  dashHud?.classList.add('hidden');
  topEscBtn?.classList.add('hidden');
  modalPause?.classList.add('hidden');
  hideMissionComplete();
  hideCampaignComplete();
  isGamePaused = true;
  isGameStarted = true;

  hidePhaseAnnouncement();

  if (phaserGame) {
    phaserGame.scale.refresh();
    const scene = phaserGame.scene.getScene('GameScene') as GameScene;
    if (scene) {
      scene.pauseCombatSessionForBuilder();
    }
  }

  // Проверяем, есть ли неразыгранная модификация за завершенную контрольную миссию (например, после перезагрузки)
  const pendingMission = campaignManager.getPendingModificationMission();
  if (pendingMission) {
    shipModificationModal.open(pendingMission, () => {
      if (phaserGame) {
        const scene = phaserGame.scene.getScene('GameScene') as GameScene;
        if (scene) {
          scene.applyCampaignUpgrades();
        }
      }
      const nextMission = campaignManager.getCurrentMission();
      launchDirectCombat(nextMission);
    });
    return;
  }

  // Появление голографического зеленого окна конструктора корабля
  shipBuilderModal.open();

  // Обновление размеров полноэкранного холста
  window.requestAnimationFrame(() => {
    phaserGame?.scale.refresh();
  });
}

/**
 * Прямой запуск следующей миссии без открытия конструктора корабля
 * (используется после получения модификаций на контрольных уровнях)
 */
function launchDirectCombat(nextMission: CampaignMission): void {
  isGamePaused = false;
  isGameStarted = true;
  mainMenu.classList.add('hidden');
  gameContainer?.classList.remove('hidden');
  dashHud?.classList.remove('hidden');
  topEscBtn?.classList.remove('hidden');
  modalPause?.classList.add('hidden');
  hideMissionComplete();
  hideCampaignComplete();
  hideGameOver();

  if (phaserGame) {
    const scene = phaserGame.scene.getScene('GameScene') as GameScene;
    if (scene) {
      if (scene.scene.isPaused()) {
        scene.scene.resume();
      }
      scene.startCombatSession(nextMission);
    }
  }

  showPhaseAnnouncement(
    1,
    nextMission.title,
    `${nextMission.subtitle} // ${nextMission.briefing}`,
  );

  window.requestAnimationFrame(() => {
    phaserGame?.scale.refresh();
  });
}

/**
 * Переход из конструктора в боевой режим при нажатии "В БОЙ // ЗАПУСК":
 * Появляется корабль игрока, игра снимается с паузы, отображается HUD и Фаза 1
 */
function startCombatFromBuilder(assembly?: CustomShipAssembly): void {
  soundFx.playUiClick();
  shipBuilderModal.close();

  isGamePaused = false;
  dashHud?.classList.remove('hidden');
  topEscBtn?.classList.remove('hidden');

  if (phaserGame) {
    const scene = phaserGame.scene.getScene('GameScene') as GameScene;
    if (scene) {
      scene.resumeCombatSessionFromBuilder(assembly);
    }
  }

  const activeMission = campaignManager.getCurrentMission();
  // Отображение голограммы миссии
  showPhaseAnnouncement(
    1,
    activeMission.title,
    `${activeMission.subtitle} // ${activeMission.briefing}`,
  );

  window.requestAnimationFrame(() => {
    phaserGame?.scale.refresh();
  });
}

// Привязка коллбэков конструктора корабля
shipBuilderModal.onLaunch = (assembly: CustomShipAssembly) => {
  startCombatFromBuilder(assembly);
};

shipBuilderModal.onReturnToMenu = () => {
  returnToMainMenu();
};

/**
 * Возврат в главное меню с отображением menu_bg.jpg и кнопок управления
 */
function returnToMainMenu(): void {
  shipModificationModal.close();
  shipBuilderModal.close();
  hideGameOver();
  hideMissionComplete();
  hideCampaignComplete();
  hidePhaseAnnouncement();
  modalPause?.classList.add('hidden');
  modalSettings?.classList.add('hidden');
  modalExit?.classList.add('hidden');
  isGamePaused = false;
  isGameStarted = false;

  updateMenuCampaignInfo();

  dashHud?.classList.add('hidden');
  topEscBtn?.classList.add('hidden');
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

function handleResetProgress(): void {
  soundFx.playUiClick();
  const confirmed = window.confirm(
    'Вы уверены, что хотите сбросить весь прогресс кампании?\nВсе пройденные миссии, баланс металлолома и улучшения будут сброшены к миссии 1-1.'
  );
  if (!confirmed) return;

  campaignManager.resetCampaign();
  shipBuilderModal.loadDefaultShipPreset();

  if (phaserGame) {
    const scene = phaserGame.scene.getScene('GameScene') as GameScene;
    if (scene) {
      scene.activeShipAssembly = null;
      scene.startCombatSession();
    }
  }

  updateMenuCampaignInfo();
  modalPause?.classList.add('hidden');
  returnToMainMenu();
}

btnResetProgress?.addEventListener('click', handleResetProgress);
btnPauseReset?.addEventListener('click', handleResetProgress);

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
  topEscBtn?.classList.add('hidden');

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
  topEscBtn?.classList.add('hidden');
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
  campaignManager.prepareRetry();
  gameContainer?.classList.remove('hidden');
  dashHud?.classList.add('hidden');
  topEscBtn?.classList.add('hidden');
  isGameStarted = true;
  isGamePaused = true;

  if (phaserGame) {
    phaserGame.scale.refresh();
    const scene = phaserGame.scene.getScene('GameScene') as GameScene;
    if (scene) {
      scene.pauseCombatSessionForBuilder();
    }
  }

  // Появление голографического зеленого окна конструктора корабля
  shipBuilderModal.open();

  window.requestAnimationFrame(() => {
    phaserGame?.scale.refresh();
  });
}

function returnToMenuFromGameOver(): void {
  soundFx.playUiClick();
  hideGameOver();
  returnToMainMenu();
}

modalGoRestartBtn?.addEventListener('click', restartFromGameOver);
modalGoMenuBtn?.addEventListener('click', returnToMenuFromGameOver);

// Управление окнами завершения миссии и кампании
function showMissionComplete(
  missionId: string,
  title: string,
  subtitle: string,
  time: string,
  kills: number,
  score: number,
  nextSector: number,
  nextMission: number,
  scrapBreakdown?: ScrapVictoryBreakdown,
): void {
  hideGameOver();
  modalPause?.classList.add('hidden');
  isGamePaused = true;
  dashHud?.classList.add('hidden');
  topEscBtn?.classList.add('hidden');

  if (mcTitle) mcTitle.textContent = `МИССИЯ ${missionId} ВЫПОЛНЕНА`;
  if (mcSubtitle) mcSubtitle.textContent = '';
  if (mcTime) mcTime.textContent = time;
  if (mcKills) mcKills.textContent = kills.toString();
  if (mcScore) mcScore.textContent = score.toString();

  // Выделенное уведомление о разблокировке деталей и лимитов верфи
  if (mcUnlockBanner && mcUnlockText) {
    if (missionId === '1-3') {
      mcUnlockBanner.className = 'mc-unlock-banner unlock-guns';
      if (mcUnlockIcon) mcUnlockIcon.textContent = '⚡';
      mcUnlockText.innerHTML = `
        <div class="mc-unlock-body">
          <div class="mc-unlock-headline">МОДЕРНИЗАЦИЯ ОРУЖИЯ</div>
          <div class="mc-unlock-subtext">ЛИМИТ ПУШЕК УВЕЛИЧЕН НА 1 <span class="mc-limit-tag">МАКС: 2 ПУШКИ</span></div>
        </div>
      `;
    } else if (missionId === '1-5') {
      mcUnlockBanner.className = 'mc-unlock-banner unlock-rare-engine';
      if (mcUnlockIcon) mcUnlockIcon.textContent = '⭐';
      mcUnlockText.innerHTML = `
        <div class="mc-unlock-body">
          <div class="mc-unlock-headline">ДОСТУПНЫ РЕДКИЕ ЧАСТИ КОРАБЛЯ</div>
          <div class="mc-unlock-subtext mc-subtext-engine">🚀 ЛИМИТ ДВИГАТЕЛЕЙ УВЕЛИЧЕН НА 1 <span class="mc-limit-tag">МАКС: 2 ДВИГАТЕЛЯ</span></div>
        </div>
      `;
    } else if (missionId === '2-2') {
      mcUnlockBanner.className = 'mc-unlock-banner unlock-body';
      if (mcUnlockIcon) mcUnlockIcon.textContent = '🛡️';
      mcUnlockText.innerHTML = `
        <div class="mc-unlock-body">
          <div class="mc-unlock-headline">МОДЕРНИЗАЦИЯ КАРКАСА</div>
          <div class="mc-unlock-subtext">ЛИМИТ ТЕЛА УВЕЛИЧЕН НА 1 <span class="mc-limit-tag">МАКС: 2 КОРПУСА</span></div>
        </div>
      `;
    } else if (missionId === '2-4') {
      mcUnlockBanner.className = 'mc-unlock-banner unlock-wings';
      if (mcUnlockIcon) mcUnlockIcon.textContent = '🪽';
      mcUnlockText.innerHTML = `
        <div class="mc-unlock-body">
          <div class="mc-unlock-headline">АЭРОДИНАМИЧЕСКИЙ ПРОРЫВ</div>
          <div class="mc-unlock-subtext">ЛИМИТ КРЫЛЬЕВ УВЕЛИЧЕН НА 2 <span class="mc-limit-tag">ТО ЕСТЬ 4 КРЫЛА</span></div>
        </div>
      `;
    } else if (missionId === '2-5') {
      mcUnlockBanner.className = 'mc-unlock-banner unlock-legendary';
      if (mcUnlockIcon) mcUnlockIcon.textContent = '👑';
      mcUnlockText.innerHTML = `
        <div class="mc-unlock-body">
          <div class="mc-unlock-headline">ДОСТУПНЫ ЛЕГЕНДАРНЫЕ ЧАСТИ КОРАБЛЯ</div>
        </div>
      `;
    } else {
      mcUnlockBanner.className = 'mc-unlock-banner hidden';
      mcUnlockText.innerHTML = '';
    }
  }

  // Заполнение информации о добытом металлоломе
  if (scrapBreakdown) {
    if (mcScrapEnemies) mcScrapEnemies.textContent = `+${scrapBreakdown.enemyScrap}`;
    if (mcScrapMission) mcScrapMission.textContent = `+${scrapBreakdown.missionReward}`;
    if (mcScrapBossRow && mcScrapBoss) {
      if (scrapBreakdown.bossBonus > 0) {
        mcScrapBossRow.classList.remove('hidden');
        mcScrapBoss.textContent = `+${scrapBreakdown.bossBonus}`;
      } else {
        mcScrapBossRow.classList.add('hidden');
      }
    }
    if (mcScrapTotal) mcScrapTotal.textContent = `+${scrapBreakdown.totalEarned}`;
    if (mcScrapBalance) mcScrapBalance.textContent = scrapBreakdown.newBalance.toString();
  } else {
    const currentBalance = campaignManager.getScrapBalance();
    if (mcScrapEnemies) mcScrapEnemies.textContent = '+0';
    if (mcScrapMission) mcScrapMission.textContent = '+0';
    if (mcScrapBossRow) mcScrapBossRow.classList.add('hidden');
    if (mcScrapTotal) mcScrapTotal.textContent = '+0';
    if (mcScrapBalance) mcScrapBalance.textContent = currentBalance.toString();
  }

  const isModReward = campaignManager.isModificationRewardMission(missionId) &&
                      !campaignManager.isModificationMissionRewarded(missionId);

  if (btnMcNext) btnMcNext.disabled = false;
  if (btnMcNextText) {
    if (isModReward) {
      btnMcNextText.textContent = 'ДАЛЕЕ // ВЫБОР МОДИФИКАЦИИ [SPACE]';
    } else {
      btnMcNextText.textContent = `ДАЛЕЕ // ВЕРФЬ [${nextSector}-${nextMission}]`;
    }
  }

  modalMissionComplete?.classList.remove('hidden');
  updateMenuCampaignInfo();
}

function hideMissionComplete(): void {
  modalMissionComplete?.classList.add('hidden');
  mcUnlockBanner?.classList.add('hidden');
}

function showCampaignComplete(totalScore: number, scrapBalance?: number): void {
  hideGameOver();
  hideMissionComplete();
  modalPause?.classList.add('hidden');
  isGamePaused = true;
  dashHud?.classList.add('hidden');
  topEscBtn?.classList.add('hidden');

  if (ccTotalScore) ccTotalScore.textContent = totalScore.toString();
  if (ccTotalScrap) {
    ccTotalScrap.textContent = (scrapBalance ?? campaignManager.getScrapBalance()).toString();
  }
  modalCampaignComplete?.classList.remove('hidden');
  updateMenuCampaignInfo();
}

function hideCampaignComplete(): void {
  modalCampaignComplete?.classList.add('hidden');
}

function startNextMission(): void {
  soundFx.playUiClick();
  hideMissionComplete();

  if (campaignManager.isCampaignCompleted()) {
    showCampaignComplete(campaignManager.getSaveData().totalScore);
    return;
  }

  // Проверяем, полагается ли выбор модификации за завершенную контрольную миссию
  const pendingMission = campaignManager.getPendingModificationMission();
  if (pendingMission) {
    shipModificationModal.open(pendingMission, (_selectedMod) => {
      // Модификация немедленно применяется к кораблю в сцене
      if (phaserGame) {
        const scene = phaserGame.scene.getScene('GameScene') as GameScene;
        if (scene) {
          scene.applyCampaignUpgrades();
        }
      }
      // На уровнях с модификациями окно конструктора пропускается — сразу в бой
      const nextMission = campaignManager.getCurrentMission();
      launchDirectCombat(nextMission);
    });
    return;
  }

  openShipyardBeforeNextMission();
}

function openShipyardBeforeNextMission(): void {
  const nextMission = campaignManager.getCurrentMission();

  dashHud?.classList.add('hidden');
  topEscBtn?.classList.add('hidden');
  modalPause?.classList.add('hidden');
  isGamePaused = true;
  isGameStarted = true;

  if (phaserGame) {
    phaserGame.scale.refresh();
    const scene = phaserGame.scene.getScene('GameScene') as GameScene;
    if (scene) {
      scene.pauseCombatSessionForBuilder(nextMission);
    }
  }

  // Открытие конструктора корабля перед следующей миссией
  shipBuilderModal.open();

  window.requestAnimationFrame(() => {
    phaserGame?.scale.refresh();
  });
}

function returnToMenuFromMissionComplete(): void {
  soundFx.playUiClick();
  hideMissionComplete();
  returnToMainMenu();
}

function returnToMenuFromCampaignComplete(): void {
  soundFx.playUiClick();
  hideCampaignComplete();
  returnToMainMenu();
}

function restartCampaignFromBeginning(): void {
  soundFx.playUiClick();
  campaignManager.resetCampaign();
  hideCampaignComplete();
  updateMenuCampaignInfo();
  launchGame();
}

btnMcNext?.addEventListener('click', startNextMission);
btnMcMenu?.addEventListener('click', returnToMenuFromMissionComplete);
btnCcMenu?.addEventListener('click', returnToMenuFromCampaignComplete);
btnCcRestart?.addEventListener('click', restartCampaignFromBeginning);

// Слушатель завершения миссии
window.addEventListener('mission-completed', ((e: CustomEvent) => {
  const detail = e.detail || {};
  if (detail.isCampaignComplete) {
    const finalScrap = detail.scrapBreakdown?.newBalance ?? campaignManager.getScrapBalance();
    showCampaignComplete(detail.totalScore || detail.score || 0, finalScrap);
  } else {
    showMissionComplete(
      detail.missionId || `${detail.sector}-${detail.mission}`,
      detail.title || 'Миссия',
      detail.subtitle || '',
      detail.time || '00:00',
      detail.kills || 0,
      detail.score || 0,
      detail.nextSector || 1,
      detail.nextMission || 1,
      detail.scrapBreakdown,
    );
  }
}) as EventListener);

function updateMenuCampaignInfo(): void {
  const currentMission = campaignManager.getCurrentMission();
  const completedCount = campaignManager.getCompletedCount();
  const isDone = campaignManager.isCampaignCompleted();
  const scrapBalance = campaignManager.getScrapBalance();

  if (btnStartTitle && btnStartSub) {
    if (isDone) {
      btnStartTitle.textContent = 'КАМПАНИЯ ЗАВЕРШЕНА';
      btnStartSub.textContent = 'SYS_REPLAY // НАЧАТЬ ЗАНОВО [1-1]';
    } else if (completedCount > 0) {
      btnStartTitle.textContent = 'ПРОДОЛЖИТЬ';
      btnStartSub.textContent = `SYS_RESUME // СЕКТОР ${currentMission.sector}: МИССИЯ ${currentMission.id}`;
    } else {
      btnStartTitle.textContent = 'НАЧАТЬ КАМПАНИЮ';
      btnStartSub.textContent = 'SYS_LAUNCH // СЕКТОР 1: МИССИЯ 1-1';
    }
  }

  if (menuCampaignStatus) {
    if (isDone) {
      menuCampaignStatus.textContent = 'SYS_STATUS: ВСЕ 15 МИССИЙ ПРОЙДЕНЫ // КАМПАНИЯ ЗАВЕРШЕНА';
    } else if (completedCount > 0) {
      menuCampaignStatus.textContent = `SYS_STATUS: СЕКТОР ${currentMission.sector} // МИССИЯ ${currentMission.id} [${completedCount}/15 ВЫПОЛНЕНО]`;
    } else {
      menuCampaignStatus.textContent = 'SYS_STATUS: СЕКТОР 1 // МИССИЯ 1-1';
    }
  }

  if (menuScrapBalance) {
    menuScrapBalance.textContent = scrapBalance.toString();
  }
}

window.addEventListener('tank-destroyed', ((e: CustomEvent) => {
  const detail = e.detail || {};
  showGameOver(detail.time || '00:00', detail.kills || 0, detail.score || 0, detail.reason);
}) as EventListener);

// Интерактивный клик по плашке ракетного рывка внизу экрана
dashTriggerCard?.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('request-tank-dash'));
});

// Интерактивный клик по плашке супертанка внизу экрана
superTriggerCard?.addEventListener('click', (e) => {
  e.preventDefault();
  window.dispatchEvent(new CustomEvent('request-tank-super'));
});

// Клик по кнопке паузы [ESC] в левом верхнем углу
topEscBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  if (!modalPause.classList.contains('hidden')) {
    resumeGame();
  } else if (isGameStarted && mainMenu.classList.contains('hidden')) {
    pauseGame();
  }
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
  // Если открыт экран выбора модификаций корабля
  if (shipModificationModal && shipModificationModal.isOpen()) {
    return;
  }

  // Если открыт конструктор корабля
  if (shipBuilderModal && shipBuilderModal.isOpen()) {
    if (e.key === 'Escape') {
      returnToMainMenu();
      return;
    }
    if ((e.key === 'Enter' || e.code === 'Space') && document.activeElement?.tagName !== 'BUTTON') {
      shipBuilderModal.tryLaunch();
      return;
    }
    return;
  }

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

  // Если открыто окно победы в миссии
  if (modalMissionComplete && !modalMissionComplete.classList.contains('hidden')) {
    if (e.key === 'Escape') {
      returnToMenuFromMissionComplete();
      return;
    }
    if (e.key === 'Enter' || e.code === 'Space') {
      startNextMission();
      return;
    }
  }

  // Если открыто окно завершения всей кампании
  if (modalCampaignComplete && !modalCampaignComplete.classList.contains('hidden')) {
    if (e.key === 'Escape') {
      returnToMenuFromCampaignComplete();
      return;
    }
    if (e.key === 'Enter' || e.code === 'Space') {
      restartCampaignFromBeginning();
      return;
    }
  }

  // F8: Быстрое завершение текущей миссии (для проверки и отладки)
  if (e.code === 'F8') {
    e.preventDefault();
    if (phaserGame && isGameStarted) {
      const scene = phaserGame.scene.getScene('GameScene') as GameScene;
      if (scene) {
        scene.triggerMissionVictory();
      }
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
    modalPause.classList.contains('hidden') &&
    !shipBuilderModal.isOpen()
  ) {
    // Игнорируем если фокус на кнопке, чтобы не дублировать клик
    if (document.activeElement?.tagName !== 'BUTTON') {
      launchGame();
    }
  }
});

// Инициализация Phaser игрового мира сразу при загрузке страницы для главного экрана
phaserGame = createGame('game');

// Инициализация отображения текущей миссии кампании в главном меню
updateMenuCampaignInfo();

// Dev API для быстрой проверки и тестирования переходов
(window as unknown as { __CAMPAIGN_DEV__: unknown }).__CAMPAIGN_DEV__ = {
  winCurrentMission: () => {
    if (phaserGame) {
      const scene = phaserGame.scene.getScene('GameScene') as GameScene;
      if (scene) {
        scene.triggerMissionVictory();
      }
    }
  },
  setMission: (sector: number, mission: number) => {
    campaignManager.setMission(sector, mission);
    updateMenuCampaignInfo();
    const targetMission = campaignManager.getCurrentMission();
    if (phaserGame && isGameStarted) {
      const scene = phaserGame.scene.getScene('GameScene') as GameScene;
      if (scene) {
        scene.startCombatSession(targetMission);
      }
    }
  },
  resetCampaign: () => {
    campaignManager.resetCampaign();
    updateMenuCampaignInfo();
  },
  getState: () => campaignManager.getSaveData(),
};


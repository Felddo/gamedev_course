import Phaser from 'phaser';
import { ensureGameTextures } from './textures';
import { soundFx } from './audio';
import playerShipUrl from '../assets/Sprites/Ships/spaceShips_001.png';
import spaceEffect001Url from '../assets/Sprites/Effects/spaceEffects_001.png';
import spaceEffect002Url from '../assets/Sprites/Effects/spaceEffects_002.png';
import spaceEffect003Url from '../assets/Sprites/Effects/spaceEffects_003.png';
import spaceEffect004Url from '../assets/Sprites/Effects/spaceEffects_004.png';
import spaceEffect005Url from '../assets/Sprites/Effects/spaceEffects_005.png';
import spaceEffect008Url from '../assets/Sprites/Effects/spaceEffects_008.png';
import spaceEffect010Url from '../assets/Sprites/Effects/spaceEffects_010.png';
import spaceEffect013Url from '../assets/Sprites/Effects/spaceEffects_013.png';
import spaceEffect017Url from '../assets/Sprites/Effects/spaceEffects_017.png';
import spaceEffect018Url from '../assets/Sprites/Effects/spaceEffects_018.png';
import meteor001Url from '../assets/Sprites/Meteors/spaceMeteors_001.png';
import meteor002Url from '../assets/Sprites/Meteors/spaceMeteors_002.png';
import meteor003Url from '../assets/Sprites/Meteors/spaceMeteors_003.png';
import meteor004Url from '../assets/Sprites/Meteors/spaceMeteors_004.png';
import playerMissileUrl from '../assets/Sprites/Missiles/green/spaceMissiles_010.png';
import evilShip001Url from '../assets/Sprites/EvilShips/spaceShips_001.png';
import evilShip002Url from '../assets/Sprites/EvilShips/spaceShips_002.png';
import evilShip003Url from '../assets/Sprites/EvilShips/spaceShips_003.png';
import evilShip004Url from '../assets/Sprites/EvilShips/spaceShips_004.png';
import evilShip005Url from '../assets/Sprites/EvilShips/spaceShips_005.png';
import bossRocket001Url from '../assets/Sprites/Rockets/spaceRockets_001.png';
import bossRocket002Url from '../assets/Sprites/Rockets/spaceRockets_002.png';
import bossRocket003Url from '../assets/Sprites/Rockets/spaceRockets_003.png';

import {
  MAP_WIDTH,
  MAP_HEIGHT,
  GAME_PHASES,
  PLAYER_MAX_HP,
  PLAYER_ATTACK_RADIUS,
} from './constants';
export * from './constants';
export * from './types';
import { FireHazard } from './types';

import { PlayerShip } from './PlayerShip';
import { WeaponSystem } from './WeaponSystem';
import { EnemyManager } from './EnemyManager';
import { ParticleManager } from './ParticleManager';
import { AtmosphereManager } from './AtmosphereManager';
import { HudManager } from './HudManager';
import { HudScene } from './HudScene';
import { MeteorManager } from './MeteorManager';
import { SpaceStationManager, STATION_SPRITE_ASSETS } from './SpaceStationManager';
import { FlyingShopManager, FLYING_SHOP_SPRITE_ASSET } from './FlyingShopManager';
import { ALL_MISSILE_TEXTURE_ASSETS, ShopMissileOffer } from './shop/missilesCatalog';
import { ScrapManager } from './ScrapManager';
import { NeonBarrierManager } from './NeonBarrierManager';
import { getEnemyScrapDrop } from './campaign/scrapConfig';
import { buildPartsCatalog } from './shipBuilder/partsCatalog';
import { CustomShipAssembly } from './shipBuilder/ShipBuilderModal';
import { CampaignMission } from './campaign/types';
import { campaignManager } from './campaign/CampaignManager';
import { isMobilePhone, getGameDpr } from './deviceUtils';
import { track } from '../analytics';

/**
 * Основная боевая сцена космического выживания:
 * - Процедурно генерируемый глубокий космос с движущимися звездами и туманностями
 * - Спавн метеоритов, смертельных для корабля при таране
 * - Странствующие космические базы, взрывающиеся при уничтожении и приносящие опыт
 * - Фотонно-плазменное вооружение, волны противников, овердрайв и тактический радар
 */
export class GameScene extends Phaser.Scene {
  public playerShip!: PlayerShip;
  public activeShipAssembly: CustomShipAssembly | null = null;
  private weaponSystem!: WeaponSystem;
  private enemyManager!: EnemyManager;
  private particleManager!: ParticleManager;
  private atmosphereManager!: AtmosphereManager;
  public hudManager!: HudManager;
  private meteorManager!: MeteorManager;
  private spaceStationManager!: SpaceStationManager;
  private flyingShopManager!: FlyingShopManager;
  private scrapManager!: ScrapManager;
  private neonBarrierManager!: NeonBarrierManager;

  // Опасные зоны плазменного шлейфа двигателей
  private fireHazards: FireHazard[] = [];
  private upgradeListener: ((e: CustomEvent<{ id: string }>) => void) | null = null;
  private rightClickListener: (() => void) | null = null;

  // Счет, валюта и таймер выживания
  private survivalTime = 0;
  private killsCount = 0;
  private score = 0;
  private inMissionScrapCollected = 0;
  private wasBossKilled = false;
  private currentPhase = 1;
  private isGameOver = false;
  public isMissionWon = false;
  public currentMission: CampaignMission | null = null;

  // Режим главного меню
  public isMenuMode = true;
  private menuSalvoTimer = 0;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    ensureGameTextures(this);
    this.load.image('player_ship', playerShipUrl);
    this.load.image('player_missile', playerMissileUrl);

    // 5 типов обычных противников (spaceShips_001 - spaceShips_005)
    this.load.image('enemy_ship_001', evilShip001Url);
    this.load.image('enemy_ship_002', evilShip002Url);
    this.load.image('enemy_ship_003', evilShip003Url);
    this.load.image('enemy_ship_004', evilShip004Url);
    this.load.image('enemy_ship_005', evilShip005Url);

    // 3 уникальных босса (spaceRockets_001 - spaceRockets_003)
    this.load.image('boss_rocket_001', bossRocket001Url);
    this.load.image('boss_rocket_002', bossRocket002Url);
    this.load.image('boss_rocket_003', bossRocket003Url);
    this.load.image('meteor_001', meteor001Url);
    this.load.image('meteor_002', meteor002Url);
    this.load.image('meteor_003', meteor003Url);
    this.load.image('meteor_004', meteor004Url);
    this.load.image('space_effect_001', spaceEffect001Url);
    this.load.image('space_effect_002', spaceEffect002Url);
    this.load.image('space_effect_003', spaceEffect003Url);
    this.load.image('space_effect_004', spaceEffect004Url);
    this.load.image('space_effect_005', spaceEffect005Url);
    this.load.image('space_effect_008', spaceEffect008Url);
    this.load.image('space_effect_010', spaceEffect010Url);
    this.load.image('space_effect_013', spaceEffect013Url);
    this.load.image('space_effect_017', spaceEffect017Url);
    this.load.image('space_effect_018', spaceEffect018Url);
    STATION_SPRITE_ASSETS.forEach((asset) => {
      if (!this.textures.exists(asset.key)) {
        this.load.image(asset.key, asset.url);
      }
    });
    if (!this.textures.exists(FLYING_SHOP_SPRITE_ASSET.key)) {
      this.load.image(FLYING_SHOP_SPRITE_ASSET.key, FLYING_SHOP_SPRITE_ASSET.url);
    }
    ALL_MISSILE_TEXTURE_ASSETS.forEach((asset) => {
      if (!this.textures.exists(asset.key)) {
        this.load.image(asset.key, asset.url);
      }
    });

    // Предзагрузка всех 101 модульных деталей для конструктора корабля
    const catalog = buildPartsCatalog();
    catalog.forEach((cat) => {
      cat.directItems.forEach((item) => {
        if (!this.textures.exists(item.id)) {
          this.load.image(item.id, item.url);
        }
      });
      cat.folders.forEach((folder) => {
        folder.items.forEach((item) => {
          if (!this.textures.exists(item.id)) {
            this.load.image(item.id, item.url);
          }
        });
      });
    });
  }

  create(): void {
    const { width, height } = this.scale;

    // Сброс показателей боевой сессии
    this.isGameOver = false;
    this.isMissionWon = false;
    this.survivalTime = 0;
    this.killsCount = 0;
    this.score = 0;
    this.inMissionScrapCollected = 0;
    this.wasBossKilled = false;
    this.currentPhase = 1;
    this.fireHazards = [];

    // 1. Построение космической карты и среды
    this.atmosphereManager = new AtmosphereManager(this);
    this.atmosphereManager.createSpaceMap();
    this.atmosphereManager.createCosmicAtmosphere();

    // 2. Инициализация менеджера частиц и эффектов
    this.particleManager = new ParticleManager(this);

    // 3. Спавн корабля игрока по центру сектора
    this.playerShip = new PlayerShip(this, MAP_WIDTH / 2, MAP_HEIGHT / 2);
    this.playerShip.onFireTrailSpawn = (x, y) => {
      this.fireHazards.push({
        x,
        y,
        life: 3.5,
        maxLife: 3.5,
        damageTimer: 0.15,
        radius: 26,
      });
    };

    // 4. Оружейная система
    this.weaponSystem = new WeaponSystem(this);

    // Залп ракетами при нажатии на правую кнопку мыши
    this.rightClickListener = () => {
      if (!this.isMenuMode && !this.isGameOver && !this.scene.isPaused()) {
        this.weaponSystem.fireRightClickSalvo(this.playerShip, this.particleManager);
      }
    };
    window.addEventListener('player-right-click-fire', this.rightClickListener);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() || pointer.button === 2) {
        if (!this.isMenuMode && !this.isGameOver && !this.scene.isPaused()) {
          this.weaponSystem.fireRightClickSalvo(this.playerShip, this.particleManager);
        }
        return;
      }

      // ЛКМ / тап: выбор базы для фокусированной стрельбы или отмена выбора
      if (pointer.button === 0 || pointer.button === -1 || pointer.leftButtonDown()) {
        if (!this.isMenuMode && !this.isGameOver && !this.scene.isPaused()) {
          const dpr = getGameDpr();
          // Защита от выбора станций при касании области виртуального джойстика (левый нижний угол)
          if (pointer.x < 190 * dpr && pointer.y > this.scale.height - 190 * dpr) {
            return;
          }
          // Защита от выбора станций при касании области кнопок способностей (правый нижний угол)
          if (pointer.x > this.scale.width - 320 * dpr && pointer.y > this.scale.height - 140 * dpr) {
            return;
          }
          const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
          this.spaceStationManager.toggleTargetStationAt(worldPoint.x, worldPoint.y);
        }
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.upgradeListener) {
        window.removeEventListener('apply-tank-upgrade', this.upgradeListener as EventListener);
        this.upgradeListener = null;
      }
      if (this.rightClickListener) {
        window.removeEventListener('player-right-click-fire', this.rightClickListener);
        this.rightClickListener = null;
      }
    });

    // Слушатель применения тактических апгрейдов из UI
    this.upgradeListener = (e: CustomEvent<{ id: string }>) => {
      const upgradeId = e.detail?.id;
      if (upgradeId) {
        this.playerShip.applyUpgrade(upgradeId);
        this.weaponSystem.applyUpgrade(upgradeId);
      }
    };
    window.addEventListener('apply-tank-upgrade', this.upgradeListener as EventListener);

    // 5. Менеджер кораблей противника
    this.enemyManager = new EnemyManager(this);
    this.enemyManager.onBossDestroyed = (_boss) => {
      if (this.currentMission?.isBoss && !this.isGameOver && !this.isMissionWon) {
        this.triggerMissionVictory();
      }
    };
    this.enemyManager.onBossSpawned = (_boss) => {
      // Окошко фаз убрано, индикация босса отображается на верхней панели HUD
    };

    // 6. Настройка камеры для слежения за кораблем в пределах ограниченной карты
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.setBackgroundColor('#02040a');
    this.cameras.main.startFollow(this.playerShip.shipSprite, false, 0.08, 0.08);

    // 7. Построение боевого HUD интерфейса и тактического радара в выделенной статичной сцене HudScene
    const initialDpr = getGameDpr();
    this.hudManager = new HudManager(width / initialDpr, height / initialDpr);
    if (!this.scene.isActive('HudScene')) {
      this.scene.launch('HudScene');
    }
    this.scene.bringToTop('HudScene');
    const hudScene = this.scene.get('HudScene') as HudScene | undefined;
    if (hudScene && hudScene.isCreated) {
      hudScene.syncCameraZoom();
      this.hudManager.attachScene(hudScene);
    }

    // 8. Инициализация менеджера метеоритов (включая плотные пояса астероидов по 4 краям)
    this.meteorManager = new MeteorManager(this);
    this.meteorManager.createInitialMeteors(6);

    // 8.1. Инициализация странствующих космических баз и летающего магазина
    this.spaceStationManager = new SpaceStationManager(this);
    this.spaceStationManager.createInitialStations(2);
    this.flyingShopManager = new FlyingShopManager(this);

    // 8.2. Инициализация менеджера валюты «Металлолом»
    this.scrapManager = new ScrapManager(this);
    this.spaceStationManager.setScrapManager(this.scrapManager);

    // 8.3. Инициализация неонового барьера с надписями STOP по границам сектора
    this.neonBarrierManager = new NeonBarrierManager(this);

    // 9. Установка начальной фазы боя
    this.enemyManager.setPhase(1);

    // 10. Адаптивность при изменении размера окна
    const resizeListener = (gameSize: Phaser.Structs.Size) => {
      const dpr = getGameDpr();
      const activeHudScene = this.scene.get('HudScene') as HudScene | undefined;
      activeHudScene?.syncCameraZoom();
      this.hudManager.handleResize(gameSize.width / dpr, gameSize.height / dpr);
      this.updateCameraZoom();
    };
    this.scale.on('resize', resizeListener, this);

    // 11. Инициализация режима фонового боя главного меню
    this.initMenuMode();

    this.events.once('shutdown', () => {
      this.scale.off('resize', resizeListener, this);
      if (this.upgradeListener) {
        window.removeEventListener('apply-tank-upgrade', this.upgradeListener as EventListener);
        this.upgradeListener = null;
      }
      this.playerShip.destroy();
      this.weaponSystem.destroy();
      this.enemyManager.destroy();
      this.particleManager.destroy();
      this.atmosphereManager.destroy();
      this.hudManager.destroy();
      if (this.scene.isActive('HudScene')) {
        this.scene.stop('HudScene');
      }
      this.meteorManager.destroy();
      this.spaceStationManager.destroy();
      this.flyingShopManager.destroy();
      this.scrapManager.destroy();
      this.neonBarrierManager.destroy();
    });
  }

  public initMenuMode(): void {
    this.isMenuMode = true;
    this.isGameOver = false;
    this.isMissionWon = false;
    this.playerShip.setVisible(false);
    this.playerShip.setAutopilot(false);
    this.hudManager.setVisible(false);
    this.meteorManager?.reset();
    this.flyingShopManager?.reset();
    this.scrapManager?.reset();
    this.inMissionScrapCollected = 0;
    this.wasBossKilled = false;
    this.cameras.main.setZoom(getGameDpr());
    this.cameras.main.setFollowOffset(0, 0);
  }

  public enterMenuMode(): void {
    this.isMenuMode = true;
    this.isGameOver = false;
    this.isMissionWon = false;
    this.hudManager?.setVisible(false);
    this.playerShip?.setVisible(false);
    this.playerShip?.setAutopilot(false);
    this.playerShip?.resetUpgrades();
    this.spaceStationManager?.setTargetedStation(null);
    this.tweens.killTweensOf(this.cameras.main);
    this.cameras.main.setZoom(getGameDpr());
    this.cameras.main.setFollowOffset(0, 0);
    this.enemyManager?.reset();
    this.weaponSystem?.reset();
    this.weaponSystem?.resetUpgrades();
    this.meteorManager?.reset();
    this.flyingShopManager?.reset();
    this.scrapManager?.reset();
    this.inMissionScrapCollected = 0;
    this.wasBossKilled = false;
  }

  /**
   * Вычисление целевого масштаба камеры (Zoom).
   * Если игрок играет со смартфона/телефона (НЕ ПЛАНШЕТА), увеличиваем обзор,
   * отдаляя камеру (зум 0.62-0.70) для обеспечения комфортного поля видимости ~570-600px по вертикали.
   * На планшетах и ПК масштаб остается 1.0 (умноженным на HiDPI-коэффициент устройства).
   */
  public getTargetCameraZoom(): number {
    const dpr = getGameDpr();
    if (this.isMenuMode) {
      return dpr;
    }
    if (isMobilePhone()) {
      const logicalHeight = this.scale.height / dpr;
      return Phaser.Math.Clamp(logicalHeight / 570, 0.62, 0.70) * dpr;
    }
    return dpr;
  }

  public updateCameraZoom(): void {
    const targetZoom = this.getTargetCameraZoom();
    this.cameras.main.setZoom(targetZoom);
    if (this.hudManager) {
      this.hudManager.syncZoomTransform();
    }
  }

  public startCombatSession(customMission?: CampaignMission): void {
    this.isMenuMode = false;
    this.isGameOver = false;
    this.isMissionWon = false;
    this.survivalTime = 0;
    this.killsCount = 0;
    this.score = 0;
    this.inMissionScrapCollected = 0;
    this.wasBossKilled = false;
    this.currentPhase = 1;
    this.fireHazards = [];

    // Инициализация миссии кампании
    this.currentMission = customMission || campaignManager.getCurrentMission();

    this.spaceStationManager?.setTargetedStation(null);
    this.enemyManager?.reset();
    this.weaponSystem?.reset();
    this.weaponSystem?.resetUpgrades();
    this.weaponSystem?.setEquippedMissile(campaignManager.getEquippedMissileId());
    this.scrapManager?.reset();
    this.meteorManager?.reset();

    if (this.currentMission) {
      this.enemyManager?.setMission(this.currentMission);
      this.meteorManager?.setMission(this.currentMission);
      this.hudManager?.setMission(this.currentMission);
    }

    this.flyingShopManager?.setupForMission(this.currentMission);

    this.meteorManager?.createInitialMeteors();
    this.meteorManager?.clearMeteorsNear(MAP_WIDTH / 2, MAP_HEIGHT / 2, 750);

    if (this.playerShip) {
      this.playerShip.reset(MAP_WIDTH / 2, MAP_HEIGHT / 2);
      if (this.activeShipAssembly) {
        this.playerShip.setCustomAssembly(this.activeShipAssembly);
        if (this.playerShip.installedStats && this.weaponSystem) {
          this.weaponSystem.applyAssemblyStats(this.playerShip.installedStats);
        }
        if (this.hudManager) {
          this.hudManager.playerMaxHp = this.playerShip.maxHp;
        }
      }
      this.playerShip.resetUpgrades();
      this.weaponSystem?.resetUpgrades();
      this.applyCampaignUpgrades();
      this.playerShip.setVisible(true);
      this.playerShip.setAutopilot(false);
    }

    this.tweens.killTweensOf(this.cameras.main);
    this.updateCameraZoom();
    this.cameras.main.setFollowOffset(0, 0);
    this.hudManager?.setVisible(true);

    this.playerShip?.emitDashState();
    this.playerShip?.emitSuperState();
  }

  /**
   * Подготовка боевой сессии для голографического конструктора:
   * Игра замирает, корабль игрока и HUD скрываются, сцена на паузе
   */
  public pauseCombatSessionForBuilder(customMission?: CampaignMission): void {
    if (!this.playerShip || !this.enemyManager) {
      return;
    }
    this.startCombatSession(customMission);
    this.playerShip?.setVisible(false);
    this.hudManager?.setVisible(false);
    if (this.scene.isActive() && !this.scene.isPaused()) {
      this.scene.pause();
    }
  }

  /**
   * Возобновление боевой сессии после сборки корабля в конструкторе:
   * Корабль игрока появляется в собранном виде, HUD активируется, игра снимается с паузы
   */
  public resumeCombatSessionFromBuilder(assembly?: CustomShipAssembly): void {
    if (assembly) {
      this.activeShipAssembly = assembly;
      this.playerShip.setCustomAssembly(assembly);
      if (this.playerShip.installedStats) {
        this.weaponSystem.applyAssemblyStats(this.playerShip.installedStats);
      }
      this.hudManager.playerMaxHp = this.playerShip.maxHp;
    } else if (this.activeShipAssembly) {
      this.playerShip.setCustomAssembly(this.activeShipAssembly);
      if (this.playerShip.installedStats) {
        this.weaponSystem.applyAssemblyStats(this.playerShip.installedStats);
      }
      this.hudManager.playerMaxHp = this.playerShip.maxHp;
    }
    this.applyCampaignUpgrades();
    this.playerShip.setVisible(true);
    this.cameras.main.centerOn(this.playerShip.x, this.playerShip.y);
    this.updateCameraZoom();
    this.meteorManager.clearMeteorsNear(this.playerShip.x, this.playerShip.y, 750);
    this.hudManager.setVisible(true);
    if (this.scene.isPaused()) {
      this.scene.resume();
    }
  }

  public setJoystickVector(x: number, y: number): void {
    if (this.playerShip) {
      this.playerShip.setJoystickVector(x, y);
    }
  }

  public resetJoystick(): void {
    if (this.playerShip) {
      this.playerShip.resetJoystick();
    }
  }

  /**
   * Применение всех сохраненных тактических улучшений и модификаций текущей кампании
   * Каждое улучшение применяется ровно один раз!
   */
  public applyCampaignUpgrades(): void {
    this.playerShip.resetUpgrades();
    this.weaponSystem.resetUpgrades();
    this.scrapManager.resetModifications();

    const campaignUpgrades = campaignManager.getAppliedUpgradeIds();
    for (const upgradeId of campaignUpgrades) {
      this.playerShip.applyUpgrade(upgradeId);
      this.weaponSystem.applyUpgrade(upgradeId);
      this.scrapManager.applyModification(upgradeId);
    }
  }

  private handleEnemyKilled(
    scoreGained: number,
    ex: number,
    ey: number,
    enemyType?: string,
    isBoss?: boolean,
  ): void {
    this.killsCount += 1;
    this.score += scoreGained;
    this.checkPhaseProgression();
    let scrapDrop = getEnemyScrapDrop(enemyType, isBoss);
    if (scrapDrop > 0) {
      if (campaignManager.getAppliedUpgradeIds().includes('scrap_recycler')) {
        scrapDrop = Math.max(1, Math.round(scrapDrop * 1.2));
      }
      this.scrapManager.spawnScrap(ex, ey, scrapDrop);
    }
    if (isBoss) {
      this.wasBossKilled = true;
    }

    // Проверка победы в обычной миссии кампании (по числу уничтоженных врагов)
    if (
      this.currentMission &&
      !this.currentMission.isBoss &&
      !this.isGameOver &&
      !this.isMissionWon
    ) {
      const targetKills =
        this.currentMission.targetKills ??
        (15 + ((this.currentMission.sector - 1) * 5 + (this.currentMission.mission - 1)) * 5);
      if (this.killsCount >= targetKills) {
        this.triggerMissionVictory();
      }
    }
  }

  update(_time: number, delta: number): void {
    const seconds = delta / 1000;

    if (this.isMenuMode) {
      return;
    }

    if (this.isGameOver) {
      this.neonBarrierManager.update(seconds);
      this.particleManager.update(seconds);
      this.atmosphereManager.updateCosmicDust(seconds);
      this.meteorManager.update(seconds, this.cameras.main, this.particleManager);
      this.spaceStationManager.update(seconds, this.cameras.main);
      return;
    }

    if (this.isMissionWon) {
      this.neonBarrierManager.update(seconds);
      this.particleManager.update(seconds);
      this.atmosphereManager.updateCosmicDust(seconds);
      this.atmosphereManager.updateCosmicAtmosphere(seconds, this.cameras.main);
      this.meteorManager.update(seconds, this.cameras.main, this.particleManager);
      this.spaceStationManager.update(seconds, this.cameras.main);
      return;
    }

    this.survivalTime += seconds;

    // 0. Неоновый лазерный барьер с надписями STOP по краям сектора
    this.neonBarrierManager.update(seconds);
    this.neonBarrierManager.clampPlayer(this.playerShip, this.particleManager);

    // Проверка победы в обычной миссии кампании (по числу уничтоженных врагов)
    if (
      this.currentMission &&
      !this.currentMission.isBoss &&
      !this.isGameOver &&
      !this.isMissionWon
    ) {
      const targetKills =
        this.currentMission.targetKills ??
        (15 + ((this.currentMission.sector - 1) * 5 + (this.currentMission.mission - 1)) * 5);
      if (this.killsCount >= targetKills) {
        this.triggerMissionVictory();
        return;
      }
    }

    // 1. Процедурный космос: движение звезд и мерцание звездной пыли
    this.atmosphereManager.updateCosmicAtmosphere(seconds, this.cameras.main);

    // 1.1. Движение, вращение и периодический спавн метеоритов
    this.meteorManager.update(seconds, this.cameras.main, this.particleManager);

    // 1.2. Столкновение с метеоритом
    this.meteorManager.checkPlayerCollision(
      this.playerShip,
      () => {
        if (this.isMenuMode) {
          this.particleManager.spawnSparkBurst(this.playerShip.x, this.playerShip.y);
          return;
        }
        this.triggerGameOver('meteor');
      },
      this.particleManager,
    );

    // 2. Обновление подсветки базы при наведении курсора
    const pointer = this.input.activePointer;
    if (pointer && (pointer.x !== 0 || pointer.y !== 0)) {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.spaceStationManager.updateHover(worldPoint.x, worldPoint.y);
    }

    // 2.1. Автонаводка орудий: выбор приоритетной цели (захваченная база или ближайший враг)
    const targetedStation = this.spaceStationManager.getTargetedStation();
    let hasTarget = false;
    let nearestEnemy: import('./types').EnemyShip | null = null;

    if (targetedStation) {
      const activeStations = this.spaceStationManager.getStations();
      if (
        targetedStation.sprite?.active &&
        targetedStation.hp > 0 &&
        activeStations.includes(targetedStation)
      ) {
        const distToStation = Phaser.Math.Distance.Between(
          this.playerShip.x,
          this.playerShip.y,
          targetedStation.sprite.x,
          targetedStation.sprite.y,
        );
        const effectiveDist = Math.max(0, distToStation - targetedStation.boundingRadius);
        // Стреляем по захваченной базе, когда она в радиусе досягаемости орудий
        if (effectiveDist <= this.playerShip.getAttackRadius()) {
          hasTarget = true;
        }
        // Орудия направлены строго в центр базы
        this.playerShip.aimAngle = Phaser.Math.Angle.Between(
          this.playerShip.x,
          this.playerShip.y,
          targetedStation.sprite.x,
          targetedStation.sprite.y,
        );
      } else {
        // База уничтожена или ушла за пределы зоны — сброс захвата
        this.spaceStationManager.setTargetedStation(null);
      }
    }

    // Если база НЕ захвачена, автонаводка стреляет по ближайшему противнику
    if (!this.spaceStationManager.getTargetedStation()) {
      nearestEnemy = this.enemyManager.findNearestEnemy(this.playerShip.x, this.playerShip.y, this.playerShip.getAttackRadius());
      if (nearestEnemy && nearestEnemy.sprite?.active && nearestEnemy.hp > 0) {
        hasTarget = true;
        this.playerShip.aimAngle = Phaser.Math.Angle.Between(
          this.playerShip.x,
          this.playerShip.y,
          nearestEnemy.sprite.x,
          nearestEnemy.sprite.y,
        );
      } else {
        // Если врагов в радиусе нет — орудия смотрят вперед по курсу корабля
        this.playerShip.aimAngle = this.playerShip.shipFacingAngle;
      }
    }

    // 3. Перемещение корабля игрока (при автонаводке корпус НЕ поворачивается к врагам)
    this.playerShip.update(
      seconds,
      nearestEnemy,
      this.atmosphereManager,
      this.particleManager,
      this.survivalTime,
    );

    // 4. Автоматический огонь носовых орудий по цели
    this.weaponSystem.handleBlasterFire(
      seconds,
      this.playerShip,
      nearestEnemy,
      this.particleManager,
      hasTarget,
    );

    // Периодический ракетный залп в режиме меню
    if (this.isMenuMode) {
      this.menuSalvoTimer += seconds;
      if (this.menuSalvoTimer >= 3.6 && nearestEnemy) {
        this.menuSalvoTimer = 0;
        this.weaponSystem.fireRightClickSalvo(this.playerShip, this.particleManager);
      }
    }

    // 5. Движение снарядов
    this.weaponSystem.update(seconds);

    // 5.1. Столкновение снарядов с метеоритами (сколы, искры, раскалывание)
    this.meteorManager.checkLaserCollisions(
      this.weaponSystem,
      this.particleManager,
      (scoreGained) => {
        this.score += scoreGained;
        this.checkPhaseProgression();
      },
    );

    // 5.2. Кинетические удары метеоритов по кораблям врагов
    this.meteorManager.checkEnemyCollisions(
      this.enemyManager,
      this.particleManager,
      (scoreGained, ex, ey, enemyType, isBoss) => {
        this.handleEnemyKilled(scoreGained, ex, ey, enemyType, isBoss);
      },
    );

    // 5.3. Движение и попадания по странствующим космическим базам
    this.spaceStationManager.update(seconds, this.cameras.main);
    this.spaceStationManager.checkLaserCollisions(
      this.weaponSystem,
      this.particleManager,
      (scoreGained) => {
        this.score += scoreGained;
        this.checkPhaseProgression();
      },
      this.enemyManager,
      this.meteorManager,
      this.playerShip,
    );

    // 6. Спавн и поведение кораблей противника
    this.enemyManager.handleSpawning(seconds, this.survivalTime, this.cameras.main, this.killsCount);
    this.enemyManager.update(seconds, this.playerShip.x, this.playerShip.y, this.particleManager);

    // 7. Попадания снарядов по вражеским кораблям (выпадение металлолома)
    this.enemyManager.checkLaserCollisions(
      this.weaponSystem,
      this.particleManager,
      (scoreGained, ex, ey, enemyType, isBoss) => {
        this.handleEnemyKilled(scoreGained, ex, ey, enemyType, isBoss);
      },
    );
    this.enemyManager.checkEnergyTrailDamage(
      this.weaponSystem,
      this.particleManager,
      (scoreGained, ex, ey, enemyType, isBoss) => {
        this.handleEnemyKilled(scoreGained, ex, ey, enemyType, isBoss);
      },
    );

    // 7.1. Урон врагам и базам от плазменного следа двигателей
    for (let f = this.fireHazards.length - 1; f >= 0; f--) {
      const hazard = this.fireHazards[f];
      hazard.life -= seconds;
      hazard.damageTimer -= seconds;
      if (hazard.damageTimer <= 0) {
        hazard.damageTimer = 0.18;
        this.enemyManager.checkFireDamage(
          hazard.x,
          hazard.y,
          hazard.radius,
          0.4,
          this.particleManager,
          (scoreGained, ex, ey, enemyType, isBoss) => {
            this.handleEnemyKilled(scoreGained, ex, ey, enemyType, isBoss);
          },
        );
        this.spaceStationManager.checkFireDamage(
          hazard.x,
          hazard.y,
          hazard.radius,
          0.4,
          this.particleManager,
          (scoreGained) => {
            this.score += scoreGained;
            this.checkPhaseProgression();
          },
          this.enemyManager,
          this.meteorManager,
          this.playerShip,
        );
      }
      if (hazard.life <= 0) {
        this.fireHazards.splice(f, 1);
      }
    }

    // 8. Контактные столкновения вражеских кораблей со звездолетом
    this.enemyManager.checkPlayerCollisions(
      this.playerShip,
      this.particleManager,
      () => {
        if (this.isMenuMode) {
          this.playerShip.hp = PLAYER_MAX_HP;
          return;
        }
        this.triggerGameOver();
      },
      (scoreGained, ex, ey, enemyType, isBoss) => {
        this.handleEnemyKilled(scoreGained, ex, ey, enemyType, isBoss);
      },
    );

    // 8.1. Обновление летающего магазина и проверка нахождения игрока в желтой сфере (2 сек)
    this.flyingShopManager.update(
      seconds,
      this.playerShip.x,
      this.playerShip.y,
      () => {
        this.openFlyingShop();
      },
    );

    // 8.2. Обновление фрагментов металлолома: разлет, притягивание и сбор
    this.scrapManager.update(
      seconds,
      this.playerShip.x,
      this.playerShip.y,
      (scrapGained) => {
        this.inMissionScrapCollected += scrapGained;
      },
      this.particleManager,
    );

    // 9. Обновление частиц и спецэффектов
    this.particleManager.update(seconds);

    // 10. Обновление интерфейса HUD, металлолома и тактического радара
    this.hudManager.update(
      this.playerShip.hp,
      this.survivalTime,
      this.killsCount,
      this.score,
      this.playerShip.x,
      this.playerShip.y,
      this.playerShip.lastMoveAngle,
      this.cameras.main,
      this.enemyManager.getEnemies(),
      undefined,
      this.currentPhase,
      this.meteorManager.getMeteors(),
      this.spaceStationManager.getStations(),
      this.spaceStationManager.getTargetedStation(),
      this.enemyManager.getActiveBoss(),
      this.inMissionScrapCollected,
      this.scrapManager.getItems(),
      this.flyingShopManager.getShop(),
    );
  }

  public getAvailableShopScrap(): number {
    return campaignManager.getScrapBalance() + this.inMissionScrapCollected;
  }

  public purchaseShopMissile(offer: ShopMissileOffer): boolean {
    if (this.flyingShopManager.getPurchasedIds().has(offer.id)) {
      return false;
    }
    const available = this.getAvailableShopScrap();
    if (available < offer.price) {
      return false;
    }

    let remainingCost = offer.price;
    if (this.inMissionScrapCollected > 0) {
      const deductInMission = Math.min(this.inMissionScrapCollected, remainingCost);
      this.inMissionScrapCollected -= deductInMission;
      remainingCost -= deductInMission;
    }
    if (remainingCost > 0) {
      campaignManager.spendScrap(remainingCost);
    }

    this.flyingShopManager.markPurchased(offer.id);
    campaignManager.setEquippedMissileId(offer.id);
    this.weaponSystem.setEquippedMissile(offer.id);
    return true;
  }

  private openFlyingShop(): void {
    if (this.isGameOver || this.isMissionWon || this.isMenuMode) return;
    this.input.keyboard?.resetKeys();
    this.playerShip.resetJoystick();
    if (this.scene.isActive() && !this.scene.isPaused()) {
      this.scene.pause();
    }
    window.dispatchEvent(
      new CustomEvent('open-flying-shop', {
        detail: {
          offers: this.flyingShopManager.getOffers(),
          purchasedIds: this.flyingShopManager.getPurchasedIds(),
        },
      }),
    );
  }

  public triggerMissionVictory(): void {
    if (this.isMissionWon || this.isGameOver) return;
    this.isMissionWon = true;

    // Сбор всех оставшихся на карте фрагментов металлолома
    this.scrapManager.collectAll(this.playerShip.x, this.playerShip.y, (scrapGained) => {
      this.inMissionScrapCollected += scrapGained;
    });

    // 1. Останавливаем появление новых врагов и метеоритов
    this.enemyManager.stopSpawning();
    this.enemyManager.clearActiveThreats();
    this.meteorManager.stopSpawning();

    // 2. Победный звуковой эффект и праздничный салют в космосе
    soundFx.playUpgradeSelect();
    this.particleManager.spawnExplosion(this.playerShip.x + 35, this.playerShip.y - 30);
    this.particleManager.spawnExplosion(this.playerShip.x - 35, this.playerShip.y + 30);
    this.cameras.main.shake(300, 0.012);

    const isBossMission = !!this.currentMission?.isBoss;
    const runId = campaignManager.getRunId();

    // 3. Фиксация победы в CampaignManager с начислением наград металлолома
    const outcome = campaignManager.recordVictory(
      this.score,
      this.killsCount,
      this.survivalTime,
      {
        enemyScrap: this.inMissionScrapCollected,
        isBossMission,
        wasBossKilled: this.wasBossKilled || isBossMission,
      },
    );
    const timeFormatted = this.hudManager.formatTime(this.survivalTime);

    track('game_over', {
      run_id: runId,
      score: this.score,
      phase: this.currentPhase,
      duration_sec: Math.round(this.survivalTime),
      outcome: 'victory',
    });

    const completedMissionId = `${outcome.completedSector}-${outcome.completedMission}`;
    if (completedMissionId === '1-3' && campaignManager.markFirstModificationReached()) {
      track('first_modification_reached', {
        run_id: runId,
        mission_id: '1-3',
      });
    }

    if (outcome.isCampaignComplete && campaignManager.markCampaignCompleted()) {
      track('campaign_completed', {
        run_id: runId,
        mission_id: '3-5',
      });
      track('ship_builder_total_time', {
        run_id: runId,
        total_seconds: Math.round(campaignManager.getTotalShipBuilderTime()),
      });
    }

    // 4. Оповещение UI об успешном выполнении миссии
    window.dispatchEvent(
      new CustomEvent('mission-completed', {
        detail: {
          sector: outcome.completedSector,
          mission: outcome.completedMission,
          missionId: `${outcome.completedSector}-${outcome.completedMission}`,
          title: this.currentMission?.title || `Миссия ${outcome.completedSector}-${outcome.completedMission}`,
          subtitle: this.currentMission?.subtitle || `СЕКТОР ${outcome.completedSector}`,
          isBoss: isBossMission,
          score: this.score,
          kills: this.killsCount,
          time: timeFormatted,
          nextSector: outcome.nextSector,
          nextMission: outcome.nextMission,
          isCampaignComplete: outcome.isCampaignComplete,
          totalScore: campaignManager.getSaveData().totalScore,
          scrapBreakdown: outcome.scrapBreakdown,
        },
      }),
    );
  }

  private checkPhaseProgression(): void {
    if (this.isMenuMode) return;
    let nextPhase = this.currentPhase;
    for (const phase of GAME_PHASES) {
      if (this.score >= phase.scoreThreshold && phase.number > nextPhase) {
        nextPhase = phase.number;
      }
    }
    if (nextPhase > this.currentPhase) {
      this.currentPhase = nextPhase;
      this.enemyManager.setPhase(this.currentPhase);
      this.meteorManager.setPhase(this.currentPhase);
      // Окошко фаз убрано
    }
  }

  private notifyPhaseChange(_phaseNumber: number): void {
    // Окошко фаз убрано из игры
  }

  private triggerGameOver(reason?: string): void {
    if (this.isGameOver) return;
    this.isGameOver = true;

    track('game_over', {
      run_id: campaignManager.getRunId(),
      score: this.score,
      phase: this.currentPhase,
      duration_sec: Math.round(this.survivalTime),
      outcome: 'defeat',
    });

    // Останавливаем спавн и уничтожаем накопившиеся метеориты, чтобы не спавниться в них при рестарте
    this.meteorManager.stopSpawning();
    this.meteorManager.reset();

    soundFx.playExplosion();
    this.cameras.main.shake(380, 0.024);
    this.particleManager.spawnExplosion(this.playerShip.x, this.playerShip.y);
    this.playerShip.setVisible(false);

    const timeFormatted = this.hudManager.formatTime(this.survivalTime);

    // Уведомление внешнего HTML UI об окончании космической миссии
    window.dispatchEvent(
      new CustomEvent('tank-destroyed', {
        detail: {
          time: timeFormatted,
          kills: this.killsCount,
          score: this.score,
          reason,
        },
      }),
    );
  }
}

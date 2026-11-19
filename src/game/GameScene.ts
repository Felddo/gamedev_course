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
import station020Url from '../assets/Sprites/Station/spaceStation_020.png';
import station021Url from '../assets/Sprites/Station/spaceStation_021.png';
import station024Url from '../assets/Sprites/Station/spaceStation_024.png';
import playerMissileUrl from '../assets/Sprites/Missiles/spaceMissiles_039.png';
import evilShip005Url from '../assets/Sprites/EvilShips/spaceShips_005.png';
import evilShip004Url from '../assets/Sprites/EvilShips/spaceShips_004.png';
import evilShip006Url from '../assets/Sprites/EvilShips/spaceShips_006.png';

import { MAP_WIDTH, MAP_HEIGHT, GAME_PHASES, PLAYER_MAX_HP } from './constants';
export * from './constants';
export * from './types';
import { FireHazard } from './types';

import { PlayerShip } from './PlayerShip';
import { WeaponSystem } from './WeaponSystem';
import { EnemyManager } from './EnemyManager';
import { ParticleManager } from './ParticleManager';
import { AtmosphereManager } from './AtmosphereManager';
import { HudManager } from './HudManager';
import { MeteorManager } from './MeteorManager';
import { SpaceStationManager } from './SpaceStationManager';
import { ExperienceManager } from './ExperienceManager';
import { ScrapManager } from './ScrapManager';
import { getEnemyScrapDrop } from './campaign/scrapConfig';
import { buildPartsCatalog } from './shipBuilder/partsCatalog';
import { CustomShipAssembly } from './shipBuilder/ShipBuilderModal';
import { CampaignMission } from './campaign/types';
import { campaignManager } from './campaign/CampaignManager';

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
  private experienceManager!: ExperienceManager;
  private scrapManager!: ScrapManager;

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
    this.load.image('enemy_ship_weak', evilShip005Url);
    this.load.image('enemy_ship_medium', evilShip004Url);
    this.load.image('enemy_ship_shooter', evilShip006Url);
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
    this.load.image('space_station_020', station020Url);
    this.load.image('space_station_021', station021Url);
    this.load.image('space_station_024', station024Url);

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
    this.enemyManager.onBossSpawned = (boss) => {
      window.dispatchEvent(
        new CustomEvent('phase-changed', {
          detail: {
            phase: 2,
            title: boss.bossName || 'БОСС СЕКТОРА',
            subtitle: 'ТРЕВОГА // В СЕКТОР ВОШЕЛ ВРАЖЕСКИЙ ФЛАГМАН!',
          },
        }),
      );
    };

    // 6. Настройка камеры для слежения за кораблем
    this.cameras.main.removeBounds();
    this.cameras.main.setBackgroundColor('#02040a');
    this.cameras.main.startFollow(this.playerShip.shipSprite, true, 0.08, 0.08);

    // 7. Построение боевого HUD интерфейса и тактического радара
    this.hudManager = new HudManager(this, width, height);

    // 8. Инициализация менеджера метеоритов
    this.meteorManager = new MeteorManager(this);
    this.meteorManager.createInitialMeteors(6);

    // 8.1. Инициализация странствующих космических баз
    this.spaceStationManager = new SpaceStationManager(this);
    this.spaceStationManager.createInitialStations(2);

    // 8.2. Инициализация менеджера фиолетового голографического опыта
    this.experienceManager = new ExperienceManager(this);

    // 8.3. Инициализация менеджера валюты «Металлолом»
    this.scrapManager = new ScrapManager(this);

    // 9. Установка начальной фазы боя
    this.enemyManager.setPhase(1);

    // 10. Адаптивность при изменении размера окна
    const resizeListener = (gameSize: Phaser.Structs.Size) => {
      this.hudManager.handleResize(gameSize.width, gameSize.height);
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
      this.meteorManager.destroy();
      this.spaceStationManager.destroy();
      this.experienceManager.destroy();
      this.scrapManager.destroy();
    });
  }

  public initMenuMode(): void {
    this.isMenuMode = true;
    this.isGameOver = false;
    this.isMissionWon = false;
    this.playerShip.setVisible(false);
    this.playerShip.setAutopilot(false);
    this.hudManager.setVisible(false);
    this.experienceManager.reset();
    this.scrapManager?.reset();
    this.inMissionScrapCollected = 0;
    this.wasBossKilled = false;
    this.cameras.main.setZoom(1.0);
    this.cameras.main.setFollowOffset(0, 0);
  }

  public enterMenuMode(): void {
    this.isMenuMode = true;
    this.isGameOver = false;
    this.isMissionWon = false;
    this.hudManager.setVisible(false);
    this.playerShip.setVisible(false);
    this.playerShip.setAutopilot(false);
    this.playerShip.resetUpgrades();
    this.spaceStationManager.setTargetedStation(null);
    this.tweens.killTweensOf(this.cameras.main);
    this.cameras.main.setZoom(1.0);
    this.cameras.main.setFollowOffset(0, 0);
    this.enemyManager.reset();
    this.weaponSystem.reset();
    this.weaponSystem.resetUpgrades();
    this.experienceManager.reset();
    this.scrapManager?.reset();
    this.inMissionScrapCollected = 0;
    this.wasBossKilled = false;
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

    this.spaceStationManager.setTargetedStation(null);
    this.enemyManager.reset();
    this.weaponSystem.reset();
    this.weaponSystem.resetUpgrades();
    this.experienceManager.reset();
    this.scrapManager.reset();

    this.enemyManager.setMission(this.currentMission);
    this.meteorManager.setMission(this.currentMission);
    this.hudManager.setMission(this.currentMission);

    this.playerShip.reset(MAP_WIDTH / 2, MAP_HEIGHT / 2);
    if (this.activeShipAssembly) {
      this.playerShip.setCustomAssembly(this.activeShipAssembly);
      if (this.playerShip.installedStats) {
        this.weaponSystem.applyAssemblyStats(this.playerShip.installedStats);
      }
      this.hudManager.playerMaxHp = this.playerShip.maxHp;
    }
    this.playerShip.resetUpgrades();
    this.weaponSystem.resetUpgrades();
    this.applyCampaignUpgrades();
    this.playerShip.setVisible(true);
    this.playerShip.setAutopilot(false);

    this.tweens.killTweensOf(this.cameras.main);
    this.cameras.main.setZoom(1.0);
    this.cameras.main.setFollowOffset(0, 0);
    this.hudManager.setVisible(true);

    this.notifyPhaseChange(1);
    this.playerShip.emitDashState();
    this.playerShip.emitSuperState();
  }

  /**
   * Подготовка боевой сессии для голографического конструктора:
   * Игра замирает, корабль игрока и HUD скрываются, сцена на паузе
   */
  public pauseCombatSessionForBuilder(): void {
    this.startCombatSession();
    this.playerShip.setVisible(false);
    this.hudManager.setVisible(false);
    this.scene.pause();
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
    this.hudManager.setVisible(true);
    if (this.scene.isPaused()) {
      this.scene.resume();
    }
  }

  /**
   * Применение всех сохраненных тактических улучшений текущей кампании
   * Каждое улучшение применяется ровно один раз!
   */
  public applyCampaignUpgrades(): void {
    const campaignUpgrades = campaignManager.getAppliedUpgradeIds();
    for (const upgradeId of campaignUpgrades) {
      this.playerShip.applyUpgrade(upgradeId);
      this.weaponSystem.applyUpgrade(upgradeId);
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
    this.experienceManager.spawnOrbs(ex, ey, scoreGained);
    const scrapDrop = getEnemyScrapDrop(enemyType, isBoss);
    if (scrapDrop > 0) {
      this.scrapManager.spawnScrap(ex, ey, scrapDrop);
    }
    if (isBoss) {
      this.wasBossKilled = true;
    }
  }

  update(_time: number, delta: number): void {
    const seconds = delta / 1000;

    if (this.isMenuMode) {
      return;
    }

    if (this.isGameOver) {
      this.particleManager.update(seconds);
      this.atmosphereManager.updateCosmicDust(seconds);
      this.meteorManager.update(seconds, this.cameras.main, this.particleManager);
      this.spaceStationManager.update(seconds, this.cameras.main);
      return;
    }

    if (this.isMissionWon) {
      this.particleManager.update(seconds);
      this.atmosphereManager.updateCosmicDust(seconds);
      this.atmosphereManager.updateCosmicAtmosphere(seconds, this.cameras.main);
      this.meteorManager.update(seconds, this.cameras.main, this.particleManager);
      this.spaceStationManager.update(seconds, this.cameras.main);
      return;
    }

    this.survivalTime += seconds;

    // Проверка победы в обычной миссии кампании (по истечении времени выживания)
    if (
      this.currentMission &&
      !this.currentMission.isBoss &&
      this.survivalTime >= this.currentMission.targetDuration &&
      !this.isGameOver &&
      !this.isMissionWon
    ) {
      this.triggerMissionVictory();
      return;
    }

    // 1. Процедурный космос: движение звезд и мерцание звездной пыли
    this.atmosphereManager.updateCosmicAtmosphere(seconds, this.cameras.main);

    // 1.1. Движение, вращение и периодический спавн метеоритов
    this.meteorManager.update(seconds, this.cameras.main, this.particleManager);

    // 1.2. Столкновение с метеоритом
    this.meteorManager.checkPlayerCollision(this.playerShip, () => {
      if (this.isMenuMode) {
        this.particleManager.spawnSparkBurst(this.playerShip.x, this.playerShip.y);
        return;
      }
      this.triggerGameOver('meteor');
    });

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
        if (effectiveDist <= 850) {
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
      nearestEnemy = this.enemyManager.findNearestEnemy(this.playerShip.x, this.playerShip.y, 850);
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
      (scoreGained, mx, my) => {
        this.experienceManager.spawnOrbs(mx, my, scoreGained);
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
      (scoreGained, sx, sy) => {
        const dropX = sx ?? this.playerShip.x;
        const dropY = sy ?? this.playerShip.y;
        this.experienceManager.spawnOrbs(dropX, dropY, scoreGained);
      },
      this.enemyManager,
      this.meteorManager,
      this.playerShip,
    );

    // 6. Спавн и поведение кораблей противника
    this.enemyManager.handleSpawning(seconds, this.survivalTime, this.cameras.main);
    this.enemyManager.update(seconds, this.playerShip.x, this.playerShip.y, this.particleManager);

    // 7. Попадания снарядов по вражеским кораблям (выпадение сфер опыта и металлолома)
    this.enemyManager.checkLaserCollisions(
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
          (scoreGained, sx, sy) => {
            const dropX = sx ?? hazard.x;
            const dropY = sy ?? hazard.y;
            this.experienceManager.spawnOrbs(dropX, dropY, scoreGained);
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

    // 8.1. Обновление фиолетового голографического опыта: притягивание и сбор
    this.experienceManager.update(
      seconds,
      this.playerShip.x,
      this.playerShip.y,
      (expGained) => {
        this.score += expGained;
        this.checkPhaseProgression();
      },
      this.particleManager,
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

    // 10. Обновление интерфейса HUD, фиолетовой полоски опыта, металлолома и тактического радара
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
      this.experienceManager.getOrbs(),
      this.enemyManager.getActiveBoss(),
      this.inMissionScrapCollected,
      this.scrapManager.getItems(),
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
      this.notifyPhaseChange(this.currentPhase);
    }
  }

  private notifyPhaseChange(phaseNumber: number): void {
    const phaseInfo = GAME_PHASES.find((p) => p.number === phaseNumber) || {
      number: phaseNumber,
      title: `Фаза ${phaseNumber}`,
      subtitle: '',
      scoreThreshold: 0,
      allowTerminator: true,
      spawnIntensity: 1.0,
      healthMultiplier: 1.0,
    };

    soundFx.playPhaseNotification(phaseNumber);

    window.dispatchEvent(
      new CustomEvent('phase-changed', {
        detail: {
          phase: phaseNumber,
          title: phaseInfo.title,
          subtitle: phaseInfo.subtitle,
          scoreThreshold: phaseInfo.scoreThreshold,
        },
      }),
    );
  }

  private triggerGameOver(reason?: string): void {
    if (this.isGameOver) return;
    this.isGameOver = true;

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

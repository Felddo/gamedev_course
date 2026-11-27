import Phaser from 'phaser';
import { soundFx } from './audio';
import {
  PLAYER_SPEED,
  PLAYER_MAX_HP,
  PLAYER_INVULN_TIME,
  DASH_COOLDOWN,
  DASH_DURATION,
  DASH_SPEED,
  SUPER_DURATION,
  SUPER_COOLDOWN,
  SHIP_SCALE,
  MAP_WIDTH,
  MAP_HEIGHT,
  PLAYER_ATTACK_RADIUS,
} from './constants';
import { EnemyShip } from './types';
import { AtmosphereManager } from './AtmosphereManager';
import { ParticleManager } from './ParticleManager';
import { CustomShipAssembly } from './shipBuilder/ShipBuilderModal';
import { calculateAssemblyStats, CalculatedShipStats } from './shipBuilder/modulesCatalog';
import { track } from '../analytics';
import { campaignManager } from './campaign/CampaignManager';

/**
 * Боевой космический корабль игрока:
 * - Модульная система сборки из конструктора верфи
 * - Маневровые и маршевые двигатели со световыми соплами
 * - Наведение носовых орудий по направлению курсора
 * - Форсаж / ракетный рывок (Shift)
 * - Режим боевой перегрузки реактора / овердрайв (ПКМ)
 */
export class PlayerShip {
  private scene: Phaser.Scene;

  public shipSprite!: Phaser.GameObjects.Sprite;
  public customShipContainer!: Phaser.GameObjects.Container;
  private customPartSprites: Phaser.GameObjects.Sprite[] = [];
  public customAssembly: CustomShipAssembly | null = null;
  private isShipVisible = true;
  private shieldSprite!: Phaser.GameObjects.Sprite;
  public leftFlameSprite!: Phaser.GameObjects.Sprite;
  public rightFlameSprite!: Phaser.GameObjects.Sprite;
  public engineFlames: Array<{ left: Phaser.GameObjects.Sprite; right: Phaser.GameObjects.Sprite }> = [];
  public attackRangeCircle!: Phaser.GameObjects.Graphics;

  // Совместимый геттер для корпуса
  public get hullSprite(): Phaser.GameObjects.Sprite {
    return this.shipSprite;
  }

  public lastMoveAngle = -Math.PI / 2;
  public aimAngle = -Math.PI / 2;
  public recoilOffset = 0;

  // Совместимый геттер для угла прицеливания орудий
  public get turretAimAngle(): number {
    return this.aimAngle;
  }

  // Физическое направление носа корабля (не зависит от угла автонаводки орудий)
  public get shipFacingAngle(): number {
    return this.shipSprite ? this.shipSprite.rotation + Math.PI / 2 : this.lastMoveAngle;
  }

  // Показатели корабля
  public installedStats: CalculatedShipStats | null = null;
  public maxHp = PLAYER_MAX_HP;
  public damageReduction = 0;
  public hp = PLAYER_MAX_HP;
  public invulnTimer = 0;
  public isGameOver = false;

  // Тактические апгрейды (Двигатели и Орудия)
  public appliedUpgrades = new Set<string>();
  public speedMultiplier = 2.0;
  public dashCooldownMultiplier = 1.0;
  public hasFireTrail = false;
  public hasRamSpikes = false;
  public hasEmpDrift = false;
  public onFireTrailSpawn: ((x: number, y: number) => void) | null = null;
  private normalFireTrailTimer = 0;

  // Модификации корабля (Soul Knight style)
  public attackRadiusMultiplier = 1.0;
  public modDamageReduction = 0;
  public modMoveSpeedMultiplier = 1.0;

  public getAttackRadius(): number {
    return PLAYER_ATTACK_RADIUS * this.attackRadiusMultiplier;
  }

  // Режим автопилота для главного экрана
  public isAutopilot = false;
  private autopilotDashTimer = 0;

  public setAutopilot(enabled: boolean): void {
    this.isAutopilot = enabled;
  }

  // Механика форсажа (Shift)
  public dashCooldownTimer = 0;
  public isDashing = false;
  private dashTimer = 0;
  private dashMoveAngle = -Math.PI / 2;
  private dashDirX = 0;
  private dashDirY = -1;
  private dashDriftYaw = 0;
  private dashFlameTimer = 0;

  // Механика перегрузки реактора (ПКМ)
  public isSuperMode = false;
  public superDurationTimer = 0;
  public superCooldownTimer = 0;
  private superFlameTimer = 0;

  // Управление с виртуального джойстика (сенсорный ввод)
  public joystickVector = { x: 0, y: 0 };
  public isJoystickActive = false;

  public setJoystickVector(x: number, y: number): void {
    const len = Math.hypot(x, y);
    if (len > 0.05) {
      const normLen = Math.min(1.0, len);
      this.joystickVector.x = (x / len) * normLen;
      this.joystickVector.y = (y / len) * normLen;
      this.isJoystickActive = true;
    } else {
      this.joystickVector.x = 0;
      this.joystickVector.y = 0;
      this.isJoystickActive = false;
    }
  }

  public resetJoystick(): void {
    this.joystickVector.x = 0;
    this.joystickVector.y = 0;
    this.isJoystickActive = false;
  }

  // Управление
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private qKey!: Phaser.Input.Keyboard.Key;

  // Слушатели событий
  private dashRequestListener!: () => void;
  private superRequestListener!: () => void;
  private onWindowShiftListener!: (e: KeyboardEvent) => void;
  private onWindowCombatModeListener!: (e: KeyboardEvent) => void;
  private onWindowMouseDownListener!: (e: MouseEvent) => void;
  private onContextMenuListener!: (e: MouseEvent) => void;
  private onWindowMouseMove!: (e: MouseEvent) => void;

  public cursorWorldX = 0;
  public cursorWorldY = 0;
  public hasCursorMoved = false;

  constructor(scene: Phaser.Scene, startX: number, startY: number) {
    this.scene = scene;
    this.create(startX, startY);
  }

  public get x(): number {
    return this.shipSprite.x;
  }

  public get y(): number {
    return this.shipSprite.y;
  }

  private create(startX: number, startY: number): void {
    // 1. Корпус космолета игрока spaceShips_001
    this.shipSprite = this.scene.add.sprite(startX, startY, 'player_ship');
    this.shipSprite.setOrigin(0.5, 0.5);
    this.shipSprite.setScale(SHIP_SCALE);
    this.shipSprite.setDepth(10);
    this.shipSprite.rotation = this.lastMoveAngle - Math.PI / 2;

    // 1.1 Контейнер модульного корабля из конструктора верфи
    this.customShipContainer = this.scene.add.container(startX, startY);
    this.customShipContainer.setDepth(10);
    this.customShipContainer.setVisible(false);

    // 2. Двойное пламя сопел маршевых двигателей
    this.leftFlameSprite = this.scene.add.sprite(startX, startY, 'space_effect_001');
    this.leftFlameSprite.setOrigin(0.5, 0);
    this.leftFlameSprite.setDepth(9);

    this.rightFlameSprite = this.scene.add.sprite(startX, startY, 'space_effect_001');
    this.rightFlameSprite.setOrigin(0.5, 0);
    this.rightFlameSprite.setDepth(9);

    this.engineFlames = [{ left: this.leftFlameSprite, right: this.rightFlameSprite }];

    // 2.5 Малозаметный круг боевого радиуса поражения корабля
    this.attackRangeCircle = this.scene.add.graphics();
    this.attackRangeCircle.setDepth(4);
    this.drawAttackRangeCircle();
    this.attackRangeCircle.setPosition(startX, startY);
    this.attackRangeCircle.setVisible(false);

    // 3. Голографический силовой щит форсажа и неуязвимости
    this.shieldSprite = this.scene.add.sprite(startX, startY, 'shield_aura');
    this.shieldSprite.setDepth(13);
    this.shieldSprite.setScale(1.15 * SHIP_SCALE);
    this.shieldSprite.setVisible(false);

    // 4. Клавиатурное управление
    if (!this.scene.input.keyboard) {
      throw new Error('Клавиатура недоступна в браузере');
    }

    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.wasd = this.scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

    this.shiftKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.qKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    // 5. Регистрация событий управления форсажем и овердрайвом
    this.setupListeners();

    // 6. Начальная синхронизация состояния с UI
    this.emitDashState();
    this.emitSuperState();
  }

  private setupListeners(): void {
    this.dashRequestListener = () => {
      if (this.isAutopilot) return;
      this.tryTriggerDash();
    };
    window.addEventListener('request-tank-dash', this.dashRequestListener);

    this.onWindowShiftListener = (e: KeyboardEvent) => {
      if (this.isAutopilot) return;
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.key === 'Shift') && !e.repeat) {
        this.tryTriggerDash();
      }
    };
    window.addEventListener('keydown', this.onWindowShiftListener);

    this.onWindowCombatModeListener = (e: KeyboardEvent) => {
      if (this.isAutopilot) return;
      if (
        (e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q' || e.key === 'й' || e.key === 'Й') &&
        !e.repeat
      ) {
        this.tryTriggerSuperMode();
      }
    };
    window.addEventListener('keydown', this.onWindowCombatModeListener);

    this.superRequestListener = () => {
      if (this.isAutopilot) return;
      this.tryTriggerSuperMode();
    };
    window.addEventListener('request-tank-super', this.superRequestListener);

    this.scene.input.mouse?.disableContextMenu();

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isAutopilot) return;
      if (pointer.rightButtonDown() || pointer.button === 2) {
        this.tryTriggerSuperMode();
        window.dispatchEvent(new CustomEvent('player-right-click-fire'));
      }
    });

    this.onWindowMouseDownListener = (e: MouseEvent) => {
      if (this.isAutopilot) return;
      if (e.button === 2) {
        e.preventDefault();
        this.tryTriggerSuperMode();
        window.dispatchEvent(new CustomEvent('player-right-click-fire'));
      }
    };
    window.addEventListener('mousedown', this.onWindowMouseDownListener);

    this.onContextMenuListener = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', this.onContextMenuListener);

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.cursorWorldX = worldPoint.x;
      this.cursorWorldY = worldPoint.y;
      this.hasCursorMoved = true;
    });

    this.onWindowMouseMove = (e: MouseEvent) => {
      const canvas = this.scene.game.canvas;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screenX = ((e.clientX - rect.left) / rect.width) * this.scene.scale.width;
      const screenY = ((e.clientY - rect.top) / rect.height) * this.scene.scale.height;
      const worldPoint = this.scene.cameras.main.getWorldPoint(screenX, screenY);
      this.cursorWorldX = worldPoint.x;
      this.cursorWorldY = worldPoint.y;
      this.hasCursorMoved = true;
    };
    window.addEventListener('mousemove', this.onWindowMouseMove);
  }

  /**
   * Установка кастомной модульной сборки корабля из верфи
   */
  public setCustomAssembly(assembly: CustomShipAssembly | null): void {
    this.customAssembly = assembly;

    this.customShipContainer.removeAll(true);
    this.customPartSprites = [];

    const shouldShow = this.isShipVisible && !this.isGameOver;

    if (!assembly || assembly.modules.length === 0) {
      this.customShipContainer.setVisible(false);
      this.shipSprite.setVisible(shouldShow);
      this.installedStats = null;
      this.maxHp = PLAYER_MAX_HP;
      this.damageReduction = 0;
      this.hp = Math.min(this.hp, this.maxHp);
      return;
    }

    // Расчет характеристик по фактически установленным модулям
    this.installedStats = calculateAssemblyStats(assembly.modules);
    this.maxHp = this.installedStats.maxHp;
    this.damageReduction = this.installedStats.damageReduction;
    this.hp = this.maxHp;

    const sortedModules = [...assembly.modules].sort((a, b) => a.zIndex - b.zIndex);

    sortedModules.forEach((mod) => {
      let texKey = mod.textureKey;
      let isFallback = false;
      if (!this.scene.textures.exists(texKey)) {
        isFallback = true;
        texKey = this.scene.textures.exists('player_ship') ? 'player_ship' : '__DEFAULT';
      }

      const sprite = this.scene.add.sprite(mod.offsetX, mod.offsetY, texKey);
      sprite.setOrigin(0.5, 0.5);
      sprite.setRotation((mod.rotationDeg * Math.PI) / 180);
      const scale = 0.5;
      sprite.setScale((mod.flipX ? -1 : 1) * scale, scale);

      if (isFallback && mod.url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (!this.scene.textures.exists(mod.textureKey)) {
            this.scene.textures.addImage(mod.textureKey, img);
          }
          if (sprite && sprite.active) {
            sprite.setTexture(mod.textureKey);
          }
        };
        img.src = mod.url;
      }

      this.customShipContainer.add(sprite);
      this.customPartSprites.push(sprite);
    });

    // Сразу ориентируем контейнер и выставляем позицию
    this.customShipContainer.setPosition(this.shipSprite.x, this.shipSprite.y);
    this.customShipContainer.setRotation(this.shipFacingAngle + Math.PI / 2);
    this.customShipContainer.setAlpha(this.shipSprite.alpha);

    // Скрываем стандартный монолитный корпус и активируем собранный корабль
    this.shipSprite.setVisible(false);
    this.customShipContainer.setVisible(shouldShow);

    // Синхронизируем пламя для всех двигателей (включая второй двигатель)
    this.syncEngineFlames(shouldShow);
  }

  /**
   * Синхронизация спрайтов пламени для каждого установленного двигателя (1-й, 2-й и т.д.)
   */
  private syncEngineFlames(shouldShow: boolean): void {
    const requiredEngines =
      this.customAssembly && this.customAssembly.engineOffsets.length > 0
        ? this.customAssembly.engineOffsets.length
        : 1;

    while (this.engineFlames.length < requiredEngines) {
      const left = this.scene.add.sprite(this.shipSprite.x, this.shipSprite.y, 'space_effect_001');
      left.setOrigin(0.5, 0);
      left.setDepth(9);
      left.setVisible(shouldShow);

      const right = this.scene.add.sprite(this.shipSprite.x, this.shipSprite.y, 'space_effect_001');
      right.setOrigin(0.5, 0);
      right.setDepth(9);
      right.setVisible(shouldShow);

      this.engineFlames.push({ left, right });
    }

    while (this.engineFlames.length > requiredEngines) {
      const removed = this.engineFlames.pop();
      if (removed) {
        removed.left.destroy();
        removed.right.destroy();
      }
    }

    if (this.engineFlames.length > 0) {
      this.leftFlameSprite = this.engineFlames[0].left;
      this.rightFlameSprite = this.engineFlames[0].right;
    }
  }

  /**
   * Отрисовка минималистичного круга радиуса поражения корабля в стиле зеленой голограммы
   */
  public drawAttackRangeCircle(): void {
    if (!this.attackRangeCircle) return;
    this.attackRangeCircle.clear();

    const radius = this.getAttackRadius();

    // 1. Заметная, но мягкая изумрудная голографическая заливка области поражения
    this.attackRangeCircle.fillStyle(0x10b981, 0.065);
    this.attackRangeCircle.fillCircle(0, 0, radius);

    // Мягкий внутренний голографический ореол вдоль внутренней кромки зоны
    this.attackRangeCircle.lineStyle(12, 0x34d399, 0.045);
    this.attackRangeCircle.strokeCircle(0, 0, Math.max(10, radius - 6));

    // 2. Мягкое внешнее голографическое свечение по периметру
    this.attackRangeCircle.lineStyle(4, 0x10b981, 0.07);
    this.attackRangeCircle.strokeCircle(0, 0, radius);

    // 3. Тонкая базовая окружность радиуса поражения
    this.attackRangeCircle.lineStyle(1.1, 0x10b981, 0.22);
    this.attackRangeCircle.strokeCircle(0, 0, radius);

    // 4. Четыре аккуратных голографических дуги-акцента по осям
    const arcHalfSpan = Phaser.Math.DegToRad(11);
    this.attackRangeCircle.lineStyle(1.8, 0x34d399, 0.3);
    for (let i = 0; i < 4; i++) {
      const centerAngle = (i * Math.PI) / 2;
      this.attackRangeCircle.beginPath();
      this.attackRangeCircle.arc(0, 0, radius, centerAngle - arcHalfSpan, centerAngle + arcHalfSpan);
      this.attackRangeCircle.strokePath();
    }

    // 5. Минималистичные внутренние риски по 4 основным и 4 диагональным направлениям
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const isCardinal = i % 2 === 0;
      const tickInner = radius - (isCardinal ? 5 : 3);
      const tickOuter = radius + (isCardinal ? 2 : 0);
      this.attackRangeCircle.lineStyle(isCardinal ? 1.4 : 1.0, 0x6ee7b7, isCardinal ? 0.34 : 0.18);
      this.attackRangeCircle.lineBetween(
        Math.cos(angle) * tickInner,
        Math.sin(angle) * tickInner,
        Math.cos(angle) * tickOuter,
        Math.sin(angle) * tickOuter,
      );
    }
  }

  /**
   * Вычисление мировой точки выхлопа сопла первого двигателя (для обратной совместимости)
   */
  public getEngineExhaustPoint(): { x: number; y: number; rearAngle: number } {
    let rearAngle = this.shipFacingAngle + Math.PI;
    let exhaustX = this.shipSprite.x;
    let exhaustY = this.shipSprite.y;

    if (this.customAssembly && this.customAssembly.engineOffsets.length > 0) {
      const enz = this.customAssembly.engineOffsets[0];
      const rot = this.shipFacingAngle + Math.PI / 2;
      exhaustX = this.shipSprite.x + Math.cos(rot) * enz.x - Math.sin(rot) * enz.y;
      exhaustY = this.shipSprite.y + Math.sin(rot) * enz.x + Math.cos(rot) * enz.y;
      rearAngle += (enz.angleOffset * Math.PI) / 180;
    }

    return { x: exhaustX, y: exhaustY, rearAngle };
  }

  /**
   * Вычисление мировых точек выхлопа всех двигателей, установленных на корабль
   */
  public getAllEngineExhaustPoints(): Array<{ x: number; y: number; rearAngle: number }> {
    if (this.customAssembly && this.customAssembly.engineOffsets.length > 0) {
      const containerRot = this.shipFacingAngle + Math.PI / 2;
      const cR = Math.cos(containerRot);
      const sR = Math.sin(containerRot);

      return this.customAssembly.engineOffsets.map((enz) => {
        const exhaustX = this.shipSprite.x + cR * enz.x - sR * enz.y;
        const exhaustY = this.shipSprite.y + sR * enz.x + cR * enz.y;
        const rearAngle = this.shipFacingAngle + Math.PI + (enz.angleOffset * Math.PI) / 180;
        return { x: exhaustX, y: exhaustY, rearAngle };
      });
    }

    return [this.getEngineExhaustPoint()];
  }

  public tryTriggerDash(particleManager?: ParticleManager): void {
    if (this.dashCooldownTimer > 0 || this.isGameOver || this.isDashing || this.scene.scene.isPaused()) return;

    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;

    if (dx === 0 && dy === 0 && this.isJoystickActive) {
      dx = this.joystickVector.x;
      dy = this.joystickVector.y;
    }

    let moveAngle = this.lastMoveAngle;
    if (dx !== 0 || dy !== 0) {
      moveAngle = Math.atan2(dy, dx);
    }

    this.isDashing = true;
    this.dashTimer = DASH_DURATION;
    const dashCdMod = this.installedStats?.dashCooldownMultiplier || 1.0;
    this.dashCooldownTimer = DASH_COOLDOWN * this.dashCooldownMultiplier * dashCdMod;
    this.dashMoveAngle = moveAngle;
    this.dashDirX = Math.cos(moveAngle);
    this.dashDirY = Math.sin(moveAngle);

    // Векторное отклонение при форсаже
    const driftSign = Math.random() < 0.5 ? -1 : 1;
    this.dashDriftYaw = driftSign * Phaser.Math.FloatBetween(0.42, 0.72);

    // Неуязвимость во время форсажа
    this.invulnTimer = Math.max(this.invulnTimer, DASH_DURATION + 0.15);

    // Звуковой эффект и сотрясение экрана
    soundFx.playRocketBoost();
    this.scene.cameras.main.shake(170, 0.007);

    // Силовой щит
    this.shieldSprite.setPosition(this.shipSprite.x, this.shipSprite.y);
    this.shieldSprite.setVisible(true);
    this.shieldSprite.setAlpha(0.95);

    // Вспышка сопел двигателей (для всех установленных двигателей)
    if (particleManager) {
      const exhaustPoints = this.getAllEngineExhaustPoints();
      for (const exhaust of exhaustPoints) {
        particleManager.spawnDashBurstFire(exhaust.x, exhaust.y, exhaust.rearAngle);
        particleManager.spawnShipDashTrail(exhaust.x, exhaust.y, exhaust.rearAngle);
      }
    }

    this.emitDashState();

    const gameScene = this.scene as { isMenuMode?: boolean; isMissionWon?: boolean };
    if (this.isShipVisible && !this.isAutopilot && !gameScene.isMenuMode && !gameScene.isMissionWon) {
      track('ability_shift_used', {
        run_id: campaignManager.getRunId(),
      });
    }
  }

  public tryTriggerSuperMode(particleManager?: ParticleManager): void {
    if (this.superCooldownTimer > 0 || this.isSuperMode || this.isGameOver || this.scene.scene.isPaused()) return;

    this.isSuperMode = true;
    const superDurBonus = this.installedStats?.superDurationBonus || 0;
    this.superDurationTimer = SUPER_DURATION + superDurBonus;
    this.superCooldownTimer = 0;

    soundFx.playSuperTransform();
    this.scene.cameras.main.shake(200, 0.008);

    if (particleManager) {
      const exhaustPoints = this.getAllEngineExhaustPoints();
      for (const exhaust of exhaustPoints) {
        particleManager.spawnSuperActivationBurst(exhaust.x, exhaust.y, exhaust.rearAngle);
        particleManager.spawnShipDashTrail(exhaust.x, exhaust.y, exhaust.rearAngle);
      }
    }

    this.emitSuperState();

    const gameScene = this.scene as { isMenuMode?: boolean; isMissionWon?: boolean };
    if (this.isShipVisible && !this.isAutopilot && !gameScene.isMenuMode && !gameScene.isMissionWon) {
      track('ability_q_used', {
        run_id: campaignManager.getRunId(),
      });
    }
  }

  public exitSuperMode(): void {
    this.isSuperMode = false;
    this.superDurationTimer = 0;
    const superCdMod = this.installedStats?.superCooldownMultiplier || 1.0;
    this.superCooldownTimer = SUPER_COOLDOWN * superCdMod;

    this.emitSuperState();
  }

  // Кэш состояния способностей для предотвращения лишних DOM-обновлений каждый кадр
  private lastEmittedDashKey = '';
  private lastEmittedSuperKey = '';

  public emitDashState(force = false): void {
    const dashCdMod = this.installedStats?.dashCooldownMultiplier || 1.0;
    const maxCooldown = DASH_COOLDOWN * this.dashCooldownMultiplier * dashCdMod;
    const isReady = this.dashCooldownTimer <= 0;
    const key = `${this.isDashing ? 1 : 0}_${isReady ? 1 : 0}_${Math.round(this.dashCooldownTimer * 10)}_${Math.round(maxCooldown * 10)}`;
    if (!force && key === this.lastEmittedDashKey) return;
    this.lastEmittedDashKey = key;

    window.dispatchEvent(
      new CustomEvent('tank-dash-state', {
        detail: {
          cooldown: this.dashCooldownTimer,
          maxCooldown,
          isReady,
          isDashing: this.isDashing,
        },
      }),
    );
  }

  public emitSuperState(force = false): void {
    const superCdMod = this.installedStats?.superCooldownMultiplier || 1.0;
    const superDurBonus = this.installedStats?.superDurationBonus || 0;
    const maxCooldown = SUPER_COOLDOWN * superCdMod;
    const maxDuration = SUPER_DURATION + superDurBonus;
    const isReady = !this.isSuperMode && this.superCooldownTimer <= 0;
    const key = `${this.isSuperMode ? 1 : 0}_${isReady ? 1 : 0}_${Math.round(this.superCooldownTimer * 10)}_${Math.round(this.superDurationTimer * 10)}_${Math.round(maxCooldown * 10)}_${Math.round(maxDuration * 10)}`;
    if (!force && key === this.lastEmittedSuperKey) return;
    this.lastEmittedSuperKey = key;

    window.dispatchEvent(
      new CustomEvent('tank-super-state', {
        detail: {
          cooldown: this.superCooldownTimer,
          maxCooldown,
          duration: this.superDurationTimer,
          maxDuration,
          isReady,
          isActive: this.isSuperMode,
        },
      }),
    );
  }

  public triggerAutopilotDash(moveAngle: number, particleManager?: ParticleManager): void {
    if (this.dashCooldownTimer > 0 || this.isGameOver || this.isDashing || this.scene.scene.isPaused()) return;

    this.isDashing = true;
    this.dashTimer = DASH_DURATION;
    const dashCdMod = this.installedStats?.dashCooldownMultiplier || 1.0;
    this.dashCooldownTimer = DASH_COOLDOWN * this.dashCooldownMultiplier * dashCdMod;
    this.dashMoveAngle = moveAngle;
    this.dashDirX = Math.cos(moveAngle);
    this.dashDirY = Math.sin(moveAngle);

    const driftSign = Math.random() < 0.5 ? -1 : 1;
    this.dashDriftYaw = driftSign * Phaser.Math.FloatBetween(0.42, 0.72);
    this.invulnTimer = Math.max(this.invulnTimer, DASH_DURATION + 0.15);

    soundFx.playRocketBoost();

    this.shieldSprite.setPosition(this.shipSprite.x, this.shipSprite.y);
    this.shieldSprite.setVisible(true);
    this.shieldSprite.setAlpha(0.95);

    if (particleManager) {
      const exhaustPoints = this.getAllEngineExhaustPoints();
      for (const exhaust of exhaustPoints) {
        particleManager.spawnDashBurstFire(exhaust.x, exhaust.y, exhaust.rearAngle);
        particleManager.spawnShipDashTrail(exhaust.x, exhaust.y, exhaust.rearAngle);
      }
    }
  }

  public update(
    seconds: number,
    nearestEnemy: EnemyShip | null,
    _atmosphere: AtmosphereManager,
    particleManager: ParticleManager,
    survivalTime: number,
  ): void {
    let isMoving = false;

    if (this.isAutopilot) {
      if (this.isDashing) {
        this.dashTimer -= seconds;
        const progress = 1 - Math.max(0, this.dashTimer / DASH_DURATION);
        const dashSpeed = DASH_SPEED * (this.installedStats?.dashSpeedMultiplier || 1.0) * this.modMoveSpeedMultiplier;
        const currentSpeed = Phaser.Math.Linear(dashSpeed, (PLAYER_SPEED * 1.3) * this.modMoveSpeedMultiplier, progress);

        const sideAngle = this.dashMoveAngle + Math.PI / 2;
        const driftSlip = Math.sin(progress * Math.PI) * 195 * Math.sign(this.dashDriftYaw);

        const moveX = (this.dashDirX * currentSpeed + Math.cos(sideAngle) * driftSlip) * seconds;
        const moveY = (this.dashDirY * currentSpeed + Math.sin(sideAngle) * driftSlip) * seconds;

        this.shipSprite.x += moveX;
        this.shipSprite.y += moveY;

        this.lastMoveAngle = this.dashMoveAngle;
        isMoving = true;

        this.shieldSprite.setPosition(this.shipSprite.x, this.shipSprite.y);
        this.shieldSprite.rotation += 9 * seconds;
        this.shieldSprite.setScale((1.15 + Math.sin(survivalTime * 28) * 0.08) * SHIP_SCALE);

        if (this.dashTimer <= 0) {
          this.isDashing = false;
          this.dashTimer = 0;
          this.shieldSprite.setVisible(false);
        }
      } else {
        let desiredMoveAngle: number;
        if (nearestEnemy && nearestEnemy.sprite && nearestEnemy.sprite.active) {
          const dx = nearestEnemy.sprite.x - this.shipSprite.x;
          const dy = nearestEnemy.sprite.y - this.shipSprite.y;
          const dist = Math.hypot(dx, dy);
          const enemyAngle = Math.atan2(dy, dx);

          // Наведение орудий в сторону врага
          this.aimAngle = enemyAngle;

          // Тактические маневры в космосе
          if (dist > 440) {
            desiredMoveAngle = enemyAngle + Math.sin(survivalTime * 2.6) * 0.35;
          } else if (dist < 190) {
            desiredMoveAngle = enemyAngle + Math.PI + Math.sin(survivalTime * 3.2) * 0.45;
          } else {
            desiredMoveAngle = enemyAngle + Math.PI / 2 + Math.sin(survivalTime * 2.0) * 0.35;
          }

          // Периодический рывок форсажа при автопилоте
          this.autopilotDashTimer += seconds;
          if (this.autopilotDashTimer >= 4.5 && this.dashCooldownTimer <= 0) {
            this.autopilotDashTimer = 0;
            this.triggerAutopilotDash(desiredMoveAngle, particleManager);
          }
        } else {
          // Патрулирование по плавной дуге
          const patrolAngle = survivalTime * 0.7;
          desiredMoveAngle = patrolAngle;
          this.aimAngle = patrolAngle;
        }

        const angleDiff = Phaser.Math.Angle.Wrap(desiredMoveAngle - this.lastMoveAngle);
        this.lastMoveAngle = this.lastMoveAngle + angleDiff * Math.min(1, 4.2 * seconds);

        const currentSpeed = PLAYER_SPEED * this.speedMultiplier * this.modMoveSpeedMultiplier;
        this.shipSprite.x += Math.cos(this.lastMoveAngle) * currentSpeed * seconds;
        this.shipSprite.y += Math.sin(this.lastMoveAngle) * currentSpeed * seconds;
        isMoving = true;

        const targetShipRotation = this.lastMoveAngle - Math.PI / 2;
        const rotDiff = Phaser.Math.Angle.Wrap(targetShipRotation - this.shipSprite.rotation);
        this.shipSprite.rotation += rotDiff * Math.min(1, 10 * seconds);
      }
    } else {
      if (Phaser.Input.Keyboard.JustDown(this.shiftKey)) {
        this.tryTriggerDash(particleManager);
      }

      if (Phaser.Input.Keyboard.JustDown(this.qKey)) {
        this.tryTriggerSuperMode(particleManager);
      }

      if (this.isDashing) {
        this.dashTimer -= seconds;
        const progress = 1 - Math.max(0, this.dashTimer / DASH_DURATION);
        const dashSpeed = DASH_SPEED * (this.installedStats?.dashSpeedMultiplier || 1.0) * this.modMoveSpeedMultiplier;
        const currentSpeed = Phaser.Math.Linear(dashSpeed, (PLAYER_SPEED * 1.3) * this.modMoveSpeedMultiplier, progress);

        const sideAngle = this.dashMoveAngle + Math.PI / 2;
        const driftSlip = Math.sin(progress * Math.PI) * 195 * Math.sign(this.dashDriftYaw);

        const moveX = (this.dashDirX * currentSpeed + Math.cos(sideAngle) * driftSlip) * seconds;
        const moveY = (this.dashDirY * currentSpeed + Math.sin(sideAngle) * driftSlip) * seconds;

        this.shipSprite.x += moveX;
        this.shipSprite.y += moveY;

        this.lastMoveAngle = this.dashMoveAngle;
        isMoving = true;

        const targetRotation = this.dashMoveAngle - Math.PI / 2;
        const diff = Phaser.Math.Angle.Wrap(targetRotation - this.shipSprite.rotation);
        this.shipSprite.rotation += diff * Math.min(1, 16 * seconds);

        this.shieldSprite.setPosition(this.shipSprite.x, this.shipSprite.y);
        this.shieldSprite.rotation += 9 * seconds;
        this.shieldSprite.setScale((1.15 + Math.sin(survivalTime * 28) * 0.08) * SHIP_SCALE);

        if (this.dashTimer <= 0) {
          this.isDashing = false;
          this.dashTimer = 0;
          this.shieldSprite.setVisible(false);
        }
      } else {
        let dx = 0;
        let dy = 0;

        if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
        if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
        if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
        if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;

        let inputMagnitude = 1.0;

        if (dx !== 0 || dy !== 0) {
          const kLen = Math.hypot(dx, dy);
          dx /= kLen;
          dy /= kLen;
          inputMagnitude = 1.0;
          isMoving = true;
        } else if (this.isJoystickActive) {
          const jLen = Math.hypot(this.joystickVector.x, this.joystickVector.y);
          if (jLen > 0.05) {
            inputMagnitude = Math.min(1.0, jLen);
            dx = this.joystickVector.x / jLen;
            dy = this.joystickVector.y / jLen;
            isMoving = true;
          }
        }

        if (isMoving) {
          const modSpeedMult = this.installedStats?.speedMultiplier || 1.0;
          const moveX = dx * inputMagnitude * PLAYER_SPEED * this.speedMultiplier * modSpeedMult * this.modMoveSpeedMultiplier * seconds;
          const moveY = dy * inputMagnitude * PLAYER_SPEED * this.speedMultiplier * modSpeedMult * this.modMoveSpeedMultiplier * seconds;

          this.shipSprite.x += moveX;
          this.shipSprite.y += moveY;

          const moveAngle = Math.atan2(dy, dx);
          this.lastMoveAngle = moveAngle;

          // Корпус плавно ориентируется по вектору движения, маневренность зависит от установленных крыльев
          const targetRotation = moveAngle - Math.PI / 2;
          const diff = Phaser.Math.Angle.Wrap(targetRotation - this.shipSprite.rotation);
          const bonusRate = Math.min(8, (this.installedStats?.turnSpeedBonus || 0) * 0.15);
          const turnMultiplier = this.installedStats?.turnSpeedMultiplier || 1.0;
          const turnRate = Math.min(24, (14 + bonusRate) * turnMultiplier);

          // Плавное сглаживание: предотвращает любые рывки и резкие скачки даже при нескольких парах крыльев
          const lerpFactor = 1 - Math.exp(-turnRate * seconds);
          const smoothLerp = Math.min(0.38, Math.max(0.01, lerpFactor));
          this.shipSprite.rotation += diff * smoothLerp;

          // Плазменный след двигателей при тактическом улучшении
          if (this.hasFireTrail) {
            this.normalFireTrailTimer += seconds;
            if (this.normalFireTrailTimer >= 0.12) {
              this.normalFireTrailTimer = 0;
              const exhaustPoints = this.getAllEngineExhaustPoints();
              for (const exhaust of exhaustPoints) {
                particleManager.spawnDashFireTrail(
                  exhaust.x,
                  exhaust.y,
                  exhaust.rearAngle,
                  this.shipSprite.rotation,
                );
                if (this.onFireTrailSpawn) {
                  this.onFireTrailSpawn(exhaust.x, exhaust.y);
                }
              }
            }
          }
        }
      }
    }

    // Ограничение перемещения корабля пределами сектора (внутри пояса туманностей)
    this.shipSprite.x = Phaser.Math.Clamp(this.shipSprite.x, 130, MAP_WIDTH - 130);
    this.shipSprite.y = Phaser.Math.Clamp(this.shipSprite.y, 130, MAP_HEIGHT - 130);

    // Синхронизация кастомного модульного корабля
    const shouldShow = this.isShipVisible && !this.isGameOver;
    if (this.customAssembly && this.customAssembly.modules.length > 0) {
      this.shipSprite.setVisible(false);
      this.customShipContainer.setPosition(this.shipSprite.x, this.shipSprite.y);
      this.customShipContainer.setRotation(this.shipFacingAngle + Math.PI / 2);
      this.customShipContainer.setAlpha(this.shipSprite.alpha);
      this.customShipContainer.setVisible(shouldShow);
    } else {
      this.shipSprite.setVisible(shouldShow);
      this.customShipContainer?.setVisible(false);
    }

    // 2. Расчет позиций сопел всех двигателей (для 1-го, 2-го и любых последующих двигателей)
    interface EngineNozzlePair {
      leftX: number;
      leftY: number;
      rightX: number;
      rightY: number;
      flameRot: number;
      rearAngle: number;
    }

    const nozzlePairs: EngineNozzlePair[] = [];

    if (this.customAssembly && this.customAssembly.engineOffsets.length > 0) {
      const containerRot = this.shipFacingAngle + Math.PI / 2;
      const cR = Math.cos(containerRot);
      const sR = Math.sin(containerRot);
      const nozzleSpread = 7 * SHIP_SCALE;

      for (let i = 0; i < this.customAssembly.engineOffsets.length; i++) {
        const enz = this.customAssembly.engineOffsets[i];
        const enzRad = (enz.angleOffset * Math.PI) / 180;
        const flameRot = this.shipFacingAngle + Math.PI / 2 + enzRad;
        const rearAngle = this.shipFacingAngle + Math.PI + enzRad;

        const enzNozzleSpreadX = Math.cos(enzRad) * nozzleSpread;
        const enzNozzleSpreadY = Math.sin(enzRad) * nozzleSpread;

        const p1X = enz.x - enzNozzleSpreadX;
        const p1Y = enz.y - enzNozzleSpreadY;
        const p2X = enz.x + enzNozzleSpreadX;
        const p2Y = enz.y + enzNozzleSpreadY;

        nozzlePairs.push({
          leftX: this.shipSprite.x + cR * p1X - sR * p1Y,
          leftY: this.shipSprite.y + sR * p1X + cR * p1Y,
          rightX: this.shipSprite.x + cR * p2X - sR * p2Y,
          rightY: this.shipSprite.y + sR * p2X + cR * p2Y,
          flameRot,
          rearAngle,
        });
      }
    } else {
      const rot = this.shipSprite.rotation;
      const flameRot = rot + Math.PI;
      const rearAngle = this.shipFacingAngle + Math.PI;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);

      const nozzleOffsetY = -34 * SHIP_SCALE;
      const nozzleOffsetX = 16 * SHIP_SCALE;
      nozzlePairs.push({
        leftX: this.shipSprite.x + cosR * nozzleOffsetX - sinR * nozzleOffsetY,
        leftY: this.shipSprite.y + sinR * nozzleOffsetX + cosR * nozzleOffsetY,
        rightX: this.shipSprite.x + cosR * (-nozzleOffsetX) - sinR * nozzleOffsetY,
        rightY: this.shipSprite.y + sinR * (-nozzleOffsetX) + cosR * nozzleOffsetY,
        flameRot,
        rearAngle,
      });
    }

    if (this.engineFlames.length !== nozzlePairs.length) {
      this.syncEngineFlames(shouldShow);
    }

    // Позиционирование и плавное голографическое вращение круга радиуса поражения корабля
    if (this.attackRangeCircle) {
      this.attackRangeCircle.setPosition(this.shipSprite.x, this.shipSprite.y);
      this.attackRangeCircle.rotation += seconds * 0.1;
    }

    // 3. Эффекты пламени сопел и выхлопа дыма/огня всех двигателей
    if (this.isDashing) {
      const sy = (1.9 + Math.random() * 0.4) * SHIP_SCALE;
      const sx = (1.15 + Math.random() * 0.2) * SHIP_SCALE;

      for (let i = 0; i < nozzlePairs.length; i++) {
        const n = nozzlePairs[i];
        const flames = this.engineFlames[i];
        if (flames) {
          flames.left.setPosition(n.leftX, n.leftY).setRotation(n.flameRot);
          flames.right.setPosition(n.rightX, n.rightY).setRotation(n.flameRot);
          flames.left.setTexture('space_effect_017').setScale(sx, sy).setAlpha(1.0);
          flames.right.setTexture('space_effect_017').setScale(sx, sy).setAlpha(1.0);
        }
      }

      this.dashFlameTimer += seconds;
      if (this.dashFlameTimer >= 0.02) {
        this.dashFlameTimer = 0;
        for (const n of nozzlePairs) {
          particleManager.spawnShipDashTrail(n.leftX, n.leftY, n.rearAngle);
          particleManager.spawnShipDashTrail(n.rightX, n.rightY, n.rearAngle);
        }
      }
    } else if (this.isSuperMode) {
      const sy = (1.6 + Math.random() * 0.35) * SHIP_SCALE;
      const sx = (1.05 + Math.random() * 0.2) * SHIP_SCALE;

      for (let i = 0; i < nozzlePairs.length; i++) {
        const n = nozzlePairs[i];
        const flames = this.engineFlames[i];
        if (flames) {
          flames.left.setPosition(n.leftX, n.leftY).setRotation(n.flameRot);
          flames.right.setPosition(n.rightX, n.rightY).setRotation(n.flameRot);
          flames.left.setTexture('space_effect_018').setScale(sx, sy).setAlpha(1.0);
          flames.right.setTexture('space_effect_018').setScale(sx, sy).setAlpha(1.0);
        }
      }

      this.superFlameTimer += seconds;
      if (this.superFlameTimer >= 0.03) {
        this.superFlameTimer = 0;
        for (const n of nozzlePairs) {
          particleManager.spawnShipExhaust(n.leftX, n.leftY, n.rearAngle, true);
          particleManager.spawnShipExhaust(n.rightX, n.rightY, n.rearAngle, true);
        }
      }
    } else if (isMoving) {
      const sy = (1.1 + Math.random() * 0.35) * SHIP_SCALE;
      const sx = (0.95 + Math.random() * 0.15) * SHIP_SCALE;

      for (let i = 0; i < nozzlePairs.length; i++) {
        const n = nozzlePairs[i];
        const flames = this.engineFlames[i];
        if (flames) {
          flames.left.setPosition(n.leftX, n.leftY).setRotation(n.flameRot);
          flames.right.setPosition(n.rightX, n.rightY).setRotation(n.flameRot);
          flames.left.setTexture('space_effect_004').setScale(sx, sy).setAlpha(0.95);
          flames.right.setTexture('space_effect_004').setScale(sx, sy).setAlpha(0.95);
        }
      }

      if (Math.random() < 0.35) {
        for (const n of nozzlePairs) {
          particleManager.spawnShipExhaust(n.leftX, n.leftY, n.rearAngle, false);
          particleManager.spawnShipExhaust(n.rightX, n.rightY, n.rearAngle, false);
        }
      }
    } else {
      const sy = (0.5 + Math.sin(survivalTime * 12) * 0.08) * SHIP_SCALE;
      const sx = 0.6 * SHIP_SCALE;

      for (let i = 0; i < nozzlePairs.length; i++) {
        const n = nozzlePairs[i];
        const flames = this.engineFlames[i];
        if (flames) {
          flames.left.setPosition(n.leftX, n.leftY).setRotation(n.flameRot);
          flames.right.setPosition(n.rightX, n.rightY).setRotation(n.flameRot);
          flames.left.setTexture('space_effect_001').setScale(sx, sy).setAlpha(0.65);
          flames.right.setTexture('space_effect_001').setScale(sx, sy).setAlpha(0.65);
        }
      }
    }

    // Затухание отдачи выстрелов
    if (this.recoilOffset > 0) {
      this.recoilOffset = Math.max(0, this.recoilOffset - 35 * seconds);
    }

    // Мигание и силовой щит при неуязвимости (включая защитный экран при спавне)
    if (this.invulnTimer > 0) {
      this.invulnTimer -= seconds;
      const alpha = Math.floor(survivalTime * 18) % 2 === 0 ? 0.45 : 1;
      this.shipSprite.setAlpha(alpha);
      this.customShipContainer?.setAlpha(alpha);
      for (const flames of this.engineFlames) {
        flames.left?.setAlpha(alpha);
        flames.right?.setAlpha(alpha);
      }

      // Визуализация защитного силового поля при спавне
      if (!this.isDashing && this.shieldSprite) {
        this.shieldSprite.setPosition(this.shipSprite.x, this.shipSprite.y);
        this.shieldSprite.setVisible(this.isShipVisible);
        this.shieldSprite.rotation += 4 * seconds;
        const shieldPulse = 0.65 + Math.sin(survivalTime * 12) * 0.2;
        this.shieldSprite.setAlpha(shieldPulse);
        this.shieldSprite.setScale((1.2 + Math.sin(survivalTime * 14) * 0.06) * SHIP_SCALE);
      }
    } else {
      this.shipSprite.setAlpha(1);
      this.customShipContainer?.setAlpha(1);
      for (const flames of this.engineFlames) {
        flames.left?.setAlpha(1);
        flames.right?.setAlpha(1);
      }
      if (!this.isDashing && this.shieldSprite) {
        this.shieldSprite.setVisible(false);
      }
    }

    // Таймер перезарядки форсажа
    if (this.dashCooldownTimer > 0) {
      const prevCooldown = this.dashCooldownTimer;
      this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - seconds);
      if (prevCooldown > 0 && this.dashCooldownTimer === 0) {
        soundFx.playDashReady();
      }
    }

    // Таймеры режима перегрузки реактора
    if (this.isSuperMode) {
      this.superDurationTimer = Math.max(0, this.superDurationTimer - seconds);
      if (this.superDurationTimer <= 0) {
        this.exitSuperMode();
      }
    } else if (this.superCooldownTimer > 0) {
      const prevSuperCooldown = this.superCooldownTimer;
      this.superCooldownTimer = Math.max(0, this.superCooldownTimer - seconds);
      if (prevSuperCooldown > 0 && this.superCooldownTimer === 0) {
        soundFx.playSuperReady();
      }
    }

    this.emitDashState();
    this.emitSuperState();
  }

  public takeDamage(amount: number): boolean {
    if (this.isAutopilot) {
      this.hp = Math.max(this.maxHp * 0.65, this.hp - amount * 0.25);
      this.invulnTimer = 0.45;
      return false;
    }
    if (this.invulnTimer > 0 || this.isDashing) return false;

    const baseReducedDamage = amount * (1 - this.damageReduction);
    const netDamage = Math.max(1, baseReducedDamage * (1 - this.modDamageReduction));
    this.hp = Math.max(0, this.hp - netDamage);
    this.invulnTimer = PLAYER_INVULN_TIME;
    return this.hp <= 0;
  }

  public setVisible(visible: boolean): void {
    this.isShipVisible = visible;
    const shouldShow = visible && !this.isGameOver;

    if (this.customAssembly && this.customAssembly.modules.length > 0) {
      this.shipSprite.setVisible(false);
      this.customShipContainer?.setVisible(shouldShow);
    } else {
      this.shipSprite.setVisible(shouldShow);
      this.customShipContainer?.setVisible(false);
    }
    for (const flames of this.engineFlames) {
      flames.left?.setVisible(shouldShow);
      flames.right?.setVisible(shouldShow);
    }
    this.attackRangeCircle?.setVisible(shouldShow);
    if (!shouldShow) {
      this.shieldSprite?.setVisible(false);
    }
  }

  public getIsShipVisible(): boolean {
    return this.isShipVisible;
  }

  public applyUpgrade(upgradeId: string): void {
    if (this.appliedUpgrades.has(upgradeId)) return;
    this.appliedUpgrades.add(upgradeId);
    if (upgradeId === 'tracks_turbo') {
      this.speedMultiplier = 1.35;
      this.dashCooldownMultiplier = 0.75;
      this.emitDashState();
    } else if (upgradeId === 'tracks_fire_trail') {
      this.hasFireTrail = true;
    } else if (upgradeId === 'tracks_ram_spikes') {
      this.hasRamSpikes = true;
    } else if (upgradeId === 'tracks_emp_drift') {
      this.hasEmpDrift = true;
    } else if (upgradeId === 'enhanced_targeting') {
      this.attackRadiusMultiplier = 1.25;
      this.drawAttackRangeCircle();
    } else if (upgradeId === 'reinforced_armor') {
      this.modDamageReduction = 0.35;
    } else if (upgradeId === 'afterburner_thrusters') {
      this.modMoveSpeedMultiplier = 1.35;
    }
  }

  public reset(startX: number, startY: number): void {
    this.isShipVisible = true;
    this.isGameOver = false;
    this.shipSprite.setPosition(startX, startY);
    this.customShipContainer?.setPosition(startX, startY);
    this.customShipContainer?.setRotation(this.shipFacingAngle + Math.PI / 2);
    for (const flames of this.engineFlames) {
      flames.left?.setPosition(startX, startY);
      flames.right?.setPosition(startX, startY);
    }
    this.attackRangeCircle?.setPosition(startX, startY);
    this.shieldSprite?.setPosition(startX, startY);
    this.hp = this.maxHp;
    this.invulnTimer = 3.0; // 3 секунды неуязвимости и активного щита при спавне/рестарте
    this.isGameOver = false;
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.isSuperMode = false;
    this.superDurationTimer = 0;
    this.superCooldownTimer = 0;
    this.isAutopilot = false;
    this.lastMoveAngle = -Math.PI / 2;
    this.aimAngle = -Math.PI / 2;
    this.shipSprite.rotation = -Math.PI;
    this.setVisible(true);
    this.resetUpgrades();
    this.emitDashState();
    this.emitSuperState();
  }

  public resetUpgrades(): void {
    this.appliedUpgrades.clear();
    this.speedMultiplier = 1.0;
    this.dashCooldownMultiplier = 1.0;
    this.hasFireTrail = false;
    this.hasRamSpikes = false;
    this.hasEmpDrift = false;
    this.normalFireTrailTimer = 0;
    this.attackRadiusMultiplier = 1.0;
    this.modDamageReduction = 0;
    this.modMoveSpeedMultiplier = 1.0;
    this.drawAttackRangeCircle();
    this.emitDashState();
  }

  public destroy(): void {
    window.removeEventListener('request-tank-dash', this.dashRequestListener);
    window.removeEventListener('keydown', this.onWindowShiftListener);
    window.removeEventListener('keydown', this.onWindowCombatModeListener);
    window.removeEventListener('request-tank-super', this.superRequestListener);
    window.removeEventListener('mousedown', this.onWindowMouseDownListener);
    window.removeEventListener('contextmenu', this.onContextMenuListener);
    if (this.onWindowMouseMove) {
      window.removeEventListener('mousemove', this.onWindowMouseMove);
    }

    this.shipSprite.destroy();
    this.customShipContainer?.destroy();
    this.shieldSprite.destroy();
    for (const flames of this.engineFlames) {
      flames.left?.destroy();
      flames.right?.destroy();
    }
    this.engineFlames = [];
    this.attackRangeCircle?.destroy();
  }
}

// Экспорт алиаса для обратной совместимости
export { PlayerShip as PlayerTank };

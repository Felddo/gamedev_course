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
} from './constants';
import { EnemyShip } from './types';
import { AtmosphereManager } from './AtmosphereManager';
import { ParticleManager } from './ParticleManager';

/**
 * Боевой космический корабль игрока:
 * - Маневровые и маршевые двигатели со световыми соплами
 * - Наведение носовых орудий по направлению курсора
 * - Форсаж / ракетный рывок (Shift)
 * - Режим боевой перегрузки реактора / овердрайв (ПКМ)
 */
export class PlayerShip {
  private scene: Phaser.Scene;

  public shipSprite!: Phaser.GameObjects.Sprite;
  private shieldSprite!: Phaser.GameObjects.Sprite;
  public leftFlameSprite!: Phaser.GameObjects.Sprite;
  public rightFlameSprite!: Phaser.GameObjects.Sprite;

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

  // Показатели корабля
  public hp = PLAYER_MAX_HP;
  public invulnTimer = 0;
  public isGameOver = false;

  // Тактические апгрейды (Двигатели и Орудия)
  public appliedUpgrades = new Set<string>();
  public speedMultiplier = 1.0;
  public dashCooldownMultiplier = 1.0;
  public hasFireTrail = false;
  public hasRamSpikes = false;
  public hasEmpDrift = false;
  public onFireTrailSpawn: ((x: number, y: number) => void) | null = null;
  private normalFireTrailTimer = 0;

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

  // Управление
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;

  // Слушатели событий
  private dashRequestListener!: () => void;
  private superRequestListener!: () => void;
  private onWindowShiftListener!: (e: KeyboardEvent) => void;
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
    this.shipSprite.rotation = this.aimAngle - Math.PI / 2;

    // 2. Двойное пламя сопел маршевых двигателей
    this.leftFlameSprite = this.scene.add.sprite(startX, startY, 'space_effect_001');
    this.leftFlameSprite.setOrigin(0.5, 0);
    this.leftFlameSprite.setDepth(9);

    this.rightFlameSprite = this.scene.add.sprite(startX, startY, 'space_effect_001');
    this.rightFlameSprite.setOrigin(0.5, 0);
    this.rightFlameSprite.setDepth(9);

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

  public tryTriggerDash(particleManager?: ParticleManager): void {
    if (this.dashCooldownTimer > 0 || this.isGameOver || this.isDashing || this.scene.scene.isPaused()) return;

    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;

    let moveAngle = this.lastMoveAngle;
    if (dx !== 0 || dy !== 0) {
      moveAngle = Math.atan2(dy, dx);
    }

    this.isDashing = true;
    this.dashTimer = DASH_DURATION;
    this.dashCooldownTimer = DASH_COOLDOWN * this.dashCooldownMultiplier;
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

    // Вспышка сопел двигателей
    if (particleManager) {
      const rearAngle = this.aimAngle + Math.PI;
      particleManager.spawnDashBurstFire(this.shipSprite.x, this.shipSprite.y, rearAngle);
      particleManager.spawnShipDashTrail(this.shipSprite.x, this.shipSprite.y, rearAngle);
    }

    this.emitDashState();
  }

  public tryTriggerSuperMode(particleManager?: ParticleManager): void {
    if (this.superCooldownTimer > 0 || this.isSuperMode || this.isGameOver || this.scene.scene.isPaused()) return;

    this.isSuperMode = true;
    this.superDurationTimer = SUPER_DURATION;
    this.superCooldownTimer = 0;

    soundFx.playSuperTransform();
    this.scene.cameras.main.shake(200, 0.008);

    if (particleManager) {
      const rearAngle = this.aimAngle + Math.PI;
      particleManager.spawnSuperActivationBurst(this.shipSprite.x, this.shipSprite.y, rearAngle);
      particleManager.spawnShipDashTrail(this.shipSprite.x, this.shipSprite.y, rearAngle);
    }

    this.emitSuperState();
  }

  public exitSuperMode(): void {
    this.isSuperMode = false;
    this.superDurationTimer = 0;
    this.superCooldownTimer = SUPER_COOLDOWN;

    this.emitSuperState();
  }

  public emitDashState(): void {
    window.dispatchEvent(
      new CustomEvent('tank-dash-state', {
        detail: {
          cooldown: this.dashCooldownTimer,
          maxCooldown: DASH_COOLDOWN * this.dashCooldownMultiplier,
          isReady: this.dashCooldownTimer <= 0,
          isDashing: this.isDashing,
        },
      }),
    );
  }

  public emitSuperState(): void {
    window.dispatchEvent(
      new CustomEvent('tank-super-state', {
        detail: {
          cooldown: this.superCooldownTimer,
          maxCooldown: SUPER_COOLDOWN,
          duration: this.superDurationTimer,
          maxDuration: SUPER_DURATION,
          isReady: !this.isSuperMode && this.superCooldownTimer <= 0,
          isActive: this.isSuperMode,
        },
      }),
    );
  }

  public triggerAutopilotDash(moveAngle: number, particleManager?: ParticleManager): void {
    if (this.dashCooldownTimer > 0 || this.isGameOver || this.isDashing || this.scene.scene.isPaused()) return;

    this.isDashing = true;
    this.dashTimer = DASH_DURATION;
    this.dashCooldownTimer = DASH_COOLDOWN * this.dashCooldownMultiplier;
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
      const rearAngle = this.aimAngle + Math.PI;
      particleManager.spawnDashBurstFire(this.shipSprite.x, this.shipSprite.y, rearAngle);
      particleManager.spawnShipDashTrail(this.shipSprite.x, this.shipSprite.y, rearAngle);
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
        const currentSpeed = Phaser.Math.Linear(DASH_SPEED, PLAYER_SPEED * 1.3, progress);

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

        const currentSpeed = PLAYER_SPEED * this.speedMultiplier;
        this.shipSprite.x += Math.cos(this.lastMoveAngle) * currentSpeed * seconds;
        this.shipSprite.y += Math.sin(this.lastMoveAngle) * currentSpeed * seconds;
        isMoving = true;
      }
    } else {
      if (Phaser.Input.Keyboard.JustDown(this.shiftKey)) {
        this.tryTriggerDash(particleManager);
      }

      if (this.isDashing) {
        this.dashTimer -= seconds;
        const progress = 1 - Math.max(0, this.dashTimer / DASH_DURATION);
        const currentSpeed = Phaser.Math.Linear(DASH_SPEED, PLAYER_SPEED * 1.3, progress);

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
        let dx = 0;
        let dy = 0;

        if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
        if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
        if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
        if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;

        isMoving = dx !== 0 || dy !== 0;

        if (isMoving) {
          const len = Math.hypot(dx, dy);
          const moveX = (dx / len) * PLAYER_SPEED * this.speedMultiplier * seconds;
          const moveY = (dy / len) * PLAYER_SPEED * this.speedMultiplier * seconds;

          this.shipSprite.x += moveX;
          this.shipSprite.y += moveY;

          const moveAngle = Math.atan2(dy, dx);
          this.lastMoveAngle = moveAngle;

          // Плазменный след двигателей при тактическом улучшении
          if (this.hasFireTrail) {
            this.normalFireTrailTimer += seconds;
            if (this.normalFireTrailTimer >= 0.12) {
              this.normalFireTrailTimer = 0;
              const rearAngle = this.aimAngle + Math.PI;
              particleManager.spawnDashFireTrail(
                this.shipSprite.x,
                this.shipSprite.y,
                rearAngle,
                this.shipSprite.rotation,
              );
              if (this.onFireTrailSpawn) {
                this.onFireTrailSpawn(this.shipSprite.x, this.shipSprite.y);
              }
            }
          }
        }
      }

      // 1. Прицеливание носовых орудий космолета: всегда смотрит в сторону курсора игрока
      const pointer = this.scene.input.activePointer;
      let targetX = this.cursorWorldX;
      let targetY = this.cursorWorldY;

      if (pointer && (pointer.x !== 0 || pointer.y !== 0)) {
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        targetX = worldPoint.x;
        targetY = worldPoint.y;
      }

      const distToCursor = Phaser.Math.Distance.Between(
        this.shipSprite.x,
        this.shipSprite.y,
        targetX,
        targetY,
      );
      if (distToCursor > 4) {
        this.aimAngle = Phaser.Math.Angle.Between(
          this.shipSprite.x,
          this.shipSprite.y,
          targetX,
          targetY,
        );
      }
    }

    // Спрайт spaceShips_001.png ориентирован носом вниз (+PI/2), поворачиваем к курсору (aimAngle - PI/2)
    const targetShipRotation = this.aimAngle - Math.PI / 2;
    this.shipSprite.rotation = targetShipRotation;

    // 2. Расчет позиций сопел двигателей на корме космолета (корпус 106x80, сопла сверху: Y = -34, X = ±16)
    const rot = this.shipSprite.rotation;
    const flameRot = rot + Math.PI;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);

    const nozzleOffsetY = -34 * SHIP_SCALE;
    const nozzleOffsetX = 16 * SHIP_SCALE;
    const leftNozzleX = this.shipSprite.x + cosR * nozzleOffsetX - sinR * nozzleOffsetY;
    const leftNozzleY = this.shipSprite.y + sinR * nozzleOffsetX + cosR * nozzleOffsetY;
    const rightNozzleX = this.shipSprite.x + cosR * (-nozzleOffsetX) - sinR * nozzleOffsetY;
    const rightNozzleY = this.shipSprite.y + sinR * (-nozzleOffsetX) + cosR * nozzleOffsetY;

    this.leftFlameSprite.setPosition(leftNozzleX, leftNozzleY);
    this.leftFlameSprite.setRotation(flameRot);
    this.rightFlameSprite.setPosition(rightNozzleX, rightNozzleY);
    this.rightFlameSprite.setRotation(flameRot);

    // 3. Эффекты пламени сопел в зависимости от режима движения
    if (this.isDashing) {
      this.leftFlameSprite.setTexture('space_effect_017');
      this.rightFlameSprite.setTexture('space_effect_017');
      const sy = (1.9 + Math.random() * 0.4) * SHIP_SCALE;
      const sx = (1.15 + Math.random() * 0.2) * SHIP_SCALE;
      this.leftFlameSprite.setScale(sx, sy).setAlpha(1.0);
      this.rightFlameSprite.setScale(sx, sy).setAlpha(1.0);

      this.dashFlameTimer += seconds;
      if (this.dashFlameTimer >= 0.02) {
        this.dashFlameTimer = 0;
        const rearAngle = this.aimAngle + Math.PI;
        particleManager.spawnShipDashTrail(leftNozzleX, leftNozzleY, rearAngle);
        particleManager.spawnShipDashTrail(rightNozzleX, rightNozzleY, rearAngle);
      }
    } else if (this.isSuperMode) {
      this.leftFlameSprite.setTexture('space_effect_018');
      this.rightFlameSprite.setTexture('space_effect_018');
      const sy = (1.6 + Math.random() * 0.35) * SHIP_SCALE;
      const sx = (1.05 + Math.random() * 0.2) * SHIP_SCALE;
      this.leftFlameSprite.setScale(sx, sy).setAlpha(1.0);
      this.rightFlameSprite.setScale(sx, sy).setAlpha(1.0);

      this.superFlameTimer += seconds;
      if (this.superFlameTimer >= 0.03) {
        this.superFlameTimer = 0;
        const rearAngle = this.aimAngle + Math.PI;
        particleManager.spawnShipExhaust(leftNozzleX, leftNozzleY, rearAngle, true);
        particleManager.spawnShipExhaust(rightNozzleX, rightNozzleY, rearAngle, true);
      }
    } else if (isMoving) {
      this.leftFlameSprite.setTexture('space_effect_004');
      this.rightFlameSprite.setTexture('space_effect_004');
      const sy = (1.1 + Math.random() * 0.35) * SHIP_SCALE;
      const sx = (0.95 + Math.random() * 0.15) * SHIP_SCALE;
      this.leftFlameSprite.setScale(sx, sy).setAlpha(0.95);
      this.rightFlameSprite.setScale(sx, sy).setAlpha(0.95);

      if (Math.random() < 0.35) {
        const rearAngle = this.aimAngle + Math.PI;
        particleManager.spawnShipExhaust(leftNozzleX, leftNozzleY, rearAngle, false);
        particleManager.spawnShipExhaust(rightNozzleX, rightNozzleY, rearAngle, false);
      }
    } else {
      this.leftFlameSprite.setTexture('space_effect_001');
      this.rightFlameSprite.setTexture('space_effect_001');
      const sy = (0.5 + Math.sin(survivalTime * 12) * 0.08) * SHIP_SCALE;
      const sx = 0.6 * SHIP_SCALE;
      this.leftFlameSprite.setScale(sx, sy).setAlpha(0.65);
      this.rightFlameSprite.setScale(sx, sy).setAlpha(0.65);
    }

    // Затухание отдачи выстрелов
    if (this.recoilOffset > 0) {
      this.recoilOffset = Math.max(0, this.recoilOffset - 35 * seconds);
    }

    // Мигание щита при неуязвимости
    if (this.invulnTimer > 0) {
      this.invulnTimer -= seconds;
      const alpha = Math.floor(survivalTime * 20) % 2 === 0 ? 0.35 : 1;
      this.shipSprite.setAlpha(alpha);
      this.leftFlameSprite.setAlpha(alpha);
      this.rightFlameSprite.setAlpha(alpha);
    } else {
      this.shipSprite.setAlpha(1);
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
      this.hp = Math.max(PLAYER_MAX_HP * 0.65, this.hp - amount * 0.25);
      this.invulnTimer = 0.45;
      return false;
    }
    if (this.invulnTimer > 0 || this.isDashing) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.invulnTimer = PLAYER_INVULN_TIME;
    return this.hp <= 0;
  }

  public setVisible(visible: boolean): void {
    this.shipSprite.setVisible(visible);
    this.leftFlameSprite?.setVisible(visible);
    this.rightFlameSprite?.setVisible(visible);
    if (!visible) {
      this.shieldSprite.setVisible(false);
    }
  }

  public applyUpgrade(upgradeId: string): void {
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
    }
  }

  public reset(startX: number, startY: number): void {
    this.shipSprite.setPosition(startX, startY);
    this.leftFlameSprite?.setPosition(startX, startY);
    this.rightFlameSprite?.setPosition(startX, startY);
    this.shieldSprite?.setPosition(startX, startY);
    this.hp = PLAYER_MAX_HP;
    this.invulnTimer = 0;
    this.isGameOver = false;
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.isSuperMode = false;
    this.superDurationTimer = 0;
    this.superCooldownTimer = 0;
    this.isAutopilot = false;
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
    this.emitDashState();
  }

  public destroy(): void {
    window.removeEventListener('request-tank-dash', this.dashRequestListener);
    window.removeEventListener('keydown', this.onWindowShiftListener);
    window.removeEventListener('request-tank-super', this.superRequestListener);
    window.removeEventListener('mousedown', this.onWindowMouseDownListener);
    window.removeEventListener('contextmenu', this.onContextMenuListener);
    if (this.onWindowMouseMove) {
      window.removeEventListener('mousemove', this.onWindowMouseMove);
    }

    this.shipSprite.destroy();
    this.shieldSprite.destroy();
    this.leftFlameSprite?.destroy();
    this.rightFlameSprite?.destroy();
  }
}

// Экспорт алиаса для обратной совместимости
export { PlayerShip as PlayerTank };

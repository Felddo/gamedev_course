import Phaser from 'phaser';
import { SpaceStation, LaserProjectile } from './types';
import { WeaponSystem } from './WeaponSystem';
import { ParticleManager } from './ParticleManager';
import { EnemyManager } from './EnemyManager';
import { MeteorManager } from './MeteorManager';
import { PlayerShip } from './PlayerShip';
import { soundFx } from './audio';
import { BLASTER_DAMAGE, MAP_WIDTH, MAP_HEIGHT } from './constants';
import { ScrapManager } from './ScrapManager';

const stationImages = import.meta.glob<string>(
  '../assets/Sprites/Station/*.{png,jpg,jpeg,webp,svg}',
  { eager: true, import: 'default' },
);

export const STATION_SPRITE_ASSETS = Object.entries(stationImages)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([filePath, url]) => {
    const fileName = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'station';
    return {
      key: `space_station_${fileName}`,
      url,
    };
  });

// Максимальный размер старой самой крупной станции (spaceStation_024 при scale 1.55) составлял 620px.
// Половина от прежнего максимума = 310px.
const STATION_MAX_RENDERED_SIZE = 310;
const STATION_MIN_RENDERED_SIZE = 146;

/**
 * Менеджер странствующих космических баз:
 * - Автоматически загружает все спрайты из папки Sprites/Station и выбирает случайный при появлении
 * - Случайный размер (максимальный в 2 раза меньше прежнего максимума 620px)
 * - Медленный дрейф и величественное вращение в открытом космосе (не стреляют)
 * - Красная полоска здоровья (HP bar) сверху
 * - При уничтожении: колоссальный взрыв с нанесением урона окружающим объектам и выпадением лома
 */
export class SpaceStationManager {
  private scene: Phaser.Scene;
  private stations: SpaceStation[] = [];
  private spawnTimer = 3.0;
  private maxStations = 4;
  private spawnInterval = 14.0;
  private scrapManager: ScrapManager | null = null;

  // Выбранная база для фокусированного огня корабля (Target Lock)
  private targetedStation: SpaceStation | null = null;
  private hoveredStation: SpaceStation | null = null;
  private hologramRedrawTimer = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public setScrapManager(scrapManager: ScrapManager): void {
    this.scrapManager = scrapManager;
  }

  public getStations(): SpaceStation[] {
    return this.stations;
  }

  public getTargetedStation(): SpaceStation | null {
    return this.targetedStation;
  }

  public setTargetedStation(station: SpaceStation | null): void {
    this.targetedStation = station;
  }

  public getHoveredStation(): SpaceStation | null {
    return this.hoveredStation;
  }

  public updateHover(worldX: number, worldY: number): void {
    let found: SpaceStation | null = null;
    for (const station of this.stations) {
      if (this.isPointInsideStation(worldX, worldY, station, 35)) {
        found = station;
        break;
      }
    }
    this.hoveredStation = found;

    const canvas = this.scene.game.canvas;
    if (canvas) {
      if (found) {
        canvas.style.cursor = 'crosshair';
      } else if (canvas.style.cursor === 'crosshair' || canvas.style.cursor === 'pointer') {
        canvas.style.cursor = 'default';
      }
    }
  }

  public toggleTargetStationAt(worldX: number, worldY: number): boolean {
    for (const station of this.stations) {
      if (this.isPointInsideStation(worldX, worldY, station, 35)) {
        if (this.targetedStation === station) {
          // Отмена стрельбы по базе при повторном нажатии
          this.targetedStation = null;
          soundFx.playUiHover();
        } else {
          // Захват базы: корабль стреляет исключительно в нее
          this.targetedStation = station;
          soundFx.playUiClick();
        }
        return true;
      }
    }
    return false;
  }

  public reset(): void {
    for (const station of this.stations) {
      this.destroyStationSprites(station);
    }
    this.stations = [];
    this.spawnTimer = 3.0;
    this.targetedStation = null;
    this.hoveredStation = null;
    const canvas = this.scene.game.canvas;
    if (canvas && (canvas.style.cursor === 'crosshair' || canvas.style.cursor === 'pointer')) {
      canvas.style.cursor = 'default';
    }
  }

  private destroyStationSprites(station: SpaceStation): void {
    if (station.hologramRing) {
      station.hologramRing.destroy();
    }
    station.sprite.destroy();
    station.hpBarBg.destroy();
    station.hpBarFill.destroy();
  }

  /**
   * Начальный спавн баз при старте игры
   */
  public createInitialStations(count = 2): void {
    const cx = MAP_WIDTH / 2;
    const cy = MAP_HEIGHT / 2;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.4, 0.4);
      const dist = Phaser.Math.FloatBetween(400, 850);
      const x = Phaser.Math.Clamp(cx + Math.cos(angle) * dist, 350, MAP_WIDTH - 350);
      const y = Phaser.Math.Clamp(cy + Math.sin(angle) * dist, 350, MAP_HEIGHT - 350);
      const typeIndex = STATION_SPRITE_ASSETS.length > 0
        ? Phaser.Math.Between(0, STATION_SPRITE_ASSETS.length - 1)
        : 0;
      this.spawnStationAt(x, y, typeIndex, angle + Math.PI / 2);
    }
  }

  /**
   * Периодический спавн баз вокруг текущей области обзора камеры в бесконечной карте
   */
  public update(seconds: number, cam: Phaser.Cameras.Scene2D.Camera): void {
    this.spawnTimer -= seconds;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Phaser.Math.FloatBetween(this.spawnInterval * 0.8, this.spawnInterval * 1.3);
      if (this.stations.length < this.maxStations) {
        this.spawnStationAroundCamera(cam);
      }
    }

    const camCenterX = cam.worldView ? cam.worldView.centerX : 0;
    const camCenterY = cam.worldView ? cam.worldView.centerY : 0;
    const viewLeft = cam.worldView ? cam.worldView.x : 0;
    const viewRight = cam.worldView ? cam.worldView.right : MAP_WIDTH;
    const viewTop = cam.worldView ? cam.worldView.y : 0;
    const viewBottom = cam.worldView ? cam.worldView.bottom : MAP_HEIGHT;

    this.hologramRedrawTimer += seconds;
    const shouldRedrawIdleHolo = this.hologramRedrawTimer >= 0.05;
    if (shouldRedrawIdleHolo) {
      this.hologramRedrawTimer = 0;
    }

    for (let i = this.stations.length - 1; i >= 0; i--) {
      const station = this.stations[i];

      // Медленное плавное странствие в космическом пространстве
      station.animPhase += seconds * 0.35;
      station.moveAngle += Math.sin(station.animPhase) * 0.14 * seconds;

      station.sprite.x += Math.cos(station.moveAngle) * station.speed * seconds;
      station.sprite.y += Math.sin(station.moveAngle) * station.speed * seconds;
      station.sprite.rotation += station.rotationSpeed * seconds;

      // Ограничение движения станции пределами космического сектора (отскок от границ пояса астероидов)
      const minBound = 280;
      const maxBoundX = MAP_WIDTH - 280;
      const maxBoundY = MAP_HEIGHT - 280;
      if (station.sprite.x < minBound) {
        station.sprite.x = minBound;
        station.moveAngle = Math.PI - station.moveAngle;
      } else if (station.sprite.x > maxBoundX) {
        station.sprite.x = maxBoundX;
        station.moveAngle = Math.PI - station.moveAngle;
      }
      if (station.sprite.y < minBound) {
        station.sprite.y = minBound;
        station.moveAngle = -station.moveAngle;
      } else if (station.sprite.y > maxBoundY) {
        station.sprite.y = maxBoundY;
        station.moveAngle = -station.moveAngle;
      }

      // Обновление таймера вспышки от попадания
      if (station.isHitFlash > 0) {
        station.isHitFlash -= seconds;
        if (station.isHitFlash <= 0) {
          station.sprite.clearTint();
        }
      }

      // Обновление красной полоски HP сверху базы
      const barWidth = station.barWidth;
      const barHeight = station.barHeight;
      const barY = station.sprite.y - station.boundingRadius - 28;
      const hpRatio = Phaser.Math.Clamp(station.hp / station.maxHp, 0, 1);
      const currentFillW = Math.max(0, barWidth * hpRatio);

      station.hpBarBg.setPosition(station.sprite.x, barY);
      station.hpBarFill.setPosition(station.sprite.x - barWidth / 2, barY);
      station.hpBarFill.setSize(currentFillW, barHeight);
      station.hpBarFill.setVisible(currentFillW > 0);

      // Отрисовка тактической голограммы вокруг станции (только для видимых на экране)
      if (station.hologramRing) {
        const holoMargin = station.boundingRadius + 60;
        const isVisibleOnScreen =
          station.sprite.x >= viewLeft - holoMargin &&
          station.sprite.x <= viewRight + holoMargin &&
          station.sprite.y >= viewTop - holoMargin &&
          station.sprite.y <= viewBottom + holoMargin;
        if (station.hologramRing.visible !== isVisibleOnScreen) {
          station.hologramRing.setVisible(isVisibleOnScreen);
        }

        const isTargeted = this.targetedStation === station;
        const isHovered = this.hoveredStation === station;
        if (!isVisibleOnScreen || (!isTargeted && !isHovered && !shouldRedrawIdleHolo)) {
          // Пропускаем перерисовку, если станция за экраном или это нецелевой кадр
        } else {
        station.hologramPhase = (station.hologramPhase || 0) + (isTargeted || isHovered ? seconds * 2.2 : 0.05 * 2.2);
        const g = station.hologramRing;
        g.clear();

        const baseR = station.boundingRadius + 18;
        const pulse = Math.sin(station.hologramPhase) * (isTargeted ? 10 : 6);
        const holoR = baseR + pulse;

        if (isTargeted) {
          // Яркий неоновый режим захвата цели (Target Lock)
          const targetColor = 0xef4444; // Красный неон
          const pulseAlpha = 0.8 + Math.sin(station.hologramPhase * 2.5) * 0.2;

          // 4 сегментарные дуги вращающегося прицела
          g.lineStyle(2.5, targetColor, pulseAlpha);
          const segments = 4;
          const segAngle = Math.PI / 2.6;
          const rotOffset = station.hologramPhase * 0.8;

          for (let s = 0; s < segments; s++) {
            const startA = rotOffset + (s * Math.PI * 2) / segments;
            g.beginPath();
            g.arc(station.sprite.x, station.sprite.y, holoR + 10, startA, startA + segAngle);
            g.strokePath();

            // Тактические маркеры захвата на углах
            const markerX = station.sprite.x + Math.cos(startA) * (holoR + 10);
            const markerY = station.sprite.y + Math.sin(startA) * (holoR + 10);
            g.fillStyle(0xfca5a5, 1.0);
            g.fillCircle(markerX, markerY, 3.5);
          }

          // Внутреннее мерцающее кольцо прицела
          g.lineStyle(1.8, 0xf87171, pulseAlpha * 0.7);
          g.strokeCircle(station.sprite.x, station.sprite.y, holoR - 8);

          // 4 перекрестных лазерных маркера прицеливания (Crosshair)
          const crossDist = holoR + 26;
          const innerDist = holoR + 4;
          g.lineStyle(2.2, 0xef4444, pulseAlpha);
          g.lineBetween(station.sprite.x - crossDist, station.sprite.y, station.sprite.x - innerDist, station.sprite.y);
          g.lineBetween(station.sprite.x + innerDist, station.sprite.y, station.sprite.x + crossDist, station.sprite.y);
          g.lineBetween(station.sprite.x, station.sprite.y - crossDist, station.sprite.x, station.sprite.y - innerDist);
          g.lineBetween(station.sprite.x, station.sprite.y + innerDist, station.sprite.x, station.sprite.y + crossDist);

          // Подсветка полоски HP базы красной рамкой
          station.hpBarBg.setStrokeStyle(2.5, 0xef4444, 1.0);
        } else if (isHovered) {
          // Режим наведения курсора: яркая неоновая подсветка, показывающая интерактивность
          const alpha = 0.65 + Math.sin(station.hologramPhase * 2) * 0.2;
          g.lineStyle(2, 0x38bdf8, alpha);

          const segments = 4;
          const segAngle = Math.PI / 3.0;
          const rotOffset = station.hologramPhase * 0.5;

          for (let s = 0; s < segments; s++) {
            const startA = rotOffset + (s * Math.PI * 2) / segments;
            g.beginPath();
            g.arc(station.sprite.x, station.sprite.y, holoR + 4, startA, startA + segAngle);
            g.strokePath();

            const dotX = station.sprite.x + Math.cos(startA) * (holoR + 4);
            const dotY = station.sprite.y + Math.sin(startA) * (holoR + 4);
            g.fillStyle(0xbae6fd, 1.0);
            g.fillCircle(dotX, dotY, 2.5);
          }

          g.lineStyle(1.2, 0x0284c7, alpha * 0.6);
          g.strokeCircle(station.sprite.x, station.sprite.y, holoR - 10);
          station.hpBarBg.setStrokeStyle(1.8, 0x38bdf8, 0.95);
        } else {
          // Стандартное фоновое свечение базы
          const alpha = 0.22 + Math.sin(station.hologramPhase) * 0.08;
          g.lineStyle(1.5, 0x38bdf8, alpha);

          const segments = 4;
          const segAngle = Math.PI / 3.2;
          const rotOffset = station.hologramPhase * 0.35;

          for (let s = 0; s < segments; s++) {
            const startA = rotOffset + (s * Math.PI * 2) / segments;
            g.beginPath();
            g.arc(station.sprite.x, station.sprite.y, holoR, startA, startA + segAngle);
            g.strokePath();

            const dotX = station.sprite.x + Math.cos(startA) * holoR;
            const dotY = station.sprite.y + Math.sin(startA) * holoR;
            g.fillStyle(0x67e8f9, alpha * 1.3);
            g.fillCircle(dotX, dotY, 2);
          }

          g.lineStyle(1, 0x0ea5e9, alpha * 0.45);
          g.strokeCircle(station.sprite.x, station.sprite.y, holoR - 14);
          station.hpBarBg.setStrokeStyle(1.5, 0x475569, 0.95);
        }
        }
      }

      // Очистка баз, оставшихся далеко позади при исследовании бесконечного космоса
      const distToCamera = Phaser.Math.Distance.Between(
        station.sprite.x,
        station.sprite.y,
        camCenterX,
        camCenterY,
      );
      if (distToCamera > 3600) {
        if (this.targetedStation === station) {
          this.targetedStation = null;
        }
        if (this.hoveredStation === station) {
          this.hoveredStation = null;
        }
        this.destroyStationSprites(station);
        this.stations.splice(i, 1);
      }
    }
  }

  /**
   * Спавн станции на границе экрана
   */
  private spawnStationAroundCamera(cam: Phaser.Cameras.Scene2D.Camera): void {
    const vw = cam.worldView ? cam.worldView.width : 1600;
    const vh = cam.worldView ? cam.worldView.height : 900;
    const vx = cam.worldView ? cam.worldView.x : 0;
    const vy = cam.worldView ? cam.worldView.y : 0;
    const offset = Phaser.Math.Between(160, 260);

    const side = Phaser.Math.Between(0, 3);
    let startX = 0;
    let startY = 0;

    if (side === 0) {
      startX = Phaser.Math.Between(vx - 50, vx + vw + 50);
      startY = vy - offset;
    } else if (side === 1) {
      startX = vx + vw + offset;
      startY = Phaser.Math.Between(vy - 50, vy + vh + 50);
    } else if (side === 2) {
      startX = Phaser.Math.Between(vx - 50, vx + vw + 50);
      startY = vy + vh + offset;
    } else {
      startX = vx - offset;
      startY = Phaser.Math.Between(vy - 50, vy + vh + 50);
    }

    startX = Phaser.Math.Clamp(startX, 260, MAP_WIDTH - 260);
    startY = Phaser.Math.Clamp(startY, 260, MAP_HEIGHT - 260);

    // Траектория движения направлена внутрь исследуемого сектора
    const targetCenterX = vx + vw / 2 + Phaser.Math.Between(-300, 300);
    const targetCenterY = vy + vh / 2 + Phaser.Math.Between(-300, 300);
    const moveAngle = Phaser.Math.Angle.Between(startX, startY, targetCenterX, targetCenterY);

    const typeRoll = STATION_SPRITE_ASSETS.length > 0
      ? Phaser.Math.Between(0, STATION_SPRITE_ASSETS.length - 1)
      : 0;
    this.spawnStationAt(startX, startY, typeRoll, moveAngle);
  }

  /**
   * Инициализация объекта космической базы со случайным спрайтом из папки Station и случайным размером
   */
  public spawnStationAt(
    x: number,
    y: number,
    typeIndex: number,
    moveAngle: number,
  ): void {
    const assetCount = STATION_SPRITE_ASSETS.length;
    if (assetCount === 0) return;

    const safeIdx = ((typeIndex % assetCount) + assetCount) % assetCount;
    const textureKey = STATION_SPRITE_ASSETS[safeIdx].key;

    const sprite = this.scene.add.sprite(x, y, textureKey);
    const texW = sprite.width > 0 ? sprite.width : 172;
    const texH = sprite.height > 0 ? sprite.height : 52;
    const maxTexDim = Math.max(texW, texH);

    const minScale = STATION_MIN_RENDERED_SIZE / maxTexDim;
    const maxScale = STATION_MAX_RENDERED_SIZE / maxTexDim;
    const scale = Phaser.Math.FloatBetween(minScale, maxScale);
    const sizeFactor = maxScale > minScale ? (scale - minScale) / (maxScale - minScale) : 0.5;

    const halfWidth = (texW * scale) / 2;
    const halfHeight = (texH * scale) / 2;
    const boundingRadius = Math.hypot(halfWidth, halfHeight);

    const maxHp = Math.round(Phaser.Math.Linear(40, 90, sizeFactor));
    const barWidth = Math.round(Phaser.Math.Linear(120, 200, sizeFactor));
    const barHeight = Math.round(Phaser.Math.Linear(10, 14, sizeFactor));
    const speed = Phaser.Math.FloatBetween(18, 32);
    const xpReward = 0; // Опыт со станции не начисляется
    const scrapReward = Math.round(Phaser.Math.Linear(50, 130, sizeFactor));
    const explosionRadius = Math.round(Phaser.Math.Linear(180, 280, sizeFactor));
    const explosionDamage = Math.round(Phaser.Math.Linear(45, 75, sizeFactor));

    const radius = boundingRadius;

    sprite.setOrigin(0.5, 0.5);
    sprite.setScale(scale);
    sprite.setDepth(6.5);
    sprite.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));

    // Увеличенная и аккуратно выровненная полоска HP сверху базы
    const barY = y - boundingRadius - 28;

    const hpBarBg = this.scene.add.rectangle(
      x,
      barY,
      barWidth + 6,
      barHeight + 6,
      0x050b14,
      0.88,
    );
    hpBarBg.setStrokeStyle(1.5, 0x475569, 0.95);
    hpBarBg.setOrigin(0.5, 0.5);
    hpBarBg.setDepth(15);

    const hpBarFill = this.scene.add.rectangle(
      x - barWidth / 2,
      barY,
      barWidth,
      barHeight,
      0xef4444,
      1.0,
    );
    hpBarFill.setOrigin(0, 0.5);
    hpBarFill.setDepth(15.1);

    // Малозаметная тактическая голограмма вокруг базы для индикации интерактивности (нажатия)
    const hologramRing = this.scene.add.graphics();
    hologramRing.setDepth(6.2);

    this.stations.push({
      sprite,
      hpBarBg,
      hpBarFill,
      hologramRing,
      hologramPhase: Math.random() * Math.PI * 2,
      typeIndex,
      vx: Math.cos(moveAngle) * speed,
      vy: Math.sin(moveAngle) * speed,
      speed,
      moveAngle,
      rotationSpeed: Phaser.Math.FloatBetween(0.04, 0.09) * (Math.random() < 0.5 ? 1 : -1),
      animPhase: Math.random() * Math.PI * 2,
      hp: maxHp,
      maxHp,
      radius,
      halfWidth,
      halfHeight,
      boundingRadius,
      barWidth,
      barHeight,
      scale,
      isHitFlash: 0,
      xpReward,
      scrapReward,
      explosionRadius,
      explosionDamage,
    });
  }

  /**
   * Проверка: находится ли точка (x, y) внутри ориентированного хитбокса космической базы
   * с учетом угла поворота и дополнительного допуска (padding)
   */
  public isPointInsideStation(
    x: number,
    y: number,
    station: SpaceStation,
    padding = 24,
  ): boolean {
    const dx = x - station.sprite.x;
    const dy = y - station.sprite.y;
    const distSq = dx * dx + dy * dy;

    // Быстрый отсев по радиусу описанной окружности
    const maxBound = station.boundingRadius + padding;
    if (distSq > maxBound * maxBound) {
      return false;
    }

    // Попадание во вписанную окружность станции
    const innerBound = Math.min(station.halfWidth, station.halfHeight) + padding;
    if (distSq <= innerBound * innerBound) {
      return true;
    }

    // Перевод координат в локальную систему станции с учетом угла поворота
    const angle = -station.sprite.rotation;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    return (
      Math.abs(localX) <= station.halfWidth + padding &&
      Math.abs(localY) <= station.halfHeight + padding
    );
  }

  /**
   * Проверка столкновения снаряда со станцией с учетом траектории полета
   */
  public isLaserHittingStation(
    laser: LaserProjectile,
    station: SpaceStation,
    padding = 16,
  ): boolean {
    // 1. Текущая позиция снаряда
    if (this.isPointInsideStation(laser.sprite.x, laser.sprite.y, station, padding)) {
      return true;
    }

    // 2. Промежуточная точка для предотвращения туннелирования при высокой скорости снаряда
    const midX = laser.sprite.x - laser.vx * 0.009;
    const midY = laser.sprite.y - laser.vy * 0.009;
    if (this.isPointInsideStation(midX, midY, station, padding)) {
      return true;
    }

    // 3. Предыдущая позиция снаряда
    const prevX = laser.sprite.x - laser.vx * 0.018;
    const prevY = laser.sprite.y - laser.vy * 0.018;
    return this.isPointInsideStation(prevX, prevY, station, padding);
  }

  /**
   * Проверка попаданий снарядов орудий в космические базы
   */
  public checkLaserCollisions(
    weaponSystem: WeaponSystem,
    particleManager: ParticleManager,
    onScoreGained: (score: number, x?: number, y?: number) => void,
    enemyManager: EnemyManager,
    meteorManager: MeteorManager,
    playerShip: PlayerShip,
  ): void {
    const lasers = weaponSystem.getLasers();

    for (let l = lasers.length - 1; l >= 0; l--) {
      const laser = lasers[l];

      for (let s = this.stations.length - 1; s >= 0; s--) {
        const station = this.stations[s];

        if (laser.hitStations && laser.hitStations.has(station)) {
          continue;
        }

        const isHit = this.isLaserHittingStation(laser, station, 16);

        if (isHit) {
          soundFx.playHit();
          particleManager.spawnHitSparks(laser.sprite.x, laser.sprite.y);

          if (!laser.hitStations) {
            laser.hitStations = new Set();
          }
          laser.hitStations.add(station);

          // Вспышка обшивки при получении урона
          station.sprite.setTint(0xffffff);
          station.isHitFlash = 0.08;

          const damage = laser.damage ?? BLASTER_DAMAGE;
          station.hp -= damage;

          // Взрывной сплеш снаряда
          if (laser.isExplosive) {
            particleManager.spawnExplosion(laser.sprite.x, laser.sprite.y);
          }

          // Бронебойный пробой
          if (laser.pierceCount && laser.pierceCount > 1) {
            laser.pierceCount -= 1;
          } else {
            weaponSystem.removeLaser(l);
          }

          // Уничтожение базы при потере всего здоровья
          if (station.hp <= 0) {
            this.destroyStation(
              s,
              particleManager,
              onScoreGained,
              enemyManager,
              meteorManager,
              playerShip,
            );
          }
          break;
        }
      }
    }
  }

  /**
   * Урон базам от напалмового огненного следа
   */
  public checkFireDamage(
    x: number,
    y: number,
    radius: number,
    damage: number,
    particleManager: ParticleManager,
    onScoreGained: (score: number, x?: number, y?: number) => void,
    enemyManager: EnemyManager,
    meteorManager: MeteorManager,
    playerShip: PlayerShip,
  ): void {
    for (let s = this.stations.length - 1; s >= 0; s--) {
      const station = this.stations[s];
      if (this.isPointInsideStation(x, y, station, radius)) {
        station.hp -= damage;
        station.sprite.setTint(0xf97316);
        station.isHitFlash = 0.06;

        if (station.hp <= 0) {
          this.destroyStation(
            s,
            particleManager,
            onScoreGained,
            enemyManager,
            meteorManager,
            playerShip,
          );
        }
      }
    }
  }

  /**
   * Разрушение базы:
   * - Колоссальный детонационный взрыв
   * - Нанесение сокрушительного урона окружающим объектам (метеоры, осколочные волны)
   * - Начисление опыта игроку с эффектным всплывающим индикатором
   */
  public destroyStation(
    index: number,
    particleManager: ParticleManager,
    onScoreGained: (score: number, x?: number, y?: number) => void,
    enemyManager: EnemyManager,
    meteorManager: MeteorManager,
    playerShip: PlayerShip,
  ): void {
    const station = this.stations[index];
    if (!station) return;

    const sx = station.sprite.x;
    const sy = station.sprite.y;
    const expRadius = station.explosionRadius;
    const expDamage = station.explosionDamage;
    const xpReward = station.xpReward;

    soundFx.playExplosion();
    this.scene.cameras.main.shake(360, 0.018);

    // Колоссальный взрыв станции без начисления опыта
    particleManager.spawnStationMegaExplosion(sx, sy, expRadius, 0);

    // При взрыве со станции выпадает металлолом (валюта)
    if (this.scrapManager) {
      this.scrapManager.spawnScrap(sx, sy, station.scrapReward ?? 60);
    }

    // Враги полностью неуязвимы к взрыву станции (урон врагам не наносится)

    // 1. Раскалывание и урон окружающим метеоритам
    const meteors = meteorManager.getMeteors();
    for (let m = meteors.length - 1; m >= 0; m--) {
      const meteor = meteors[m];
      const dist = Phaser.Math.Distance.Between(sx, sy, meteor.sprite.x, meteor.sprite.y);
      if (dist <= expRadius) {
        meteor.hp -= expDamage;
        meteor.sprite.setTint(0xffffff);
        meteor.isHitFlash = 0.12;
        particleManager.spawnExplosion(meteor.sprite.x, meteor.sprite.y);

        if (meteor.hp <= 0) {
          meteor.sprite.destroy();
          meteors.splice(m, 1);
        }
      }
    }

    // 3. Урон кораблю игрока, если он оказался в эпицентре взрыва
    const distToPlayer = Phaser.Math.Distance.Between(sx, sy, playerShip.x, playerShip.y);
    if (distToPlayer <= expRadius * 0.75) {
      playerShip.takeDamage(18);
      soundFx.playHit();
      this.scene.cameras.main.shake(200, 0.012);
      particleManager.spawnHitSparks(playerShip.x, playerShip.y);
    }

    if (this.targetedStation === station) {
      this.targetedStation = null;
    }
    if (this.hoveredStation === station) {
      this.hoveredStation = null;
    }

    this.destroyStationSprites(station);
    this.stations.splice(index, 1);
  }

  public destroy(): void {
    this.reset();
  }
}

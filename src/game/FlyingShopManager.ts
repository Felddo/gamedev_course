import Phaser from 'phaser';
import shopStationUrl from '../assets/Sprites/Shop/spaceStation_020.png';
import { FlyingShop } from './types';
import { MAP_WIDTH, MAP_HEIGHT } from './constants';
import { CampaignMission } from './campaign/types';
import { soundFx } from './audio';
import { ShopMissileOffer, rollShopMissileOffers } from './shop/missilesCatalog';

export const FLYING_SHOP_SPRITE_ASSET = {
  key: 'flying_shop_station',
  url: shopStationUrl,
};

// Средний размер станции (середина диапазона SpaceStationManager 146..310px)
const SHOP_RENDERED_SIZE = 228;
const SHOP_DWELL_DURATION = 2.0; // секунд удержания в сфере для входа
const SHOP_RANDOM_SPAWN_CHANCE = 0.45; // шанс появления на уровнях кроме 1-2

/**
 * Менеджер летающего магазина:
 * - На уровне 1-2 появляется со 100% вероятностью
 * - На остальных уровнях появляется случайно (может и не появиться)
 * - Всегда среднего размера, со спрайтом spaceStation_020.png
 * - Окружен желтоватой сферой; при нахождении игрока внутри 2 секунды круг
 *   заполняется более насыщенным желтым и открывает окно магазина
 */
export class FlyingShopManager {
  private scene: Phaser.Scene;
  private shop: FlyingShop | null = null;
  private currentOffers: ShopMissileOffer[] = [];
  private purchasedIds = new Set<string>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public getShop(): FlyingShop | null {
    return this.shop;
  }

  public getOffers(): ShopMissileOffer[] {
    return this.currentOffers;
  }

  public getPurchasedIds(): Set<string> {
    return this.purchasedIds;
  }

  public markPurchased(offerId: string): void {
    this.purchasedIds.add(offerId);
  }

  public reset(): void {
    if (this.shop) {
      this.shop.sphereGraphics.destroy();
      this.shop.sprite.destroy();
      this.shop = null;
    }
    this.currentOffers = [];
    this.purchasedIds.clear();
  }

  public setupForMission(mission?: CampaignMission | null): void {
    this.reset();
    if (!mission) return;

    const shouldSpawn =
      mission.id === '1-2' ? true : Math.random() < SHOP_RANDOM_SPAWN_CHANCE;

    if (!shouldSpawn) {
      return;
    }

    this.currentOffers = rollShopMissileOffers(mission.id, 3);
    this.spawnShop();
  }

  private spawnShop(): void {
    if (!this.scene.textures.exists(FLYING_SHOP_SPRITE_ASSET.key)) {
      return;
    }

    const cx = MAP_WIDTH / 2;
    const cy = MAP_HEIGHT / 2;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dist = Phaser.Math.FloatBetween(520, 920);
    const x = Phaser.Math.Clamp(cx + Math.cos(angle) * dist, 380, MAP_WIDTH - 380);
    const y = Phaser.Math.Clamp(cy + Math.sin(angle) * dist, 380, MAP_HEIGHT - 380);

    const sprite = this.scene.add.sprite(x, y, FLYING_SHOP_SPRITE_ASSET.key);
    const texW = sprite.width > 0 ? sprite.width : 124;
    const texH = sprite.height > 0 ? sprite.height : 347;
    const maxTexDim = Math.max(texW, texH);

    // Размер магазина всегда средний
    const scale = SHOP_RENDERED_SIZE / maxTexDim;
    const halfWidth = (texW * scale) / 2;
    const halfHeight = (texH * scale) / 2;
    const boundingRadius = Math.hypot(halfWidth, halfHeight);
    const sphereRadius = Math.round(boundingRadius + 46);

    sprite.setOrigin(0.5, 0.5);
    sprite.setScale(scale);
    sprite.setDepth(6.6);
    sprite.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));

    const sphereGraphics = this.scene.add.graphics();
    sphereGraphics.setDepth(6.1);

    this.shop = {
      sprite,
      sphereGraphics,
      x,
      y,
      speed: Phaser.Math.FloatBetween(18, 26),
      moveAngle: angle + Math.PI / 2,
      rotationSpeed: Phaser.Math.FloatBetween(0.03, 0.055) * (Math.random() < 0.5 ? 1 : -1),
      animPhase: Math.random() * Math.PI * 2,
      pulsePhase: Math.random() * Math.PI * 2,
      boundingRadius,
      sphereRadius,
      dwellTimer: 0,
      reenterCooldown: 0,
      mustExitBeforeReenter: false,
    };

    this.drawSphere(false);
  }

  public update(
    seconds: number,
    playerX: number,
    playerY: number,
    onEnterShop: () => void,
  ): void {
    const shop = this.shop;
    if (!shop) return;

    if (shop.reenterCooldown > 0) {
      shop.reenterCooldown = Math.max(0, shop.reenterCooldown - seconds);
    }

    const distToPlayer = Phaser.Math.Distance.Between(playerX, playerY, shop.x, shop.y);
    const isInside = distToPlayer <= shop.sphereRadius;

    if (shop.mustExitBeforeReenter && distToPlayer > shop.sphereRadius + 12) {
      shop.mustExitBeforeReenter = false;
    }

    // Плавный полет магазина в пределах сектора (замедляется, когда игрок внутри сферы)
    const speedFactor = isInside ? 0.3 : 1.0;
    shop.animPhase += seconds * 0.32;
    shop.pulsePhase += seconds * 2.4;
    shop.moveAngle += Math.sin(shop.animPhase) * 0.12 * seconds;

    shop.x += Math.cos(shop.moveAngle) * shop.speed * speedFactor * seconds;
    shop.y += Math.sin(shop.moveAngle) * shop.speed * speedFactor * seconds;

    const minBound = 340;
    const maxBoundX = MAP_WIDTH - 340;
    const maxBoundY = MAP_HEIGHT - 340;
    if (shop.x < minBound) {
      shop.x = minBound;
      shop.moveAngle = Math.PI - shop.moveAngle;
    } else if (shop.x > maxBoundX) {
      shop.x = maxBoundX;
      shop.moveAngle = Math.PI - shop.moveAngle;
    }
    if (shop.y < minBound) {
      shop.y = minBound;
      shop.moveAngle = -shop.moveAngle;
    } else if (shop.y > maxBoundY) {
      shop.y = maxBoundY;
      shop.moveAngle = -shop.moveAngle;
    }

    shop.sprite.setPosition(shop.x, shop.y);
    shop.sprite.rotation += shop.rotationSpeed * seconds;

    // Таймер удержания 2 секунды внутри желтой сферы
    if (isInside && !shop.mustExitBeforeReenter && shop.reenterCooldown <= 0) {
      shop.dwellTimer = Math.min(SHOP_DWELL_DURATION, shop.dwellTimer + seconds);
      if (shop.dwellTimer >= SHOP_DWELL_DURATION) {
        shop.dwellTimer = 0;
        shop.mustExitBeforeReenter = true;
        shop.reenterCooldown = 1.0;
        this.drawSphere(isInside);
        soundFx.playUpgradeSelect();
        onEnterShop();
        return;
      }
    } else if (!isInside) {
      shop.dwellTimer = Math.max(0, shop.dwellTimer - seconds * 3.0);
    }

    this.drawSphere(isInside);
  }

  private drawSphere(isInside: boolean): void {
    const shop = this.shop;
    if (!shop) return;

    const g = shop.sphereGraphics;
    const { x, y, sphereRadius, pulsePhase, dwellTimer } = shop;
    const progress = Phaser.Math.Clamp(dwellTimer / SHOP_DWELL_DURATION, 0, 1);

    g.clear();

    const idlePulse = Math.sin(pulsePhase) * 0.03;

    // Базовая желтоватая сфера вокруг магазина (становится насыщеннее желтой по мере заполнения)
    const baseFillAlpha = 0.10 + idlePulse + progress * 0.24;
    g.fillStyle(0xfacc15, baseFillAlpha);
    g.fillCircle(x, y, sphereRadius);

    // Внутренний заполняющийся желтый круг от центра к краям по мере удержания 2 сек
    if (progress > 0) {
      const fillRadius = Math.max(4, sphereRadius * progress);
      g.fillStyle(0xfde047, 0.22 + progress * 0.30);
      g.fillCircle(x, y, fillRadius);

      g.lineStyle(2, 0xfef08a, 0.55 + progress * 0.4);
      g.strokeCircle(x, y, fillRadius);
    }

    // Контур желтоватой сферы
    const borderAlpha = isInside ? 0.85 : 0.58 + Math.sin(pulsePhase) * 0.14;
    g.lineStyle(2, 0xfde047, borderAlpha);
    g.strokeCircle(x, y, sphereRadius);

    // Мягкие вращающиеся голографические дуги по контуру сферы
    const segments = 4;
    const segAngle = Math.PI / 4;
    const rotOffset = pulsePhase * 0.35;
    g.lineStyle(1.5, 0xfef08a, 0.38 + progress * 0.35);
    for (let s = 0; s < segments; s++) {
      const startA = rotOffset + (s * Math.PI * 2) / segments;
      g.beginPath();
      g.arc(x, y, sphereRadius + 6, startA, startA + segAngle);
      g.strokePath();
    }

    // Дуга прогресса заполнения по периметру
    if (progress > 0) {
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + Math.PI * 2 * progress;
      g.lineStyle(4.5, 0xfef08a, 0.96);
      g.beginPath();
      g.arc(x, y, sphereRadius, startAngle, endAngle, false);
      g.strokePath();
    }
  }

  public destroy(): void {
    this.reset();
  }
}

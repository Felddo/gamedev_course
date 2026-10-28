import Phaser from 'phaser';
import { CosmicDustParticle, CosmicStar } from './types';
import { MAP_WIDTH, MAP_HEIGHT } from './constants';

/**
 * Менеджер процедурной космической среды:
 * - Глубокий звездный вакуум и процедурные туманности
 * - Множество непрерывно движущихся звезд с эффектом параллакса и мерцанием (3 слоя глубины)
 * - Периодически пролетающие кометы
 * - Парящие светящиеся частицы звездной пыли
 */
export class AtmosphereManager {
  private scene: Phaser.Scene;
  private stardust: CosmicDustParticle[] = [];
  private stars: CosmicStar[] = [];
  private nebulas: Phaser.GameObjects.Image[] = [];
  private starAnimTimer = 0;
  private shootingStarTimer = 4.0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public reset(): void {
    for (const dust of this.stardust) {
      dust.sprite.destroy();
    }
    this.stardust = [];

    for (const s of this.stars) {
      s.sprite.destroy();
    }
    this.stars = [];

    for (const n of this.nebulas) {
      n.destroy();
    }
    this.nebulas = [];
  }

  /**
   * Построение процедурной космической карты
   */
  public createSpaceMap(): void {
    this.reset();
    this.ensureSpaceTextures();

    // 1. Космический фон глубокого вакуума
    this.scene.cameras.main.setBackgroundColor('#02040a');

    // 2. Процедурные космические туманности
    this.createProceduralNebulas();

    // 3. Процедурно генерируемые двигающиеся звезды (3 слоя глубины)
    this.createProceduralMovingStars();
  }

  // Алиас для обратной совместимости
  public createWastelandMap(): void {
    this.createSpaceMap();
  }

  /**
   * Создание необходимых процедурных текстур для космоса, звезд и туманностей
   */
  private ensureSpaceTextures(): void {
    // 1. Текстуры звезд
    if (!this.scene.textures.exists('cosmic_star_tiny')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(2, 2, 1.2);
      g.generateTexture('cosmic_star_tiny', 4, 4);
      g.destroy();
    }

    if (!this.scene.textures.exists('cosmic_star_med')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x38bdf8, 0.4);
      g.fillCircle(4, 4, 3.5);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 1.8);
      g.generateTexture('cosmic_star_med', 8, 8);
      g.destroy();
    }

    if (!this.scene.textures.exists('cosmic_star_bright')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x06b6d4, 0.35);
      g.fillCircle(8, 8, 7.5);
      g.fillStyle(0xffffff, 0.85);
      g.fillRect(7, 1, 2, 14);
      g.fillRect(1, 7, 14, 2);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 2.8);
      g.generateTexture('cosmic_star_bright', 16, 16);
      g.destroy();
    }

    if (!this.scene.textures.exists('cosmic_star_gold')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xf59e0b, 0.35);
      g.fillCircle(5, 5, 4.5);
      g.fillStyle(0xfef08a, 1);
      g.fillCircle(5, 5, 2.2);
      g.generateTexture('cosmic_star_gold', 10, 10);
      g.destroy();
    }

    // 2. Процедурная частица звездной пыли
    if (!this.scene.textures.exists('cosmic_dust_particle')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(4, 4, 3);
      g.generateTexture('cosmic_dust_particle', 8, 8);
      g.destroy();
    }

    // 3. Процедурные текстуры туманностей
    if (!this.scene.textures.exists('nebula_cyan_cloud')) {
      const size = 512;
      const canvas = this.scene.textures.createCanvas('nebula_cyan_cloud', size, size);
      if (canvas) {
        const ctx = canvas.context;
        const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(6, 182, 212, 0.32)');
        grad.addColorStop(0.35, 'rgba(14, 116, 144, 0.22)');
        grad.addColorStop(0.7, 'rgba(8, 51, 68, 0.12)');
        grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }

    if (!this.scene.textures.exists('nebula_purple_cloud')) {
      const size = 512;
      const canvas = this.scene.textures.createCanvas('nebula_purple_cloud', size, size);
      if (canvas) {
        const ctx = canvas.context;
        const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(168, 85, 247, 0.28)');
        grad.addColorStop(0.35, 'rgba(109, 40, 217, 0.2)');
        grad.addColorStop(0.7, 'rgba(59, 7, 100, 0.1)');
        grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }

    if (!this.scene.textures.exists('nebula_rose_cloud')) {
      const size = 512;
      const canvas = this.scene.textures.createCanvas('nebula_rose_cloud', size, size);
      if (canvas) {
        const ctx = canvas.context;
        const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(244, 63, 94, 0.22)');
        grad.addColorStop(0.4, 'rgba(190, 18, 60, 0.14)');
        grad.addColorStop(0.75, 'rgba(80, 7, 36, 0.08)');
        grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }
  }

  /**
   * Размещение процедурных туманностей по секторам космической карты
   */
  private createProceduralNebulas(): void {
    const nebulaSpots = [
      { x: 500, y: 400, texture: 'nebula_cyan_cloud', scale: 2.2, alpha: 0.35 },
      { x: 1200, y: 1300, texture: 'nebula_purple_cloud', scale: 2.5, alpha: 0.32 },
      { x: 2300, y: 550, texture: 'nebula_cyan_cloud', scale: 2.8, alpha: 0.3 },
      { x: 2600, y: 1250, texture: 'nebula_rose_cloud', scale: 2.3, alpha: 0.28 },
      { x: 1600, y: 750, texture: 'nebula_purple_cloud', scale: 2.6, alpha: 0.25 },
      { x: 300, y: 1200, texture: 'nebula_rose_cloud', scale: 2.1, alpha: 0.26 },
      { x: 2000, y: 250, texture: 'nebula_purple_cloud', scale: 2.2, alpha: 0.24 },
    ];

    for (const spot of nebulaSpots) {
      const cloud = this.scene.add.image(spot.x, spot.y, spot.texture);
      cloud.setScale(spot.scale);
      cloud.setAlpha(spot.alpha);
      cloud.setDepth(-8);
      cloud.setBlendMode(Phaser.BlendModes.ADD);

      this.scene.tweens.add({
        targets: cloud,
        scaleX: spot.scale * 1.08,
        scaleY: spot.scale * 1.08,
        alpha: spot.alpha * 1.25,
        duration: Phaser.Math.Between(7000, 12000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.nebulas.push(cloud);
    }
  }

  /**
   * Процедурно генерируемые двигающиеся звезды (3 слоя глубины)
   */
  private createProceduralMovingStars(): void {
    this.stars = [];
    const cam = this.scene.cameras.main;
    const cx = cam.worldView ? cam.worldView.centerX : MAP_WIDTH / 2;
    const cy = cam.worldView ? cam.worldView.centerY : MAP_HEIGHT / 2;
    const spanX = 2800;
    const spanY = 1800;

    // Слой 1: Далекие крошечные звезды (220 шт)
    for (let i = 0; i < 220; i++) {
      const x = cx + Phaser.Math.Between(-spanX / 2, spanX / 2);
      const y = cy + Phaser.Math.Between(-spanY / 2, spanY / 2);
      const sprite = this.scene.add.sprite(x, y, 'cosmic_star_tiny');
      sprite.setDepth(-4);

      const baseAlpha = Phaser.Math.FloatBetween(0.28, 0.7);
      sprite.setAlpha(baseAlpha);

      this.stars.push({
        sprite,
        x,
        y,
        vx: Phaser.Math.FloatBetween(-18, -12),
        vy: Phaser.Math.FloatBetween(4, 9),
        baseAlpha,
        twinkleSpeed: Phaser.Math.FloatBetween(1.2, 2.5),
        twinkleOffset: Math.random() * Math.PI * 2,
        layer: 1,
      });
    }

    // Слой 2: Средние звезды с легким ореолом (120 шт)
    for (let i = 0; i < 120; i++) {
      const x = cx + Phaser.Math.Between(-spanX / 2, spanX / 2);
      const y = cy + Phaser.Math.Between(-spanY / 2, spanY / 2);
      const textureKey = Math.random() < 0.25 ? 'cosmic_star_gold' : 'cosmic_star_med';
      const sprite = this.scene.add.sprite(x, y, textureKey);
      sprite.setDepth(-3);
      sprite.setScale(Phaser.Math.FloatBetween(0.9, 1.3));

      const baseAlpha = Phaser.Math.FloatBetween(0.5, 0.85);
      sprite.setAlpha(baseAlpha);

      this.stars.push({
        sprite,
        x,
        y,
        vx: Phaser.Math.FloatBetween(-34, -24),
        vy: Phaser.Math.FloatBetween(8, 16),
        baseAlpha,
        twinkleSpeed: Phaser.Math.FloatBetween(2.0, 4.0),
        twinkleOffset: Math.random() * Math.PI * 2,
        layer: 2,
      });
    }

    // Слой 3: Яркие искрящиеся передние звезды с лучами (55 шт)
    for (let i = 0; i < 55; i++) {
      const x = cx + Phaser.Math.Between(-spanX / 2, spanX / 2);
      const y = cy + Phaser.Math.Between(-spanY / 2, spanY / 2);
      const sprite = this.scene.add.sprite(x, y, 'cosmic_star_bright');
      sprite.setDepth(-2);
      sprite.setScale(Phaser.Math.FloatBetween(0.9, 1.4));

      const baseAlpha = Phaser.Math.FloatBetween(0.75, 1.0);
      sprite.setAlpha(baseAlpha);

      this.stars.push({
        sprite,
        x,
        y,
        vx: Phaser.Math.FloatBetween(-58, -42),
        vy: Phaser.Math.FloatBetween(14, 24),
        baseAlpha,
        twinkleSpeed: Phaser.Math.FloatBetween(3.5, 6.0),
        twinkleOffset: Math.random() * Math.PI * 2,
        layer: 3,
      });
    }
  }

  /**
   * Непрерывное перемещение и мерцание звезд с тороидальным переносом вокруг камеры
   */
  public updateStars(seconds: number, cam?: Phaser.Cameras.Scene2D.Camera): void {
    this.starAnimTimer += seconds;
    const c = cam || this.scene.cameras.main;
    const pad = 120;
    const viewW = c.worldView && c.worldView.width > 0 ? c.worldView.width : 1600;
    const viewH = c.worldView && c.worldView.height > 0 ? c.worldView.height : 900;
    const left = (c.worldView ? c.worldView.x : 0) - pad;
    const right = left + viewW + pad * 2;
    const top = (c.worldView ? c.worldView.y : 0) - pad;
    const bottom = top + viewH + pad * 2;
    const totalW = right - left;
    const totalH = bottom - top;

    for (const star of this.stars) {
      star.x += star.vx * seconds;
      star.y += star.vy * seconds;

      while (star.x < left) {
        star.x += totalW;
      }
      while (star.x > right) {
        star.x -= totalW;
      }
      while (star.y < top) {
        star.y += totalH;
      }
      while (star.y > bottom) {
        star.y -= totalH;
      }

      star.sprite.setPosition(star.x, star.y);

      const pulse = Math.sin(this.starAnimTimer * star.twinkleSpeed + star.twinkleOffset) * 0.22;
      star.sprite.setAlpha(Phaser.Math.Clamp(star.baseAlpha + pulse, 0.1, 1.0));
    }

    // Периодический полет кометы
    this.shootingStarTimer -= seconds;
    if (this.shootingStarTimer <= 0) {
      this.shootingStarTimer = Phaser.Math.FloatBetween(6.0, 13.0);
      this.spawnShootingStar();
    }
  }

  /**
   * Падающая звезда / комета в области обзора
   */
  private spawnShootingStar(): void {
    const cam = this.scene.cameras.main;
    const vx = cam.worldView ? cam.worldView.x : 0;
    const vy = cam.worldView ? cam.worldView.y : 0;
    const vw = cam.worldView ? cam.worldView.width : 1600;
    const vh = cam.worldView ? cam.worldView.height : 900;

    const startX = vx + Phaser.Math.Between(vw * 0.1, vw * 0.95);
    const startY = vy + Phaser.Math.Between(-30, vh * 0.4);
    const length = Phaser.Math.Between(180, 320);
    const angle = Phaser.Math.FloatBetween(2.2, 2.7);

    const targetX = startX + Math.cos(angle) * length;
    const targetY = startY + Math.sin(angle) * length;

    const comet = this.scene.add.line(0, 0, startX, startY, targetX, targetY, 0x67e8f9, 0.9);
    comet.setOrigin(0, 0);
    comet.setLineWidth(1.8);
    comet.setDepth(-1);

    this.scene.tweens.add({
      targets: comet,
      alpha: 0,
      duration: Phaser.Math.Between(450, 750),
      ease: 'Quad.easeOut',
      onComplete: () => comet.destroy(),
    });
  }

  /**
   * Атмосфера космоса: парящие светящиеся частицы звездной пыли
   */
  public createCosmicAtmosphere(): void {
    const stardustCount = 65;
    const cam = this.scene.cameras.main;
    const cx = cam.worldView ? cam.worldView.centerX : MAP_WIDTH / 2;
    const cy = cam.worldView ? cam.worldView.centerY : MAP_HEIGHT / 2;

    for (let i = 0; i < stardustCount; i++) {
      const x = cx + Phaser.Math.Between(-1400, 1400);
      const y = cy + Phaser.Math.Between(-900, 900);

      const sprite = this.scene.add.sprite(x, y, 'cosmic_dust_particle');
      sprite.setScale(Phaser.Math.FloatBetween(0.7, 1.5));
      sprite.setDepth(7);
      sprite.setTint(Math.random() < 0.6 ? 0x38bdf8 : 0xa78bfa);

      const baseAlpha = Phaser.Math.FloatBetween(0.25, 0.65);
      sprite.setAlpha(baseAlpha);

      this.stardust.push({
        sprite,
        vx: Phaser.Math.Between(-35, -15),
        vy: Phaser.Math.Between(5, 18),
        baseAlpha,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  // Алиас для совместимости
  public createFalloutAtmosphere(): void {
    this.createCosmicAtmosphere();
  }

  public updateCosmicAtmosphere(seconds: number, cam: Phaser.Cameras.Scene2D.Camera): void {
    this.updateStars(seconds, cam);

    // Бесшовный перенос туманностей вокруг камеры
    const camCenterX = cam.worldView ? cam.worldView.centerX : 0;
    const camCenterY = cam.worldView ? cam.worldView.centerY : 0;
    const wrapX = 2600;
    const wrapY = 2000;

    for (const cloud of this.nebulas) {
      if (cloud.x < camCenterX - wrapX) {
        cloud.x += wrapX * 2;
      } else if (cloud.x > camCenterX + wrapX) {
        cloud.x -= wrapX * 2;
      }
      if (cloud.y < camCenterY - wrapY) {
        cloud.y += wrapY * 2;
      } else if (cloud.y > camCenterY + wrapY) {
        cloud.y -= wrapY * 2;
      }
    }

    const viewLeft = cam.worldView.x - 40;
    const viewTop = cam.worldView.y - 40;
    const viewRight = cam.worldView.right + 40;
    const viewBottom = cam.worldView.bottom + 40;

    for (const dust of this.stardust) {
      dust.sprite.x += dust.vx * seconds;
      dust.sprite.y += dust.vy * seconds;
      dust.pulsePhase += seconds * 2.2;

      const alphaPulse = dust.baseAlpha + Math.sin(dust.pulsePhase) * 0.18;
      dust.sprite.setAlpha(Phaser.Math.Clamp(alphaPulse, 0.12, 0.8));

      if (dust.sprite.x < viewLeft) {
        dust.sprite.x = viewRight;
        dust.sprite.y = Phaser.Math.Between(viewTop, viewBottom);
      }
      if (dust.sprite.y > viewBottom) {
        dust.sprite.y = viewTop;
        dust.sprite.x = Phaser.Math.Between(viewLeft, viewRight);
      }
    }
  }

  // Алиас для совместимости
  public updateFalloutAtmosphere(seconds: number, cam: Phaser.Cameras.Scene2D.Camera): void {
    this.updateCosmicAtmosphere(seconds, cam);
  }

  public updateCosmicDust(seconds: number): void {
    this.updateStars(seconds);
    for (const dust of this.stardust) {
      dust.sprite.x += dust.vx * seconds;
      dust.sprite.y += dust.vy * seconds;
    }
  }

  // Алиас для совместимости
  public updateFalloutEmbers(seconds: number): void {
    this.updateCosmicDust(seconds);
  }

  public destroy(): void {
    this.reset();
  }
}

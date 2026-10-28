import Phaser from 'phaser';

/**
 * Процедурная генерация эффектов и снарядов для космического боя.
 * Создает текстуры искр, плазмы, щита и выстрелов.
 */
export function ensureGameTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('spark_particle')) {
    return;
  }

  createSparkParticleTexture(scene);
  createFireTrailPatchTexture(scene);
  createShieldAuraTexture(scene);
  createEnemyBulletTexture(scene);
}

/**
 * Частица звездной пыли, искр попаданий и взрывов.
 */
function createSparkParticleTexture(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 4);
  g.generateTexture('spark_particle', 8, 8);
  g.destroy();
}

/**
 * Плазменный след на траектории движения корабля (размер 26x14).
 */
function createFireTrailPatchTexture(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });

  // 1. Внешний ореол плазмы
  g.fillStyle(0xef4444, 0.45);
  g.fillEllipse(13, 7, 26, 14);

  // 2. Средний слой энергии
  g.fillStyle(0xf97316, 0.85);
  g.fillEllipse(13, 7, 18, 9);

  // 3. Высокотемпературное ядро
  g.fillStyle(0xfef08a, 0.98);
  g.fillEllipse(13, 7, 9, 4);

  g.generateTexture('fire_trail_patch', 26, 14);
  g.destroy();
}

/**
 * Голографический силовой щит форсажа и неуязвимости корабля (размер 72x72).
 */
function createShieldAuraTexture(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Внешний светящийся купол
  g.lineStyle(2.5, 0x38bdf8, 0.95);
  g.strokeCircle(36, 36, 32);

  // Внутреннее свечение поля
  g.fillStyle(0x06b6d4, 0.22);
  g.fillCircle(36, 36, 30);

  // Тактические маркеры силового щита
  g.lineStyle(2, 0x67e8f9, 0.9);
  g.strokeCircle(36, 36, 22);

  g.fillStyle(0xffffff, 0.85);
  g.fillRect(35, 2, 2, 6);
  g.fillRect(35, 64, 2, 6);
  g.fillRect(2, 35, 6, 2);
  g.fillRect(64, 35, 6, 2);

  g.generateTexture('shield_aura', 72, 72);
  g.destroy();
}

/**
 * Красный плазменный выстрел вражеских крейсеров (размер 22x22).
 */
function createEnemyBulletTexture(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });

  // 1. Внешний ореол плазмы
  g.fillStyle(0xef4444, 0.35);
  g.fillCircle(11, 11, 10);

  // 2. Раскаленное тело снаряда
  g.fillStyle(0xf43f5e, 0.85);
  g.fillCircle(11, 11, 6.5);

  // 3. Белое термоядерное ядро
  g.fillStyle(0xffffff, 1.0);
  g.fillCircle(11, 11, 3.2);

  g.generateTexture('enemy_bullet_red', 22, 22);
  g.destroy();
}

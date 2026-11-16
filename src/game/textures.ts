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
  createExpOrbTexture(scene);
  createScrapMetalTexture(scene);
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

/**
 * Фиолетовая голографическая сфера опыта (размер 32x32).
 */
function createExpOrbTexture(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });

  // 1. Внешний голографический ореол энергии
  g.fillStyle(0xa855f7, 0.28);
  g.fillCircle(16, 16, 15);

  // 2. Вторичное свечение силового поля
  g.fillStyle(0xc084fc, 0.48);
  g.fillCircle(16, 16, 11);

  // 3. Тонкое голографическое орбитальное кольцо
  g.lineStyle(1.5, 0xe9d5ff, 0.95);
  g.strokeCircle(16, 16, 9.5);

  // 4. Внутреннее тело концентрированного опыта
  g.fillStyle(0x9333ea, 0.92);
  g.fillCircle(16, 16, 6.5);

  // 5. Ослепительно белое энергетическое ядро
  g.fillStyle(0xffffff, 1.0);
  g.fillCircle(16, 16, 3.2);

  // 6. Тактические голографические засечки (4 маркера по краям)
  g.lineStyle(1.5, 0xffffff, 0.95);
  g.lineBetween(16, 3, 16, 6);
  g.lineBetween(16, 26, 16, 29);
  g.lineBetween(3, 16, 6, 16);
  g.lineBetween(26, 16, 29, 16);

  g.generateTexture('exp_orb_purple', 32, 32);
  g.destroy();
}

/**
 * Металлический осколок / слиток металлолома (валюта Scrap, размер 28x28).
 * Оформлен в янтарно-золотых металлических оттенках с технологическими насечками.
 */
function createScrapMetalTexture(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });

  // 1. Внешний теплый янтарный ореол металлического свечения
  g.fillStyle(0xd97706, 0.28);
  g.fillCircle(14, 14, 13);

  // 2. Вторичное свечение
  g.fillStyle(0xf59e0b, 0.45);
  g.fillCircle(14, 14, 9.5);

  // 3. Металлическая граненая пластина (шестиугольник)
  g.fillStyle(0xb45309, 0.95);
  g.beginPath();
  const radius = 7.5;
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 * Math.PI) / 180;
    const px = 14 + radius * Math.cos(angle);
    const py = 14 + radius * Math.sin(angle);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillPath();

  // 4. Внутренняя золотистая пластина со срезом
  g.fillStyle(0xfbbf24, 1.0);
  g.beginPath();
  const innerRadius = 5.2;
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 * Math.PI) / 180;
    const px = 14 + innerRadius * Math.cos(angle);
    const py = 14 + innerRadius * Math.sin(angle);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillPath();

  // 5. Ослепительно яркий металлический блик
  g.fillStyle(0xfef08a, 1.0);
  g.fillCircle(13, 12, 2.2);

  // 6. Золотая окантовка и технологические заклепки
  g.lineStyle(1.2, 0xfde68a, 0.95);
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 * Math.PI) / 180;
    const px = 14 + radius * Math.cos(angle);
    const py = 14 + radius * Math.sin(angle);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.strokePath();

  g.generateTexture('scrap_metal_icon', 28, 28);
  g.destroy();
}

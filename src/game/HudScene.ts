import Phaser from 'phaser';
import type { GameScene } from './GameScene';

/**
 * Выделенная сцена для отрисовки HUD (верхней панели, полосы босса и радара).
 * Работает со статичной камерой (zoom = 1, scroll = 0, без shake),
 * что полностью исключает дрожание текста, цифр и иконок при движении, зуме и тряске основной камеры.
 */
export class HudScene extends Phaser.Scene {
  public isCreated = false;

  constructor() {
    super({ key: 'HudScene' });
  }

  create(): void {
    this.isCreated = true;

    const cam = this.cameras.main;
    cam.setScroll(0, 0);
    cam.setZoom(1);
    cam.setRoundPixels(false);

    const gameScene = this.scene.get('GameScene') as GameScene | undefined;
    gameScene?.hudManager?.attachScene(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.isCreated = false;
    });
  }
}

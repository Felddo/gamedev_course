import Phaser from 'phaser';
import type { GameScene } from './GameScene';
import { getGameDpr } from './deviceUtils';

/**
 * Выделенная сцена для отрисовки HUD (верхней панели, полосы босса и радара).
 * Работает со статичной камерой (origin = 0,0, scroll = 0, zoom = dpr, без shake),
 * что гарантирует четкость шрифтов и графики в нативном разрешении экрана на любых устройствах.
 */
export class HudScene extends Phaser.Scene {
  public isCreated = false;

  constructor() {
    super({ key: 'HudScene' });
  }

  public syncCameraZoom(): void {
    if (!this.isCreated || !this.cameras?.main) return;
    const cam = this.cameras.main;
    cam.setOrigin(0, 0);
    cam.setScroll(0, 0);
    cam.setZoom(getGameDpr());
    cam.setRoundPixels(false);
  }

  create(): void {
    this.isCreated = true;
    this.syncCameraZoom();

    const onScaleResize = () => {
      this.syncCameraZoom();
    };
    this.scale.on('resize', onScaleResize, this);

    const gameScene = this.scene.get('GameScene') as GameScene | undefined;
    gameScene?.hudManager?.attachScene(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onScaleResize, this);
      this.isCreated = false;
    });
  }
}

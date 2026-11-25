import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { HudScene } from './HudScene';

export function createGame(parent: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#02040a',
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
    },
    scene: [GameScene, HudScene],
  };

  return new Phaser.Game(config);
}

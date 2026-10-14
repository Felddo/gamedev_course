import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { RhythmScene } from '../scenes/RhythmScene';

export function createGame(parent: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 640,
    backgroundColor: '#0f172a',
    // Первой стартует ритм-сцена; GameScene остаётся в проекте и доступна
    // по ключу 'GameScene' (this.scene.start('GameScene')).
    scene: [RhythmScene, GameScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  return new Phaser.Game(config);
}

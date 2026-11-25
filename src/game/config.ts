import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { HudScene } from './HudScene';
import { getGameDpr } from './deviceUtils';

export function createGame(parent: string): Phaser.Game {
  const parentEl = typeof document !== 'undefined' ? document.getElementById(parent) : null;
  const rect = parentEl?.getBoundingClientRect();
  const initialCssW = Math.max(1, Math.round(rect?.width || (typeof window !== 'undefined' ? window.innerWidth : 1280)));
  const initialCssH = Math.max(1, Math.round(rect?.height || (typeof window !== 'undefined' ? window.innerHeight : 720)));
  const initialDpr = getGameDpr();

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#02040a',
    antialias: true,
    antialiasGL: true,
    roundPixels: false,
    render: {
      antialias: true,
      antialiasGL: true,
      roundPixels: false,
      mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
    },
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: Math.max(1, Math.round(initialCssW * initialDpr)),
      height: Math.max(1, Math.round(initialCssH * initialDpr)),
      zoom: 1 / initialDpr,
    },
    scene: [GameScene, HudScene],
  };

  const game = new Phaser.Game(config);

  let isSyncing = false;
  const syncCanvasSize = () => {
    if (isSyncing || !game.scale || !game.canvas) return;

    const currentRect = parentEl?.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(currentRect?.width || window.innerWidth));
    const cssH = Math.max(1, Math.round(currentRect?.height || window.innerHeight));
    const nextDpr = getGameDpr();
    const targetW = Math.max(1, Math.round(cssW * nextDpr));
    const targetH = Math.max(1, Math.round(cssH * nextDpr));

    isSyncing = true;
    try {
      game.canvas.style.width = `${cssW}px`;
      game.canvas.style.height = `${cssH}px`;
      game.canvas.style.marginLeft = '0px';
      game.canvas.style.marginTop = '0px';

      const zoomChanged = Math.abs(game.scale.zoom - 1 / nextDpr) > 0.0005;
      const sizeChanged = game.scale.width !== targetW || game.scale.height !== targetH;
      if (zoomChanged || sizeChanged) {
        game.scale.zoom = 1 / nextDpr;
        game.scale.resize(targetW, targetH);
      } else {
        game.scale.updateBounds();
      }
    } finally {
      isSyncing = false;
    }
  };

  const origRefresh = game.scale.refresh.bind(game.scale);
  game.scale.refresh = ((previousWidth?: number, previousHeight?: number) => {
    if (!isSyncing) {
      syncCanvasSize();
    }
    return origRefresh(previousWidth, previousHeight);
  }) as typeof game.scale.refresh;

  game.events.once(Phaser.Core.Events.READY, syncCanvasSize);

  const onResize = () => syncCanvasSize();
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);

  const resizeObserver =
    parentEl && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => syncCanvasSize())
      : null;
  if (resizeObserver && parentEl) {
    resizeObserver.observe(parentEl);
  }

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    window.removeEventListener('resize', onResize);
    window.visualViewport?.removeEventListener('resize', onResize);
    resizeObserver?.disconnect();
  });

  return game;
}

import './menu.css';
import { geoOf, paintPicture } from '../render/painter/backdrops';
import { arenaFor } from '../sim/world';

// What every menu screen shares: the museum wall they hang on, and paintings for their frames. Screens are plain HTML over the game.
let wall = '';
export const BACK = '<svg viewBox="0 0 16 16" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.5 2.5 5 8l5.5 5.5"/></svg>'; // the back arrow

/** Show a menu screen (replacing the one before). */
export function openMenu(cls: string, html: string): HTMLElement {
  closeMenu();
  const root = document.createElement('div');
  root.id = 'menu';
  root.style.setProperty('--wall', `url(${(wall ||= paintWall())})`);
  root.innerHTML = `<div class="${cls}">${html}</div>`;
  document.body.appendChild(root);
  return root;
}
export const closeMenu = (): void => document.getElementById('menu')?.remove();

/** Paint an era's arena into a frame's canvas (with the painter the fight uses; kept in storage, so only the first visit waits). */
export function hangPicture(canvas: HTMLCanvasElement, era: string, w: number, h: number): void {
  canvas.width = w; canvas.height = h;
  paintPicture(era, geoOf(arenaFor(era, 0)), w, h).then((b) => { if (b) canvas.getContext('2d')!.drawImage(b, 0, 0, w, h); });
}

/** The wall is painted too: soft horizontal brush strokes, lighter and darker, on a tile that repeats without seams. */
function paintWall(): string { return wallTile().toDataURL(); }

/** The wall's brush strokes (a 512 px tile that wraps; laid over the wall's dark green). The fight's museum (era changes) uses it too. */
let tile: HTMLCanvasElement | null = null;
export function wallTile(): HTMLCanvasElement {
  if (tile) return tile;
  const S = 512, c = document.createElement('canvas');
  tile = c;
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * S, y = Math.random() * S, L = 60 + Math.random() * 160, bend = (Math.random() - 0.5) * 30;
    g.strokeStyle = Math.random() < 0.5 ? `rgba(130,170,140,${0.012 + Math.random() * 0.025})` : `rgba(0,0,0,${0.025 + Math.random() * 0.04})`;
    g.lineWidth = 10 + Math.random() * 26;
    for (const dx of [0, -S]) for (const dy of [0, -S, S]) { // copies across the edges, so the tile wraps
      g.beginPath(); g.moveTo(x + dx, y + dy); g.quadraticCurveTo(x + dx + L / 2, y + dy + bend, x + dx + L, y + dy + bend * 0.6); g.stroke();
    }
  }
  return c;
}

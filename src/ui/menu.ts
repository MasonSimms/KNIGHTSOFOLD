import './menu.css';
import { geoOf, paintPicture } from '../render/painter/backdrops';
import { eras } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { arenaFor } from '../sim/world';

// What every menu screen shares: the museum wall they hang on, and paintings for their frames. Screens are plain HTML over the game.
let wall = '', soon = 0; // soon: a loading screen asked for and not up yet (openLoadingSoon)
export const BACK = '<svg viewBox="0 0 16 16" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.5 2.5 5 8l5.5 5.5"/></svg>'; // the back arrow

/** Show a menu screen (replacing the one before). */
export function openMenu(cls: string, html: string): HTMLElement {
  closeMenu();
  const root = document.createElement('div');
  root.id = 'menu';
  root.style.setProperty('--wall', `url(${wallUrl()})`);
  root.innerHTML = `<div class="${cls}">${html}</div>`;
  document.body.appendChild(root);
  return root;
}
export const closeMenu = (): void => { clearTimeout(soon); document.getElementById('menu')?.remove(); };

/** Paint an era's arena (its usual one, or map `map`) into a frame's canvas (with the painter the fight uses; kept in storage, so only the
 *  first visit waits). Resolves once it is on the canvas; until then its frame shows paint being laid (menu.css .painting). */
export function hangPicture(canvas: HTMLCanvasElement, era: string, w: number, h: number, map = 0): Promise<void> {
  const frame = canvas.parentElement;
  canvas.width = w; canvas.height = h;
  frame?.classList.add('painting');
  return paintPicture(era, geoOf(arenaFor(era, map)), w, h).then((b) => { if (b) canvas.getContext('2d')!.drawImage(b, 0, 0, w, h); frame?.classList.remove('painting'); });
}

// The loading screen: the museum wall with, in the middle, a small gilt frame in which a stroke of paint is laid on again and again: no
// words. index.html shows the same one while the game itself is still arriving (#boot). It comes up as little as can be (owner,
// 2026-10-11: "way too much loading"): its picture only after 0.4 s (menu.css), a menu waits tuning.finish.loading.screenWait at most
// for its pictures, and what was on screen stays up a moment first where it can (openLoadingSoon).
const LOADER = '<div class="loading"><div class="pic lit lpic"><div class="lamp"></div><div class="frame"><div class="art"><div class="stroke"></div></div></div></div></div>';

/** The loading screen on its own (before a fight: its backdrops being painted). */
export const openLoading = (): HTMLElement => openMenu('waiting', LOADER);
/** The loading screen, but not yet: what is on screen now stays (the Hall, when a fight starts) for tuning.finish.loading.after, and if
 *  the wait is over by then (closeMenu) there is no loading screen at all. */
export function openLoadingSoon(): void { clearTimeout(soon); soon = window.setTimeout(openLoading, T.finish.loading.after * 1000); }

/** Hold a screen out of sight, behind the loading screen, until `pending` (its pictures) are done or `maxMs` has gone by, then show it:
 *  all at once if they were quick, otherwise with the late ones still being painted in their frames. Resolves false if the screen was
 *  closed meanwhile. */
export async function whenReady(root: HTMLElement, pending: Promise<unknown>[], maxMs = T.finish.loading.screenWait * 1000): Promise<boolean> {
  const screen = root.firstElementChild as HTMLElement | null;
  screen?.classList.add('unready');
  root.insertAdjacentHTML('beforeend', LOADER);
  await Promise.race([Promise.allSettled([...pending, document.fonts?.ready]), new Promise((ok) => setTimeout(ok, maxMs))]);
  if (!root.isConnected) return false;
  root.querySelector(':scope > .loading')?.remove();
  screen?.classList.remove('unready');
  bootDone();
  return true;
}

/** The game has its first screen up: the loading screen the page opened with (index.html #boot) fades away. */
export function bootDone(): void {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('gone');
  setTimeout(() => boot.remove(), 400);
}

/** Paint ahead, in the background, the pictures other screens will want (each era's maps for the training menu, each era for the
 *  highlights), so they open at once. They are kept in storage: after the first visit this costs nothing. */
export function paintAhead(): void {
  for (const e of eras) {
    for (let map = 0; map <= (e.alt?.length ?? 0); map++) void paintPicture(e.id, geoOf(arenaFor(e.id, map)), 192, 108, true);
    void paintPicture(e.id, geoOf(arenaFor(e.id, 0)), 400, 225, true);
  }
}

/** The museum wall's painted tile, as a picture address for CSS (painted once). */
export const wallUrl = (): string => (wall ||= keptWall());
const WALL_KEY = 'knights-wall'; // the painted wall, kept in the browser so the loading screen has it before the game has arrived (index.html)
function keptWall(): string {
  try { const w = localStorage.getItem(WALL_KEY); if (w) return w; } catch { /* storage blocked */ }
  const w = paintWall();
  try { localStorage.setItem(WALL_KEY, w); } catch { /* full or blocked: painted again next visit */ }
  return w;
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

// The loading screen the page opened with is on the same wall as soon as the game is here (on later visits index.html has it at once).
const boot = document.getElementById('boot');
if (boot) { boot.style.setProperty('--wall', `url(${wallUrl()})`); boot.classList.add('walled'); }

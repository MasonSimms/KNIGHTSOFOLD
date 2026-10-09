// The renderer's side of backdrop painting: asks the worker for the painted backdrop of a round (era + arena layout), keeps the last few,
// and paints the next round's ahead of time so a new round starts on a finished picture.
import { Texture } from 'pixi.js';
import { eraById } from '../../content/eras';
import { tuning as T } from '../../content/tuning';
import { wallsOf } from '../../sim/world';
import type { Arena } from '../../sim/world';
import type { PaintKnobs } from './bake';
import type { ArenaGeo } from './scene';
import type { BakeRequest, BakeResult } from './worker';

const KEEP = 6; // painted backdrops kept (each is a texture of about 3.5 MB): the one shown, the next rounds', a replay's (quick rounds: 3 an era)

/** The solid ground of an arena in design px (1920 x 1080 = the whole view). */
export function geoOf(A: Arena): ArenaGeo {
  const s = 1920 / A.viewW, slabs = (A.train || A.plane ? [] : A.ground.length ? A.ground : A.boats.length ? [] : [{ x: A.platformX, w: A.platformW }]).map((g: Arena['ground'][number]) => ({ x: g.x * s, w: g.w * s, y: (A.platformTop - (g.up ?? 0)) * s, th: (g.thick ?? A.platformThickness) * s })); // (a ship is not painted in: it moves, though a pier beside it is; nor is a train: the land moves past it; nor the ground on a plane in flight: there is none)
  const walls = wallsOf(A).map((w) => ({ x: w.x * s, w: A.wallThickness * s, top: w.top * s }));
  return { slabs, ledges: A.ledges.map((l) => ({ x: l.x * s, y: (A.platformTop - l.up) * s, w: l.w * s })), ledgeThick: A.ledgeThick * s, top: A.platformTop * s, thick: A.platformThickness * s, walls, ...(A.sea ? { sea: (A.platformTop + A.sea.level) * s } : {}) };
}

const knobsOf = (era: string): PaintKnobs => { const P = T.finish.paint, S = { ...T.finish.style, ...eraById(era).style }; return { under: P.under, relief: P.relief, bristle: P.bristle, jitter: P.jitter, dof: S.blur, haze: S.haze }; };
const newWorker = (): Worker | null => { try { return typeof OffscreenCanvas !== 'undefined' ? new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) : null; } catch { return null; } };

// Painting is slow (a 400 x 225 picture about 1 s, a backdrop about 5 s on a fast computer; owner, 2026-10-09: "loading up the game
// takes forever"). Two workers paint side by side: more did not help (the home screen's first visit: 1 worker 8.6 s, 2 7.9 s, 4 8.2 s),
// and two let the backdrop needed now start while another is being painted ahead. One on a computer with few cores.
const workersFor = (most: number) => Math.max(1, Math.min(most, (navigator.hardwareConcurrency || 4) - 2));

// One-off paintings at any size (the menus: gallery pictures and portrait backgrounds), painted by their own workers and kept in storage
// like the backdrops. Resolves null where painting in a worker is impossible.
let picWorkers: { w: Worker; jobs: number }[] | undefined;
const picWaiting = new Map<string, ((b: ImageBitmap | null) => void)[]>();
export function paintPicture(era: string, geo: ArenaGeo, w: number, h: number): Promise<ImageBitmap | null> {
  if (picWorkers === undefined) {
    picWorkers = [];
    for (let i = 0; i < workersFor(2); i++) {
      const pw = newWorker();
      if (!pw) break;
      const p = { w: pw, jobs: 0 };
      pw.addEventListener('message', (e: MessageEvent<BakeResult>) => { p.jobs--; picWaiting.get(e.data.key)?.forEach((ok) => ok(e.data.bitmap ?? null)); picWaiting.delete(e.data.key); });
      picWorkers.push(p);
    }
  }
  if (!picWorkers.length) return Promise.resolve(null);
  const knobs = knobsOf(era), key = `pic|${era}|${w}x${h}|${JSON.stringify(geo)}|${JSON.stringify(knobs)}`;
  return new Promise((ok) => {
    const list = picWaiting.get(key);
    if (list) { list.push(ok); return; }
    picWaiting.set(key, [ok]);
    const p = picWorkers!.reduce((a, b) => (b.jobs < a.jobs ? b : a)); // (the least busy)
    p.jobs++;
    p.w.postMessage({ key, era, geo, w, h, seed: 7, knobs } satisfies BakeRequest);
  });
}

export function createBackdrops() {
  const workers = Array.from({ length: workersFor(2) }, newWorker).filter((x): x is Worker => !!x), worker = workers[0] ?? null; // (two: the one needed now never waits for one only wanted soon)
  const done = new Map<string, Texture>(), pending = new Set<string>(), order: string[] = [], waiting = new Map<string, (() => void)[]>();
  // Each worker is given one backdrop at a time, so one needed now (shown, or waited for) goes ahead of ones only wanted soon (owner,
  // 2026-10-09: a round was shown on its flat stand-in while the worker was still painting rounds further ahead).
  const queue: BakeRequest[] = [];
  const idle = [...workers];
  let shown = ''; // (shown: the backdrop last asked for to draw: never the one thrown away)
  const pump = () => { while (idle.length && queue.length) idle.pop()!.postMessage(queue.shift()!); };
  const keyOf = (era: string, A: Arena) => `${era}|${JSON.stringify(geoOf(A))}|${JSON.stringify(knobsOf(era))}|${T.finish.paint.width}`;
  for (const wk of workers) wk.addEventListener('message', (e: MessageEvent<BakeResult>) => {
    const r = e.data;
    idle.push(wk);
    pump();
    pending.delete(r.key);
    waiting.get(r.key)?.forEach((ok) => ok()); waiting.delete(r.key);
    if (!r.bitmap) { console.warn('backdrop painting failed', r.error); return; }
    done.set(r.key, Texture.from(r.bitmap));
    order.push(r.key);
    while (order.length > KEEP) { const old = order.splice(Math.max(0, order.findIndex((k) => k !== shown)), 1)[0]; done.get(old)?.destroy(true); done.delete(old); }
    console.info(`backdrop ${r.key.split('|')[0]}: ${r.cached ? 'from storage' : 'painted'} in ${Math.round(r.ms)} ms`);
  });
  const request = (era: string, A: Arena, now = false) => {
    const key = keyOf(era, A);
    if (!worker || done.has(key)) return key;
    if (pending.has(key)) { const i = queue.findIndex((q) => q.key === key); if (now && i > 0) queue.unshift(...queue.splice(i, 1)); return key; } // (needed now: to the front)
    pending.add(key);
    const P = T.finish.paint, h = Math.round((P.width * 9) / 16), q: BakeRequest = { key, era, geo: geoOf(A), w: P.width, h, seed: 7, knobs: knobsOf(era) };
    if (now) queue.unshift(q); else queue.push(q);
    pump();
    return key;
  };
  return {
    /** The painted backdrop for this era and arena, or null while it is still being painted (it is requested now). */
    get(era: string, A: Arena): Texture | null { shown = request(era, A, true); return done.get(shown) ?? null; },
    /** Start painting a backdrop that will be needed soon. */
    prefetch(era: string, A: Arena) { request(era, A); },
    /** Resolves once this backdrop is painted (at once if it already is, or if painting is impossible here). */
    ready(era: string, A: Arena): Promise<void> {
      const key = request(era, A, true);
      if (!pending.has(key)) return Promise.resolve();
      return new Promise((ok) => waiting.set(key, [...(waiting.get(key) ?? []), ok]));
    },
    available: !!worker,
  };
}

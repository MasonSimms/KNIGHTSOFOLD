// The renderer's side of backdrop painting: asks the worker for the painted backdrop of a round (era + arena layout), keeps the last few,
// and paints the next round's ahead of time so a new round starts on a finished picture.
import { Texture } from 'pixi.js';
import { eraById } from '../../content/eras';
import { tuning as T } from '../../content/tuning';
import type { Arena } from '../../sim/world';
import type { PaintKnobs } from './bake';
import type { ArenaGeo } from './scene';
import type { BakeRequest, BakeResult } from './worker';

const KEEP = 4; // painted backdrops kept (each is a texture of about 3.5 MB)

/** The solid ground of an arena in design px (1920 x 1080 = the view at 100 px per metre). */
export function geoOf(A: Arena): ArenaGeo {
  const s = 100, slabs = (A.ground.length ? A.ground : [{ x: A.platformX, w: A.platformW }]).map((g) => ({ x: g.x * s, w: g.w * s }));
  const walls = [A.platformX - A.wallGap - A.wallThickness, A.platformX + A.platformW + A.wallGap].map((x) => ({ x: x * s, w: A.wallThickness * s }));
  return { slabs, ledges: A.ledges.map((l) => ({ x: l.x * s, y: (A.platformTop - l.up) * s, w: l.w * s })), top: A.platformTop * s, thick: A.platformThickness * s, walls, wallTop: A.wallTop * s };
}

const knobsOf = (era: string): PaintKnobs => { const P = T.finish.paint, S = { ...T.finish.style, ...eraById(era).style }; return { under: P.under, relief: P.relief, bristle: P.bristle, jitter: P.jitter, dof: S.blur, haze: S.haze }; };
const newWorker = (): Worker | null => { try { return typeof OffscreenCanvas !== 'undefined' ? new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) : null; } catch { return null; } };

// One-off paintings at any size (the menus: gallery pictures and portrait backgrounds), painted by their own worker and kept in storage
// like the backdrops. Resolves null where painting in a worker is impossible.
let picWorker: Worker | null | undefined;
const picWaiting = new Map<string, ((b: ImageBitmap | null) => void)[]>();
export function paintPicture(era: string, geo: ArenaGeo, w: number, h: number): Promise<ImageBitmap | null> {
  if (picWorker === undefined) {
    picWorker = newWorker();
    picWorker?.addEventListener('message', (e: MessageEvent<BakeResult>) => { picWaiting.get(e.data.key)?.forEach((ok) => ok(e.data.bitmap ?? null)); picWaiting.delete(e.data.key); });
  }
  if (!picWorker) return Promise.resolve(null);
  const knobs = knobsOf(era), key = `pic|${era}|${w}x${h}|${JSON.stringify(geo)}|${JSON.stringify(knobs)}`;
  return new Promise((ok) => {
    const list = picWaiting.get(key);
    if (list) { list.push(ok); return; }
    picWaiting.set(key, [ok]);
    picWorker!.postMessage({ key, era, geo, w, h, seed: 7, knobs } satisfies BakeRequest);
  });
}

export function createBackdrops() {
  const worker = newWorker();
  const done = new Map<string, Texture>(), pending = new Set<string>(), order: string[] = [];
  const keyOf = (era: string, A: Arena) => `${era}|${JSON.stringify(geoOf(A))}|${JSON.stringify(knobsOf(era))}|${T.finish.paint.width}`;
  worker?.addEventListener('message', (e: MessageEvent<BakeResult>) => {
    const r = e.data;
    pending.delete(r.key);
    if (!r.bitmap) { console.warn('backdrop painting failed', r.error); return; }
    done.set(r.key, Texture.from(r.bitmap));
    order.push(r.key);
    while (order.length > KEEP) { const old = order.shift()!; done.get(old)?.destroy(true); done.delete(old); }
    console.info(`backdrop ${r.key.split('|')[0]}: ${r.cached ? 'from storage' : 'painted'} in ${Math.round(r.ms)} ms`);
  });
  const request = (era: string, A: Arena) => {
    const key = keyOf(era, A);
    if (!worker || done.has(key) || pending.has(key)) return key;
    pending.add(key);
    const P = T.finish.paint, h = Math.round((P.width * 9) / 16);
    worker.postMessage({ key, era, geo: geoOf(A), w: P.width, h, seed: 7, knobs: knobsOf(era) } satisfies BakeRequest);
    return key;
  };
  return {
    /** The painted backdrop for this era and arena, or null while it is still being painted (it is requested now). */
    get(era: string, A: Arena): Texture | null { return done.get(request(era, A)) ?? null; },
    /** Start painting a backdrop that will be needed soon. */
    prefetch(era: string, A: Arena) { request(era, A); },
    available: !!worker,
  };
}

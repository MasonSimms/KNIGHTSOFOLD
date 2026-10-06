// The renderer's side of backdrop painting: asks the worker for the painted backdrop of a round (era + arena layout), keeps the last few,
// and paints the next round's ahead of time so a new round starts on a finished picture.
import { Texture } from 'pixi.js';
import { eraById } from '../../content/eras';
import { tuning as T } from '../../content/tuning';
import { wallXs } from '../../sim/world';
import type { Arena } from '../../sim/world';
import type { PaintKnobs } from './bake';
import type { ArenaGeo } from './scene';
import type { BakeRequest, BakeResult } from './worker';

const KEEP = 4; // painted backdrops kept (each is a texture of about 3.5 MB)

/** The solid ground of an arena in design px (1920 x 1080 = the whole view). */
export function geoOf(A: Arena): ArenaGeo {
  const s = 1920 / A.viewW, slabs = (A.ground.length ? A.ground : [{ x: A.platformX, w: A.platformW }]).map((g) => ({ x: g.x * s, w: g.w * s }));
  const walls = wallXs(A).map((cx) => ({ x: (cx - A.wallThickness / 2) * s, w: A.wallThickness * s }));
  return { slabs, ledges: A.ledges.map((l) => ({ x: l.x * s, y: (A.platformTop - l.up) * s, w: l.w * s })), ledgeThick: A.ledgeThick * s, top: A.platformTop * s, thick: A.platformThickness * s, walls, wallTop: A.wallTop * s };
}

export function createBackdrops() {
  let worker: Worker | null = null;
  try { worker = typeof OffscreenCanvas !== 'undefined' ? new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) : null; } catch { worker = null; }
  const done = new Map<string, Texture>(), pending = new Set<string>(), order: string[] = [];
  const knobsOf = (era: string): PaintKnobs => { const P = T.finish.paint, S = { ...T.finish.style, ...eraById(era).style }; return { under: P.under, relief: P.relief, bristle: P.bristle, jitter: P.jitter, dof: S.blur, haze: S.haze }; };
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

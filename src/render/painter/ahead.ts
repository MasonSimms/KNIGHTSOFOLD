// The page's side of the painting worker (spriteWorker.ts): pictures asked for ahead of need are painted away from the page and put in
// sprites.ts's cache, so whatever needs one later finds it painted and the page never freezes painting it. One job at a time, in order,
// an urgent one first. Where a worker cannot paint (no OffscreenCanvas: Safari before 16.4) each is painted here, at once, as before.
import { Texture } from 'pixi.js';
import { cache } from './sprites';
import { runJob } from './spriteWorker';
import type { SpriteDone, SpriteJob } from './spriteWorker';

export type PaintJob = ['makeHat' | 'paintedShape' | 'paintedCape' | 'paintedWeapon' | 'paintedCostume', unknown[]];

let worker: Worker | null | undefined, busy = false, ids = 0;
const queue: { key: string; job: SpriteJob }[] = [], asked = new Map<string, Promise<void>>(), waiting = new Map<number, () => void>();

function start(): Worker | null {
  if (worker !== undefined) return worker;
  try { worker = typeof OffscreenCanvas !== 'undefined' ? new Worker(new URL('./spriteWorker.ts', import.meta.url), { type: 'module' }) : null; } catch { worker = null; }
  worker?.addEventListener('message', (e: MessageEvent<SpriteDone>) => {
    for (const { key, tex } of e.data.out) if (!cache.has(key)) cache.set(key, tex.map(({ w, h, px }) => { // (painted here meanwhile: keep that one)
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px), w, h), 0, 0);
      return Texture.from(c);
    }));
    finish(e.data.id);
  });
  worker?.addEventListener('error', (e) => { // (it would not start: everything is painted here when needed, as before)
    console.warn('the painting worker failed', e.message);
    worker = null;
    for (const id of [...waiting.keys(), ...queue.splice(0).map((q) => q.job.id)]) finish(id);
  });
  return worker;
}
function finish(id: number): void {
  waiting.get(id)?.(); waiting.delete(id);
  busy = false;
  const q = queue.shift();
  if (q && worker) { busy = true; worker.postMessage(q.job); }
}

/** Paint this picture (a sprites.ts painter and its arguments, or makeHat [hat, headR, tint]) ahead of need: resolves once the page has
 *  it. urgent: before everything already asked for (it is wanted on screen now). */
export function prepaint([fn, args]: PaintJob, urgent = false): Promise<void> {
  const key = JSON.stringify([fn, args]), had = asked.get(key);
  if (had) {
    const at = urgent ? queue.findIndex((q) => q.key === key) : -1;
    if (at > 0) queue.unshift(...queue.splice(at, 1));
    return had;
  }
  if (!start()) { runJob(fn, args); return Promise.resolve(); }
  const id = ++ids, p = new Promise<void>((ok) => waiting.set(id, ok));
  asked.set(key, p);
  if (!busy) { busy = true; worker!.postMessage({ id, fn, args } satisfies SpriteJob); }
  else if (urgent) queue.unshift({ key, job: { id, fn, args } });
  else queue.push({ key, job: { id, fn, args } });
  return p;
}

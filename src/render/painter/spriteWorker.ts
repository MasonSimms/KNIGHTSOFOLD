// Paints the fighters' pictures (bodies, hats, capes, costumes, weapons) away from the page, so painting one never freezes it: a click on a
// hat in the Hall, the warm-up behind the menus. Each job runs the page's own painting code (sprites.ts, hat.ts) and sends back every
// picture it painted, under the same key; the page takes them in (ahead.ts) and finds them painted when it needs them.
import { Container } from 'pixi.js';
import type { Hat } from '../../content/looks';
import { makeHat } from '../hat';
import * as S from './sprites';

export interface SpriteJob { id: number; fn: string; args: unknown[] }
export interface SpriteDone { id: number; out: { key: string; tex: { w: number; h: number; px: ArrayBuffer }[] }[] }

/** A painter in sprites.ts by name, or makeHat: a hat with everything that sways on it. */
export function runJob(fn: string, args: unknown[]): void {
  if (fn === 'makeHat') { const [hat, headR, tint] = args as [Hat, number, number], k = new Container(); makeHat(hat, k, 0, 0, headR, tint); k.destroy({ children: true }); }
  else (S as unknown as Record<string, (...a: unknown[]) => unknown>)[fn](...args);
}

if (typeof document === 'undefined') self.onmessage = (e: MessageEvent<SpriteJob>) => {
  const { id, fn, args } = e.data, before = new Set(S.cache.keys());
  try { runJob(fn, args); } catch (err) { console.warn(`painting ${fn} failed`, err); }
  const out: SpriteDone['out'] = [];
  for (const [key, tex] of S.cache) if (!before.has(key)) out.push({ key, tex: tex.map((t) => { const c = t.source.resource as OffscreenCanvas; return { w: c.width, h: c.height, px: c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data.buffer }; }) });
  (self as unknown as Worker).postMessage({ id, out } satisfies SpriteDone, out.flatMap((o) => o.tex.map((t) => t.px)));
};

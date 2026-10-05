// Runs the slow backdrop painting off the main thread, so the game never stutters while a picture is being painted.
// Every finished painting is kept in the browser's storage (IndexedDB), so each backdrop is painted only once per machine.
import { paintingFor } from '../../content/paintings';
import { bakeBackdrop } from './bake';
import type { PaintKnobs } from './bake';
import type { ArenaGeo } from './scene';

const PAINTER_VERSION = 1; // bump when the painting code changes, so stored paintings are painted again

export interface BakeRequest { key: string; era: string; geo: ArenaGeo; w: number; h: number; seed: number; knobs: PaintKnobs }
export interface BakeResult { key: string; bitmap?: ImageBitmap; ms: number; cached?: boolean; error?: string }

const db: Promise<IDBDatabase | null> = new Promise((ok) => {
  try {
    const r = indexedDB.open('knights-paintings', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('backdrops');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ok(null);
  } catch { ok(null); }
});
async function load(key: string): Promise<Blob | null> {
  const d = await db;
  if (!d) return null;
  return new Promise((ok) => { const q = d.transaction('backdrops').objectStore('backdrops').get(key); q.onsuccess = () => ok((q.result as Blob) ?? null); q.onerror = () => ok(null); });
}
async function save(key: string, blob: Blob): Promise<void> {
  const d = await db;
  if (d) d.transaction('backdrops', 'readwrite').objectStore('backdrops').put(blob, key);
}

self.onmessage = async (e: MessageEvent<BakeRequest>) => {
  const r = e.data, t0 = performance.now(), post = (m: BakeResult, t: Transferable[] = []) => (self as unknown as Worker).postMessage(m, t);
  const store = `${PAINTER_VERSION}|${r.key}|${JSON.stringify(paintingFor(r.era))}`;
  try {
    const hit = await load(store);
    if (hit) { const bitmap = await createImageBitmap(hit); post({ key: r.key, bitmap, ms: performance.now() - t0, cached: true }, [bitmap]); return; }
    const data = bakeBackdrop(paintingFor(r.era), r.geo, r.w, r.h, r.seed, r.knobs);
    const c = new OffscreenCanvas(r.w, r.h);
    c.getContext('2d')!.putImageData(data, 0, 0);
    save(store, await c.convertToBlob({ type: 'image/webp', quality: 0.92 })).catch(() => { /* storage full or blocked: just paint again next time */ });
    const bitmap = c.transferToImageBitmap();
    post({ key: r.key, bitmap, ms: performance.now() - t0 }, [bitmap]);
  } catch (err) {
    post({ key: r.key, ms: performance.now() - t0, error: String(err) });
  }
};

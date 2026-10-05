// Painted body parts (port of fighter_sprite / shade_circle and the fighter stroke layers in the art package's scene.py and game.py).
// Every capsule (torso, limbs, clubs, planks) and ball (head, fist) is shaded like the package's fighters (a lit side, a shadow side with a
// cool bounce light, a cream highlight), smoothed along its form, painted over with small tapered strokes that follow the form, and relit
// for paint thickness. Three variants of each are painted with different strokes, and the renderer swaps between them ("boil").
// Painted once per shape, size and colour, then kept (small textures; nothing is painted while playing after the first build).
import { Texture } from 'pixi.js';
import { blur, licSmooth, makeRandom, newImg, relight, sobel } from './core';
import type { Img } from './core';
import { paintLayer } from './strokes';

export const PPM = 160; // texture pixels per metre (the view is 100 px per metre at 1080p)
export const VARIANTS = 3;
const PAD = 4; // px of transparent margin
const STROKE_SCALE = 1.8; // the package's fighter stroke sizes (px at 1280 wide) -> this texture

type Part = { k: 'ball'; r: number } | { k: 'cap'; r: number; hl: number };
const cache = new Map<string, Texture[]>();
const norm = (x: number, y: number, z: number) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const SPHERE_L = norm(-0.5, -0.55, 0.67); // world light, upper left and toward the viewer
const CYL_L = norm(-0.62, 0, 0.78); // a capsule is painted lit from its local left (the renderer turns or mirrors it to face the light)
const smooth = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

export interface SpriteKnobs { relief: number; bristle: number; jitter: number; under: number }

/** Three painted variants of a ball or capsule (capsule long axis vertical, lit from the left). */
export function paintedShape(s: Part, color: number, K: SpriteKnobs): Texture[] {
  const key = `${s.k}|${s.r.toFixed(3)}|${s.k === 'cap' ? s.hl.toFixed(3) : 0}|${color}|${JSON.stringify(K)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = s.r * PPM, hl = s.k === 'cap' ? s.hl * PPM : 0;
  const W = Math.ceil(2 * r + 2 * PAD), H = Math.ceil(2 * (hl + r) + 2 * PAD), cx = W / 2, cy = H / 2, N = W * H;
  const base = [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
  const img = newImg(W, H), alpha = new Float32Array(N), ang = new Float32Array(N), R = makeRandom(color ^ Math.round(r * 977 + hl * 131));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, u = x + 0.5 - cx, v0 = y + 0.5 - cy, v = v0 - Math.max(-hl, Math.min(hl, v0)); // offset from the nearest point of the spine
    const d = Math.hypot(u, v), dn = Math.min(1, d / r);
    alpha[i] = Math.min(1, Math.max(0, r - d + 0.5));
    const nz = Math.sqrt(Math.max(0, 1 - dn * dn)), nx = d > 0 ? (u / d) * dn : 0, ny = d > 0 ? (v / d) * dn : 0;
    const L = s.k === 'ball' ? SPHERE_L : CYL_L;
    const lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    const t = smooth((lam - 0.15) / 0.75);
    const rim = smooth((dn * dn - 0.55) / 0.45) * Math.max(0, Math.min(1, nx)) * (1 - t);
    const hi = Math.min(1, Math.max(0, (lam - 0.93) / 0.07)) * 0.5;
    const bounce = [0.1, 0.17, 0.2], cool = [0.95, 0.95, 1.1], cream = [1, 0.96, 0.85];
    for (let c = 0; c < 3; c++) {
      const shadow = base[c] * 0.42 * cool[c], lit = Math.min(1, base[c] * 1.12 + 0.06);
      let col = shadow * (1 - t) + lit * t + rim * bounce[c];
      col = col * (1 - hi) + cream[c] * hi;
      img.c[c][i] = col;
    }
    // strokes follow the form: along a capsule, around a ball
    ang[i] = s.k === 'ball' ? Math.atan2(v0, u) + Math.PI / 2 : Math.PI / 2 + R.normal() * 0.05;
  }
  const out = paintFlat(img, alpha, ang, vntSeed(color, r, hl), K);
  cache.set(key, out);
  return out;
}

const vntSeed = (color: number, r: number, hl: number) => (color & 0xffff) + Math.round(r * 13 + hl);

/**
 * Paint a flat, shaded picture (with its coverage `alpha` and brush direction `ang`) the way the package paints its fighters: smoothed
 * along the form, two layers of small tapered strokes, some underpaint showing through, then relit for paint thickness. Returns the
 * VARIANTS painted versions (different strokes each) as textures.
 */
function paintFlat(img: Img, alpha: Float32Array, ang: Float32Array, seed0: number, K: SpriteKnobs, variants = VARIANTS): Texture[] {
  const { w: W, h: H } = img, N = W * H;
  const smoothBase = licSmooth(img, ang, 14 * STROKE_SCALE * 0.5, 8, 0.09);
  const [ex, ey] = sobel(blur(smoothBase.c[1], W, H, 1), W, H), ed = new Float32Array(N);
  for (let i = 0; i < N; i++) ed[i] = Math.min(1, Math.hypot(ex[i], ey[i]) * 4);
  const out: Texture[] = [];
  for (let vnt = 0; vnt < variants; vnt++) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!, hb = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true })!, hr = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true })!;
    const id = ctx.createImageData(W, H);
    for (let i = 0; i < N; i++) { id.data[4 * i] = smoothBase.c[0][i] * 255; id.data[4 * i + 1] = smoothBase.c[1][i] * 255; id.data[4 * i + 2] = smoothBase.c[2][i] * 255; id.data[4 * i + 3] = 255; }
    ctx.putImageData(id, 0, 0);
    hb.fillStyle = 'rgb(77,77,77)'; hb.fillRect(0, 0, W, H);
    hr.fillStyle = '#000'; hr.fillRect(0, 0, W, H);
    const seed = vnt * 7919 + seed0, J = { jitter: K.jitter * 1.6, bristle: K.bristle * 2 };
    paintLayer(ctx, hb, hr, smoothBase, ang, { blur: 1.4, spacing: 6.5, L: 38, W: 9.5, thr: 0.12, bristles: 5, jv: 0.04, jh: 0.012, contrast: 0.06, prob: (i) => (alpha[i] > 0.5 ? Math.min(0.95, 0.65 + ed[i]) : 0) }, seed, STROKE_SCALE, J);
    paintLayer(ctx, hb, hr, img, ang, { blur: 0.6, spacing: 4.4, L: 18, W: 5.2, thr: 0.08, bristles: 3, jv: 0.035, jh: 0.01, contrast: 0.06, prob: (i) => (alpha[i] > 0.5 ? 0.8 : 0) }, seed + 1, STROKE_SCALE, J);
    const painted = ctx.getImageData(0, 0, W, H), hbd = hb.getImageData(0, 0, W, H).data, hrd = hr.getImageData(0, 0, W, H).data;
    const pimg = newImg(W, H), hbase = new Float32Array(N), hbris = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      // some smooth underpaint shows through the strokes, as in the package (UNDER)
      for (let c = 0; c < 3; c++) pimg.c[c][i] = (painted.data[4 * i + c] / 255) * (1 - K.under) + smoothBase.c[c][i] * K.under;
      hbase[i] = hbd[4 * i] / 255; hbris[i] = hrd[4 * i] / 255;
    }
    const lit = relight(pimg, hbase, hbris, 1.15 * K.relief, 0.1 * K.relief, null, 1);
    for (let i = 0; i < N; i++) {
      painted.data[4 * i] = lit.c[0][i] * 255; painted.data[4 * i + 1] = lit.c[1][i] * 255; painted.data[4 * i + 2] = lit.c[2][i] * 255;
      painted.data[4 * i + 3] = alpha[i] * 255;
    }
    ctx.putImageData(painted, 0, 0);
    out.push(Texture.from(canvas));
  }
  return out;
}

export const CAPE = { length: 0.62, top: 0.06, bottom: 0.16, hem: 0.07 }; // metres: cape length, half-width at the shoulders and at the hem, hem notch depth

/**
 * The hot-colour cape (the package's signature shape), laid out flat for a rope mesh: x runs from the shoulders (0) to the hem, y across.
 * It flares toward a jagged hem and has soft folds; strokes run down its length.
 */
export function paintedCape(color: number, K: SpriteKnobs): Texture[] {
  const key = `cape|${color}|${JSON.stringify(K)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const L = CAPE.length * PPM, Wh = CAPE.bottom * PPM, W = Math.ceil(L + 2 * PAD), H = Math.ceil(2 * Wh + 2 * PAD), cy = H / 2, N = W * H;
  const hot = [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
  const img = newImg(W, H), alpha = new Float32Array(N), ang = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, t = Math.max(0, (x - PAD) / L), hw = (CAPE.top + (CAPE.bottom - CAPE.top) * t ** 0.8) * PPM, dy = y + 0.5 - cy;
    const across = dy / Wh; // -1..1 at the widest
    const hem = L + PAD - CAPE.hem * PPM * Math.abs(Math.sin(Math.PI * 1.5 * (across + 1))); // two teeth at the hem
    const inside = Math.min(hw - Math.abs(dy), hem - x, x - PAD + 2);
    alpha[i] = Math.min(1, Math.max(0, inside + 0.5));
    const fold = Math.sin(across * Math.PI * 1.6 + t * 2.2), shade = 0.86 + 0.2 * fold - 0.12 * t; // soft folds, a little darker toward the hem
    for (let c = 0; c < 3; c++) img.c[c][i] = Math.min(1, hot[c] * shade + (fold > 0.75 ? (fold - 0.75) * 0.35 : 0));
    ang[i] = across * 0.25 * t; // down the cape, fanning out a little toward the hem
  }
  const out = paintFlat(img, alpha, ang, color & 0xfff, K);
  cache.set(key, out);
  return out;
}

/** A few painted paint splats (white, tinted when used): a cluster of blobs with drips running down. Anchor them at (0.5, 0.35). */
export function paintedSplats(K: SpriteKnobs, count = 6): Texture[] {
  const key = `splats|${count}|${JSON.stringify(K)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out: Texture[] = [];
  for (let n = 0; n < count; n++) {
    const W = 112, H = 144, cx = W / 2, cy = H * 0.35, N = W * H, R = makeRandom(9001 + n * 31);
    const c = new OffscreenCanvas(W, H), g = c.getContext('2d', { willReadFrequently: true })!;
    g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round';
    for (let i = 0; i < 16; i++) { const a = R.range(0, Math.PI * 2), d = R.range(0, 30); g.beginPath(); g.arc(cx + Math.cos(a) * d * 1.1, cy + Math.sin(a) * d, R.range(5, 17), 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 3; i++) { const x = cx + R.range(-24, 24); g.lineWidth = R.range(4, 8); g.beginPath(); g.moveTo(x, cy); g.lineTo(x + R.range(-4, 4), cy + R.range(30, 80)); g.stroke(); }
    const a0 = new Float32Array(N), d = g.getImageData(0, 0, W, H).data;
    for (let i = 0; i < N; i++) a0[i] = d[4 * i + 3] / 255;
    const a1 = blur(a0, W, H, 1.2), alpha = new Float32Array(N), img = newImg(W, H), ang = new Float32Array(N);
    const [gx, gy] = sobel(blur(a0, W, H, 4), W, H);
    for (let i = 0; i < N; i++) {
      alpha[i] = Math.min(1, Math.max(0, (a1[i] - 0.35) * 3)); // a firm but soft edge
      const lit = Math.max(-1, Math.min(1, (gx[i] * 0.6 + gy[i] * 0.8) * 2)); // the blob's rounded edge catches the light at the upper left
      for (let ch = 0; ch < 3; ch++) img.c[ch][i] = 0.86 + 0.12 * lit;
      const x = i % W, y = (i / W) | 0;
      ang[i] = y > cy + 20 ? Math.PI / 2 : Math.atan2(y - cy, x - cx) + Math.PI / 2; // drips run down, the blob is dabbed round
    }
    out.push(paintFlat(img, alpha, ang, 77 + n, K, 1)[0]); // splats lie still: one variant
  }
  cache.set(key, out);
  return out;
}

/**
 * Something on the front plane, between us and the fighters (grass, a sign): painted like the rest, base at the bottom middle.
 * `greens` = the era's foliage colours, darkest first (used for grass).
 */
export function paintedFront(kind: 'grass' | 'sign', greens: string[], K: SpriteKnobs): Texture {
  const key = `front|${kind}|${greens.join()}|${JSON.stringify(K)}`;
  const hit = cache.get(key);
  if (hit) return hit[0];
  const W = kind === 'grass' ? 220 : 200, H = kind === 'grass' ? 150 : 190, N = W * H, R = makeRandom(kind === 'grass' ? 31 : 37);
  const c = new OffscreenCanvas(W, H), g = c.getContext('2d', { willReadFrequently: true })!;
  const lean = new Float32Array(N); // brush direction per pixel, filled in as the shapes are drawn
  if (kind === 'grass') {
    for (let i = 0; i < 46; i++) { // tapered blades from the ground, the tall ones lighter (lit), bending a little
      const x = R.range(12, W - 12), h = R.range(50, H - 6), bend = R.range(-28, 28), w = R.range(5, 11), col = greens[Math.min(greens.length - 1, Math.floor((h / H) * greens.length + R.range(-1, 1)))] ?? greens[0];
      g.fillStyle = col;
      g.beginPath(); g.moveTo(x - w / 2, H); g.quadraticCurveTo(x + bend * 0.3, H - h * 0.6, x + bend, H - h); g.quadraticCurveTo(x + bend * 0.3 + w * 0.3, H - h * 0.6, x + w / 2, H); g.closePath(); g.fill();
    }
  } else { // a wooden sign on a post
    g.fillStyle = '#4A3020'; g.fillRect(W / 2 - 9, 60, 18, H - 60);
    g.fillStyle = '#7A5634'; g.fillRect(14, 14, W - 28, 74);
    g.fillStyle = '#9C7448'; g.fillRect(20, 20, W - 40, 30);
    g.fillStyle = '#5E4026'; for (const y of [40, 62]) g.fillRect(20, y, W - 40, 3);
  }
  const d = g.getImageData(0, 0, W, H).data, img = newImg(W, H), alpha = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    alpha[i] = d[4 * i + 3] / 255;
    for (let ch = 0; ch < 3; ch++) img.c[ch][i] = d[4 * i + ch] / 255;
    const y = (i / W) | 0;
    lean[i] = kind === 'grass' || y > 88 ? -Math.PI / 2 + R.normal() * 0.15 : R.normal() * 0.05; // blades and post upright, the board along its grain
  }
  const out = paintFlat(img, alpha, lean, kind === 'grass' ? 41 : 43, K, 1);
  cache.set(key, out);
  return out[0];
}

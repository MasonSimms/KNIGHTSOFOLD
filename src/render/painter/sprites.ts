// Painted body parts (port of fighter_sprite / shade_circle and the fighter stroke layers in the art package's scene.py and game.py).
// Every capsule (torso, limbs, clubs, planks) and ball (head, fist) is shaded like the package's fighters (a lit side, a shadow side with a
// cool bounce light, a cream highlight), smoothed along its form, painted over with small tapered strokes that follow the form, and relit
// for paint thickness. Three variants of each are painted with different strokes, and the renderer swaps between them ("boil").
// Painted once per shape, size and colour, then kept (small textures; nothing is painted while playing after the first build).
import { Texture } from 'pixi.js';
import { blur, licSmooth, makeRandom, newImg, relight, sobel } from './core';
import type { Img } from './core';
import { paintLayer } from './strokes';
import type { Hat } from '../../content/looks';

/** A canvas to paint on away from the page: OffscreenCanvas, or an ordinary canvas where the browser has none (Safari before 16.4). */
const offscreen = (w: number, h: number): OffscreenCanvas => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }) as unknown as OffscreenCanvas);

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
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!, hb = offscreen(W, H).getContext('2d', { willReadFrequently: true })!, hr = offscreen(W, H).getContext('2d', { willReadFrequently: true })!;
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

/** How far a hat reaches from the centre of the head, in head radii (x both ways, y up and down): the canvas it is painted on. */
const HAT_BOX = { x: 2, up: 3.1, down: 0.8 };
type Ctx = OffscreenCanvasRenderingContext2D;
/** Lit from the upper left: lighter there, darker toward the lower right of the shape centred at (x, y) with radius `rad` (canvas px). */
const lit = (g: Ctx, x: number, y: number, rad: number, light: string, base: string, dark: string) => {
  const gr = g.createRadialGradient(x - rad * 0.45, y - rad * 0.5, rad * 0.05, x, y, rad * 1.25);
  gr.addColorStop(0, light); gr.addColorStop(0.45, base); gr.addColorStop(1, dark);
  return gr;
};
const STEEL = ['#C9CFD4', '#8A929B', '#4F555C'] as const, GOLD = ['#F6DC86', '#E2B33C', '#8C6A1C'] as const;
/** The static parts of each hat (LOOKS_HANDOFF.md), drawn facing right in head radii; `P` turns a point into canvas px. The swaying parts
 *  (feather, jester points, wizard tip, veil, mane) are content/hats.ts. Returns the brush direction at a point (radians, 0 = across). */
const HAT_SHAPES: Partial<Record<Hat, (g: Ctx, P: (x: number, y: number) => [number, number], s: number, tint: number) => (x: number, y: number) => number>> = {
  helmet(g, P, s) { // a steel bucket over the whole head, a dark visor slot the eyes show through, a nose bar, breath holes
    const path = new Path2D();
    path.moveTo(...P(-1.07, 0.67)); path.lineTo(...P(-1.07, -0.7)); path.quadraticCurveTo(...P(-1.07, -1.27), ...P(0, -1.27)); path.quadraticCurveTo(...P(1.07, -1.27), ...P(1.07, -0.7)); path.lineTo(...P(1.07, 0.67)); path.closePath();
    g.fillStyle = lit(g, ...P(0, -0.3), 1.1 * s, ...STEEL); g.fill(path);
    g.fillStyle = '#17110D'; g.beginPath(); g.roundRect(...P(-0.8, -0.3), 1.68 * s, 0.56 * s, 0.12 * s); g.fill();
    g.fillStyle = STEEL[1]; g.fillRect(...P(-0.01, -0.32), 0.08 * s, 0.9 * s);
    g.fillStyle = '#2A2622'; for (const [x, y] of [[-0.62, 0.42], [-0.44, 0.5], [0.56, 0.42], [0.74, 0.5]]) { g.beginPath(); g.arc(...P(x, y), 0.055 * s, 0, Math.PI * 2); g.fill(); }
    return (x, y) => Math.atan2(y + 0.3, x) + Math.PI / 2; // round the dome
  },
  plumed(g, P, s) { // a steel kettle dome over the top half, with a brim (the feather sways)
    g.fillStyle = lit(g, ...P(0, -0.7), 1.05 * s, ...STEEL); g.beginPath(); g.arc(...P(0, -0.27), 1.02 * s, Math.PI, Math.PI * 2); g.fill();
    g.fillStyle = lit(g, ...P(0, -0.27), 1.4 * s, STEEL[1], '#737B84', STEEL[2]); g.beginPath(); g.ellipse(...P(0, -0.27), 1.33 * s, 0.13 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = GOLD[2]; g.beginPath(); g.arc(...P(0.27, -1.18), 0.1 * s, 0, Math.PI * 2); g.fill(); // the plume's socket
    return (x, y) => (y > -0.4 ? 0 : Math.atan2(y + 0.27, x) + Math.PI / 2);
  },
  crown(g, P, s) { // five gold points on a dark gold band, a red gem in the middle and two blue ones
    const pts: [number, number][] = [[-0.85, -0.95], [-0.88, -1.62], [-0.63, -1.2], [-0.42, -1.72], [-0.21, -1.2], [0, -1.85], [0.21, -1.2], [0.42, -1.72], [0.63, -1.2], [0.88, -1.62], [0.85, -0.95]];
    g.fillStyle = lit(g, ...P(0, -1.3), 1 * s, ...GOLD); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(...P(x, y)) : g.moveTo(...P(x, y)))); g.closePath(); g.fill();
    for (const [x, y] of [pts[1], pts[3], pts[5], pts[7], pts[9]]) { g.fillStyle = GOLD[0]; g.beginPath(); g.arc(...P(x, y), 0.07 * s, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = lit(g, ...P(0, -0.84), 0.9 * s, '#D9AE4A', '#A07A22', '#5E4510'); g.fillRect(...P(-0.87, -0.97), 1.74 * s, 0.26 * s);
    g.fillStyle = '#C8282A'; g.beginPath(); g.arc(...P(0, -0.84), 0.1 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2D5DB0'; for (const x of [-0.5, 0.5]) { g.beginPath(); g.arc(...P(x, -0.84), 0.07 * s, 0, Math.PI * 2); g.fill(); }
    return (_x, y) => (y < -0.97 ? Math.PI / 2 : 0); // the points upright, the band along
  },
  horns(g, P, s) { // a steel cap and band, two bone horns curving up and out from the sides
    for (const k of [-1, 1]) {
      g.fillStyle = lit(g, ...P(1.35 * k, -1), 0.9 * s, '#FFF8E8', '#EDE3CC', '#A99C80'); g.beginPath();
      g.moveTo(...P(1.0 * k, -0.25)); g.quadraticCurveTo(...P(1.9 * k, -0.6), ...P(1.75 * k, -1.75)); g.quadraticCurveTo(...P(1.3 * k, -0.8), ...P(0.62 * k, -0.62)); g.closePath(); g.fill();
    }
    g.fillStyle = lit(g, ...P(0, -0.5), 1.05 * s, ...STEEL); g.beginPath(); g.arc(...P(0, -0.1), 1.04 * s, Math.PI, Math.PI * 2); g.fill();
    g.fillStyle = lit(g, ...P(0, -0.2), 1.2 * s, STEEL[1], '#6B727A', STEEL[2]); g.fillRect(...P(-1.06, -0.3), 2.12 * s, 0.22 * s);
    return (x, y) => (Math.abs(x) > 0.95 && y < -0.3 ? Math.PI / 2 - Math.sign(x) * 0.5 : Math.atan2(y + 0.1, x) + Math.PI / 2);
  },
  jester(g, P, s) { // a gold band round the head (the three points sway)
    g.fillStyle = lit(g, ...P(0, -0.65), 1 * s, ...GOLD); g.beginPath();
    g.moveTo(...P(-0.98, -0.72)); g.quadraticCurveTo(...P(0, -0.98), ...P(0.98, -0.72)); g.lineTo(...P(0.98, -0.46)); g.quadraticCurveTo(...P(0, -0.72), ...P(-0.98, -0.46)); g.closePath(); g.fill();
    return () => 0;
  },
  wizard(g, P, s) { // an indigo cone with little cream stars on a wide brim (its tip droops on its own)
    g.fillStyle = lit(g, ...P(0, -1.2), 0.9 * s, '#6E66B0', '#4A4288', '#2C2758'); g.beginPath();
    g.moveTo(...P(-0.82, -0.74)); g.quadraticCurveTo(...P(-0.42, -1.2), ...P(-0.2, -1.87)); g.lineTo(...P(0.2, -1.87)); g.quadraticCurveTo(...P(0.42, -1.2), ...P(0.82, -0.74)); g.closePath(); g.fill();
    g.fillStyle = lit(g, ...P(0, -0.73), 1.45 * s, '#5C549C', '#3E3878', '#221E48'); g.beginPath(); g.ellipse(...P(0, -0.73), 1.4 * s, 0.16 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#F1E6CF'; for (const [x, y, r] of [[-0.32, -1.02, 0.07], [0.22, -1.28, 0.06], [0.1, -0.9, 0.05], [-0.08, -1.55, 0.05]]) { g.beginPath(); g.arc(...P(x, y), r * s, 0, Math.PI * 2); g.fill(); }
    return (_x, y) => (y < -0.85 ? Math.PI / 2 : 0);
  },
  hennin(g, P, s) { // a tall plum cone leaning up to its tip, a gold band at its base (the veil streams from the tip)
    g.fillStyle = lit(g, ...P(0.3, -1.6), 1.3 * s, '#A05A82', '#7A3A5E', '#4A2038'); g.beginPath();
    g.moveTo(...P(-0.74, -0.62)); g.quadraticCurveTo(...P(0.1, -1.7), ...P(1.07, -2.8)); g.quadraticCurveTo(...P(0.7, -1.6), ...P(0.8, -0.72)); g.closePath(); g.fill();
    g.fillStyle = lit(g, ...P(0, -0.66), 1 * s, ...GOLD); g.beginPath();
    g.moveTo(...P(-0.8, -0.5)); g.quadraticCurveTo(...P(0, -0.9), ...P(0.85, -0.6)); g.lineTo(...P(0.82, -0.78)); g.quadraticCurveTo(...P(0, -1.08), ...P(-0.76, -0.68)); g.closePath(); g.fill();
    return (_x, y) => (y < -0.8 ? Math.PI / 2 - 0.45 : 0); // along the cone
  },
  locks(g, P, s) { // brown hair over the top of the head, a ragged fringe over the forehead (the mane behind sways)
    g.fillStyle = lit(g, ...P(0, -0.5), 1.15 * s, '#A0703E', '#7A4E28', '#4E3016'); g.beginPath();
    g.moveTo(...P(-1.1, 0.4)); g.arc(...P(0, 0), 1.09 * s, Math.PI * 0.97, Math.PI * 2 - 0.3);
    for (const [x, y] of [[0.84, -0.48], [0.7, -0.36], [0.52, -0.56], [0.32, -0.44], [0.12, -0.62], [-0.12, -0.5], [-0.36, -0.66], [-0.58, -0.42], [-0.72, -0.05], [-0.92, 0.42]]) g.lineTo(...P(x, y));
    g.closePath(); g.fill();
    return () => Math.PI / 2; // hair hangs
  },
  cap(g, P, s, tint) { // a peaked cap in a darker shade of the player's colour, the peak to the face side, a button on top
    const c = hex(mixHex(tint, 0, 0.3)), l = hex(mixHex(tint, 0xffffff, 0.12)), d = hex(mixHex(tint, 0, 0.55));
    g.fillStyle = lit(g, ...P(0.6, -0.26), 0.8 * s, c, c, d); g.beginPath(); g.moveTo(...P(0.3, -0.36)); g.quadraticCurveTo(...P(1.2, -0.42), ...P(1.58, -0.2)); g.quadraticCurveTo(...P(1.1, -0.12), ...P(0.3, -0.12)); g.closePath(); g.fill();
    g.fillStyle = lit(g, ...P(0, -0.7), 1.02 * s, l, c, d); g.beginPath(); g.arc(...P(0, -0.2), 1.02 * s, Math.PI, Math.PI * 2); g.fill();
    g.fillStyle = d; g.beginPath(); g.arc(...P(0, -1.22), 0.09 * s, 0, Math.PI * 2); g.fill();
    return (x, y) => (y > -0.42 && x > 0.3 ? 0 : Math.atan2(y + 0.2, x) + Math.PI / 2);
  },
  tophat(g, P, s, tint) { // a black stovepipe on a black brim, a band in the player's colour, a faint highlight down one side
    g.fillStyle = lit(g, ...P(-0.2, -1.6), 1 * s, '#3A3A3E', '#222224', '#0E0E10'); g.fillRect(...P(-0.68, -2.35), 1.36 * s, 1.52 * s);
    g.fillStyle = 'rgba(200,200,210,0.28)'; g.fillRect(...P(-0.52, -2.3), 0.12 * s, 1.18 * s);
    g.fillStyle = lit(g, ...P(0, -1.0), 0.8 * s, hex(mixHex(tint, 0xffffff, 0.15)), hex(tint), hex(mixHex(tint, 0, 0.4))); g.fillRect(...P(-0.68, -1.12), 1.36 * s, 0.26 * s);
    g.fillStyle = lit(g, ...P(0, -0.84), 1.25 * s, '#38383C', '#1E1E20', '#0A0A0C'); g.beginPath(); g.ellipse(...P(0, -0.84), 1.2 * s, 0.13 * s, 0, 0, Math.PI * 2); g.fill();
    return (_x, y) => (y < -0.95 ? Math.PI / 2 : 0);
  },
  cowboy(g, P, s) { // a leather crown with a pinched dent, a dark band, a wide curled brim low over the brow
    g.fillStyle = lit(g, ...P(0, -1.3), 0.9 * s, '#B08A5C', '#8A6A44', '#4E3A22'); g.beginPath();
    g.moveTo(...P(-0.72, -0.86)); g.lineTo(...P(-0.66, -1.62)); g.quadraticCurveTo(...P(-0.35, -1.8), ...P(0, -1.56)); g.quadraticCurveTo(...P(0.35, -1.8), ...P(0.66, -1.62)); g.lineTo(...P(0.72, -0.86)); g.closePath(); g.fill();
    g.fillStyle = '#4A3220'; g.fillRect(...P(-0.72, -1.06), 1.44 * s, 0.18 * s);
    g.fillStyle = lit(g, ...P(0, -0.8), 1.7 * s, '#A07C50', '#7A5C3A', '#3E2C18'); g.beginPath();
    g.moveTo(...P(-1.67, -1.02)); g.quadraticCurveTo(...P(-1.1, -0.82), ...P(0, -0.86)); g.quadraticCurveTo(...P(1.1, -0.82), ...P(1.67, -1.02)); g.quadraticCurveTo(...P(1.3, -0.62), ...P(0, -0.66)); g.quadraticCurveTo(...P(-1.3, -0.62), ...P(-1.67, -1.02)); g.closePath(); g.fill();
    return (_x, y) => (y < -1.06 ? Math.PI / 2 : 0);
  },
  beanie(g, P, s, tint) { // a ribbed knit dome in the player's colour, a darker ribbed cuff (the pom-pom bounces on its own)
    g.fillStyle = lit(g, ...P(0, -0.75), 1.05 * s, hex(mixHex(tint, 0xffffff, 0.15)), hex(tint), hex(mixHex(tint, 0, 0.45))); g.beginPath(); g.arc(...P(0, -0.25), 1.05 * s, Math.PI, Math.PI * 2); g.fill();
    g.strokeStyle = hex(mixHex(tint, 0, 0.3)); g.lineWidth = 0.05 * s;
    for (let x = -0.8; x <= 0.81; x += 0.2) { g.beginPath(); g.moveTo(...P(x, -0.4)); g.lineTo(...P(x * 0.6, -0.25 - Math.sqrt(Math.max(0, 1.1 - x * x)) * 0.95)); g.stroke(); }
    g.fillStyle = lit(g, ...P(0, -0.3), 1.1 * s, hex(mixHex(tint, 0, 0.15)), hex(mixHex(tint, 0, 0.3)), hex(mixHex(tint, 0, 0.55))); g.fillRect(...P(-1.07, -0.47), 2.14 * s, 0.32 * s);
    g.fillStyle = hex(mixHex(tint, 0, 0.45)); for (let x = -1.0; x <= 1.0; x += 0.14) g.fillRect(...P(x, -0.47), 0.04 * s, 0.32 * s);
    return (x, y) => (y > -0.47 ? Math.PI / 2 : Math.PI / 2 + x * 0.4); // the knit runs up the dome
  },
  ponytail(g, P, s) { // an auburn cap of hair, tied high at the back with a small ultramarine band (the tail swings)
    hairCap(g, P, s, ['#B05A34', '#8A3A1E', '#5A2210'], -0.42);
    g.fillStyle = '#2D5DB0'; g.beginPath(); g.ellipse(...P(-0.93, -0.5), 0.12 * s, 0.17 * s, 0.4, 0, Math.PI * 2); g.fill();
    return () => Math.PI / 2;
  },
  braid(g, P, s) { // blonde hair with darker strands (the plait hangs down the back)
    hairCap(g, P, s, ['#ECCB78', '#D8B35A', '#9A7A30'], -0.45);
    g.strokeStyle = '#C79A44'; g.lineWidth = 0.04 * s;
    for (const y of [-0.95, -0.75, -0.55]) { g.beginPath(); g.moveTo(...P(0.7, y + 0.35)); g.quadraticCurveTo(...P(0, y - 0.25), ...P(-0.88, 0.05)); g.stroke(); }
    return () => Math.PI / 2;
  },
  pigtails(g, P, s) { // ginger hair with a centre parting, gold ties at the sides (the bunches bounce)
    hairCap(g, P, s, ['#F0904A', '#D8732E', '#9A4A18'], -0.4);
    g.strokeStyle = '#9A4A18'; g.lineWidth = 0.05 * s; g.beginPath(); g.moveTo(...P(0.05, -1.08)); g.quadraticCurveTo(...P(0.2, -0.85), ...P(0.18, -0.55)); g.stroke();
    g.fillStyle = lit(g, ...P(0, -0.33), 1 * s, ...GOLD); for (const x of [-0.97, 0.97]) { g.beginPath(); g.arc(...P(x, -0.33), 0.13 * s, 0, Math.PI * 2); g.fill(); }
    return () => Math.PI / 2;
  },
  topknot(g, P, s) { // black hair at the sides and back, a small folded knot on top with a gold tie
    hairCap(g, P, s, ['#3A3028', '#1E1712', '#0A0705'], -0.5);
    g.fillStyle = '#1E1712';
    g.beginPath(); g.ellipse(...P(-0.02, -1.13), 0.2 * s, 0.13 * s, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.roundRect(...P(-0.08, -1.36), 0.5 * s, 0.17 * s, 0.08 * s); g.fill();
    g.fillStyle = GOLD[1]; g.fillRect(...P(-0.06, -1.27), 0.1 * s, 0.22 * s);
    return (_x, y) => (y < -1.05 ? 0 : Math.PI / 2);
  },
  fubo(g, P, s) { // the owner's named style: a full black mop with volume on top and a middle part, sides over the ears (the curtain bangs and flyaways sway)
    hairCap(g, P, s, ['#3E342A', '#1A1512', '#0A0806'], -0.55);
    g.fillStyle = lit(g, ...P(0, -0.95), 1.1 * s, '#3E342A', '#1A1512', '#0A0806'); g.beginPath(); g.ellipse(...P(-0.05, -0.9), 0.95 * s, 0.42 * s, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3E342A'; g.lineWidth = 0.035 * s;
    for (const [x0, x1] of [[-0.75, -0.55], [-0.4, -0.3], [0.35, 0.5]]) { g.beginPath(); g.moveTo(...P(x0, -1.05)); g.quadraticCurveTo(...P((x0 + x1) / 2, -0.75), ...P(x1, -0.4)); g.stroke(); } // strand highlights
    g.strokeStyle = '#0A0806'; g.lineWidth = 0.05 * s; g.beginPath(); g.moveTo(...P(0.02, -1.28)); g.lineTo(...P(0.05, -0.9)); g.stroke(); // the middle part
    return () => Math.PI / 2;
  },
  afro(g, P, s) { // the hairline over the brow (the cloud of curls is behind the head: HAT_BACKS)
    g.fillStyle = lit(g, ...P(0, -0.8), 1 * s, '#6A4428', '#4A2E1A', '#26160A'); g.beginPath();
    g.arc(...P(0, 0), 1.03 * s, Math.PI + 0.62, Math.PI * 2 - 0.62); g.quadraticCurveTo(...P(0, -0.5), ...P(-0.84, -0.6)); g.closePath(); g.fill();
    return () => 0;
  },
};

/** A cap of hair over the top of the head and down the back, with a smooth hairline over the brow at `brow` (head radii). */
function hairCap(g: Ctx, P: (x: number, y: number) => [number, number], s: number, c: readonly [string, string, string], brow: number): void {
  g.fillStyle = lit(g, ...P(0, -0.55), 1.15 * s, ...c); g.beginPath();
  g.moveTo(...P(-1.07, 0.15)); g.arc(...P(0, 0), 1.08 * s, Math.PI * 0.96, Math.PI * 2 - 0.36);
  g.quadraticCurveTo(...P(0.55, brow - 0.08), ...P(0.1, brow - 0.12)); g.quadraticCurveTo(...P(-0.55, brow - 0.1), ...P(-0.8, 0.05)); g.closePath(); g.fill();
}
/** Static parts drawn behind the head: the afro's cloud of curls (about 1.25 r round, centred 0.75 r above the head's centre). */
const HAT_BACKS: Partial<Record<Hat, (g: Ctx, P: (x: number, y: number) => [number, number], s: number, tint: number) => (x: number, y: number) => number>> = {
  afro(g, P, s) {
    const R = makeRandom(4513);
    g.fillStyle = lit(g, ...P(0, -0.75), 1.4 * s, '#6A4428', '#4A2E1A', '#26160A'); g.beginPath(); g.arc(...P(0, -0.75), 1.05 * s, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 16; i++) { // curls round the rim
      const a = (i / 16) * Math.PI * 2, x = Math.cos(a) * 1.0, y = -0.75 + Math.sin(a) * 0.95;
      g.fillStyle = lit(g, ...P(x, y), 0.45 * s, '#7A5232', '#4A2E1A', '#26160A'); g.beginPath(); g.arc(...P(x, y), R.range(0.3, 0.42) * s, 0, Math.PI * 2); g.fill();
    }
    return (x, y) => Math.atan2(y + 0.75, x) + Math.PI / 2; // dabbed round the curls
  },
};
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const mixHex = (a: number, b: number, t: number) => { const ch = (k: number) => Math.round(((a >> k) & 255) + (((b >> k) & 255) - ((a >> k) & 255)) * t); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
/** Hats painted in the player's own colour. */
const TINTED = new Set<Hat>(['cap', 'tophat', 'beanie']);

/** A hat's static parts (dome, cone, band, fringe), painted like the fighters: 3 variants for the boil. Sized for a head of radius `headR`
 *  metres; `tint` = the player's colour (the cap, top hat and beanie use it); `back` = the part behind the head (the afro's curls).
 *  Anchor the sprite at (ax, ay), the centre of the head. Null when there is nothing to paint (Bare, a mohawk's bare head). */
export function paintedHat(hat: Hat, headR: number, tint: number, K: SpriteKnobs, back = false): { tex: Texture[]; ax: number; ay: number } | null {
  const draw = (back ? HAT_BACKS : HAT_SHAPES)[hat];
  if (!draw) return null;
  if (!TINTED.has(hat)) tint = 0;
  const s = headR * PPM, W = Math.ceil(2 * HAT_BOX.x * s + 2 * PAD), H = Math.ceil((HAT_BOX.up + HAT_BOX.down) * s + 2 * PAD), ox = PAD + HAT_BOX.x * s, oy = PAD + HAT_BOX.up * s;
  const key = `hat|${hat}|${back}|${tint}|${headR.toFixed(3)}|${JSON.stringify(K)}`, hit = cache.get(key);
  if (hit) return { tex: hit, ax: ox / W, ay: oy / H };
  const N = W * H, g = offscreen(W, H).getContext('2d', { willReadFrequently: true })!;
  const along = draw(g, (x, y) => [ox + x * s, oy + y * s], s, tint);
  const d = g.getImageData(0, 0, W, H).data, img = newImg(W, H), alpha = new Float32Array(N), ang = new Float32Array(N), R = makeRandom(hat.length * 7919 + Math.round(s));
  for (let i = 0; i < N; i++) {
    alpha[i] = d[4 * i + 3] / 255;
    for (let c = 0; c < 3; c++) img.c[c][i] = d[4 * i + c] / 255;
    ang[i] = along((i % W - ox) / s, (((i / W) | 0) - oy) / s) + R.normal() * 0.05;
  }
  const out = paintFlat(img, alpha, ang, 3001 + hat.length * 31, K);
  cache.set(key, out);
  return { tex: out, ax: ox / W, ay: oy / H };
}

/**
 * The strip a swaying part is drawn with (a feather, a jester point, a veil, a lock of hair), laid out flat for a rope mesh: x runs from the
 * root to the tip, y across (its height is the widest it gets). Narrowing from `width[0]` to `width[1]` head radii, lit along its top edge,
 * the second colour down its middle (a quill, a lighter strand) or, braided, in alternating lumps. Strokes run along it. Sized for a head
 * of radius `headR` metres.
 */
export function paintedStrip(d: { length: number; width: [number, number]; colors: [string, string?]; braided?: boolean }, headR: number, K: SpriteKnobs): Texture[] {
  const key = `strip|${d.length}|${d.width}|${d.colors}|${!!d.braided}|${headR.toFixed(3)}|${JSON.stringify(K)}`, hit = cache.get(key);
  if (hit) return hit;
  const s = headR * PPM, L = d.length * s, W = Math.ceil(L + 2 * PAD), H = Math.ceil(Math.max(d.width[0], d.width[1]) * s + 2 * PAD), cy = H / 2, N = W * H;
  const a = rgb(d.colors[0]), b = rgb(d.colors[1] ?? d.colors[0]), img = newImg(W, H), alpha = new Float32Array(N), ang = new Float32Array(N), lumps = Math.max(3, Math.round(d.length * 4));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, t = Math.min(1, Math.max(0, (x - PAD) / L)), dy = y + 0.5 - cy;
    let hw = ((d.width[0] + (d.width[1] - d.width[0]) * t) * s) / 2;
    if (d.braided) hw *= 0.82 + 0.18 * Math.abs(Math.sin((t * lumps + (dy < 0 ? 0.5 : 0)) * Math.PI)); // the plait's lumps, offset side to side
    alpha[i] = Math.min(1, Math.max(0, hw - Math.abs(dy) + 0.5)) * Math.min(1, Math.max(0, x - PAD + 1)) * Math.min(1, Math.max(0, PAD + L - x + 1));
    const across = hw > 0 ? dy / hw : 0, second = d.braided ? Math.floor(t * lumps + (dy < 0 ? 0.5 : 0)) % 2 === 1 : Math.abs(across) < 0.2;
    const shade = 1.08 - 0.28 * (across + 1) / 2; // lit along the top edge
    for (let c = 0; c < 3; c++) img.c[c][i] = Math.min(1, (second ? b : a)[c] * shade);
    ang[i] = across * 0.15; // along the strip
  }
  const out = paintFlat(img, alpha, ang, 6007 + Math.round(L), K);
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
    const c = offscreen(W, H), g = c.getContext('2d', { willReadFrequently: true })!;
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

/** A few painted streaks of paint (white, tinted when used): a thick round head thinning to a tail, with drops along it. Anchor at (0, 0.5): the head is where it starts. */
export function paintedStreaks(K: SpriteKnobs, count = 4): Texture[] {
  const key = `streaks|${count}|${JSON.stringify(K)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out: Texture[] = [];
  for (let n = 0; n < count; n++) {
    const W = 260, H = 44, cy = H / 2, N = W * H, R = makeRandom(7001 + n * 17);
    const c = offscreen(W, H), g = c.getContext('2d', { willReadFrequently: true })!;
    g.fillStyle = '#fff';
    g.beginPath(); // a tapered body: full width at the head, a thin wavy tail
    const head = R.range(14, 18), tail = R.range(1.5, 3), wob = R.range(0.5, 2.5);
    for (let x = 8; x <= W - 6; x += 4) { const t = (x - 8) / (W - 14), w = head * (1 - t) ** 0.8 + tail * t; g.lineTo(x, cy - w + Math.sin(t * 9 + n) * wob); }
    for (let x = W - 6; x >= 8; x -= 4) { const t = (x - 8) / (W - 14), w = head * (1 - t) ** 0.8 + tail * t; g.lineTo(x, cy + w + Math.sin(t * 9 + n) * wob); }
    g.closePath(); g.fill();
    g.beginPath(); g.arc(14, cy, head + 1, 0, Math.PI * 2); g.fill(); // the round head
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(R.range(60, W - 10), cy + R.range(-14, 14), R.range(1.5, 4), 0, Math.PI * 2); g.fill(); } // drops thrown off it
    const a0 = new Float32Array(N), d = g.getImageData(0, 0, W, H).data;
    for (let i = 0; i < N; i++) a0[i] = d[4 * i + 3] / 255;
    const a1 = blur(a0, W, H, 1), alpha = new Float32Array(N), img = newImg(W, H), ang = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      alpha[i] = Math.min(1, Math.max(0, (a1[i] - 0.3) * 3));
      const y = (i / W) | 0, lit = Math.max(-1, Math.min(1, (cy - y) / cy)); // the top edge catches the light
      for (let ch = 0; ch < 3; ch++) img.c[ch][i] = 0.86 + 0.1 * lit;
      ang[i] = 0; // strokes along the streak
    }
    out.push(paintFlat(img, alpha, ang, 91 + n, K, 1)[0]); // (paint lies still: one variant)
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
  const c = offscreen(W, H), g = c.getContext('2d', { willReadFrequently: true })!;
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

const SEA_PPM = 60; // texture pixels per metre for the ship and the water (big pictures: painted at a little under screen size)
const rgb = (s: string) => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];

/** Which colours a ship is painted in (the era painting's ground colours, and its hot accent for the pennant). */
export interface HullPaint { face: string; dark: string; lip: string; lipdark: string; seam: string; hot: string }

/**
 * A ship seen from the side (Pirates: Ship Deck), painted like the rest: the hull below the deck (the same outline as its physics body:
 * straight sides to just under the waterline, then in to the keel), the far rail behind the deck, and a mast with its furled sail,
 * crow's nest and rigging. `w`, `depth` and `water` (the waterline below the deck) in metres. Returns the texture and where the hull's
 * middle (its physics body) sits in it, as an anchor (0..1).
 */
export function paintedHull(w: number, depth: number, water: number, c: HullPaint, K: SpriteKnobs): { tex: Texture; ax: number; ay: number; ppm: number } {
  const key = `hull|${w}|${depth}|${water}|${JSON.stringify(c)}|${JSON.stringify(K)}`, k = SEA_PPM, mastH = 5.2, up = mastH + 0.5, pad = 6;
  const W = Math.ceil(w * k + 2 * pad), H = Math.ceil((up + depth) * k + 2 * pad), N = W * H;
  const ax = (pad + (w / 2) * k) / W, ay = (pad + (up + depth / 2) * k) / H;
  const hit = cache.get(key);
  if (hit) return { tex: hit[0], ax, ay, ppm: k };
  const X = (m: number) => pad + m * k, Y = (m: number) => pad + (up + m) * k; // metres along the deck from its left end; metres below the deck
  const g = offscreen(W, H).getContext('2d', { willReadFrequently: true })!;
  const poly = (pts: number[][], fill: string) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath(); g.fill(); };
  const mx = w * 0.46, side = water + 0.35;
  // rigging, mast, yard, furled sail, crow's nest, pennant (above the deck, behind the fighters)
  g.strokeStyle = '#3A2A1C'; g.lineWidth = 2;
  for (const [x0, y0, x1, y1] of [[mx, -mastH, w * 0.06, -0.45], [mx, -mastH, w * 0.94, -0.45], [mx - 1.6, -mastH + 0.7, w * 0.2, -0.45], [mx + 1.6, -mastH + 0.7, w * 0.8, -0.45]]) { g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke(); }
  poly([[mx - 0.09, -mastH], [mx + 0.09, -mastH], [mx + 0.11, 0], [mx - 0.11, 0]], '#4A3020');
  poly([[mx - 1.7, -mastH + 0.64], [mx + 1.7, -mastH + 0.64], [mx + 1.7, -mastH + 0.76], [mx - 1.7, -mastH + 0.76]], '#4A3020');
  g.fillStyle = '#E6D8B8'; g.beginPath(); g.ellipse(X(mx), Y(-mastH + 0.9), 1.55 * k, 0.2 * k, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#C8B48E'; g.beginPath(); g.ellipse(X(mx), Y(-mastH + 0.97), 1.4 * k, 0.1 * k, 0, 0, Math.PI); g.fill();
  poly([[mx - 0.36, -mastH + 1.55], [mx + 0.36, -mastH + 1.55], [mx + 0.3, -mastH + 1.9], [mx - 0.3, -mastH + 1.9]], c.lipdark);
  poly([[mx + 0.09, -mastH - 0.05], [mx + 0.95, -mastH + 0.12], [mx + 0.09, -mastH + 0.3]], c.hot);
  // the far rail: a cap rail on posts, behind the deck
  for (let x = 0.1; x < w; x += 0.38) poly([[x, -0.45], [x + 0.05, -0.45], [x + 0.05, 0], [x, 0]], c.lipdark);
  poly([[0, -0.5], [w, -0.5], [w, -0.42], [0, -0.42]], c.lip);
  // the hull: planks, a gold wale, gunports, a darker bottom below the waterline, the gunwale the fighters stand on
  poly([[0, 0], [w, 0], [w, side], [w * 0.9, depth], [w * 0.08, depth], [0, side]], c.face);
  g.save(); g.beginPath(); [[0, 0], [w, 0], [w, side], [w * 0.9, depth], [w * 0.08, depth], [0, side]].forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath(); g.clip();
  g.fillStyle = c.dark; g.fillRect(0, Y(water - 0.05), W, H);
  g.fillStyle = c.seam; for (let y = 0.22; y < depth; y += 0.22) g.fillRect(0, Y(y), W, 2);
  g.fillStyle = '#B8893A'; g.fillRect(0, Y(0.14), W, 0.1 * k);
  for (let x = 0.9; x < w - 0.5; x += 1.55) { poly([[x - 0.03, 0.33], [x + 0.31, 0.33], [x + 0.31, 0.63], [x - 0.03, 0.63]], c.lipdark); poly([[x, 0.36], [x + 0.28, 0.36], [x + 0.28, 0.6], [x, 0.6]], '#1A120C'); }
  g.restore();
  poly([[0, -0.03], [w, -0.03], [w, 0.07], [0, 0.07]], c.lip);
  const d = g.getImageData(0, 0, W, H).data, img = newImg(W, H), alpha = new Float32Array(N), ang = new Float32Array(N), R = makeRandom(53);
  for (let i = 0; i < N; i++) {
    alpha[i] = d[4 * i + 3] / 255;
    for (let ch = 0; ch < 3; ch++) img.c[ch][i] = d[4 * i + ch] / 255;
    const x = i % W, y = (i / W) | 0, mast = Math.abs(x - X(mx)) < 0.15 * k && y < Y(0) && y > Y(-mastH + 0.6);
    ang[i] = (mast ? Math.PI / 2 : 0) + R.normal() * 0.04; // planks along their length, the mast up and down
  }
  const out = paintFlat(img, alpha, ang, 61, K, 1); // a ship lies still: one variant
  cache.set(key, out);
  return { tex: out[0], ax, ay, ppm: k };
}

/** The near water (in front of the play plane): `w` x `h` metres, light at the top to deep at the bottom, with light catching the swell. */
export function paintedWater(w: number, h: number, top: string, deep: string, foam: string, K: SpriteKnobs): { tex: Texture; ppm: number } {
  const key = `water|${w}|${h}|${top}|${deep}|${foam}|${JSON.stringify(K)}`, k = SEA_PPM * 0.6;
  const hit = cache.get(key);
  if (hit) return { tex: hit[0], ppm: k };
  const W = Math.ceil(w * k), H = Math.ceil(h * k), N = W * H, R = makeRandom(67), a = rgb(top), b = rgb(deep), f = rgb(foam);
  const img = newImg(W, H), alpha = new Float32Array(N).fill(1), ang = new Float32Array(N);
  for (let i = 0; i < N; i++) { const t = Math.min(1, ((i / W) | 0) / H * 1.4); for (let ch = 0; ch < 3; ch++) img.c[ch][i] = a[ch] + (b[ch] - a[ch]) * t; ang[i] = R.normal() * 0.05; }
  for (let s = 0; s < 140; s++) { // streaks of light on the swell, more near the top
    const y = Math.floor(H * R.range(0, 1) ** 1.8), x0 = Math.floor(R.range(-20, W)), len = Math.floor(R.range(20, 90)), th = R.range(1, 3), amt = R.range(0.25, 0.6) * (1 - y / H);
    for (let dy = 0; dy < th; dy++) for (let x = Math.max(0, x0); x < Math.min(W, x0 + len); x++) { const i = (y + dy) * W + x; if (i < N) for (let ch = 0; ch < 3; ch++) img.c[ch][i] += (f[ch] - img.c[ch][i]) * amt; }
  }
  const out = paintFlat(img, alpha, ang, 71, K, 1);
  cache.set(key, out);
  return { tex: out[0], ppm: k };
}

/**
 * The painting's gilded frame (owner: a thin gold frame around the game, like a painting frame): one strip of carved moulding, `w` long
 * and `h` across, painted like the rest. Across it, from the outside: a dark outer edge, a bright rounded gold bead with a row of carved
 * dots, a flat, and a dark inner lip against the picture. It tiles along each side of the frame.
 */
export function paintedMoulding(K: SpriteKnobs, w = 256, h = 28): Texture {
  const key = `moulding|${w}|${h}|${JSON.stringify(K)}`;
  const hit = cache.get(key);
  if (hit) return hit[0];
  const N = w * h, img = newImg(w, h), alpha = new Float32Array(N).fill(1), ang = new Float32Array(N), R = makeRandom(83);
  const stops: [number, number[]][] = [[0, [0.29, 0.2, 0.07]], [0.12, [0.55, 0.4, 0.14]], [0.3, [0.96, 0.82, 0.5]], [0.45, [0.78, 0.6, 0.27]], [0.62, [0.62, 0.47, 0.2]], [0.8, [0.86, 0.71, 0.4]], [0.9, [0.4, 0.28, 0.09]], [1, [0.2, 0.13, 0.04]]];
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    let i = 0;
    while (i < stops.length - 2 && stops[i + 1][0] < v) i++;
    const [v0, c0] = stops[i], [v1, c1] = stops[i + 1], t = Math.min(1, Math.max(0, (v - v0) / (v1 - v0)));
    for (let x = 0; x < w; x++) {
      const p = y * w + x, bead = v > 0.2 && v < 0.42 ? 0.12 * Math.cos(((x % 16) / 16) * Math.PI * 2) : 0; // a row of carved beads
      for (let ch = 0; ch < 3; ch++) img.c[ch][p] = Math.min(1, c0[ch] + (c1[ch] - c0[ch]) * t + bead + (R.range(-1, 1) * 0.03));
      ang[p] = 0;
    }
  }
  const out = paintFlat(img, alpha, ang, 97, K, 1);
  cache.set(key, out);
  return out[0];
}

/** A painted block (a stone, a crate, a pane, a sign): flat-lit, its upper-left edges catching the light and its lower-right ones in shade, strokes along its length. */
export function paintedBox(hw: number, hh: number, color: number, K: SpriteKnobs): Texture[] {
  const key = `box|${hw.toFixed(3)}|${hh.toFixed(3)}|${color}|${JSON.stringify(K)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const k = Math.min(PPM, 600 / Math.max(hw, hh) / 2); // (a big block is painted coarser: a tunnel mouth is 9 m tall)
  const W = Math.ceil(2 * hw * k + 2 * PAD), H = Math.ceil(2 * hh * k + 2 * PAD), N = W * H, cx = W / 2, cy = H / 2;
  const base = [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
  const img = newImg(W, H), alpha = new Float32Array(N), ang = new Float32Array(N), R = makeRandom(color ^ Math.round(hw * 911 + hh * 77));
  const bevel = Math.max(2, Math.min(hw, hh) * k * 0.18);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, u = Math.abs(x + 0.5 - cx) - hw * k, v = Math.abs(y + 0.5 - cy) - hh * k;
    alpha[i] = Math.min(1, Math.max(0, 0.5 - Math.max(u, v)));
    const left = Math.max(0, 1 - (x - PAD) / bevel), top = Math.max(0, 1 - (y - PAD) / bevel), right = Math.max(0, 1 - (W - PAD - x) / bevel), bottom = Math.max(0, 1 - (H - PAD - y) / bevel);
    const light = 0.92 + 0.28 * Math.max(left, top) - 0.32 * Math.max(right, bottom) + R.range(-0.03, 0.03);
    for (let c = 0; c < 3; c++) img.c[c][i] = Math.min(1, base[c] * light);
    ang[i] = (hw >= hh ? 0 : Math.PI / 2) + R.normal() * 0.04;
  }
  const out = paintFlat(img, alpha, ang, (color & 0xffff) + Math.round(hw * 13), K, 1); // (a block lies still: one variant, used for every boil frame)
  const all = [out[0], out[0], out[0]];
  cache.set(key, all);
  return all;
}

/** A painted flame (owner: everything is a painting): a teardrop, a hot pale core low down, orange, then red at the edges and the tip,
 *  brushed upward. Three variants (it boils like the fighters, which reads as flicker). w x h metres, anchored at its base. */
export function paintedFlame(K: SpriteKnobs, w = 0.3, h = 0.6): Texture[] {
  const key = `flame|${w}|${h}|${JSON.stringify(K)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = Math.ceil(w * PPM + 2 * PAD), H = Math.ceil(h * PPM + 2 * PAD), N = W * H, R = w * PPM * 0.5, cx = W / 2;
  const img = newImg(W, H), alpha = new Float32Array(N), ang = new Float32Array(N), Rn = makeRandom(4049);
  const core = [1, 0.95, 0.7], mid = [1, 0.58, 0.14], edge = [0.78, 0.16, 0.05];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = (H - PAD - y) / (H - 2 * PAD); // 0 at the base, 1 at the tip
    const hw = v < 0.3 ? R * Math.sqrt(Math.max(0, 1 - ((0.3 - v) / 0.3) ** 2)) : R * Math.max(0, 1 - (v - 0.3) / 0.7) ** 1.3; // round at the base, tapering to the tip
    const u = Math.abs(x + 0.5 - cx), d = hw > 0 ? u / hw : 2;
    alpha[i] = Math.min(1, Math.max(0, (hw - u + 0.5) / 2)) * (v >= 0 && v <= 1 ? 1 : 0);
    const heat = Math.max(0, 1 - Math.max(d, v * 1.1)); // hottest low in the middle
    for (let c = 0; c < 3; c++) img.c[c][i] = heat > 0.55 ? mid[c] + (core[c] - mid[c]) * ((heat - 0.55) / 0.45) : edge[c] + (mid[c] - edge[c]) * (heat / 0.55);
    ang[i] = Math.PI / 2 + (x - cx) / Math.max(1, R) * 0.25 + Rn.normal() * 0.05; // brushed upward, leaning in toward the tip
  }
  const out = paintFlat(img, alpha, ang, 4051, K);
  cache.set(key, out);
  return out;
}

/** The woolly mammoth (Mammoth Chase), facing right: a shaggy brown body with a hump, a domed head, a hanging trunk, cream tusks curling
 *  forward, four pillar legs; brushed downward like fur. Painted once. Centred on the middle of its len x h body (its collider). */
export function paintedMammoth(len: number, h: number, K: SpriteKnobs): { tex: Texture; ppm: number } {
  const key = `mammoth|${len}|${h}|${JSON.stringify(K)}`, k = SEA_PPM;
  const hit = cache.get(key);
  if (hit) return { tex: hit[0], ppm: k };
  const padX = 0.9, padY = 0.4, W = Math.ceil((len + 2 * padX) * k), H = Math.ceil((h + 2 * padY) * k), N = W * H, R = makeRandom(5101);
  const img = newImg(W, H), alpha = new Float32Array(N), ang = new Float32Array(N);
  const fur = rgb('#5b3b24'), top = rgb('#86603c'), belly = rgb('#33210f'), ivory = rgb('#eadfc4'), eye = rgb('#120a06');
  const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const L = len / 2, B = h / 2; // (metres from the middle; y down)
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const i = py * W + px, x = px / k - padX - L, y = py / k - padY - B;
    const body = ell(x, y, -0.15 * L, -0.12 * B, 0.92 * L, 0.62 * B) || ell(x, y, 0.2 * L, -0.5 * B, 0.45 * L, 0.38 * B); // the body and the hump
    const head = ell(x, y, 0.72 * L, -0.42 * B, 0.36 * L, 0.42 * B);
    const legs = [-0.7, -0.38, 0.28, 0.58].some((lx) => Math.abs(x - lx * L) < 0.13 * L && y > 0.1 * B && y < B);
    const tr = (y + 0.2 * B) / (1.1 * B), trunkX = 0.98 * L + 0.12 * L * Math.sin(Math.min(1, Math.max(0, tr)) * 2.4), trunk = tr >= 0 && tr <= 1 && Math.abs(x - trunkX) < 0.1 * L * (1 - 0.5 * tr);
    const tu = (x - 0.85 * L) / (0.55 * L), tusk = tu >= 0 && tu <= 1 && Math.abs(y - (0.05 * B + 0.25 * B * Math.sin(tu * 2.6) - 0.35 * B * tu * tu)) < 0.05 * B * (1.2 - tu);
    const eyeAt = ell(x, y, 0.82 * L, -0.55 * B, 0.03 * L, 0.03 * L);
    const shag = Math.abs(Math.sin(px * 0.9) * 0.04) * B; // a ragged fringe of hair along the bottom of the body
    const inBody = body || head || legs || trunk || (ell(x, y - shag, -0.15 * L, -0.12 * B, 0.92 * L, 0.66 * B) && y > 0);
    if (!inBody && !tusk) continue;
    alpha[i] = 1;
    const c = eyeAt ? eye : tusk && !head ? ivory : y < -0.55 * B ? top : y > 0.25 * B && !legs ? belly : fur;
    const n = R.range(-0.05, 0.05);
    for (let ch = 0; ch < 3; ch++) img.c[ch][i] = Math.min(1, Math.max(0, c[ch] + n));
    ang[i] = Math.PI / 2 + R.normal() * 0.18; // hair hangs down
  }
  const out = paintFlat(img, alpha, ang, 5107, K, 1);
  cache.set(key, out);
  return { tex: out[0], ppm: k };
}

// Paint one era backdrop (port of paint_full in the art package's game.py), then put everything but the ground out of focus.
// Slow (about a second): it runs in a worker (worker.ts) while the game goes on.
import type { Painting } from '../../content/paintings';
import { blur, blurImg, gray, grade, licSmooth, orientField, percentile, relight, resize, sobel, weave } from './core';
import type { Img } from './core';
import { compose, DEF_DEG, DEF_STD, REG } from './scene';
import type { ArenaGeo } from './scene';
import { paintLayer } from './strokes';
import type { Layer } from './strokes';

/** The house painting style (tuning.finish.paint); each era's `brush` multiplies these. */
export interface PaintKnobs {
  under: number; // share of smooth underpaint mixed back over the strokes (higher = smoother)
  relief: number; // paint thickness (impasto)
  bristle: number; // how streaky each stroke is
  jitter: number; // colour wobble between strokes
  dof: number; // how out of focus everything but the ground is (px at 1080p)
  haze: number; // how much the background plane fades toward the horizon colour
}

export function bakeBackdrop(cfg: Painting, geo: ArenaGeo, W: number, H: number, seed: number, K: PaintKnobs): ImageData {
  const scale = W / 1280, N = W * H, B = cfg.brush ?? {};
  const size = B.size ?? 1, jitter = K.jitter * (B.jitter ?? 1), relief = K.relief * (B.relief ?? 1), bristle = K.bristle * (B.bristle ?? 1);
  const sc = compose(cfg, geo, W, H, seed);
  const ang = orientField(sc.img, sc.region, DEF_DEG, DEF_STD, scale, seed, sc.ovAng, sc.ovW);

  // Underpaint: smooth along the brush direction. The broad passes run at half size (4x cheaper, and they are soft anyway); the last,
  // shorter pass runs at full size so edges stay crisp. `long` is a much longer smoothing used for the soft distance.
  const hw = W >> 1, hh = H >> 1, halfRegion = new Uint8Array(hw * hh);
  for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) halfRegion[y * hw + x] = sc.region[(2 * y) * W + 2 * x];
  const halfImg = resize(sc.img, hw, hh), halfAng = orientField(halfImg, halfRegion, DEF_DEG, DEF_STD, scale / 2, seed + 1);
  const baseHalf = licSmooth(halfImg, halfAng, 18 * scale, 10, 0.14);
  const long = resize(licSmooth(baseHalf, halfAng, 40 * scale, 16, 0.12), W, H);
  const base = licSmooth(resize(baseHalf, W, H), ang, 20 * scale, 8, 0.1);

  // Where the painting is soft (sky, hills, void) and where the edges are.
  const bgm = new Float32Array(N);
  for (let i = 0; i < N; i++) { const r = sc.region[i]; bgm[i] = r === REG.sky || r === REG.hills || r === REG.void ? 1 : 0; }
  const bgs = blur(bgm, W, H, 6 * scale), fms = blur(sc.fmask, W, H, 4 * scale), soft = new Float32Array(N);
  for (let i = 0; i < N; i++) soft[i] = bgs[i] * (1 - fms[i]);
  for (let c = 0; c < 3; c++) for (let i = 0; i < N; i++) base.c[c][i] = base.c[c][i] * (1 - soft[i]) + long.c[c][i] * soft[i];
  const [ex, ey] = sobel(blur(gray(sc.img), W, H, scale), W, H), edm = new Float32Array(N);
  for (let i = 0; i < N; i++) edm[i] = Math.hypot(ex[i], ey[i]);
  const p98 = percentile(edm, 0.98) + 1e-8;
  for (let i = 0; i < N; i++) edm[i] /= p98;
  const ed = blur(edm, W, H, 1.5 * scale), fm = sc.fmask;

  // Strokes, broad to fine, on top of the underpaint.
  const ctx = canv(W, H), hb = canv(W, H), hr = canv(W, H);
  ctx.putImageData(toImageData(base), 0, 0);
  hb.fillStyle = 'rgb(77,77,77)'; hb.fillRect(0, 0, W, H);
  hr.fillStyle = '#000'; hr.fillRect(0, 0, W, H);
  const cl = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const js = (i: number) => cl(1 - 0.85 * soft[i], 0.12, 1);
  const layers: Layer[] = [
    { blur: 10, spacing: 24, L: 200, W: 54, thr: 0.1, bristles: 9, jv: 0.022, jh: 0.007, contrast: 0.03, jscale: js },
    { blur: 4, spacing: 14, L: 92, W: 22, thr: 0.1, bristles: 7, jv: 0.03, jh: 0.01, contrast: 0.04, jscale: js, prob: (i) => cl(0.6 * (1 - 0.95 * soft[i]) - 0.4 * fm[i], 0, 1) },
    { blur: 1.4, spacing: 7, L: 40, W: 9.5, thr: 0.08, bristles: 5, jv: 0.04, jh: 0.012, contrast: 0.05, jscale: js, prob: (i) => cl((0.04 + 1.1 * ed[i] + 0.55 * fm[i]) * (1 - 0.85 * soft[i]), 0, 0.9) },
    { blur: 0.6, spacing: 4.6, L: 18, W: 5.2, thr: 0.06, bristles: 3, jv: 0.035, jh: 0.01, contrast: 0.05, prob: (i) => (fm[i] > 0.5 ? 0.75 : 0) },
  ];
  layers.forEach((ly, li) => {
    const sized = { ...ly, spacing: ly.spacing * size, L: ly.L * size, W: ly.W * size };
    paintLayer(ctx, hb, hr, li < 3 ? base : sc.img, ang, sized, seed * 7 + li, scale, { jitter, bristle });
  });
  const out = fromImageData(ctx.getImageData(0, 0, W, H)), hbase = plane(hb.getImageData(0, 0, W, H)), hbris = plane(hr.getImageData(0, 0, W, H));

  // Finish: soft parts drift back to the long smoothing, some underpaint shows through, then relief, weave and grade.
  for (let c = 0; c < 3; c++) {
    const o = out.c[c], b = base.c[c], l = long.c[c];
    for (let i = 0; i < N; i++) { let v = o[i] * (1 - 0.45 * soft[i]) + l[i] * 0.45 * soft[i]; v = v * (1 - K.under) + b[i] * K.under; o[i] = v; }
  }
  const smooth = blurImg(out, 0.7 * scale), amt = new Float32Array(N);
  for (let i = 0; i < N; i++) amt[i] = cl(1 - 0.7 * soft[i], 0.3, 1);
  const lit = relight(smooth, hbase, hbris, 1.15 * relief, 0.1 * relief, amt, scale);
  weave(lit, 0.03, seed + 5);
  grade(lit, 1.08, [0.93, 0.74, 0.42], 0.07);

  // Depth of field: everything except the ground the fighters stand on goes a little out of focus.
  const dofPx = K.dof * (H / 1080);
  if (dofPx > 0.3) {
    const far = blurImg(lit, dofPx), keep = blur(sc.platMask, W, H, Math.max(0.5, scale));
    const air = [1, 3, 5].map((o) => parseInt(cfg.sky[2].slice(o, o + 2), 16) / 255); // the horizon colour
    for (let c = 0; c < 3; c++) for (let i = 0; i < N; i++) {
      const bg = far.c[c][i] * (1 - K.haze) + air[c] * K.haze; // the background plane: soft, and a little lost in the air
      lit.c[c][i] = bg * (1 - keep[i]) + lit.c[c][i] * keep[i];
    }
  }
  return toImageData(lit);
}

const canv = (w: number, h: number) => new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true })!;
function toImageData(a: Img): ImageData {
  const d = new ImageData(a.w, a.h), p = d.data;
  for (let i = 0; i < a.w * a.h; i++) { p[4 * i] = a.c[0][i] * 255; p[4 * i + 1] = a.c[1][i] * 255; p[4 * i + 2] = a.c[2][i] * 255; p[4 * i + 3] = 255; }
  return d;
}
function fromImageData(d: ImageData): Img {
  const N = d.width * d.height, p = d.data, img: Img = { w: d.width, h: d.height, c: [new Float32Array(N), new Float32Array(N), new Float32Array(N)] };
  for (let i = 0; i < N; i++) { img.c[0][i] = p[4 * i] / 255; img.c[1][i] = p[4 * i + 1] / 255; img.c[2][i] = p[4 * i + 2] / 255; }
  return img;
}
const plane = (d: ImageData) => { const N = d.width * d.height, o = new Float32Array(N); for (let i = 0; i < N; i++) o[i] = d.data[4 * i] / 255; return o; };

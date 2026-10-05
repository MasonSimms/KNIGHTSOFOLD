// One layer of brush strokes (port of paint_layer_taper in the art package's paintlib.py). Strokes start on a jittered grid, follow the
// brush direction field until the colour under them changes, are tapered at both ends, and carry a few bristle streaks. Each stroke is also
// drawn into two height maps (body of the paint, and bristle ridges) that relight() turns into impasto.
import { blurImg, makeRandom } from './core';
import type { Img } from './core';

export type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export interface Layer {
  blur: number; // how much the colour reference is blurred first (bigger = broader, simpler strokes)
  spacing: number; // grid spacing of stroke starts (px at 1280 wide)
  L: number; // stroke length
  W: number; // stroke width
  thr: number; // a stroke stops when the colour under it differs from where it started by more than this
  bristles: number; // most bristle streaks in one stroke
  jv: number; jh: number; // colour jitter: value and hue
  contrast: number; // how much the bristle streaks differ from the stroke colour
  prob?: (i: number) => number; // chance a stroke starts at pixel index i (none = always)
  jscale?: (i: number) => number; // jitter multiplier at pixel index i
}

export interface Knobs { jitter: number; bristle: number }

const rgb = (r: number, g: number, b: number) => `rgb(${Math.round(Math.min(1, Math.max(0, r)) * 255)},${Math.round(Math.min(1, Math.max(0, g)) * 255)},${Math.round(Math.min(1, Math.max(0, b)) * 255)})`;
const grey = (v: number) => { const c = Math.round(Math.min(1, Math.max(0, v)) * 255); return `rgb(${c},${c},${c})`; };

export function paintLayer(ctx: Ctx2D, hbase: Ctx2D, hbris: Ctx2D, base: Img, ang: Float32Array, ly: Layer, seed: number, scale: number, K: Knobs): number {
  const { w, h } = base, R = makeRandom(seed);
  const ref = ly.blur * scale > 0.3 ? blurImg(base, ly.blur * scale) : base;
  const sp = ly.spacing * scale, starts: number[] = [];
  for (let y = sp / 2; y < h; y += sp) for (let x = sp / 2; x < w; x += sp) {
    const px = Math.min(w - 1, Math.max(0, x + R.range(-sp / 2, sp / 2))), py = Math.min(h - 1, Math.max(0, y + R.range(-sp / 2, sp / 2)));
    if (ly.prob && R.u() >= ly.prob((py | 0) * w + (px | 0))) continue;
    starts.push(px, py);
  }
  const N = starts.length / 2;
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(R.u() * (i + 1)); [starts[2 * i], starts[2 * j]] = [starts[2 * j], starts[2 * i]]; [starts[2 * i + 1], starts[2 * j + 1]] = [starts[2 * j + 1], starts[2 * i + 1]]; }
  const idx = (x: number, y: number) => Math.min(h - 1, Math.max(0, y | 0)) * w + Math.min(w - 1, Math.max(0, x | 0));
  const step = Math.max(1.5, (ly.L * scale) / 8), n = Math.max(1, Math.round((ly.L * scale * 1.5) / 2 / step));
  const [rr, gg, bb] = ref.c;
  ctx.lineCap = hbris.lineCap = 'round';
  ctx.lineJoin = hbris.lineJoin = 'round';
  const qx: number[] = [], qy: number[] = [];
  for (let s = 0; s < N; s++) {
    const px = starts[2 * s], py = starts[2 * s + 1], i0 = idx(px, py);
    const c0r = rr[i0], c0g = gg[i0], c0b = bb[i0], th0 = ang[i0];
    // trace both ways along the field
    const back: number[] = [], fwd: number[] = [];
    for (const sgn of [1, -1]) {
      let x = px, y = py, dx = Math.cos(th0) * sgn, dy = Math.sin(th0) * sgn, alive = true;
      const seq = sgn > 0 ? fwd : back;
      for (let k = 0; k < n; k++) {
        const th = ang[idx(x, y)];
        let nx = Math.cos(th), ny = Math.sin(th);
        if (nx * dx + ny * dy < 0) { nx = -nx; ny = -ny; }
        dx = 0.6 * dx + 0.4 * nx; dy = 0.6 * dy + 0.4 * ny;
        const l = Math.hypot(dx, dy) + 1e-8; dx /= l; dy /= l;
        if (alive) {
          const ex = x + dx * step, ey = y + dy * step, j = idx(ex, ey);
          if (Math.hypot(rr[j] - c0r, gg[j] - c0g, bb[j] - c0b) < ly.thr) { x = ex; y = ey; } else alive = false;
        }
        seq.push(x, y);
      }
    }
    // points back -> front, then trimmed to this stroke's length about the middle
    qx.length = 0; qy.length = 0;
    for (let k = back.length - 2; k >= 0; k -= 2) { qx.push(back[k]); qy.push(back[k + 1]); }
    qx.push(px); qy.push(py);
    for (let k = 0; k < fwd.length; k += 2) { qx.push(fwd[k]); qy.push(fwd[k + 1]); }
    const M = qx.length, mid = n, Ls = ly.L * scale * R.range(0.75, 1.25), wS = ly.W * scale * R.range(0.75, 1.25);
    const cum = new Float32Array(M);
    for (let k = 1; k < M; k++) cum[k] = cum[k - 1] + Math.hypot(qx[k] - qx[k - 1], qy[k] - qy[k - 1]);
    let a = 0, b = M - 1;
    while (a < mid && Math.abs(cum[a] - cum[mid]) > Ls / 2) a++;
    while (b > mid && Math.abs(cum[b] - cum[mid]) > Ls / 2) b--;
    if (b - a + 1 < 3) { a = Math.max(0, mid - 1); b = Math.min(M - 1, mid + 1); }
    const m = b - a + 1;
    if (m < 3 || cum[b] - cum[a] < 0.5) continue;
    const X = qx.slice(a, b + 1), Y = qy.slice(a, b + 1);
    // normals (central differences) and the tapered half-width
    const NX = new Float32Array(m), NY = new Float32Array(m), HW = new Float32Array(m);
    for (let k = 0; k < m; k++) {
      const k0 = Math.max(0, k - 1), k1 = Math.min(m - 1, k + 1), tx = X[k1] - X[k0], ty = Y[k1] - Y[k0], l = Math.hypot(tx, ty) + 1e-8;
      NX[k] = -ty / l; NY[k] = tx / l;
      const t = k / (m - 1), prof = Math.max(0.12, Math.max(0, 1 - (2 * t - 1) ** 4) ** 0.55);
      HW[k] = (wS / 2) * prof;
    }
    const js = ly.jscale ? ly.jscale(i0) : 1;
    const v = R.normal() * ly.jv * js * K.jitter, hj = ly.jh * js * K.jitter;
    const cr = c0r * (1 + v) + R.normal() * hj, cg = c0g * (1 + v) + R.normal() * hj, cb = c0b * (1 + v) + R.normal() * hj;
    ctx.beginPath(); hbase.beginPath();
    for (let k = 0; k < m; k++) { const x = X[k] + NX[k] * HW[k], y = Y[k] + NY[k] * HW[k]; if (k) { ctx.lineTo(x, y); hbase.lineTo(x, y); } else { ctx.moveTo(x, y); hbase.moveTo(x, y); } }
    for (let k = m - 1; k >= 0; k--) { const x = X[k] - NX[k] * HW[k], y = Y[k] - NY[k] * HW[k]; ctx.lineTo(x, y); hbase.lineTo(x, y); }
    ctx.closePath(); hbase.closePath();
    ctx.fillStyle = rgb(cr, cg, cb); ctx.fill();
    hbase.fillStyle = grey(R.range(0.4, 1)); hbase.fill();
    // bristle streaks
    const nb = Math.max(3, Math.min(ly.bristles, Math.floor(wS / (2.2 * scale)) + 2)), tb = Math.max(1, (wS / nb) * 1.5);
    const cst = ly.contrast * js * K.bristle;
    ctx.lineWidth = hbris.lineWidth = tb;
    for (let q = 0; q < nb; q++) {
      const off = -0.9 + (1.8 * q) / (nb - 1) + R.range(-0.12, 0.12);
      const s0 = Math.floor(R.u() * Math.max(1, Math.floor(m / 5))), e0 = m - Math.floor(R.u() * Math.max(1, Math.floor(m / 5)));
      if (e0 - s0 < 2) continue;
      let jb = 1 + R.normal() * cst;
      if (R.u() < 0.1) jb *= 1 + cst * 2.2;
      ctx.beginPath(); hbris.beginPath();
      for (let k = s0; k < e0; k++) { const x = X[k] + NX[k] * off * HW[k], y = Y[k] + NY[k] * off * HW[k]; if (k > s0) { ctx.lineTo(x, y); hbris.lineTo(x, y); } else { ctx.moveTo(x, y); hbris.moveTo(x, y); } }
      ctx.strokeStyle = rgb(cr * jb, cg * jb, cb * jb); ctx.stroke();
      hbris.strokeStyle = grey(R.range(0.2, 1)); hbris.stroke();
    }
  }
  return N;
}

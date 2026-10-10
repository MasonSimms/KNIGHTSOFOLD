// The oil painter's maths, ported from the art package (art-guide/, tools/painter/paintlib.py). Pure functions on planar float images, so
// the slow work can run in a worker and the maths can be unit tested. Stroke drawing itself is in strokes.ts (it needs a 2D canvas).
// Images are 3 planes (r, g, b) of 0..1 floats, w x h. Nothing here runs per frame: it is only used when a picture is baked.

export interface Img { w: number; h: number; c: [Float32Array, Float32Array, Float32Array] }

export const newImg = (w: number, h: number): Img => ({ w, h, c: [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)] });

/** Seeded random numbers (mulberry32) plus a normal distribution: the same seed paints the same picture. */
export function makeRandom(seed: number) {
  let s = seed >>> 0;
  const u = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
  return { u, normal, range: (a: number, b: number) => a + (b - a) * u() };
}

/** Gaussian blur of one plane (three box blurs, the usual fast approximation). */
export function blur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma <= 0.3) return src.slice();
  const n = 3, wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  let a = src.slice(), b = new Float32Array(src.length);
  for (let i = 0; i < n; i++) {
    const r = ((i < m ? wl : wl + 2) - 1) / 2;
    boxH(a, b, w, h, r); boxV(b, a, w, h, r);
  }
  return a;
}
function boxH(s: Float32Array, d: Float32Array, w: number, h: number, r: number) {
  const k = 1 / (r + r + 1);
  for (let y = 0; y < h; y++) {
    const o = y * w, first = s[o];
    let acc = (r + 1) * first;
    for (let j = 0; j < r; j++) acc += s[o + Math.min(j, w - 1)];
    for (let x = 0; x < w; x++) {
      acc += s[o + Math.min(x + r, w - 1)] - (x - r - 1 >= 0 ? s[o + x - r - 1] : first);
      d[o + x] = acc * k;
    }
  }
}
function boxV(s: Float32Array, d: Float32Array, w: number, h: number, r: number) {
  const k = 1 / (r + r + 1);
  for (let x = 0; x < w; x++) {
    const first = s[x];
    let acc = (r + 1) * first;
    for (let j = 0; j < r; j++) acc += s[Math.min(j, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      acc += s[Math.min(y + r, h - 1) * w + x] - (y - r - 1 >= 0 ? s[(y - r - 1) * w + x] : first);
      d[y * w + x] = acc * k;
    }
  }
}
export const blurImg = (a: Img, sigma: number): Img => ({ w: a.w, h: a.h, c: [blur(a.c[0], a.w, a.h, sigma), blur(a.c[1], a.w, a.h, sigma), blur(a.c[2], a.w, a.h, sigma)] });

export function gray(a: Img): Float32Array {
  const g = new Float32Array(a.w * a.h);
  for (let i = 0; i < g.length; i++) g[i] = 0.299 * a.c[0][i] + 0.587 * a.c[1][i] + 0.114 * a.c[2][i];
  return g;
}

/** Sobel x and y of one plane (scaled like OpenCV's 3x3 Sobel). */
export function sobel(p: Float32Array, w: number, h: number): [Float32Array, Float32Array] {
  const gx = new Float32Array(w * h), gy = new Float32Array(w * h);
  const at = (x: number, y: number) => p[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1), d = at(x - 1, y), f = at(x + 1, y), g = at(x - 1, y + 1), hh = at(x, y + 1), i = at(x + 1, y + 1);
    gx[y * w + x] = c + 2 * f + i - a - 2 * d - g;
    gy[y * w + x] = g + 2 * hh + i - a - 2 * b - c;
  }
  return [gx, gy];
}

/** The value below which `q` (0..1) of the samples lie (estimated from a sample, which is plenty here). */
export function percentile(p: Float32Array, q: number): number {
  const step = Math.max(1, Math.floor(p.length / 20000)), s: number[] = [];
  for (let i = 0; i < p.length; i += step) s.push(p[i]);
  s.sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

/**
 * Which way the brush runs at every pixel (radians). Strong, clear edges in the picture steer the strokes along them; everywhere else each
 * region has its own default direction with a little wander (sky nearly flat, foliage dabbed diagonally, grass upright...). `ovAng`/`ovW`
 * force a direction where something needs it (a pennant flying in the wind).
 */
export function orientField(src: Img, region: Uint8Array, defDeg: number[], defStd: number[], scale: number, seed: number, ovAng?: Float32Array, ovW?: Float32Array): Float32Array {
  const { w, h } = src, N = w * h;
  const g = blur(gray(src), w, h, 2 * scale);
  const [gx, gy] = sobel(g, w, h);
  const xx = new Float32Array(N), yy = new Float32Array(N), xy = new Float32Array(N);
  for (let i = 0; i < N; i++) { xx[i] = gx[i] * gx[i]; yy[i] = gy[i] * gy[i]; xy[i] = gx[i] * gy[i]; }
  const jxx = blur(xx, w, h, 7 * scale), jyy = blur(yy, w, h, 7 * scale), jxy = blur(xy, w, h, 7 * scale);
  const tr = new Float32Array(N);
  for (let i = 0; i < N; i++) tr[i] = jxx[i] + jyy[i];
  const p90 = percentile(tr, 0.9) + 1e-8;
  const R = makeRandom(seed), noise0 = new Float32Array(N);
  for (let i = 0; i < N; i++) noise0[i] = R.normal();
  const noise = blur(noise0, w, h, Math.max(5, w / 110));
  let sd = 0;
  for (let i = 0; i < N; i++) sd += noise[i] * noise[i];
  sd = Math.sqrt(sd / N) + 1e-8;
  const ang = new Float32Array(N), D = Math.PI / 180;
  for (let i = 0; i < N; i++) {
    const coh = Math.sqrt((jxx[i] - jyy[i]) ** 2 + 4 * jxy[i] ** 2) / (tr[i] + 1e-8);
    const th = 0.5 * Math.atan2(2 * jxy[i], jxx[i] - jyy[i]) + Math.PI / 2;
    const strength = Math.min(1, tr[i] / p90);
    const wt = Math.min(1, coh * strength * 1.3);
    const r = region[i], thd = (defDeg[r] + (noise[i] / sd) * defStd[r]) * D;
    let vx = wt * Math.cos(2 * th) + (1 - wt) * Math.cos(2 * thd), vy = wt * Math.sin(2 * th) + (1 - wt) * Math.sin(2 * thd);
    if (ovAng && ovW && ovW[i] > 0) { const o = ovW[i]; vx = o * Math.cos(2 * ovAng[i]) + (1 - o) * vx; vy = o * Math.sin(2 * ovAng[i]) + (1 - o) * vy; }
    ang[i] = 0.5 * Math.atan2(vy, vx);
  }
  return ang;
}

/**
 * Smooth the picture along the brush direction, but only between similar colours (a "line integral" smoothing): flat areas turn into soft
 * blended paint while edges stay put. This is the oil underpainting the strokes are laid on.
 */
export function licSmooth(src: Img, ang: Float32Array, length: number, steps: number, sigc: number): Img {
  const { w, h } = src, N = w * h;
  // The brush direction at each pixel as a unit vector (its sign is meaningless: it is matched to the way we are travelling).
  const ux0 = new Float32Array(N), uy0 = new Float32Array(N);
  for (let i = 0; i < N; i++) { ux0[i] = Math.cos(ang[i]); uy0[i] = Math.sin(ang[i]); }
  const out = newImg(w, h), [ro, go, bo] = out.c;
  const rgb = new Float32Array(N * 3); // interleaved: the four corners of a sample sit close together in memory
  for (let i = 0; i < N; i++) { rgb[3 * i] = src.c[0][i]; rgb[3 * i + 1] = src.c[1][i]; rgb[3 * i + 2] = src.c[2][i]; }
  const step = length / steps, wfall = new Float32Array(steps);
  for (let i = 0; i < steps; i++) wfall[i] = Math.exp(-((((i + 1) / steps) * 2) ** 2) * 0.5);
  const inv = 1 / (sigc * sigc), xm = w - 1.001, ym = h - 1.001, row = 3 * w;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i0 = y * w + x, R0 = rgb[3 * i0], G0 = rgb[3 * i0 + 1], B0 = rgb[3 * i0 + 2];
    let ar = R0, ag = G0, ab = B0, wa = 1;
    for (let sgn = -1; sgn <= 1; sgn += 2) {
      let px = x, py = y, dx = ux0[i0] * sgn, dy = uy0[i0] * sgn;
      for (let s = 0; s < steps; s++) {
        // direction at the current point (nearest pixel: the field is smooth), turned to match the way we are going
        const j = (py < 0 ? 0 : py > h - 1 ? h - 1 : py | 0) * w + (px < 0 ? 0 : px > w - 1 ? w - 1 : px | 0);
        let nx = ux0[j], ny = uy0[j];
        if (nx * dx + ny * dy < 0) { nx = -nx; ny = -ny; }
        dx = 0.5 * dx + 0.5 * nx; dy = 0.5 * dy + 0.5 * ny;
        const n = 1 / (Math.sqrt(dx * dx + dy * dy) + 1e-6); dx *= n; dy *= n;
        px += dx * step; py += dy * step;
        const sx = px < 0 ? 0 : px > xm ? xm : px, sy = py < 0 ? 0 : py > ym ? ym : py;
        const kx = sx | 0, ky = sy | 0, ux = sx - kx, uy = sy - ky, k = 3 * (ky * w + kx), k2 = k + row;
        const w00 = (1 - ux) * (1 - uy), w10 = ux * (1 - uy), w01 = (1 - ux) * uy, w11 = ux * uy;
        const cr = rgb[k] * w00 + rgb[k + 3] * w10 + rgb[k2] * w01 + rgb[k2 + 3] * w11;
        const cg = rgb[k + 1] * w00 + rgb[k + 4] * w10 + rgb[k2 + 1] * w01 + rgb[k2 + 4] * w11;
        const cb = rgb[k + 2] * w00 + rgb[k + 5] * w10 + rgb[k2 + 2] * w01 + rgb[k2 + 5] * w11;
        const e = ((cr - R0) * (cr - R0) + (cg - G0) * (cg - G0) + (cb - B0) * (cb - B0)) * inv;
        if (e > 9) continue; // a different colour: no weight (exp(-9) is nothing)
        const wt = Math.exp(-e) * wfall[s];
        ar += cr * wt; ag += cg * wt; ab += cb * wt; wa += wt;
      }
    }
    ro[i0] = ar / wa; go[i0] = ag / wa; bo[i0] = ab / wa;
  }
  return out;
}

/** Light the thickness of the paint (impasto) from the upper left, with a little sheen on the ridges. */
export function relight(img: Img, hbase: Float32Array, hbris: Float32Array, strength: number, spec: number, amt: Float32Array | null, scale: number): Img {
  const { w, h } = img, N = w * h;
  const hb = blur(hbase, w, h, 1.6 * scale), hr = blur(hbris, w, h, 0.7 * scale), hh = new Float32Array(N);
  for (let i = 0; i < N; i++) hh[i] = hb[i] + hr[i] * 0.35;
  const [gx, gy] = sobel(hh, w, h);
  let Lx = -0.55, Ly = -0.6, Lz = 0.58;
  const ln = Math.hypot(Lx, Ly, Lz); Lx /= ln; Ly /= ln; Lz /= ln;
  let Hx = Lx, Hy = Ly, Hz = Lz + 1;
  const hn = Math.hypot(Hx, Hy, Hz); Hx /= hn; Hy /= hn; Hz /= hn;
  const out = newImg(w, h);
  for (let i = 0; i < N; i++) {
    const nx0 = (-gx[i] / 8) * 5, ny0 = (-gy[i] / 8) * 5, l = Math.sqrt(nx0 * nx0 + ny0 * ny0 + 1);
    const nx = nx0 / l, ny = ny0 / l, nz = 1 / l;
    const d = nx * Lx + ny * Ly + nz * Lz, a = amt ? amt[i] : 1;
    const shade = Math.min(1.35, Math.max(0.7, 1 + strength * (d - Lz) * a));
    const sp = Math.max(0, nx * Hx + ny * Hy + nz * Hz) ** 40 * spec * a;
    out.c[0][i] = Math.min(1, img.c[0][i] * shade + sp);
    out.c[1][i] = Math.min(1, img.c[1][i] * shade + sp * 0.94);
    out.c[2][i] = Math.min(1, img.c[2][i] * shade + sp * 0.82);
  }
  return out;
}

/** Canvas weave: the fabric showing faintly through the paint. */
export function weave(img: Img, amt: number, seed: number): void {
  const { w, h } = img, R = makeRandom(seed), n = new Float32Array(w * h);
  for (let i = 0; i < n.length; i++) n[i] = R.normal();
  const a = blur(n, w, h, 0.6);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, t = a[i] * 0.6 + (Math.sin(x * 1.9) * Math.sin(y * 1.9) * 0.5 + Math.sin(x * 0.95 + y * 0.1) * 0.25) * 0.5;
    const k = 1 + amt * t;
    img.c[0][i] *= k; img.c[1][i] *= k; img.c[2][i] *= k;
  }
}

/** Final grade: a touch more saturation, a soft S-curve, and a warm varnish glaze. */
export function grade(img: Img, sat: number, glaze: [number, number, number], glazeAmt: number): void {
  const N = img.w * img.h;
  for (let i = 0; i < N; i++) {
    let r = Math.min(1, Math.max(0, img.c[0][i])), g = Math.min(1, Math.max(0, img.c[1][i])), b = Math.min(1, Math.max(0, img.c[2][i]));
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
    const s = (v: number) => { v = Math.min(1, Math.max(0, v)); return v * v * (3 - 2 * v) * 0.6 + v * 0.4; };
    r = s(r); g = s(g); b = s(b);
    img.c[0][i] = r * (1 - glazeAmt) + r * glaze[0] * 1.25 * glazeAmt;
    img.c[1][i] = g * (1 - glazeAmt) + g * glaze[1] * 1.25 * glazeAmt;
    img.c[2][i] = b * (1 - glazeAmt) + b * glaze[2] * 1.25 * glazeAmt;
  }
}

/** Bilinear resize (used to do the slow smoothing at half size). */
export function resize(a: Img, w: number, h: number): Img {
  const out = newImg(w, h), sx = (a.w - 1) / Math.max(1, w - 1), sy = (a.h - 1) / Math.max(1, h - 1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = Math.min(a.w - 1.001, x * sx), fy = Math.min(a.h - 1.001, y * sy), ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, j = iy * a.w + ix;
    for (let c = 0; c < 3; c++) {
      const p = a.c[c];
      out.c[c][y * w + x] = (p[j] * (1 - tx) + p[j + 1] * tx) * (1 - ty) + (p[j + a.w] * (1 - tx) + p[j + a.w + 1] * tx) * ty;
    }
  }
  return out;
}

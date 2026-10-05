import { describe, expect, it } from 'vitest';
import { blur, licSmooth, newImg, orientField, relight } from './core';

describe('oil painter maths', () => {
  it('blur keeps a flat plane flat and keeps the average', () => {
    const w = 40, h = 30, p = new Float32Array(w * h).fill(0.4);
    p[15 * w + 20] = 1;
    const b = blur(p, w, h, 3), sum = (a: Float32Array) => a.reduce((s, v) => s + v, 0);
    expect(Math.abs(sum(b) - sum(p))).toBeLessThan(0.05);
    expect(b[0]).toBeCloseTo(0.4, 5);
    expect(b[15 * w + 20]).toBeLessThan(0.6); // the bright dot is spread out
  });

  it('the underpaint smoothing blends similar colours but keeps a hard edge between different ones', () => {
    const w = 60, h = 20, img = newImg(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, left = x < 30; img.c[0][i] = left ? 0.2 + ((x * 7) % 3) * 0.01 : 0.9; img.c[1][i] = left ? 0.3 : 0.1; img.c[2][i] = 0.2; }
    const out = licSmooth(img, new Float32Array(w * h), 12, 8, 0.12); // brush runs horizontally, straight across the edge
    expect(out.c[0][10 * w + 10]).toBeCloseTo(0.21, 1);
    expect(out.c[0][10 * w + 29]).toBeLessThan(0.3); // just left of the edge: still the left colour
    expect(out.c[0][10 * w + 30]).toBeGreaterThan(0.85); // just right of it: still the right colour
  });

  it('a flat, empty picture takes each region\'s default brush direction, and flat paint is not relit', () => {
    const w = 30, h = 20, img = newImg(w, h), region = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) { img.c[0][i] = img.c[1][i] = img.c[2][i] = 0.5; region[i] = i < (w * h) / 2 ? 0 : 1; }
    const ang = orientField(img, region, [0, 90], [0, 0], 1, 1);
    expect(ang[2 * w + 5]).toBeCloseTo(0, 3);
    expect(Math.abs(ang[18 * w + 5])).toBeCloseTo(Math.PI / 2, 3);
    const lit = relight(img, new Float32Array(w * h).fill(0.3), new Float32Array(w * h), 0.6, 0, null, 1);
    expect(lit.c[0][10 * w + 10]).toBeCloseTo(0.5, 3);
  });
});

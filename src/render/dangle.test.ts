import { describe, expect, it } from 'vitest';
import { DANGLES } from '../content/hats';
import type { DangleSpec } from '../content/hats';
import { tuning as T } from '../content/tuning';
import { makeChain, stepChain, stepPupil, stepSquish } from './dangle';
import type { Head } from './dangle';

const still: Head = { x: 0, y: 0, rot: 0, side: 1 };
const spec = (o: Partial<DangleSpec>): DangleSpec => ({ anchor: [0, -1], links: 4, length: 1.5, rest: -2.6, stiffness: 0.5, width: [0.3, 0.1], colors: ['#fff'], ...o });
const angleOf = (c: ReturnType<typeof makeChain>, i: number) => Math.atan2(c.x[i] - c.x[i - 1], c.y[i] - c.y[i - 1]); // 0 = down, + toward +x
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

describe('swaying hats and hair (looks only)', () => {
  it('a chain left alone settles to its rest angle, on whichever side the fighter faces', () => {
    for (const side of [1, -1]) {
      const s = spec({ gravity: 0, trail: 0, flutter: 0 }), c = makeChain(s.links), head = { ...still, side };
      c.live = true; // start it hanging straight down, nowhere near its rest
      for (let i = 0; i < s.links; i++) { c.x[i] = c.px[i] = 0; c.y[i] = c.py[i] = -1 + i * 0.5; }
      for (let f = 0; f < 600; f++) stepChain(c, s, head, 1 / 60, f / 60);
      for (let i = 1; i < s.links; i++) expect(angleOf(c, i)).toBeCloseTo(-2.6 * side, 2);
    }
  });

  it('keeps every link its length, however hard the head is thrown about', () => {
    const s = spec({ stiffness: 0.1 }), c = makeChain(s.links), head = { ...still }, seg = s.length / (s.links - 1);
    for (let f = 0; f < 600; f++) {
      head.x += rand() * 0.8; head.y += rand() * 0.8; head.rot += rand() * 0.5; if (f % 50 === 0) head.side = -head.side;
      stepChain(c, s, head, 1 / 60, f / 60, rand() * 10);
      for (let i = 1; i < s.links; i++) expect(Math.hypot(c.x[i] - c.x[i - 1], c.y[i] - c.y[i - 1])).toBeCloseTo(seg, 3);
    }
  });

  it('stiffness 1 never bends: the chain stays a straight line at its rest angle, turned with the head', () => {
    const s = spec({ stiffness: 1 }), c = makeChain(s.links), head = { ...still };
    for (let f = 0; f < 300; f++) {
      head.x += rand() * 0.5; head.rot = f * 0.03;
      stepChain(c, s, head, 1 / 60, f / 60, 5);
      for (let i = 1; i < s.links; i++) expect(Math.abs(Math.sin(angleOf(c, i) - (-2.6 - head.rot)))).toBeLessThan(1e-6); // (turning is clockwise on screen, as in Pixi)
    }
  });

  it('gravity bends a floppy chain more than a stiff one', () => {
    const tipDrop = (stiffness: number) => {
      const s = spec({ stiffness, rest: -Math.PI / 2, trail: 0, flutter: 0 }), c = makeChain(s.links); // sticking straight out sideways
      for (let f = 0; f < 600; f++) stepChain(c, s, still, 1 / 60, f / 60);
      return c.y[s.links - 1] - c.y[0];
    };
    expect(tipDrop(0.2)).toBeGreaterThan(2 * tipDrop(0.55)); // a jester point flops, a feather keeps its line
  });

  it('every hat and hairstyle in the data steps without breaking (finite points)', () => {
    for (const [hat, specs] of Object.entries(DANGLES)) for (const s of specs!) {
      const c = makeChain(s.links), head = { ...still };
      for (let f = 0; f < 120; f++) { head.x += rand() * 0.3; stepChain(c, s, head, 1 / 60, f / 60, 3); }
      for (let i = 0; i < s.links; i++) expect(Number.isFinite(c.x[i]) && Number.isFinite(c.y[i]), hat).toBe(true);
    }
  });

  it('googly pupils rattle about but never leave the eye, and settle low when the head is still', () => {
    const p = { x: 0, y: 0, vx: 0, vy: 0 }, room = 0.18;
    for (let f = 0; f < 3000; f++) {
      stepPupil(p, rand() * 4000, rand() * 4000, 1 / 60, room);
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(room + 1e-9);
    }
    for (let f = 0; f < 600; f++) stepPupil(p, 0, 0, 1 / 60, room);
    expect(Math.abs(p.x)).toBeLessThan(1e-3);
    expect(p.y).toBeCloseTo(T.finish.dangle.gravity / T.fighter.headRadius / T.finish.googly.spring, 3); // hanging under its own weight
  });

  it('the afro squashes on a hard landing, never past its limit, and wobbles back to round', () => {
    const q = { s: 0, v: 0 };
    stepSquish(q, -3000, 1 / 60); // the head stops dead
    let most = 0;
    for (let f = 0; f < 600; f++) { stepSquish(q, 0, 1 / 60); most = Math.max(most, q.s); expect(Math.abs(q.s)).toBeLessThanOrEqual(T.finish.afro.max); }
    expect(most).toBeGreaterThan(0.03); // wide and short
    expect(Math.abs(q.s)).toBeLessThan(1e-3);
  });
});

import { describe, expect, it } from 'vitest';
import { MUSIC, SOUNDS } from '../content/audio';
import { eras } from '../content/eras';
import { makeRng } from '../sim/rng';
import { Excitement, pitchVariance } from './intensity';

describe('sound', () => {
  it('a hit\'s pitch varies with a normal distribution, never past -5%..+5% (owner)', () => {
    const rnd = makeRng(5), xs = Array.from({ length: 20000 }, () => pitchVariance(SOUNDS.hit.pitch, rnd));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    expect(Math.max(...xs.map(Math.abs))).toBeLessThanOrEqual(0.05);
    expect(Math.abs(mean)).toBeLessThan(0.002); // centred on the original sound
    expect(sd).toBeGreaterThan(0.017); expect(sd).toBeLessThan(0.021); // most plays close to it
    expect(xs.filter((x) => Math.abs(x) < 0.02).length / xs.length).toBeGreaterThan(0.6); // a bell, not flat (flat would be 40%)
  });

  it('the music\'s excitement swells with a big moment, settles to how much everyone moves, and calms when they stop', () => {
    const x = new Excitement(), run = (s: number, motion: number) => { for (let i = 0; i < s * 60; i++) x.update(1 / 60, motion); return x.level; };
    const moving = run(6, 3);
    expect(moving).toBeGreaterThan(0.3);
    x.event({ t: 'fall', x: 0, y: 0, v: 0, owner: 1, victim: 1 });
    expect(run(1, 3)).toBeGreaterThan(moving + 0.15); // a knock-off: a swell
    expect(run(14, 3)).toBeLessThan(moving + 0.05); // ...that fades
    expect(run(15, 0)).toBeLessThan(0.05); // nobody moving: calm
  });

  it('every era has one or two instruments of its own, and every music stem is a known kind', () => {
    for (const e of eras) {
      const list = MUSIC.eras[e.id];
      expect(list, e.id).toBeTruthy();
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.length).toBeLessThanOrEqual(2);
    }
    expect(MUSIC.eras.westerns.map((s) => s.kind).sort()).toEqual(['flute', 'pluck']); // whistle and guitar
    expect(MUSIC.eras.samurai.map((s) => s.kind).sort()).toEqual(['drum', 'flute']); // flute and drum
  });
});

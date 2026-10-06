import { describe, expect, it } from 'vitest';
import { hashSim } from './hash';
import { NEUTRAL } from './types';
import { Sim } from './world';

/** Four bots fight each other for `frames` frames; returns what happened. */
async function botFight(seed: number, frames: number) {
  const sim = await Sim.create(seed, 4, false);
  sim.looks.forEach((l) => { l.bot = true; });
  sim.reset();
  const lastX = sim.fighters.map((f) => f.torso.body.translation().x), still = [0, 0, 0, 0];
  let rounds = 0, round = sim.round, longestStill = 0, hits = 0;
  for (let i = 0; i < frames; i++) {
    sim.step([NEUTRAL, NEUTRAL, NEUTRAL, NEUTRAL]); // (the humans' inputs: bots ignore them and press their own buttons)
    hits += sim.events.filter((e) => e.t === 'hit').length;
    if (sim.round !== round) { rounds++; round = sim.round; }
    sim.fighters.forEach((f, k) => {
      const x = f.torso.body.translation().x;
      still[k] = !f.limp && !sim.roundOver && Math.abs(x - lastX[k]) < 0.01 ? still[k] + 1 : 0;
      lastX[k] = x;
      longestStill = Math.max(longestStill, still[k]);
    });
  }
  return { rounds, hits, longestStill, hash: hashSim(sim) };
}

describe('bots', () => {
  it('four bots fight on their own: they hit each other, rounds end, and none of them stands about', async () => {
    const r = await botFight(3, 60 * 60);
    expect(r.rounds).toBeGreaterThanOrEqual(2); // a minute of fighting finishes rounds
    expect(r.hits).toBeGreaterThan(50);
    expect(r.longestStill).toBeLessThan(3 * 60); // nobody frozen in place for 3 seconds
  }, 60000);

  it('a fight with bots plays out exactly the same every time (the server depends on it)', async () => {
    const a = await botFight(8, 900), b = await botFight(8, 900);
    expect(a.hash).toBe(b.hash);
  }, 60000);
});

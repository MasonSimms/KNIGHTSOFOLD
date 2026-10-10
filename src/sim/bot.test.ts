import { describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
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

  // Owner, 2026-10-10: "give bots some idea of blocking but make it infrequent".
  it('a bot with a weapon sometimes guards a swing wound up in its reach: it stands with its weapon out and does not attack; never, with the chance at 0', async () => {
    const B = T.bot, was = { g: B.guardChance, m: B.meetChance, d: B.dodgeChance };
    /** A player walks up to a bot and winds up swing after swing; how many frames the bot spent guarding, and whether it pressed attack while it did. */
    const guarding = async (chance: number) => {
      B.guardChance = chance; B.meetChance = 0; B.dodgeChance = 0;
      const sim = await Sim.create(4, 2, false);
      sim.looks[1].bot = true;
      sim.reset();
      let frames = 0, attacked = false;
      for (let i = 0; i < 600; i++) {
        const me = sim.fighters[0], it = sim.fighters[1], dx = it.torso.body.translation().x - me.torso.body.translation().x;
        sim.step([{ ...NEUTRAL, moveX: Math.abs(dx) > 1.6 ? Math.sign(dx) : 0, aim: dx > 0 ? 0 : Math.PI, attack: Math.abs(dx) < 2.2 && i % 50 < 30 }, NEUTRAL]);
        const brain = (sim as unknown as { brains: ({ plan: { kind: string } } | undefined)[] }).brains[1];
        if (brain?.plan.kind === 'guard' && !it.limp) { frames++; if (it.charge > 0) attacked = true; }
      }
      return { frames, attacked };
    };
    try {
      const always = await guarding(1), never = await guarding(0);
      expect(always.frames).toBeGreaterThan(10);
      expect(always.attacked).toBe(false); // (holding a guard is not charging a swing)
      expect(never.frames).toBe(0);
    } finally { B.guardChance = was.g; B.meetChance = was.m; B.dodgeChance = was.d; }
  }, 60000);
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { botLook } from '../content/looks';
import { tuning as T } from '../content/tuning';
import { hashSim } from '../sim/hash';
import { NEUTRAL } from '../sim/types';
import { Sim } from '../sim/world';
import { Recorder, rebuild, stepTo } from './recording';

const saved = { cg: T.eras.changeGameplay, sp: T.spawn.enabled, ly: T.props.lying, mx: T.eras.mixStarts };
beforeAll(() => { T.eras.changeGameplay = true; T.spawn.enabled = true; T.props.lying = true; T.eras.mixStarts = true; }); // the real game, everything on
afterAll(() => { T.eras.changeGameplay = saved.cg; T.spawn.enabled = saved.sp; T.props.lying = saved.ly; T.eras.mixStarts = saved.mx; });

describe('replays', () => {
  it('a recorded round plays back exactly the same, frame for frame (later rounds too, with bots)', async () => {
    const sim = await Sim.create(42, 4, false);
    sim.looks = sim.looks.map(() => botLook());
    sim.reset();
    const rec = new Recorder();
    const checks = new Map<object, Map<number, string>>(); // recording -> frame -> state hash, taken live
    for (let i = 0; i < 2400 && rec.done.length < 3; i++) {
      const inputs = [NEUTRAL, NEUTRAL, NEUTRAL, NEUTRAL];
      rec.before(sim, inputs);
      sim.step(inputs);
      if (sim.frame > 0 && sim.frame % 50 === 0) { // (frame 0 belongs to the next round, whose recording starts at the next step)
        const r = rec.current!;
        if (!checks.has(r)) checks.set(r, new Map());
        checks.get(r)!.set(sim.frame, hashSim(sim));
      }
    }
    expect(rec.done.length).toBeGreaterThanOrEqual(2); // a few rounds went by
    for (const r of rec.done.slice(0, 3)) {
      const copy = await rebuild(r);
      for (const [frame, hash] of checks.get(r) ?? []) {
        stepTo(copy, r, frame);
        expect(hashSim(copy), `round ${r.round} (${r.era}) frame ${frame}`).toBe(hash);
      }
    }
  }, 120_000);

  it('weapons dropped in and cleared from the training panel are in the replay', async () => {
    const sim = await Sim.create(5, 1, true);
    const rec = new Recorder();
    const step = () => { const inputs = [NEUTRAL, NEUTRAL]; rec.before(sim, inputs); sim.step(inputs); };
    for (let i = 0; i < 30; i++) step();
    sim.spawnItem('katana', 3, 2); sim.spawnItem('axe', -3, 2); // (as the panel does, between frames)
    for (let i = 0; i < 60; i++) step();
    sim.clearLoose();
    sim.spawnItem('log', 0, 1);
    for (let i = 0; i < 60; i++) step();
    const copy = await rebuild(rec.current!);
    stepTo(copy, rec.current!, sim.frame);
    expect(hashSim(copy)).toBe(hashSim(sim));
  }, 60_000);
});

describe('highlights', () => {
  it('a bot fight gives titled moments, and playing a moment back to its frame shows the same knockout', async () => {
    const { Spotter } = await import('./highlights');
    const sim = await Sim.create(7, 4, false);
    sim.looks = sim.looks.map(() => botLook());
    sim.reset();
    const rec = new Recorder(), spot = new Spotter();
    for (let i = 0; i < 3000; i++) {
      const inputs = [NEUTRAL, NEUTRAL, NEUTRAL, NEUTRAL];
      rec.before(sim, inputs);
      sim.step(inputs);
      spot.feed(sim, rec.current, sim.events);
    }
    const best = spot.best(5);
    expect(best.length).toBeGreaterThan(2);
    for (const m of best) {
      expect(m.title.length).toBeGreaterThan(5);
      expect(m.from).toBeLessThan(m.at);
      expect(m.to).toBeGreaterThan(m.at);
    }
    const ko = best.find((m) => /knock|takes|punches|slams|stomps/.test(m.title))!;
    expect(ko).toBeTruthy();
    const copy = await rebuild(ko.rec);
    const alive0 = copy.fighters.filter((f) => !f.limp).length;
    stepTo(copy, ko.rec, ko.at);
    expect(copy.fighters.filter((f) => !f.limp).length).toBeLessThan(alive0); // someone is down by then, as in the fight
    console.log(best.map((m) => `${m.score.toFixed(0)}  ${m.title} (${m.era})`).join('\n'));
  }, 120_000);
});

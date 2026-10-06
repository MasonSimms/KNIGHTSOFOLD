import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eras } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { setBackPlane } from './fighter';
import { hashSim } from './hash';
import { windAt } from './wind';
import { NEUTRAL } from './types';
import type { PlayerInput, SimEvent } from './types';
import { Sim } from './world';

// The Train (owner): on the roofs of a moving train, no weapons; signs and tunnel mouths come at you (a whistle first): get down or be
// swept off.
beforeAll(() => { T.eras.changeGameplay = true; });
afterAll(() => { T.eras.changeGameplay = false; });
const TRAIN = 1 + eras.find((e) => e.id === 'westerns')!.alt!.findIndex((a) => a.name === 'Train');

async function train(seed = 5) {
  const sim = await Sim.create(seed, 2, false);
  sim.forceEra = 'westerns'; sim.forceMap = TRAIN; sim.reset();
  setBackPlane(sim.fighters[1], true); sim.fighters[1].dodge = 1e9; // (the other one keeps out of it)
  return sim;
}
function run(sim: Sim, frames: number, input: PlayerInput = NEUTRAL): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < frames && !sim.fighters[0].limp; i++) { sim.step([input, NEUTRAL]); out.push(...sim.events.map((e) => ({ ...e }))); }
  return out;
}

describe('Train', () => {
  it('fists only: nobody starts armed and no weapons turn up', async () => {
    const sim = await train();
    expect(sim.fighters.every((f) => !f.stick)).toBe(true);
    run(sim, 60 * 6, { ...NEUTRAL, crouch: true });
    expect(sim.props.length).toBe(0);
  });

  it('standing up when a sign comes, you are swept off the train (a whistle first)', async () => {
    const sim = await train(), events = run(sim, 60 * 7);
    const whistle = events.findIndex((e) => e.t === 'whistle'), fall = events.findIndex((e) => e.t === 'fall' && e.victim === 0);
    expect(whistle).toBeGreaterThanOrEqual(0);
    expect(fall).toBeGreaterThan(whistle);
    expect(events.filter((e) => e.t === 'whistle').length).toBe(1); // (once)
  });

  it('lying flat, the sign and the tunnel pass over you', async () => {
    const sim = await train(), f = sim.fighters[0];
    run(sim, 60 * 9, { ...NEUTRAL, crouch: true });
    expect(f.limp).toBe(false);
    expect(Math.abs(f.torso.body.translation().y - sim.arena.platformTop)).toBeLessThan(1);
  });

  it('plays the same every time', async () => {
    const hashes: string[] = [];
    for (let k = 0; k < 2; k++) {
      const sim = await train(9);
      for (let i = 0; i < 600; i++) sim.step([{ ...NEUTRAL, moveX: i % 90 < 45 ? 1 : -1, crouch: i % 240 > 150 }, NEUTRAL]);
      hashes.push(hashSim(sim));
    }
    expect(hashes[0]).toBe(hashes[1]);
  });
});

describe('wind', () => {
  it('the headwind blows a fighter in the air back a little (standing, your feet hold you); it gusts, the same every time', async () => {
    const sim = await train(), f = sim.fighters[0];
    const t = f.torso.body.translation(), x0 = t.x;
    for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x, y: q.y - 6 }, true); p.body.setLinvel({ x: 0, y: 0 }, true); }
    run(sim, 30); // (half a second of falling: still in the air)
    const drift = f.torso.body.translation().x - x0;
    expect(drift).toBeLessThan(-0.02); // blown back (the train's wind blows toward -x)
    expect(drift).toBeGreaterThan(-0.6); // ...only a little
    const w = [0, 100, 200, 300].map((k) => windAt(sim.arena, k));
    expect(new Set(w.map((x) => x.toFixed(3))).size).toBeGreaterThan(1); // gusting
    expect(w.every((x) => x < 0)).toBe(true);
    expect(windAt(sim.arena, 123)).toBe(windAt(sim.arena, 123));
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eras } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { setBackPlane } from './fighter';
import { hashSim } from './hash';
import { NEUTRAL } from './types';
import type { PlayerInput, SimEvent } from './types';
import { Sim } from './world';

// The Mammoth Chase (owner): the ground slides left toward a mammoth; run right; touching it tosses you out (a knock-off); rocks and logs
// keep coming.
beforeAll(() => { T.eras.changeGameplay = true; });
afterAll(() => { T.eras.changeGameplay = false; });
const CHASE = 1 + eras.find((e) => e.id === 'caveman')!.alt!.findIndex((a) => a.name === 'Mammoth Chase');

async function chase(seed = 5) {
  const sim = await Sim.create(seed, 2, false);
  sim.forceEra = 'caveman'; sim.forceMap = CHASE; sim.reset();
  setBackPlane(sim.fighters[1], true); sim.fighters[1].dodge = 1e9; // (the other one keeps out of it)
  return sim;
}
function run(sim: Sim, frames: number, input: PlayerInput = NEUTRAL): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < frames; i++) { sim.step([input, NEUTRAL]); out.push(...sim.events.map((e) => ({ ...e }))); }
  return out;
}

describe('Mammoth Chase', () => {
  it('standing still, the ground carries you to the mammoth, which tosses you out of the picture', async () => {
    const sim = await chase(), f = sim.fighters[0];
    const events = run(sim, 60 * 6);
    expect(events.some((e) => e.t === 'trample' && e.victim === 0)).toBe(true);
    expect(events.some((e) => e.t === 'fall' && e.victim === 0)).toBe(true); // a knock-off
    expect(f.limp).toBe(true);
  });

  it('running right you move ahead of the floor (and walking legs walk on the floor, not the world)', async () => {
    const sim = await chase(), f = sim.fighters[0];
    run(sim, 30);
    const x0 = f.torso.body.translation().x;
    run(sim, 60, { ...NEUTRAL, moveX: 1 });
    const gained = f.torso.body.translation().x - x0, belt = sim.arena.chase!.speed;
    expect(gained).toBeGreaterThan((T.motion.moveSpeed - belt) * 0.7);
    expect(gained).toBeLessThan(T.motion.moveSpeed - belt + 0.5);
    expect(f.limp).toBe(false);
  });

  it('rocks and logs keep riding in from the right', async () => {
    const sim = await chase();
    const seen = new Set<number>();
    for (let i = 0; i < 60 * 20; i++) {
      sim.step([{ ...NEUTRAL, moveX: i % 120 < 80 ? 1 : 0, jump: i % 30 < 15 }, NEUTRAL]);
      sim.chase!.obstacles.forEach((o, k) => { const x = o.body.translation().x; if (x > 4 && x < sim.arena.viewW - 1) seen.add(k); });
    }
    expect(seen.size).toBe(sim.chase!.obstacles.length);
  });

  it('plays the same every time (same seed and buttons: the same world)', async () => {
    const hashes: string[] = [];
    for (let k = 0; k < 2; k++) {
      const sim = await chase(9);
      for (let i = 0; i < 600; i++) sim.step([{ ...NEUTRAL, moveX: i % 90 < 60 ? 1 : -1, jump: i % 40 < 5 }, NEUTRAL]);
      hashes.push(hashSim(sim));
    }
    expect(hashes[0]).toBe(hashes[1]);
  });
});

// The training panel's "clear the loose things" (Sim.clearLoose) used to take the chase's own rocks and logs away while the chase still
// moved them: the physics engine stopped on the next step.
describe('clearing the loose things on the Mammoth Chase', () => {
  it('keeps its rocks and logs, and the chase runs on', async () => {
    const sim = await chase();
    run(sim, 30);
    const riders = sim.chase!.obstacles.length;
    sim.clearLoose();
    run(sim, 120);
    expect(sim.chase!.obstacles.every((o) => sim.props.includes(o))).toBe(true);
    expect(sim.chase!.obstacles.length).toBe(riders);
  });
});

import { describe, expect, it } from 'vitest';
import { hashSim } from './hash';
import { makeRng } from './rng';
import type { PlayerInput } from './types';
import { Sim } from './world';

/** Random but sticky inputs for every fighter: buttons are held for a while, so grabs, charges, flips and crouches really happen. */
function fuzzer(seed: number) {
  const r = makeRng(seed);
  const hold = [0, 0, 0, 0].map(() => ({ left: 0, cur: {} as Partial<PlayerInput> }));
  return (n: number): PlayerInput[] =>
    Array.from({ length: n }, (_, i) => {
      const h = hold[i];
      if (h.left-- <= 0) {
        h.left = 5 + Math.floor(r() * 50);
        h.cur = { moveX: r() < 0.3 ? 0 : r() * 2 - 1, jump: r() < 0.25, aim: (r() * 2 - 1) * Math.PI, attack: r() < 0.5, crouch: r() < 0.15, flip: r() < 0.2, drop: r() < 0.1, dodge: r() < 0.05 };
      }
      return { moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...h.cur };
    });
}

function finiteAndInBounds(sim: Sim, frame: number): string | null {
  for (const f of sim.fighters) {
    if (!Number.isFinite(f.hp)) return `frame ${frame}: hp of fighter ${f.index} is ${f.hp}`;
    for (const p of f.parts) {
      const t = p.body.translation(), v = p.body.linvel();
      if (![t.x, t.y, p.body.rotation(), v.x, v.y, p.body.angvel()].every(Number.isFinite)) return `frame ${frame}: ${p.role} of fighter ${f.index} is not a number`;
      if (!f.limp && (p.role !== 'stick' || f.grip) && (Math.abs(t.x) > 100 || t.y < -100 || t.y > 100)) return `frame ${frame}: ${p.role} of fighter ${f.index} flew to ${t.x.toFixed(0)},${t.y.toFixed(0)}`;
      if (!f.limp && Math.hypot(v.x, v.y) > 150) return `frame ${frame}: ${p.role} of fighter ${f.index} reached ${Math.hypot(v.x, v.y).toFixed(0)} m/s`;
    }
  }
  return null;
}

async function fight(seed: number, players: number, frames: number) {
  const sim = await Sim.create(seed, players, false);
  const inputs = fuzzer(seed * 7 + 1);
  const seen = new Set<string>();
  let problem: string | null = null;
  const t0 = performance.now();
  for (let i = 0; i < frames && !problem; i++) {
    sim.step(inputs(players));
    for (const e of sim.events) seen.add(e.t);
    problem = finiteAndInBounds(sim, i);
  }
  return { sim, problem, seen, msPerStep: (performance.now() - t0) / frames, hash: hashSim(sim) };
}

// Longer runs find rarer bugs: raise the frame counts below (14400 = 4 minutes of play per seed) when hunting.
describe('soak: random 4-player fights', () => {
  it.each([1, 2, 3, 4, 5, 6])('seed %i: 50 seconds of random play stays finite, in bounds, and fast', async (seed) => {
    const r = await fight(seed, 4, 3000);
    expect(r.problem).toBeNull();
    expect(r.msPerStep).toBeLessThan(6); // the 60 Hz budget is 16.7 ms for everything; the sim alone must stay well under half
  }, 120_000);

  it('the fuzzer really exercises the mechanics', async () => {
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 4]) for (const e of (await fight(seed, 4, 3000)).seen) seen.add(e);
    for (const t of ['hit', 'jump', 'punch', 'dodge', 'drop', 'pickup', 'die', 'grab']) expect(seen, t).toContain(t);
  }, 120_000);

  it('is deterministic: the same seed and the same random inputs give identical state', async () => {
    const a = await fight(9, 4, 3000), b = await fight(9, 4, 3000);
    expect(a.hash).toBe(b.hash);
  }, 60_000);
});

import { describe, expect, it } from 'vitest';
import { fuzzer } from './fuzz';
import { makeRng } from './rng';
import { hashSim } from './hash';
import { Sim } from './world';

function finiteAndInBounds(sim: Sim, frame: number): string | null {
  for (const f of sim.fighters) {
    if (!Number.isFinite(f.hp)) return `frame ${frame}: hp of fighter ${f.index} is ${f.hp}`;
    for (const p of f.parts) {
      const t = p.body.translation(), v = p.body.linvel();
      if (![t.x, t.y, p.body.rotation(), v.x, v.y, p.body.angvel()].every(Number.isFinite)) return `frame ${frame}: ${p.role} of fighter ${f.index} is not a number`;
      if (!f.limp && (p.role !== 'stick' || f.grip) && !(f.armLost && (p.role === 'upper' || p.role === 'fore')) && !(f.legLost.some(Boolean) && (p.role === 'thigh' || p.role === 'shin')) && (Math.abs(t.x) > 100 || t.y < -100 || t.y > 100)) return `frame ${frame}: ${p.role} of fighter ${f.index} flew to ${t.x.toFixed(0)},${t.y.toFixed(0)}`;
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
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) for (const e of (await fight(seed, 4, 3000)).seen) seen.add(e);
    for (const t of ['hit', 'jump', 'dodge', 'drop', 'pickup', 'die', 'grab']) expect(seen, t).toContain(t); // (crashes are rarer since knockdowns tumble less: knockdown.test.ts slams one into a wall)
  }, 120_000);

  it('random injuries during random play never crash the physics or leave the fighters broken', async () => {
    const sim = await Sim.create(21, 4, false);
    const inputs = fuzzer(99);
    const r = makeRng(5);
    const maim = (f: unknown, p: unknown) => (sim as unknown as { maim(f: unknown, p: unknown, nx: number, ny: number): void }).maim(f, p, r() * 2 - 1, -0.3);
    let problem: string | null = null, maimed = 0;
    for (let i = 0; i < 3000 && !problem; i++) {
      if (i % 120 === 60) {
        const alive = sim.fighters.filter((f) => !f.limp);
        if (alive.length) {
          const f = alive[Math.floor(r() * alive.length)];
          const part = [f.upper, f.fore, f.legs[0].thigh, f.legs[0].shin, f.legs[1].thigh, f.legs[1].shin][Math.floor(r() * 6)];
          maim(f, part);
          maimed += +(f.armLost || f.legLost[0] || f.legLost[1]);
        }
      }
      sim.step(inputs(4));
      problem = finiteAndInBounds(sim, i);
    }
    expect(problem).toBeNull();
    expect(maimed).toBeGreaterThan(5);
  }, 120_000);

  it('is deterministic: the same seed and the same random inputs give identical state', async () => {
    const a = await fight(9, 4, 3000), b = await fight(9, 4, 3000);
    expect(a.hash).toBe(b.hash);
  }, 60_000);
});

import { describe, expect, it } from 'vitest';
import { damageFor, impactValue } from './combat';
import { hashSim } from './hash';
import type { PlayerInput } from './types';
import { Sim } from './world';

// Scripted player: walk toward the dummy, then sweep the aim around while swinging. Pure function of the frame number.
function script(frame: number): PlayerInput {
  return {
    moveX: frame < 90 ? 1 : 0,
    jump: frame % 150 === 100,
    aim: Math.sin(frame * 0.12) * 1.8,
    attack: frame % 40 < 20,
    cock: frame % 100 > 60, // exercise the cock-back and release path too
    grab: false,
  };
}

async function run(seed: number, frames: number) {
  const sim = await Sim.create(seed);
  let hits = 0;
  for (let i = 0; i < frames; i++) {
    sim.step([script(i)]);
    hits += sim.events.filter((e) => e.t === 'hit').length;
  }
  return { sim, hits, hash: hashSim(sim) };
}

describe('determinism', () => {
  it('same seed + same inputs for 1000 frames gives identical state hashes', async () => {
    const a = await run(1234, 1000);
    const b = await run(1234, 1000);
    expect(a.hash).toBe(b.hash);
    expect(a.hits).toBe(b.hits);
    expect(a.hits).toBeGreaterThan(0); // the test must actually exercise combat
  });

  it('different inputs give a different hash (the hash is not vacuous)', async () => {
    const a = await run(1234, 300);
    const sim = await Sim.create(1234);
    for (let i = 0; i < 300; i++) sim.step([{ ...script(i), moveX: -1 }]);
    expect(hashSim(sim)).not.toBe(a.hash);
  });
});

describe('combat maths', () => {
  it('resting contact does nothing', () => {
    expect(damageFor(impactValue(0, 3.5, 6, 1))).toBe(0);
    expect(damageFor(impactValue(-5, 3.5, 6, 1))).toBe(0);
  });
  it('heavier and faster hits hurt more, capped at damageMax', () => {
    const slow = damageFor(impactValue(4, 3.5, 6, 1));
    const fast = damageFor(impactValue(9, 3.5, 6, 1));
    expect(fast).toBeGreaterThan(slow);
    expect(damageFor(impactValue(1000, 3.5, 6, 1))).toBeLessThanOrEqual(60);
  });
});

import { describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import { damageFor, impactValue } from './combat';
import { hashSim } from './hash';
import type { PlayerInput } from './types';
import { Sim } from './world';

// Scripted player: walk to about 3 m from the dummy, then keep charging a lunge at it and releasing, with a jump and a dodge
// thrown in. Pure function of the frame number.
function script(frame: number): PlayerInput {
  const phase = frame % 110;
  return {
    moveX: frame < 38 ? 1 : 0,
    jump: frame % 250 === 200,
    aim: frame < 38 ? Math.PI / 2 : 0.1,
    attack: frame >= 50 && phase < 30, // hold 30 frames, release, repeat
    dodge: frame % 400 === 330,
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
    expect(damageFor(impactValue(0, 2.2))).toBe(0);
    expect(damageFor(impactValue(-5, 2.2))).toBe(0);
  });
  it('heavier and faster hits hurt more, capped at damageMax', () => {
    const slow = damageFor(impactValue(4, 2.2));
    const fast = damageFor(impactValue(9, 2.2));
    expect(fast).toBeGreaterThan(slow);
    expect(damageFor(impactValue(1000, 2.2))).toBeLessThanOrEqual(T.combat.damageMax);
  });
});

describe('unarmed punch', () => {
  // Same scripted fight, but with empty hands: left-click is now a punch, so this exercises the punch animation path.
  function punchScript(frame: number): PlayerInput {
    return { moveX: frame < 80 ? 1 : 0, jump: false, aim: Math.sin(frame * 0.05) * 0.4, attack: frame % 40 === 5, dodge: false };
  }
  async function runUnarmed(frames: number) {
    const was = T.fighter.startArmed;
    T.fighter.startArmed = false;
    try {
      const sim = await Sim.create(7);
      let hits = 0;
      for (let i = 0; i < frames; i++) {
        sim.step([punchScript(i)]);
        hits += sim.events.filter((e) => e.t === 'hit').length;
      }
      return { hash: hashSim(sim), hits, armed: !!sim.fighters[0].grip };
    } finally {
      T.fighter.startArmed = was;
    }
  }
  it('is deterministic, starts unarmed, and punches can land', async () => {
    const a = await runUnarmed(900);
    const b = await runUnarmed(900);
    expect(a.armed).toBe(false);
    expect(a.hash).toBe(b.hash);
    expect(a.hits).toBeGreaterThan(0);
  });
});

describe('dodge', () => {
  it('lets a fighter pass through another one, then comes back to the normal plane', async () => {
    const sim = await Sim.create(3);
    const P = () => sim.fighters[0], D = () => sim.fighters[1];
    const px = () => P().torso.body.translation().x, dx = () => D().torso.body.translation().x;
    const walk = { moveX: 1, jump: false, aim: Math.PI / 2, attack: false, dodge: false };
    while (dx() - px() > 1.6) sim.step([walk]);
    sim.step([{ ...walk, dodge: true }]);
    expect(P().inBack).toBe(true);
    let minGap = 99;
    for (let i = 0; i < 30; i++) {
      sim.step([walk]);
      minGap = Math.min(minGap, Math.abs(dx() - px()));
    }
    expect(minGap).toBeLessThan(0.3); // they overlapped: nothing stopped the walk
    expect(px()).toBeGreaterThan(dx()); // and the player came out the other side
    expect(D().hp).toBe(100); // nobody got hurt
    for (let i = 0; i < 120; i++) sim.step([{ ...walk, moveX: 0 }]);
    expect(P().inBack).toBe(false);
  });
});

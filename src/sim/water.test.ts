import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import { hashSim } from './hash';
import { NEUTRAL } from './types';
import type { PlayerInput } from './types';
import { surfaceY } from './water';
import { Sim } from './world';

// The sea and the ship (Pirates: Ship Deck). Every number here comes from tuning.water, tuning.swim and tuning.boat.
const saved = { cg: T.eras.changeGameplay, ms: T.eras.mixStarts, ly: T.props.lying, sp: T.spawn.enabled };
beforeAll(() => { T.eras.changeGameplay = true; T.eras.mixStarts = false; T.props.lying = false; T.spawn.enabled = false; });
afterAll(() => { T.eras.changeGameplay = saved.cg; T.eras.mixStarts = saved.ms; T.props.lying = saved.ly; T.spawn.enabled = saved.sp; });

async function ship(count = 2, dummy = false): Promise<Sim> {
  const sim = await Sim.create(3, count, dummy);
  sim.forceEra = 'pirates'; sim.forceMap = 0;
  sim.reset();
  return sim;
}
const run = (sim: Sim, n: number, input: (i: number) => PlayerInput = () => NEUTRAL) => { for (let k = 0; k < n; k++) sim.step([input(0), input(1), input(2), input(3)]); };
/** Move a whole fighter (every part together) to put its body at (x, y), at rest. */
function moveTo(sim: Sim, who: number, x: number, y: number): void {
  const f = sim.fighters[who], t = f.torso.body.translation(), dx = x - t.x, dy = y - t.y;
  for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + dx, y: q.y + dy }, true); p.body.setLinvel({ x: 0, y: 0 }, true); p.body.setAngvel(0, true); }
}
const deckTop = (sim: Sim) => sim.boat!.body.translation().y - T.boat.depth / 2;

describe('the sea and the ship', () => {
  it('the ship floats with its deck where the platform is, level and in the middle, with the fighters standing on it', async () => {
    const sim = await ship();
    expect(sim.boat).toBeTruthy();
    run(sim, 300);
    const A = sim.arena, b = sim.boat!.body;
    expect(Math.abs(deckTop(sim) - A.platformTop)).toBeLessThan(0.3);
    expect(Math.abs(b.rotation())).toBeLessThan(0.08);
    expect(Math.abs(b.translation().x - (A.platformX + A.platformW / 2))).toBeLessThan(0.5);
    for (const f of sim.fighters) { expect(f.grounded).toBe(true); expect(f.limp).toBe(false); expect(f.wet).toBe(0); }
  });

  it('weight at one end tips the deck, and it rights itself when they get off', async () => {
    const sim = await ship(4);
    run(sim, 60);
    const A = sim.arena, end = A.platformX + A.platformW - 0.6;
    for (let i = 0; i < 4; i++) moveTo(sim, i, end - i * 0.5, A.platformTop - T.stand.height - 0.1);
    run(sim, 150);
    const tipped = sim.boat!.body.rotation();
    console.log(`four fighters at one end tip the deck ${(tipped * 180 / Math.PI).toFixed(1)} degrees`);
    expect(Math.abs(tipped)).toBeGreaterThan(0.05);
    for (let i = 0; i < 4; i++) moveTo(sim, i, 1 + i * 0.01, A.platformTop - 6); // all off (they fall into the sea, well away from the ship)
    run(sim, 240);
    expect(Math.abs(sim.boat!.body.rotation())).toBeLessThan(Math.abs(tipped) / 3);
  });

  it('a fighter in the water floats for the swim time, then sinks: a knock-off', async () => {
    const sim = await ship();
    const A = sim.arena, x = 2.0;
    moveTo(sim, 1, x, surfaceY(A, sim.frame, x));
    let fell = -1;
    for (let i = 0; i < T.swim.frames + 400 && fell < 0; i++) {
      run(sim, 1);
      if (i === 120) { // floating, at the surface, and counted as swimming
        const f = sim.fighters[1], t = f.torso.body.translation();
        expect(f.wet).toBeGreaterThan(T.swim.wetAt);
        expect(Math.abs(t.y - surfaceY(A, sim.frame, t.x))).toBeLessThan(0.5);
        expect(f.limp).toBe(false);
      }
      if (sim.events.some((e) => e.t === 'fall' && e.owner === 1)) fell = i;
    }
    console.log(`sank and knocked out ${(fell / 60).toFixed(1)} s after going in`);
    expect(fell).toBeGreaterThanOrEqual(T.swim.frames);
    expect(sim.roundOver).toBe(true); // the other one wins the round
  });

  it('a swimmer can kick up out of the water and climb back aboard', async () => {
    const sim = await ship();
    const A = sim.arena, x = A.platformX - 0.5; // just off the left end of the deck
    moveTo(sim, 0, x, surfaceY(A, sim.frame, x));
    let aboard = -1;
    for (let i = 0; i < 300 && aboard < 0; i++) {
      run(sim, 1, (k) => (k === 0 ? { ...NEUTRAL, moveX: 1, jump: i % 40 < 20 } : NEUTRAL));
      const f = sim.fighters[0];
      if (f.grounded && f.wet === 0 && f.torso.body.translation().x > A.platformX) aboard = i;
    }
    console.log(`back aboard after ${(aboard / 60).toFixed(2)} s`);
    expect(aboard).toBeGreaterThan(0);
    run(sim, 1);
    expect(sim.fighters[0].wetFrames).toBe(0); // the swim timer starts again
  });

  it('loose weapons float', async () => {
    const sim = await ship(2, true);
    const A = sim.arena;
    sim.spawnItem('cutlass', 2.5, A.platformTop - 2);
    run(sim, 300);
    const p = sim.props[sim.props.length - 1].body.translation();
    expect(Math.abs(p.y - surfaceY(A, sim.frame, p.x))).toBeLessThan(0.4);
  });

  it('is deterministic: the same fight on the ship twice gives the same state', async () => {
    const play = async () => {
      const sim = await ship(4);
      const A = sim.arena;
      moveTo(sim, 3, 2.5, surfaceY(A, 0, 2.5)); // one of them in the water
      run(sim, 900, (k) => ({ ...NEUTRAL, moveX: Math.sin(sim.frame / (40 + k * 7)), jump: sim.frame % (50 + k * 11) === 0, aim: k, attack: sim.frame % 90 < 20 }));
      return hashSim(sim);
    };
    expect(await play()).toBe(await play());
  }, 30_000);
});

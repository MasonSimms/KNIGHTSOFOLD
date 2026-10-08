import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import { hashSim } from './hash';
import { NEUTRAL } from './types';
import type { PlayerInput } from './types';
import { surfaceY } from './water';
import { ownerGroups, ropeGroups, syncStickGroups } from './fighter';
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
const deckTop = (sim: Sim) => sim.boats[0].body.translation().y - T.boat.depth / 2;

describe('the sea and the ship', () => {
  it('the ship floats with its deck where the platform is, level and in the middle, with the fighters standing on it', async () => {
    const sim = await ship();
    expect(sim.boats[0]).toBeTruthy();
    run(sim, 300);
    const A = sim.arena, b = sim.boats[0].body;
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
    const tipped = sim.boats[0].body.rotation();
    console.log(`four fighters at one end tip the deck ${(tipped * 180 / Math.PI).toFixed(1)} degrees`);
    expect(Math.abs(tipped)).toBeGreaterThan(0.05);
    for (let i = 0; i < 4; i++) moveTo(sim, i, 1 + i * 0.01, A.platformTop - 6); // all off (they fall into the sea, well away from the ship)
    run(sim, 240);
    expect(Math.abs(sim.boats[0].body.rotation())).toBeLessThan(Math.abs(tipped) / 3);
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

// Ship to Ship (Pirates map 1): two ships tied by two ropes; cut both and they drift apart.
describe('ship to ship', () => {
  beforeAll(() => { T.props.lying = true; }); // (the gangplank is one of the map's loose things)
  afterAll(() => { T.props.lying = false; });
  async function ships(count = 2): Promise<Sim> {
    const sim = await Sim.create(3, count, false);
    sim.forceEra = 'pirates'; sim.forceMap = 1;
    sim.reset();
    return sim;
  }
  const gap = (sim: Sim) => { const [a, b] = sim.boats; return b.body.translation().x - b.w / 2 - (a.body.translation().x + a.w / 2); };
  const ropes = (sim: Sim) => { const links = sim.props.filter((p) => p.weapon?.id === 'rope'); return [links.slice(0, T.rope.links), links.slice(T.rope.links)]; };
  const cut = (sim: Sim, rope: number) => { const l = ropes(sim)[rope][Math.floor(T.rope.links / 2)], t = l.body.translation(); sim.shootLoose(l, t.x, t.y, -1); };

  it('two ships float side by side, tied by sagging ropes, with the gangplank across the gap', async () => {
    const sim = await ships(4);
    expect(sim.boats.length).toBe(2);
    run(sim, 180);
    for (const b of sim.boats) expect(Math.abs(b.body.rotation())).toBeLessThan(0.12);
    expect(Math.abs(gap(sim) - 1.5)).toBeLessThan(0.5);
    const A = sim.arena;
    for (const r of ropes(sim)) for (const l of r) { expect(l.links?.length).toBeGreaterThan(0); expect(l.body.translation().y).toBeLessThan(A.platformTop); } // still tied, above the deck
    const plank = sim.props.find((p) => p.weapon?.id === 'gangplank')!;
    expect(Math.abs(plank.body.translation().y - A.platformTop)).toBeLessThan(0.4);
    for (const f of sim.fighters) { expect(f.grounded).toBe(true); expect(f.wet).toBe(0); }
  });

  it('one rope cut, they stay together; both cut, they drift apart and the gangplank falls in', async () => {
    const sim = await ships();
    run(sim, 60);
    cut(sim, 0);
    run(sim, 240);
    expect(gap(sim)).toBeLessThan(2.2);
    cut(sim, 1);
    run(sim, 720);
    console.log(`both ropes cut: the gap opens to ${gap(sim).toFixed(2)} m`);
    expect(gap(sim)).toBeGreaterThan(3.5);
    const plank = sim.props.find((p) => p.weapon?.id === 'gangplank')!;
    expect(plank.body.translation().y).toBeGreaterThan(sim.arena.platformTop + 0.4); // in the sea
  }, 30_000);

  it('a brawl on the ships never levers them over (a rope follows its ships but never pulls them)', async () => {
    const sim = await ships(4);
    let worst = 0;
    for (let k = 0; k < 1200; k++) {
      run(sim, 1, (i) => ({ ...NEUTRAL, moveX: Math.sin(sim.frame / (30 + i * 9)), jump: sim.frame % (40 + i * 13) === 0, aim: -0.6 - i * 0.5, attack: sim.frame % 70 < 25 }));
      for (const b of sim.boats) worst = Math.max(worst, Math.abs(b.body.rotation()));
    }
    console.log(`worst tilt in a 20 s brawl: ${(worst * 180 / Math.PI).toFixed(1)} degrees`);
    expect(worst).toBeLessThan(0.3); // 17 degrees, what four fighters piled on one end of the long ship tip it (the old rope bug levered them far past this and held them there)
  }, 30_000);

  it('a weapon meets a rope, a body passes through it', async () => {
    const meets = (a: number, b: number) => ((a >>> 16) & b & 0xffff) !== 0 && ((b >>> 16) & a & 0xffff) !== 0;
    const sim = await ships();
    const f = sim.fighters[0];
    syncStickGroups(f);
    expect(meets(ropeGroups, f.stick!.colliders[0].collisionGroups())).toBe(true);
    expect(meets(ropeGroups, ownerGroups(0))).toBe(false);
    expect(meets(ropeGroups, ropeGroups)).toBe(false); // (the two ropes cross without tangling)
  });

  it('is deterministic: the same fight across the two ships twice gives the same state', async () => {
    const play = async () => {
      const sim = await ships(4);
      run(sim, 900, (k) => ({ ...NEUTRAL, moveX: Math.sin(sim.frame / (40 + k * 7)), jump: sim.frame % (50 + k * 11) === 0, aim: k, attack: sim.frame % 90 < 20 }));
      return hashSim(sim);
    };
    expect(await play()).toBe(await play());
  }, 30_000);
});

describe('tidal cove', () => {
  it('the tide comes in over the round: the low sand goes under, the rocks stay dry, and the next round starts at low tide again', async () => {
    const sim = await Sim.create(3, 2, false);
    sim.forceEra = 'pirates'; sim.forceMap = 3; sim.reset();
    const A = sim.arena, tide = A.sea!.tide!, sand = A.platformTop, rock = A.platformTop - A.ground[0].up!;
    const water = () => surfaceY(A, sim.frame, 8);
    expect(water()).toBeGreaterThan(sand); // low tide: the sand is dry
    moveTo(sim, 1, 3.75, rock - T.stand.height); // one fighter climbs onto the rocks; the other stays down on the sand
    run(sim, Math.round((tide.seconds * 0.85) / T.sim.dt));
    expect(sand - water()).toBeGreaterThan(1); // the sea stands over a metre deep on the sand...
    expect(water()).toBeGreaterThan(rock); // ...and still under the rocks
    const [low, high] = sim.fighters;
    expect(low.wet > T.swim.wetAt || low.limp).toBe(true); // swimming, or gone under
    expect(high.wet).toBe(0);
    sim.reset();
    expect(water()).toBeGreaterThan(sand); // a new round: low tide
  }, 30_000);
});

describe('sinking wreck', () => {
  it('the wreck goes down over the round: bow under, stern still dry; afloat again next round', async () => {
    const sim = await Sim.create(3, 2, false);
    sim.forceEra = 'pirates'; sim.forceMap = 4; sim.reset();
    const A = sim.arena, s = A.boats[0].sinks!, end = (side: number) => { const b = sim.boats[0].body, t = b.translation(), a = b.rotation(), r = (side * sim.boats[0].w) / 2; return t.y + r * Math.sin(a) - (sim.boats[0].depth / 2) * Math.cos(a); }; // the deck's height at one end
    const afloat = () => { expect(Math.abs(sim.boats[0].body.rotation())).toBeLessThan(0.08); expect(end(1)).toBeLessThan(surfaceY(A, sim.frame, A.boats[0].x + A.boats[0].w)); };
    run(sim, 30);
    afloat(); // level, the bow above the water
    run(sim, Math.round(s.seconds / T.sim.dt));
    expect(sim.boats[0].body.rotation()).toBeGreaterThan(s.tilt * 0.4); // leaning bow down (less than `tilt`: whoever stands at the stern holds it up)
    expect(end(1)).toBeGreaterThan(surfaceY(A, sim.frame, A.boats[0].x + A.boats[0].w)); // the bow is under
    expect(end(-1)).toBeLessThan(surfaceY(A, sim.frame, A.boats[0].x)); // the stern is not
    sim.reset(); run(sim, 30);
    afloat();
  }, 30_000);
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eras } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { setBackPlane } from './fighter';
import { NEUTRAL } from './types';
import { arenaFor, Sim } from './world';

// Every map of every era: these tests are about the eras' own arenas, so they turn that on (the other tests run with it off).
beforeAll(() => { T.eras.changeGameplay = true; });
afterAll(() => { T.eras.changeGameplay = false; });

const maps = eras.flatMap((e) => Array.from({ length: 1 + (e.alt?.length ?? 0) }, (_, map) => [e.id, map] as const));

describe('maps', () => {
  it.each(maps)('%s map %i: everyone starts standing on solid ground (not over a gap, not stuck under a ledge)', async (era, map) => {
    for (const [players, dummy] of [[4, false], [2, true]] as const) { // a 4 player fight, and playing alone with the dummy
      const sim = await Sim.create(5, players, dummy);
      sim.forceEra = era; sim.forceMap = map; sim.reset();
      const xs = sim.fighters.map((f) => f.torso.body.translation().x);
      for (let i = 0; i < 120; i++) sim.step(sim.fighters.map(() => NEUTRAL));
      sim.fighters.forEach((f, i) => {
        const p = f.torso.body.translation(), why = `${players} players, fighter ${i}`;
        expect(f.hp, why).toBeGreaterThan(0);
        expect(Math.abs(sim.arena.platformTop - T.stand.height - p.y), why).toBeLessThan(0.15); // still at standing height on the floor
        expect(Math.abs(p.x - xs[i]), why).toBeLessThan(0.5);
      });
    }
  });

  // Owner: platforms must never be in the way (no getting stuck under them, and room to swing a weapon under them, like SpiderHeck),
  // and a jump must get you onto every one of them.
  it.each(maps)('%s map %i: every ledge leaves room to swing under it, and a jump gets you onto it', (era, map) => {
    const A = arenaFor(era, map);
    const reach = T.motion.jumpSpeed ** 2 / (2 * T.sim.gravity) - 0.2; // how high a full jump lifts your feet, less a little to land with
    type Surface = { x: number; w: number; up: number };
    const surfaces: Surface[] = [...(A.ground.length ? A.ground : [{ x: A.platformX, w: A.platformW }]).map((g) => ({ ...g, up: 0 })), ...A.ledges];
    const near = (a: Surface, b: Surface, by: number) => a.x < b.x + b.w + by && b.x < a.x + a.w + by; // overlapping (or within `by` metres) side to side
    for (const l of A.ledges) {
      const why = `ledge at x ${l.x}, ${l.up} m up`;
      for (const s of surfaces) {
        if (s !== l && s.up < l.up && near(s, l, 0)) expect(l.up - A.ledgeThick - s.up, `${why}: room under it`).toBeGreaterThan(T.arena.ledgeHeadroom - 1e-6);
      }
      expect(surfaces.some((s) => s !== l && s.up <= l.up && near(s, l, 2.5) && l.up - s.up <= reach), `${why}: a jump from somewhere gets you onto it`).toBe(true);
    }
  });

  // Owner: you should never get stuck on a map. Walk (and hop) from one end of the ground to the other.
  it.each(maps)('%s map %i: you can walk and hop across it without getting stuck', async (era, map) => {
    for (const hop of [false, true]) {
      const sim = await Sim.create(5, 2, false);
      sim.forceEra = era; sim.forceMap = map; sim.reset();
      const A = sim.arena, slabs = A.ground.length ? A.ground : [{ x: A.platformX, w: A.platformW }];
      const x0 = slabs[0].x + 0.5, x1 = slabs[slabs.length - 1].x + slabs[slabs.length - 1].w - 0.5;
      const f = sim.fighters[0], other = sim.fighters[1];
      setBackPlane(other, true); other.dodge = 1e9; // the other fighter steps aside (we pass through it)
      const t = f.torso.body.translation();
      for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + x0 - t.x, y: q.y }, true); }
      let n = 0;
      while (f.torso.body.translation().x < x1 && n++ < 240) sim.step([{ ...NEUTRAL, moveX: 1, jump: hop && f.grounded && n % 20 < 10 }, NEUTRAL]);
      expect(f.torso.body.translation().x, hop ? 'hopping' : 'walking').toBeGreaterThan(x1); // across in under 4 s (a straight run takes about 2)
      expect(f.limp).toBe(false);
    }
  });

  it('a weapon in your hand passes through a ledge: jumping under one with it raised never hooks you on it', async () => {
    const sim = await Sim.create(5, 2, false);
    sim.forceEra = 'medieval'; sim.reset();
    const A = sim.arena, L = A.ledges[0], f = sim.fighters[0];
    const t = f.torso.body.translation();
    for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + L.x + L.w / 2 - t.x, y: q.y }, true); } // under the middle of the ledge
    const up = { ...NEUTRAL, aim: -Math.PI / 2 };
    for (let i = 0; i < 30; i++) sim.step([up, NEUTRAL]);
    let clubTop = Infinity;
    for (let i = 0; i < 40; i++) {
      sim.step([{ ...up, jump: true }, NEUTRAL]);
      const c = f.stick!.body.translation(), a = f.stick!.body.rotation(), r = f.stick!.weapon!.length / 2;
      clubTop = Math.min(clubTop, c.y - Math.abs(Math.sin(a)) * r);
    }
    expect(clubTop).toBeLessThan(A.platformTop - L.up); // the club went up through the ledge (the head stops at its underside)
    for (let i = 0; i < 60; i++) sim.step([up, NEUTRAL]);
    expect(f.grounded).toBe(true);
    expect(Math.abs(A.platformTop - T.stand.height - f.torso.body.translation().y)).toBeLessThan(0.15); // back on the floor, not hanging from the ledge
  });
});

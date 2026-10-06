import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eras } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { setBackPlane } from './fighter';
import { NEUTRAL } from './types';
import { arenaFor, floorAt, Sim } from './world';

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
      const sorted = [...xs].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1], 'start spots more than 2.2 m apart (at 2, the clubs start inside each other)').toBeGreaterThan(2.2);
      for (let i = 0; i < 120; i++) sim.step(sim.fighters.map(() => NEUTRAL));
      sim.fighters.forEach((f, i) => {
        const p = f.torso.body.translation(), why = `${players} players, fighter ${i}`;
        expect(f.hp, why).toBeGreaterThan(0);
        const floor = sim.boat ? sim.boat.body.translation().y - T.boat.depth / 2 : floorAt(sim.arena, xs[i]); // (a ship's deck sits lower with people on it; a roof can be higher)
        expect(Math.abs(floor - T.stand.height - p.y), why).toBeLessThan(0.15); // still at standing height on the floor
        if (!sim.arena.chase) expect(Math.abs(p.x - xs[i]), why).toBeLessThan(0.5); // (a treadmill carries you)
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
    if (arenaFor(era, map).chase || arenaFor(era, map).train) return; // (a treadmill: you run to stand still, chase.test.ts; the train sweeps you off, train.test.ts)
    // What must be jumped: tar pits, and gaps between the ground slabs with no bridge or stepping stone (the alleys between roofs).
    const A0 = arenaFor(era, map), sorted = [...A0.ground].sort((a, b) => a.x - b.x), pits = A0.tar.map((p) => ({ x: p.x, w: p.w }));
    for (let i = 1; i < sorted.length; i++) {
      const g0 = sorted[i - 1].x + sorted[i - 1].w, g1 = sorted[i].x;
      const crossed = (A0.bridge && A0.bridge.x0 <= g0 + 0.1 && A0.bridge.x1 >= g1 - 0.1) || A0.ledges.some((l) => l.up < 0.3 && l.x < g1 && l.x + l.w > g0);
      if (g1 - g0 > 0.3 && !crossed) pits.push({ x: g0, w: g1 - g0 });
    }
    for (const hop of pits.length ? [true] : [false, true]) { // (a pit is jumped: walking into it is the point)
      const sim = await Sim.create(5, 2, false);
      sim.forceEra = era; sim.forceMap = map; sim.reset();
      const A = sim.arena, slabs = A.ground.length ? A.ground : [{ x: A.platformX, w: A.platformW }];
      const doors = sim.props.filter((p) => p.body.isFixed()).map((p) => p.body.translation().x); // shop windows: across the street is up to the far one
      const x0 = slabs[0].x + 0.5, x1 = Math.min(slabs[slabs.length - 1].x + slabs[slabs.length - 1].w - 1.0, ...doors.filter((d) => d > x0 + 2).map((d) => d - 0.6)); // (to 1 m from the far end: some maps have a wall there)
      const f = sim.fighters[0], other = sim.fighters[1];
      setBackPlane(other, true); other.dodge = 1e9; // the other fighter steps aside (we pass through it)
      for (const p of [...sim.props]) if (!p.links?.length && (!hop || p.body.isFixed())) sim.removeBody(p, undefined); // walking checks the ground itself (a crate is shoved along until it jams, a standing stone is jumped); a window is a door you break
      const t = f.torso.body.translation();
      for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + x0 - t.x, y: q.y }, true); }
      let n = 0;
      const block = (p: { back?: boolean; body: { mass(): number; translation(): { x: number; y: number } } }, x: number) => !p.back && p.body.mass() > T.props.maxLift && p.body.translation().y > A.platformTop - 1 && p.body.translation().x - x > 0 && p.body.translation().x - x < 1.2;
      const leap = () => { const x = f.torso.body.translation().x; return pits.some((p) => x > p.x - 0.6 && x < p.x + p.w) || sim.props.some((p) => block(p, x)); }; // a pit or a standing stone: a full jump
      const near = () => { const x = f.torso.body.translation().x; return pits.some((p) => x > p.x - 2 && x < p.x); }; // (walk up to a pit's edge rather than hop into it)
      while (f.torso.body.translation().x < x1 && n++ < 240) sim.step([{ ...NEUTRAL, moveX: 1, jump: hop && (leap() ? !(f.grounded && f.prevJump && f.torso.body.linvel().y > -1) : f.grounded && n % 20 < 10 && !near()) }, NEUTRAL]);
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

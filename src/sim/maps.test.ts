import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eras } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { NEUTRAL } from './types';
import { Sim } from './world';

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
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mapNamed } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { NEUTRAL } from './types';
import { Sim } from './world';

beforeAll(() => { T.eras.changeGameplay = true; });
afterAll(() => { T.eras.changeGameplay = false; });

async function onMap(map: number) {
  const sim = await Sim.create(5, 2, false);
  sim.forceEra = 'vikings'; sim.forceMap = map; sim.reset();
  return sim;
}
const put = (sim: Sim, x: number, y: number) => { const f = sim.fighters[0], t = f.torso.body.translation(); for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + x - t.x, y: q.y + y - t.y }, true); } };

describe('the Frozen River', () => {
  it('on the ice you take far longer to stop when you stop running', async () => {
    const stopping = async (map: number) => { // frames from letting go of the run until you have (nearly) stopped
      const sim = await onMap(map), f = sim.fighters[0];
      put(sim, (sim.arena.ground[0]?.x ?? sim.arena.platformX) + 1, f.torso.body.translation().y); // (at the left of the floor)
      for (let i = 0; i < 45; i++) sim.step([{ ...NEUTRAL, moveX: 1 }, NEUTRAL]);
      let n = 0;
      while (Math.abs(f.torso.body.linvel().x) > 0.5 && n < 300) { sim.step([NEUTRAL, NEUTRAL]); n++; }
      return n;
    };
    const ice = await stopping(mapNamed('vikings', 'Frozen River')), ground = await stopping(0);
    expect(ice).toBeGreaterThan(ground * 2.5); // (about 3x at arena.ice 0.85)
  });

  it('a hard landing on the river breaks the ice', async () => {
    const sim = await onMap(mapNamed('vikings', 'Frozen River')), A = sim.arena;
    put(sim, 12, A.platformTop - 4); // dropped from high above the middle of the river
    for (let i = 0; i < 60; i++) sim.step([NEUTRAL, NEUTRAL]);
    expect(sim.bridge.some((p) => !p.links?.length)).toBe(true);
  });
});

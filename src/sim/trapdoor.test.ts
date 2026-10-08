import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mapNamed } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { doorAngle } from './trapdoor';
import { NEUTRAL } from './types';
import { Sim } from './world';

beforeAll(() => { T.eras.changeGameplay = true; });
afterAll(() => { T.eras.changeGameplay = false; });

describe('trapdoors', () => {
  it('whoever stands on a trapdoor when it opens drops into the pit; the floor beside it holds; then it shuts', async () => {
    const sim = await Sim.create(5, 2, false);
    sim.forceEra = 'gladiators'; sim.forceMap = mapNamed('gladiators', 'Colosseum Floor'); sim.reset();
    const A = sim.arena, door = A.trapdoors[0], D = T.trapdoor, run = (s: number) => { for (let i = 0; i < Math.round(s / T.sim.dt); i++) sim.step([NEUTRAL, NEUTRAL]); };
    const put = (who: number, x: number) => { const f = sim.fighters[who], t = f.torso.body.translation(); for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + x - t.x, y: q.y }, true); } };
    put(0, door.x + door.w / 2); // on the door
    run(door.at - 0.5);
    expect(sim.fighters[0].torso.body.translation().y).toBeLessThan(A.platformTop); // still up, on the shut door
    run(1.5);
    expect(sim.fighters[0].torso.body.translation().y).toBeGreaterThan(A.platformTop + 1); // dropped through
    expect(sim.fighters[1].torso.body.translation().y).toBeLessThan(A.platformTop); // the other one, on the sand, did not
    expect(doorAngle(door, Math.round((door.at + D.open + D.close + 0.1) / T.sim.dt))).toBe(0); // shut again
  });
});

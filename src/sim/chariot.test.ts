import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mapNamed } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { chariotAt } from './chariot';
import { NEUTRAL } from './types';
import { Sim } from './world';

beforeAll(() => { T.eras.changeGameplay = true; });
afterAll(() => { T.eras.changeGameplay = false; });

describe('the runaway chariot', () => {
  it('flings whoever is on the track ahead of it and hurts them; the spina is safe; the next run comes back the other way', async () => {
    const sim = await Sim.create(5, 2, false);
    sim.forceEra = 'gladiators'; sim.forceMap = mapNamed('gladiators', 'Chariot Track'); sim.reset();
    const A = sim.arena, C = A.chariot!, spina = A.ledges[0];
    const put = (who: number, x: number, y: number) => { const f = sim.fighters[who], t = f.torso.body.translation(); for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + x - t.x, y: q.y + y - t.y }, true); } };
    const t0 = sim.fighters[0].torso.body.translation();
    put(0, 6, t0.y); // on the sand, in its way
    put(1, spina.x + spina.w / 2, t0.y - spina.up - 0.1); // up on the spina
    for (let i = 0; i < Math.round((C.at + 1.5) / T.sim.dt); i++) sim.step([NEUTRAL, NEUTRAL]); // the first run (left to right) has gone by
    const [low, high] = sim.fighters;
    expect(low.torso.body.translation().x - 6).toBeGreaterThan(3); // flung ahead of it
    expect(low.hp).toBeLessThan(T.fighter.hp);
    expect(sim.chariot!.hit.has(low.index)).toBe(true);
    expect(sim.chariot!.hit.has(high.index)).toBe(false); // the spina: it ran underneath
    expect(high.limp).toBe(false);
    expect(chariotAt(A, Math.round((C.at + C.cycle + 0.5) / T.sim.dt)).dir).toBe(-C.dir); // and back the other way next time
  });
});

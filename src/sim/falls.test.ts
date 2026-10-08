import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mapNamed } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { fallsOf } from './falls';
import { NEUTRAL } from './types';
import { Sim } from './world';

beforeAll(() => { T.eras.changeGameplay = true; });
afterAll(() => { T.eras.changeGameplay = false; });

describe('the aqueduct', () => {
  it('its stone deck holds by itself; a block knocked out opens a gap the water pours through, pushing down what is in it', async () => {
    const sim = await Sim.create(5, 2, false);
    sim.forceEra = 'gladiators'; sim.forceMap = mapNamed('gladiators', 'Aqueduct Bridge'); sim.reset();
    const run = (n: number) => { for (let i = 0; i < n; i++) sim.step([NEUTRAL, NEUTRAL]); };
    run(120);
    expect(fallsOf(sim)).toEqual([]); // nobody has touched it: every block in its place
    const block = sim.bridge[5], home = sim.bridgeHome[5];
    (sim as unknown as { ripFree(p: unknown): void }).ripFree(block); // knocked out, as a slam does (world.ts resolveBridge)...
    block.body.setTranslation({ x: home.x, y: home.y + 4 }, true); // ...and fallen
    run(1);
    const gaps = fallsOf(sim), gap = gaps[0];
    expect(gaps.length).toBe(1);
    expect(gap.x0).toBeLessThan(home.x);
    expect(gap.x1).toBeGreaterThan(home.x);
    sim.spawnItem('plank', home.x, home.y + 0.5); // something dropped into the falling water falls faster than freely
    const crate = sim.props[sim.props.length - 1];
    run(10);
    expect(crate.body.linvel().y).toBeGreaterThan(T.sim.gravity * (10 / 60) * 1.15); // (a free fall: gravity alone)
  });
});

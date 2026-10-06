import { describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import { NEUTRAL } from './types';
import type { SimEvent } from './types';
import { Sim } from './world';

// Blocks (stones, crates, panes): square physics bodies. Heavy ones cannot be lifted, and crush whoever they come down on.
type Internals = { itemOf(p: unknown): unknown };
async function duel() {
  const sim = await Sim.create(5, 2, false);
  for (let i = 0; i < 30; i++) sim.step([NEUTRAL, NEUTRAL]);
  return sim;
}

describe('blocks', () => {
  it('a crate is a square block; a standing stone is too heavy to pick up, a boulder too, a plank is not', async () => {
    const sim = await duel();
    for (const kind of ['crate', 'upright', 'boulder', 'plank']) sim.spawnItem(kind, 12, sim.arena.platformTop - 3);
    const [crate, upright, boulder, plank] = sim.props.slice(-4);
    expect(crate.shapes[0].k).toBe('box');
    const I = sim as unknown as Internals;
    expect(I.itemOf(upright)).toBeNull();
    expect(I.itemOf(boulder)).toBeNull();
    expect(I.itemOf(plank)).not.toBeNull();
    expect(upright.body.mass()).toBeGreaterThan(T.props.maxLift);
  });

  it('a boulder dropped on a fighter crushes them (a hit, and hidden health lost); one set down gently does not', async () => {
    const sim = await duel(), v = sim.fighters[1], t = v.torso.body.translation(), hp0 = v.hp;
    sim.spawnItem('boulder', t.x, t.y - 4);
    const events: SimEvent[] = [];
    for (let i = 0; i < 90; i++) { sim.step([NEUTRAL, NEUTRAL]); events.push(...sim.events.map((e) => ({ ...e }))); }
    expect(events.some((e) => e.t === 'hit' && e.how === 'crush' && e.victim === 1)).toBe(true);
    expect(v.hp).toBeLessThan(hp0);

    const calm = await duel(), w = calm.fighters[1], hp1 = w.hp, q = w.torso.body.translation();
    calm.spawnItem('boulder', q.x + 2.5, calm.arena.platformTop - 0.35); // on the floor beside them
    for (let i = 0; i < 60; i++) calm.step([NEUTRAL, NEUTRAL]);
    expect(w.hp).toBe(hp1);
  });
});

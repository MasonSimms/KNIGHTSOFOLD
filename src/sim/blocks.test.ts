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

describe('Standing Stones', () => {
  const STONES = 4;
  async function stones() {
    T.eras.changeGameplay = true;
    const sim = await Sim.create(5, 2, false);
    sim.forceEra = 'caveman'; sim.forceMap = STONES; sim.reset();
    T.eras.changeGameplay = false;
    return sim;
  }
  it('left alone, the capstones stay up on their stones; everyone fights with stone axes', async () => {
    const sim = await stones();
    const caps = sim.props.filter((p) => p.weapon?.id === 'capstone'), y0 = caps.map((c) => c.body.translation().y);
    for (let i = 0; i < 300; i++) sim.step([NEUTRAL, NEUTRAL]);
    caps.forEach((c, i) => { expect(Math.abs(c.body.translation().y - y0[i])).toBeLessThan(0.05); expect(Math.abs(c.body.rotation())).toBeLessThan(0.05); });
    expect(sim.fighters[0].stick?.weapon?.id).toBe('stone-axe');
  });

  it('a hard knock tips a capstone off its stones onto whoever is under it: crushed', async () => {
    const sim = await stones(), cap = sim.props.find((p) => p.weapon?.id === 'capstone')!, v = sim.fighters[1];
    const c = cap.body.translation(), t = v.torso.body.translation();
    for (const p of v.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + c.x - 0.5 - t.x, y: q.y }, true); } // under it
    for (let i = 0; i < 20; i++) sim.step([NEUTRAL, NEUTRAL]);
    cap.body.applyImpulse({ x: 150, y: 0 }, true); // (a fighter flung into it: it slides off the left stone and that end comes down)
    const events: SimEvent[] = [];
    for (let i = 0; i < 120; i++) { sim.step([NEUTRAL, NEUTRAL]); events.push(...sim.events.map((e) => ({ ...e }))); }
    expect(events.some((e) => e.t === 'hit' && e.how === 'crush' && e.victim === 1)).toBe(true);
  });

  it('nobody bumps into the standing stones (they are a step behind); bullets pass in front of them', async () => {
    const sim = await stones(), up = sim.props.find((p) => p.weapon?.id === 'upright')!;
    expect(up.back).toBe(true);
    expect((sim as unknown as Internals).itemOf(up)).toBeNull();
  });
});

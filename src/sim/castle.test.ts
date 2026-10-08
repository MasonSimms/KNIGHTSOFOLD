import { describe, expect, it } from 'vitest';
import { mapNamed } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { NEUTRAL } from './types';
import { Sim } from './world';

// The Medieval castle maps' machines.
type Internals = { itemOf(p: unknown): unknown };
async function castle(name: string) {
  T.eras.changeGameplay = true;
  const sim = await Sim.create(5, 2, false);
  sim.forceEra = 'medieval'; sim.forceMap = mapNamed('medieval', name); sim.reset();
  const A = sim.arena; // (the map's own layout: read while the eras' gameplay is on)
  T.eras.changeGameplay = false;
  return { sim, A };
}
const moveTo = (sim: Sim, i: number, x: number, y: number) => { const f = sim.fighters[i], t = f.torso.body.translation(); for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + x - t.x, y: q.y + y - t.y }, true); p.body.setLinvel({ x: 0, y: 0 }, true); } };

describe('Castle Drawbridge', () => {
  const parts = (sim: Sim) => ({ deck: sim.props.find((p) => p.weapon?.id === 'drawbridge')!, chain: sim.props.find((p) => p.weapon?.id === 'drawbridge-chain')! });

  it('left alone, the drawbridge holds level with two fighters standing out on its far end', async () => {
    const { sim, A } = await castle('Castle Drawbridge'), { deck, chain } = parts(sim), D = A.drawbridge!;
    moveTo(sim, 0, D.x + D.w - 1.2, A.platformTop - T.stand.height); moveTo(sim, 1, D.x + D.w - 0.5, A.platformTop - T.stand.height);
    for (let i = 0; i < 600; i++) sim.step([NEUTRAL, NEUTRAL]);
    expect(Math.abs(deck.body.rotation())).toBeLessThan(0.03);
    expect(sim.fighters.every((f) => !f.limp && f.torso.body.translation().y < A.platformTop)).toBe(true); // both still up on it
    expect((sim as unknown as Internals).itemOf(deck)).toBeNull(); // nobody carries a drawbridge off
    expect((sim as unknown as Internals).itemOf(chain)).toBeNull();
  });

  it('cut the chain and the bridge swings down: whoever is on it goes into the moat', async () => {
    const { sim, A } = await castle('Castle Drawbridge'), { deck, chain } = parts(sim), D = A.drawbridge!, v = sim.fighters[1];
    moveTo(sim, 1, D.x + D.w - 1.0, A.platformTop - T.stand.height);
    for (let i = 0; i < 30; i++) sim.step([NEUTRAL, NEUTRAL]);
    const t = chain.body.translation();
    sim.shootLoose(chain, t.x, t.y, 0);
    for (let i = 0; i < 60; i++) sim.step([NEUTRAL, NEUTRAL]);
    expect(deck.body.rotation()).toBeGreaterThan(1.2); // hanging down from its hinge
    for (let i = 0; i < 240 && !v.limp; i++) sim.step([NEUTRAL, NEUTRAL]);
    expect(v.limp).toBe(true); // into the moat: a knock-off
    const h = deck.body.translation();
    expect(Math.abs(h.x - D.x)).toBeLessThan(0.6); // still on its hinge, under the gate
  });

  it('a training clear keeps the drawbridge', async () => {
    const { sim } = await castle('Castle Drawbridge');
    sim.clearLoose();
    const { deck, chain } = parts(sim);
    expect(deck && chain && sim.props.includes(deck) && sim.props.includes(chain)).toBe(true);
  });
});

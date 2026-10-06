import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eras } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { setBackPlane } from './fighter';
import type { Fighter } from './fighter';
import { leak } from './tower';
import { NEUTRAL } from './types';
import type { SimEvent } from './types';
import { Sim } from './world';

// The Water Tower (owner): shoot the tank and water jets out of the hole, shoving whoever it catches.
beforeAll(() => { T.eras.changeGameplay = true; });
afterAll(() => { T.eras.changeGameplay = false; });
const TOWER = 1 + eras.find((e) => e.id === 'westerns')!.alt!.findIndex((a) => a.name === 'Water Tower');
type Internals = { acquire(f: unknown, item: { kind: 'prop'; index: number }): void };

async function tower() {
  const sim = await Sim.create(5, 2, false);
  sim.forceEra = 'westerns'; sim.forceMap = TOWER; sim.reset();
  return sim;
}
const moveTo = (f: Fighter, x: number, y: number) => { const t = f.torso.body.translation(); for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + x - t.x, y: q.y + y - t.y }, true); p.body.setLinvel({ x: 0, y: 0 }, true); } };

describe('Water Tower', () => {
  it('a shot into the side of the tank springs a leak', async () => {
    const sim = await tower(), f = sim.fighters[0], tk = sim.arena.tower!, catwalk = sim.arena.platformTop + 1.6;
    setBackPlane(sim.fighters[1], true); sim.fighters[1].dodge = 1e9;
    moveTo(f, tk.x + tk.w + 2.5, catwalk - T.stand.height - 0.02);
    for (let i = 0; i < 20; i++) sim.step([NEUTRAL, NEUTRAL]);
    sim.spawnItem('revolver', f.torso.body.translation().x, f.torso.body.translation().y - 1);
    (sim as unknown as Internals).acquire(f, { kind: 'prop', index: sim.props.length - 1 });
    for (const p of [...sim.props]) if (p.weapon?.id === 'rifle') sim.removeBody(p, undefined); // (the rifle they dropped: out of the way)
    const aim = Math.PI, events: SimEvent[] = []; // (straight at the tank's side)
    for (let i = 0; i < 60; i++) { sim.step([{ ...NEUTRAL, aim, reach: 2.5, attack: i >= 30 && i < 33 }, NEUTRAL]); events.push(...sim.events.map((e) => ({ ...e }))); }
    expect(events.filter((e) => e.t !== 'jump').map((e) => `${e.t} ${e.x.toFixed(2)},${e.y.toFixed(2)}`).join(' | ')).toContain('leak');
    expect(sim.jets.length).toBe(1);
    expect(sim.jets[0].dir).toBe(1); // (out of the right side)
  });

  it('the jet washes someone off the catwalk', async () => {
    const sim = await tower(), v = sim.fighters[1], tk = sim.arena.tower!, catwalk = sim.arena.platformTop + 1.6;
    setBackPlane(sim.fighters[0], true); sim.fighters[0].dodge = 1e9;
    moveTo(v, tk.x + tk.w + 1.0, catwalk - T.stand.height - 0.02);
    for (let i = 0; i < 20; i++) sim.step([NEUTRAL, NEUTRAL]);
    leak(sim, tk.x + tk.w, catwalk - 0.8, 1); // a hole at chest height just above the catwalk
    const events: SimEvent[] = [];
    for (let i = 0; i < T.tower.jetFrames; i++) { sim.step([NEUTRAL, NEUTRAL]); events.push(...sim.events.map((e) => ({ ...e }))); }
    expect(events.some((e) => e.t === 'fall' && e.victim === 1)).toBe(true);
  });
});

describe('Saloon lanterns', () => {
  const SALOON = 1 + eras.find((e) => e.id === 'westerns')!.alt!.findIndex((a) => a.name === 'Saloon');
  async function saloon() {
    const sim = await Sim.create(5, 2, false);
    sim.forceEra = 'westerns'; sim.forceMap = SALOON; sim.reset();
    return sim;
  }
  const lanterns = (sim: Sim) => sim.props.filter((p) => p.weapon?.id === 'lantern');
  it('a lantern hangs on its rope (it cannot be taken down by hand)', async () => {
    const sim = await saloon(), l = lanterns(sim)[0], y0 = l.body.translation().y;
    for (let i = 0; i < 300; i++) sim.step([NEUTRAL, NEUTRAL]);
    expect(lanterns(sim).length).toBe(2);
    expect(Math.abs(l.body.translation().y - y0)).toBeLessThan(0.05);
    expect((sim as unknown as { itemOf(p: unknown): unknown }).itemOf(l)).toBeNull();
  });
  it('cut from its rope, a lantern falls and smashes: that light is out', async () => {
    const sim = await saloon(), l = lanterns(sim)[0];
    sim.shootLoose(l, l.body.translation().x, l.body.translation().y, -1);
    const events: SimEvent[] = [];
    for (let i = 0; i < 120; i++) { sim.step([NEUTRAL, NEUTRAL]); events.push(...sim.events.map((e) => ({ ...e }))); }
    expect(lanterns(sim).length).toBe(1);
    expect(events.some((e) => e.t === 'shatter' && e.w === 'lantern')).toBe(true);
  });
});

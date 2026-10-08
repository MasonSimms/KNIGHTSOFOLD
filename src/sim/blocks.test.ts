import { describe, expect, it } from 'vitest';
import { mapNamed } from '../content/eras';
import { PROPS } from '../content/props';
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
  const STONES = mapNamed('caveman', 'Standing Stones');
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

describe('Toppling Obelisk', () => {
  async function court() {
    T.eras.changeGameplay = true;
    const sim = await Sim.create(5, 2, false);
    sim.forceEra = 'egypt'; sim.forceMap = mapNamed('egypt', 'Toppling Obelisk'); sim.reset();
    T.eras.changeGameplay = false;
    return sim;
  }
  const obelisks = (sim: Sim) => sim.props.filter((p) => p.weapon?.id === 'obelisk').sort((a, b) => a.body.translation().x - b.body.translation().x);
  /** Fighter `i` flies at `vx` m/s into the left obelisk, `up` metres above its terrace. */
  function fling(sim: Sim, i: number, vx: number, up: number) {
    const v = sim.fighters[i], o = obelisks(sim)[0].body.translation(), t = v.torso.body.translation(), A = sim.arena;
    for (const p of v.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + o.x - 1.0 - t.x, y: q.y + A.platformTop - 1.9 - up - t.y }, true); p.body.setLinvel({ x: vx, y: -1 }, true); }
    v.thrown = 40; v.thrownBy = 1 - i;
  }

  it('left alone, both obelisks stand on their terraces', async () => {
    const sim = await court(), [a, b] = obelisks(sim);
    for (let i = 0; i < 600; i++) sim.step([NEUTRAL, NEUTRAL]);
    for (const o of [a, b]) expect(Math.abs(o.body.rotation())).toBeLessThan(0.02);
    expect((sim as unknown as Internals).itemOf(a)).toBeNull(); // (too heavy to lift)
  });

  it('a fighter flung into one tips it over toward the gap: it comes down across it, onto the far side, and crushes whoever is there', async () => {
    const sim = await court(), o = obelisks(sim)[0], v = sim.fighters[0], A = sim.arena;
    for (let i = 0; i < 20; i++) sim.step([NEUTRAL, NEUTRAL]);
    const t = v.torso.body.translation(); // fighter 0 stands on the far side, just past the gap, where the tip comes down
    for (const p of v.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + 13.8 - t.x, y: q.y }, true); }
    fling(sim, 1, 10, 1.4);
    const events: SimEvent[] = [];
    for (let i = 0; i < 240; i++) { sim.step([NEUTRAL, NEUTRAL]); events.push(...sim.events.map((e) => ({ ...e }))); }
    const c = o.body.translation(), a = o.body.rotation(), half = 2.5;
    expect(Math.abs(a)).toBeGreaterThan(1); // down
    expect(c.y).toBeLessThan(A.platformTop + 0.5); // not fallen into the gap
    expect(c.x + Math.abs(Math.sin(a)) * half).toBeGreaterThan(13.3); // its far end over the far side
    expect(c.x - Math.abs(Math.sin(a)) * half).toBeLessThan(10.7); // its near end over the near side: across the gap
    expect(events.some((e) => e.t === 'hit' && e.how === 'crush' && e.victim === 0)).toBe(true);
  });
});

describe('Main Street windows', () => {
  async function street() {
    T.eras.changeGameplay = true;
    const sim = await Sim.create(5, 2, false);
    sim.forceEra = 'westerns'; sim.forceMap = mapNamed('westerns', 'Main Street'); sim.reset();
    T.eras.changeGameplay = false;
    return sim;
  }
  it('thrown into a shop window, you go through it (the glass shatters) and land in the shop', async () => {
    const sim = await street(), v = sim.fighters[0], pane = sim.props.find((p) => p.weapon?.id === 'pane')!, px = pane.body.translation().x;
    for (let i = 0; i < 10; i++) sim.step([NEUTRAL, NEUTRAL]);
    const t = v.torso.body.translation();
    for (const p of v.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + px + 1.0 - t.x, y: q.y - 0.3 }, true); p.body.setLinvel({ x: -10, y: -1 }, true); }
    v.thrown = 40; v.thrownBy = 1; // (flung by fighter 1)
    const events: SimEvent[] = [];
    for (let i = 0; i < 40; i++) { sim.step([NEUTRAL, NEUTRAL]); events.push(...sim.events.map((e) => ({ ...e }))); }
    expect(events.some((e) => e.t === 'break' && e.w === 'pane')).toBe(true);
    expect(sim.props.includes(pane)).toBe(false);
    expect(v.torso.body.translation().x).toBeLessThan(px - 0.3); // inside
  });

  it('a window cannot be picked up, and walking into it does not break it', async () => {
    const sim = await street(), f = sim.fighters[0], pane = sim.props.find((p) => p.weapon?.id === 'pane')!;
    expect((sim as unknown as Internals).itemOf(pane)).toBeNull();
    const t = f.torso.body.translation();
    for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + pane.body.translation().x + 1.5 - t.x, y: q.y }, true); }
    for (let i = 0; i < 90; i++) sim.step([{ ...NEUTRAL, moveX: -1 }, NEUTRAL]);
    expect(sim.props.includes(pane)).toBe(true);
  });
});

describe('Dungeon Cages', () => {
  async function dungeon() {
    T.eras.changeGameplay = true;
    const sim = await Sim.create(5, 2, false);
    sim.forceEra = 'medieval'; sim.forceMap = mapNamed('medieval', 'Dungeon Cages'); sim.reset();
    T.eras.changeGameplay = false;
    return sim;
  }
  const cages = (sim: Sim) => sim.props.filter((p) => p.weapon?.id === 'cage').sort((a, b) => a.body.translation().x - b.body.translation().x);
  const moveTo = (sim: Sim, i: number, x: number, y: number) => { const f = sim.fighters[i], t = f.torso.body.translation(); for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + x - t.x, y: q.y + y - t.y }, true); p.body.setLinvel({ x: 0, y: 0 }, true); } };

  it('left alone, the cages hang on their chains (too heavy to take down by hand)', async () => {
    const sim = await dungeon(), cs = cages(sim), y0 = cs.map((c) => c.body.translation().y);
    for (let i = 0; i < 600; i++) sim.step([NEUTRAL, NEUTRAL]);
    cs.forEach((c, i) => expect(Math.abs(c.body.translation().y - y0[i])).toBeLessThan(0.05));
    expect((sim as unknown as Internals).itemOf(cs[0])).toBeNull();
  });

  it('cut down, a cage crashes onto whoever is under it: crushed', async () => {
    const sim = await dungeon(), c = cages(sim)[0], A = sim.arena;
    moveTo(sim, 1, c.body.translation().x, A.platformTop - T.stand.height);
    for (let i = 0; i < 20; i++) sim.step([NEUTRAL, NEUTRAL]);
    sim.shootLoose(c, c.body.translation().x, c.body.translation().y, 0);
    const events: SimEvent[] = [];
    for (let i = 0; i < 90; i++) { sim.step([NEUTRAL, NEUTRAL]); events.push(...sim.events.map((e) => ({ ...e }))); }
    expect(events.some((e) => e.t === 'hit' && e.how === 'crush' && e.victim === 1)).toBe(true);
  });

  it('the cage in the pit holds a fighter standing on it; cut down, it takes them into the pit', async () => {
    const sim = await dungeon(), c = cages(sim)[1], A = sim.arena, top = c.body.translation().y - PROPS.cage.thick / 2;
    moveTo(sim, 1, c.body.translation().x, top - T.stand.height);
    for (let i = 0; i < 120; i++) sim.step([NEUTRAL, NEUTRAL]);
    const v = sim.fighters[1];
    expect(v.torso.body.translation().y).toBeLessThan(A.platformTop); // still up, on the cage
    sim.shootLoose(c, c.body.translation().x, c.body.translation().y, 0);
    for (let i = 0; i < 120 && !v.limp; i++) sim.step([NEUTRAL, NEUTRAL]);
    expect(v.limp).toBe(true); // fell into the pit (a knock-off)
  });
});

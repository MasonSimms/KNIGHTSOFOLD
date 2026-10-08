import { describe, expect, it } from 'vitest';
import { mapNamed } from '../content/eras';
import { PROP_KINDS, PROPS } from '../content/props';
import { tuning as T } from '../content/tuning';
import { placeLoose } from './fighter';
import { NEUTRAL } from './types';
import type { PlayerInput } from './types';
import { Sim } from './world';

// The race for the guns (owner, 2026-10-07: "like Stick Fight"): a quick punch knocks a rival back, a grab and throw takes the gun off them,
// and on a guns-only arena everyone starts with bare hands while guns drop in early and often.
type Internals = { acquire(f: unknown, item: { kind: 'prop'; index: number }): void };
const at = (sim: Sim, who: number) => sim.fighters[who].torso.body.translation();
/** Fighter 0 bare-handed, standing `gap` metres from fighter 1, both settled. */
async function faceOff(seed: number, gap: number) {
  const sim = await Sim.create(seed, 2, false);
  for (let i = 0; i < 30; i++) sim.step([NEUTRAL, NEUTRAL]);
  const f = sim.fighters[0];
  if (f.stick) placeLoose(sim.world, f, at(sim, 0).x - 4 * f.side, sim.arena.platformTop - 0.1, 0);
  const g = sim.fighters[1], x = at(sim, 0).x + gap * f.side, t = at(sim, 1);
  for (const p of g.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + x - t.x, y: q.y }, true); p.body.setLinvel({ x: 0, y: 0 }, true); }
  for (let i = 0; i < 40; i++) sim.step([NEUTRAL, NEUTRAL]);
  return sim;
}
const toward = (sim: Sim, over: Partial<PlayerInput> = {}): PlayerInput => {
  const a = at(sim, 0), b = at(sim, 1);
  return { ...NEUTRAL, aim: Math.atan2(b.y - a.y, b.x - a.x), reach: Math.hypot(b.x - a.x, b.y - a.y), ...over };
};

describe('the race for the guns', () => {
  it('a quick punch knocks a rival back well out of reach (and hurts only a little)', async () => {
    const sim = await faceOff(31, 1.1);
    const x0 = at(sim, 1).x, hp0 = sim.fighters[1].hp;
    let landed = false;
    for (let i = 0; i < 45; i++) { sim.step([toward(sim, { attack: i < 2 }), NEUTRAL]); landed ||= sim.events.some((e) => e.t === 'hit' && e.how === 'fist'); }
    expect(landed).toBe(true);
    expect(Math.abs(at(sim, 1).x - x0), 'knocked back').toBeGreaterThan(1.2);
    expect(hp0 - sim.fighters[1].hp).toBeLessThan(15);
  }, 30_000);

  it('a fighter grabbed and flung drops the gun they held', async () => {
    const sim = await faceOff(32, 0.8);
    const g = sim.fighters[1], t = at(sim, 1);
    if (g.stick) placeLoose(sim.world, g, t.x + 4 * g.side, sim.arena.platformTop - 0.1, 0);
    sim.spawnItem('revolver', t.x, t.y - 1.5);
    (sim as unknown as Internals).acquire(g, { kind: 'prop', index: sim.props.length - 1 });
    expect(g.grip).not.toBeNull();
    let held = false;
    for (let i = 0; i < 40 && !held; i++) { sim.step([toward(sim, { attack: true }), NEUTRAL]); held = sim.fighters[0].held === g; }
    expect(held).toBe(true);
    for (let i = 0; i < 12; i++) sim.step([toward(sim, { attack: true, aim: -1.2 }), NEUTRAL]);
    sim.step([NEUTRAL, NEUTRAL]); // (let go: the fling)
    expect(g.grip).toBeNull();
    expect(sim.events.some((e) => e.t === 'disarm' && e.victim === 1)).toBe(true);
  }, 30_000);

  it('a guns-only arena: everyone starts bare-handed, a gun drops within a second or so, and only guns drop', async () => {
    const was = { change: T.eras.changeGameplay, spawn: T.spawn.enabled };
    T.eras.changeGameplay = true; T.spawn.enabled = true;
    try {
      const sim = await Sim.create(33, 4, false);
      sim.forceEra = 'modern'; sim.forceMap = 0; sim.reset();
      expect(sim.arena.gunsOnly).toBe(true);
      expect(sim.fighters.every((f) => !f.grip)).toBe(true);
      const drops: { frame: number; kind: string }[] = [];
      for (let i = 0; i < 900; i++) {
        sim.step([NEUTRAL, NEUTRAL, NEUTRAL, NEUTRAL]);
        for (const e of sim.events) if (e.t === 'spawn' && e.owner === -1) drops.push({ frame: sim.frame, kind: PROP_KINDS[e.v] });
      }
      expect(drops[0].frame).toBeLessThanOrEqual(T.spawn.gunsFirst + 2);
      expect(drops.length).toBeGreaterThanOrEqual(4);
      for (const d of drops) expect(PROPS[d.kind].gun, d.kind).toBeTruthy();
    } finally {
      T.eras.changeGameplay = was.change; T.spawn.enabled = was.spawn;
    }
  }, 30_000);

  it("a quick punch knocks the gun out of a rival's hand", async () => {
    const sim = await faceOff(34, 1.1);
    const g = sim.fighters[1], t = at(sim, 1);
    if (g.stick) placeLoose(sim.world, g, t.x + 4 * g.side, sim.arena.platformTop - 0.1, 0);
    sim.spawnItem('revolver', t.x, t.y - 1.5);
    (sim as unknown as Internals).acquire(g, { kind: 'prop', index: sim.props.length - 1 });
    expect(g.grip).not.toBeNull();
    let landed = false;
    for (let i = 0; i < 30 && !landed; i++) { sim.step([toward(sim, { attack: i < 2 }), NEUTRAL]); landed = sim.events.some((e) => e.t === 'hit' && e.how === 'fist'); }
    expect(landed).toBe(true);
    expect(g.grip).toBeNull();
    expect(g.stick?.weapon?.id).toBe('revolver'); // (lying loose now, for whoever gets to it first)
  }, 30_000);

  it("gun rounds: about half of a gun era's rounds are guns-only, picked the same way every time; the Water Tower always is", async () => {
    const was = T.eras.changeGameplay;
    T.eras.changeGameplay = true; T.eras.gunRounds = true;
    try {
      const sim = await Sim.create(35, 2, false);
      sim.forceEra = 'ww1'; sim.forceMap = 0; sim.reset();
      const rounds = (s: Sim) => Array.from({ length: 40 }, (_, r) => { (s as unknown as { round: number }).round = r; return !!s.arena.gunsOnly; });
      const a = rounds(sim), n = a.filter(Boolean).length;
      expect(n).toBeGreaterThan(10);
      expect(n).toBeLessThan(30);
      expect(rounds(await Sim.create(35, 2, false).then((s) => { s.forceEra = 'ww1'; s.forceMap = 0; s.reset(); return s; }))).toEqual(a);
      sim.forceEra = 'westerns'; sim.forceMap = mapNamed('westerns', 'Water Tower'); sim.reset();
      expect((sim.arena as { name?: string }).name).toBe('Water Tower');
      expect(rounds(sim).every(Boolean)).toBe(true);
    } finally { T.eras.changeGameplay = was; T.eras.gunRounds = false; }
  }, 30_000);

  it('a knocked-down fighter tumbling into someone is not a body attack (one launched by a squeeze killed the one who had slammed them)', async () => {
    const sim = await faceOff(36, 1.6);
    const f = sim.fighters[0], g = sim.fighters[1], hp = g.hp;
    f.knock = 40;
    for (const p of f.parts) p.body.setLinvel({ x: 25 * f.side, y: 0 }, true);
    let body = false;
    for (let i = 0; i < 20; i++) { sim.step([NEUTRAL, NEUTRAL]); body ||= sim.events.some((e) => e.t === 'hit' && e.how === 'body' && e.owner === 0); }
    expect(body).toBe(false);
    expect(g.hp).toBe(hp);
  }, 30_000);
});

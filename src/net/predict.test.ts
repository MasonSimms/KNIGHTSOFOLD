import { describe, expect, it } from 'vitest';
import { NEUTRAL } from '../sim/types';
import type { PlayerInput } from '../sim/types';
import { Sim } from '../sim/world';
import { mapNamed } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { Predictor } from './predict';
import { Mirror } from './snapshot';
import type { Snapshot } from './snapshot';
import { Room } from './room';

// Prediction over a pretend network (6 ticks = 100 ms each way): your fighter answers at once, and stays with the server.
const LAG = 6;
const wire = (s: Snapshot): Snapshot => JSON.parse(JSON.stringify(s));

async function setup(seed = 4, map?: { era: string; name: string }) {
  const server = await Sim.create(seed, 2, false), client = await Sim.create(seed, 2, false);
  if (map) for (const s of [server, client]) { s.forceEra = map.era; s.forceMap = mapNamed(map.era, map.name); s.reset(); } // (the caller keeps tuning.eras.changeGameplay on)
  const room = new Room(server), mirror = new Mirror(client), pred = new Predictor(mirror, 0);
  const up: { at: number; i: PlayerInput; n: number }[] = [], down: { at: number; s: Snapshot }[] = [];
  const server0 = () => server.fighters[0].torso.body.translation();
  let tick = 0, n = 0;
  const serverAt = new Map<number, { x: number; y: number }>(); // input number -> where the server had you after it
  /** One tick: you press `input`; it reaches the server LAG ticks later, its snapshot comes back LAG ticks after that. */
  const step = (input: PlayerInput, predict = true) => {
    tick++; n++;
    up.push({ at: tick + LAG, i: input, n });
    while (up.length && up[0].at <= tick) { const x = up.shift()!; room.setInput(0, x.i, x.n); }
    const s = room.tick();
    if (s) { down.push({ at: tick + LAG, s: wire(s) }); serverAt.set(s.ack![0], { ...server0() }); }
    while (down.length && down[0].at <= tick) { const x = down.shift()!.s; mirror.push(x); pred.reconcile(x); }
    const latest = down.length ? 0 : 0; void latest;
    const shown = mirror.show(Math.max(0, tick - 2 * LAG - 3));
    return { ev: predict ? pred.tick(input, n, shown.alpha) : [], alpha: shown.alpha };
  };
  const me = () => client.fighters[0].torso;
  return { step, me, serverAt, pred, client, server, n: () => n };
}

describe('prediction', () => {
  it('standing on a trapdoor as it opens, your fighter drops with the server, not a snap later (the door is where it is at the frame being guessed)', async () => {
    const was = T.eras.changeGameplay;
    T.eras.changeGameplay = true;
    try {
      const { step, pred, server, client } = await setup(4, { era: 'gladiators', name: 'Colosseum Floor' });
      const d = server.arena.trapdoors[0], x = d.x + d.w / 2;
      for (const sim of [server, client]) { const f = sim.fighters[0], t = f.torso.body.translation(); for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + x - t.x, y: q.y }, true); } }
      for (let i = 0; i < 60 * (d.at + T.trapdoor.swing + 1.5); i++) step(NEUTRAL);
      expect(server.fighters[0].torso.body.translation().y).toBeGreaterThan(server.arena.platformTop + 1); // the server's fighter fell through
      expect(pred.stats.snaps).toBe(0);
      expect(pred.stats.worst).toBeLessThan(0.3); // and this page's guess went with it (left on a closed door, it was a metre and more off)
      void client;
    } finally { T.eras.changeGameplay = was; }
  }, 60_000);

  it('your own jump (its sound and dust) comes from your own screen at once, not a round trip later', async () => {
    const { step, pred } = await setup();
    for (let i = 0; i < 90; i++) step(NEUTRAL);
    expect(pred.active).toBe(true);
    let at = -1;
    for (let i = 0; i < 6 && at < 0; i++) if (step({ ...NEUTRAL, jump: true }).ev.some((e) => e.t === 'jump' && e.owner === 0)) at = i;
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThan(3);
  }, 60_000);

  it('when the server takes your fighter over (a hit, a grab), it stays where it was drawn and slides to the server: no jump back', async () => {
    const { step, me, pred } = await setup();
    for (let i = 0; i < 90; i++) step(NEUTRAL);
    for (let i = 0; i < 40; i++) step({ ...NEUTRAL, moveX: 1 }); // running: the server's picture of you is a round trip behind
    const before = { x: me().cx + pred.shift.x, y: me().cy + pred.shift.y };
    pred.stop(true);
    const { alpha } = step({ ...NEUTRAL, moveX: 1 }, false); // (the copy writes the server's pose of you in)
    const server = me().px + (me().cx - me().px) * alpha;
    expect(Math.abs(server - before.x)).toBeGreaterThan(0.3); // without the slide: a jump back of this much
    pred.settle(alpha);
    expect(Math.abs(server + pred.shift.x - before.x)).toBeLessThan(0.15); // drawn where it was
    for (let i = 0; i < 30; i++) { step({ ...NEUTRAL, moveX: 1 }, false); (pred as unknown as { shift: { x: number } }).shift.x *= 0.8; }
    expect(Math.abs(pred.shift.x)).toBeLessThan(0.01); // ...and slid onto the server's picture
  }, 60_000);

  it('your fighter starts moving within a few ticks of the key, not a round trip later', async () => {
    const { step, me, pred } = await setup();
    for (let i = 0; i < 90; i++) step(NEUTRAL); // stand, while the first snapshots arrive
    expect(pred.active).toBe(true);
    const x0 = me().cx;
    let moved = -1;
    for (let i = 0; i < 40 && moved < 0; i++) { step({ ...NEUTRAL, moveX: 1 }); if (me().cx - x0 > 0.05) moved = i; }
    expect(moved).toBeGreaterThanOrEqual(0);
    expect(moved).toBeLessThan(6); // the round trip alone would be 12 ticks plus the blend
  }, 60_000);

  /** Walk a pattern; for each input, how far this page had you from where the server had you after the same input. */
  async function errors(seed: number, inputs: (k: number) => PlayerInput, ticks: number) {
    const t = await setup(seed);
    for (let i = 0; i < 90; i++) t.step(NEUTRAL);
    const mine = new Map<number, { x: number; y: number }>(), err: number[] = [];
    for (let k = 0; k < ticks; k++) {
      t.step(inputs(k));
      mine.set(t.n(), { x: t.me().cx, y: t.me().cy });
      const back = t.n() - 2 * LAG - 2, s = t.serverAt.get(back), p = mine.get(back);
      if (s && p && k > 20) err.push(Math.hypot(s.x - p.x, s.y - p.y));
    }
    return { ...t, err };
  }

  it('moving freely (walking both ways, jumping, aiming, crouching) it is exactly where the server has you', async () => {
    const { err } = await errors(5, (k) => ({ ...NEUTRAL, moveX: k < 60 ? 1 : k < 120 ? -1 : 0, jump: k % 50 === 10, crouch: k > 130, aim: k * 0.05 }), 180);
    expect(Math.max(...err)).toBeLessThan(0.02); // (the opponent is far away: only your own buttons move you, and the guess is the same physics)
  }, 60_000);

  it('bumping into someone (decided by the server) it is soon back in step', async () => {
    const { err, step, me, serverAt, n } = await errors(5, (k) => ({ ...NEUTRAL, moveX: k < 108 ? 1 : k < 190 ? -1 : 0 }), 260); // into the other fighter (about 1.7 s in), then back before the end of the stage
    console.log(`into someone: worst ${Math.max(...err).toFixed(2)} m, then ${err.slice(-30).map((e) => e.toFixed(2)).join(' ')}`);
    expect(Math.max(...err.slice(-30))).toBeLessThan(0.1); // walking away again: back with the server
    for (let i = 0; i < 90; i++) step(NEUTRAL);
    const s = serverAt.get(n() - 2 * LAG - 2)!;
    expect(Math.hypot(s.x - me().cx, s.y - me().cy)).toBeLessThan(0.05); // standing: where the server has you
  }, 60_000);

  it('the server knocks your weapon out of your hand: this page lets go too, and stays with the server', async () => {
    const t = await setup(4);
    for (let i = 0; i < 90; i++) t.step(NEUTRAL);
    const sf = t.server.fighters[0], cf = t.client.fighters[0];
    expect(sf.grip && cf.grip && t.pred.active).toBeTruthy();
    t.server.world.removeImpulseJoint(sf.grip!, true); sf.grip = null; // (a disarm, on the server: no event for it reaches the page)
    sf.stick!.body.setLinvel({ x: 0, y: -12 }, true); // the club flies off
    for (let i = 0; i < 60; i++) t.step({ ...NEUTRAL, moveX: i < 30 ? 1 : 0 });
    expect(cf.grip).toBeNull(); // (held on to here, the club tugged your fighter after it: a jump of metres)
    const s = t.serverAt.get(t.n() - 2 * LAG - 2)!;
    expect(Math.hypot(s.x - t.me().cx, s.y - t.me().cy)).toBeLessThan(0.3);
  }, 60_000);

  it('knocked down (decided by the server), your fighter follows the server until you are up again', async () => {
    const t = await setup(6);
    for (let i = 0; i < 90; i++) t.step(NEUTRAL);
    expect(t.pred.active).toBe(true);
    t.server.fighters[0].knock = 40; // a big hit, on the server
    let off = -1, back = -1;
    for (let i = 0; i < 200 && back < 0; i++) {
      t.step(NEUTRAL);
      if (off < 0 && !t.pred.active) off = i;
      if (off >= 0 && t.pred.active) back = i;
    }
    expect(off).toBeGreaterThanOrEqual(0);
    expect(off).toBeLessThanOrEqual(2 * LAG + 2); // as soon as the news arrives
    expect(back).toBeGreaterThan(off); // and up again afterwards
  }, 60_000);
});

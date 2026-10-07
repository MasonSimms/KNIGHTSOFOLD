import { describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import { Mirror } from '../net/snapshot';
import type { Snapshot } from '../net/snapshot';
import { Room } from '../net/room';
import type { Attacker, Fighter } from './fighter';
import { NEUTRAL } from './types';
import type { SimEvent } from './types';
import { Sim } from './world';

// Weapons that do more than hit (owner, batch one): shields shove, the gravity hammer pulls, a thrown spear sticks, a grenade goes off.
type Internals = { acquire(f: Fighter, item: { kind: 'prop'; index: number }): void; hit(f: Fighter, att: Attacker, v: Fighter, vp: unknown, pt: { x: number; y: number }, n: { x: number; y: number }, head: boolean): void; itemOf(p: unknown): unknown };
async function duel(seed = 3) {
  const sim = await Sim.create(seed, 2, false);
  for (let i = 0; i < 30; i++) sim.step([NEUTRAL, NEUTRAL]);
  return sim;
}
function arm(sim: Sim, who: number, kind: string) {
  const f = sim.fighters[who], t = f.torso.body.translation();
  sim.spawnItem(kind, t.x, t.y - 1.5);
  (sim as unknown as Internals).acquire(f, { kind: 'prop', index: sim.props.length - 1 });
  return f.stick!;
}
/** Fighter 0's weapon meets fighter 1's body at 10 m/s, straight at them: what it does to them (their speed toward +x after, damage). */
async function swingWith(kind: string) {
  const sim = await duel(), f = sim.fighters[0], v = sim.fighters[1], w = arm(sim, 0, kind), att = f.attackers.find((a) => a.part === w)!;
  const vt = v.torso.body.translation(), hp0 = v.hp;
  for (const p of v.parts) { p.vx = p.vy = p.w = 0; p.body.setLinvel({ x: 0, y: 0 }, true); }
  w.vx = 10; w.vy = 0; w.w = 0; w.body.setTranslation({ x: vt.x - 0.3, y: vt.y }, true);
  (sim as unknown as Internals).hit(f, att, v, v.torso, { x: vt.x - 0.1, y: vt.y }, { x: 1, y: 0 }, false);
  return { vx: v.torso.body.linvel().x, dmg: hp0 - v.hp, sim };
}

describe('batch one weapons', () => {
  it('a riot shield or round shield shoves much harder than a club but hurts less', async () => {
    const club = await swingWith('plank'), riot = await swingWith('riot-shield'), round = await swingWith('round-shield');
    expect(riot.vx).toBeGreaterThan(club.vx * 1.5);
    expect(round.vx).toBeGreaterThan(club.vx * 1.3);
    expect(riot.dmg).toBeLessThan(club.dmg);
  });

  it('the gravity hammer pulls the one it hits toward you', async () => {
    const hammer = await swingWith('gravity-hammer'), club = await swingWith('mace');
    expect(club.vx).toBeGreaterThan(0); // knocked away (+x)
    expect(hammer.vx).toBeLessThan(0); // pulled in
  });

  it('a spear thrown point-first into the ground sticks there, and picking it up pulls it out', async () => {
    const sim = await duel();
    sim.spawnItem('spear', 12, sim.arena.platformTop - 2);
    const s = sim.props.at(-1)!;
    s.body.setRotation(Math.PI / 2 - 0.2, true); // nearly point-down...
    s.body.setLinvel({ x: 2, y: 12 }, true); // ...and flying down at the ground
    const events: SimEvent[] = [];
    for (let i = 0; i < 30; i++) { sim.step([NEUTRAL, NEUTRAL]); events.push(...sim.events.map((e) => ({ ...e }))); }
    expect(events.some((e) => e.t === 'thunk')).toBe(true);
    expect(s.body.isFixed()).toBe(true);
    expect((sim as unknown as Internals).itemOf(s)).not.toBeNull(); // it can be taken
    (sim as unknown as Internals).acquire(sim.fighters[0], { kind: 'prop', index: sim.props.indexOf(s) });
    expect(s.body.isDynamic()).toBe(true);
  });

  it('a grenade goes off two seconds after leaving a hand: people near it are thrown and hurt, a barrel breaks, the grenade is gone', async () => {
    const sim = await duel(), f = sim.fighters[0], v = sim.fighters[1];
    const g = arm(sim, 0, 'grenade'), ft = f.torso.body.translation();
    const dx = ft.x + 1.5 - v.torso.body.translation().x; // a step away from the thrower
    for (const p of v.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + dx, y: q.y }, true); }
    sim.spawnItem('barrel', ft.x + 0.9, sim.arena.platformTop - 0.26); // (right beside where the grenade lands)
    const hp0 = v.hp, events: SimEvent[] = [];
    sim.step([{ ...NEUTRAL, drop: true }, NEUTRAL]); // let go of it
    for (let i = 0; i < 60 * 3; i++) { sim.step([NEUTRAL, NEUTRAL]); events.push(...sim.events.map((e) => ({ ...e }))); }
    const boom = events.findIndex((e) => e.t === 'boom');
    expect(boom).toBeGreaterThanOrEqual(0);
    expect(v.hp).toBeLessThan(hp0);
    expect(events.some((e) => e.t === 'break' && e.w === 'barrel')).toBe(true);
    expect(sim.props.includes(g) || f.stick === g).toBe(false);
  });

  it('online copies stay in step through grenades going off', async () => {
    const server = await Sim.create(5, 2, false), client = await Sim.create(5, 2, false);
    const room = new Room(server), mirror = new Mirror(client);
    for (let i = 0; i < 30; i++) { room.setInput(0, NEUTRAL); room.setInput(1, NEUTRAL); const s = room.tick(); if (s) { mirror.push(JSON.parse(JSON.stringify(s)) as Snapshot); mirror.show(s.frame); } }
    arm(server, 0, 'grenade'); arm(client, 0, 'grenade'); // (the same pickup on both: as a 'pickup' event would)
    let booms = 0;
    for (let i = 0; i < 200; i++) {
      room.setInput(0, { ...NEUTRAL, drop: i === 1 }); room.setInput(1, NEUTRAL);
      const s = room.tick();
      if (!s) continue;
      mirror.push(JSON.parse(JSON.stringify(s)) as Snapshot);
      booms += mirror.show(s.frame).events.filter((e) => e.t === 'boom').length;
    }
    expect(booms).toBe(1);
    expect(mirror.desyncs).toBe(0);
    expect(client.fighters[0].parts.length).toBe(server.fighters[0].parts.length);
    expect(client.props.length).toBe(server.props.length);
  });
});

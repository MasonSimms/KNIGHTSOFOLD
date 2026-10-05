import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eras } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { PROPS } from '../content/props';
import { weaponById } from '../content/weapons';
import { Room } from '../net/room';
import { Mirror } from '../net/snapshot';
import { fuzzer } from './fuzz';
import type { PlayerInput } from './types';
import { Sim } from './world';

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });

// These tests are about the eras' own weapon and arena, so they turn that on (the other tests run with it off).
beforeAll(() => { T.eras.changeGameplay = true; T.eras.mixStarts = false; });
afterAll(() => { T.eras.changeGameplay = false; });

async function inEra(id: string, players = 4) {
  const sim = await Sim.create(5, players, false);
  sim.forceEra = id;
  sim.reset();
  return sim;
}

describe('era gameplay: weapon and arena', () => {
  it.each(eras.map((e) => e.id))('%s: the era\'s weapon is in every hand, and everyone starts on the platform', async (id) => {
    const era = eras.find((e) => e.id === id)!;
    const sim = await inEra(id);
    const w = weaponById(era.weapon);
    const A = sim.arena;
    expect(sim.weapon.id).toBe(w.id);
    for (const f of sim.fighters) {
      expect(f.stick!.weapon!.id).toBe(w.id);
      const shape = f.stick!.shapes[0];
      expect(shape.k === 'cap' && Math.abs((shape.hl + shape.r) * 2 - w.length) < 1e-6).toBe(true); // the club is really that long
      const x = f.torso.body.translation().x;
      expect(x).toBeGreaterThan(A.platformX + 0.3);
      expect(x).toBeLessThan(A.platformX + A.platformW - 0.3);
    }
  });

  it('the arenas really differ: some eras have floating ledges, and different widths', async () => {
    const widths = new Set(eras.map((e) => ({ ...T.arena, ...e.arena }).platformW));
    expect(widths.size).toBeGreaterThan(3);
    expect(eras.filter((e) => e.arena.ledges?.length).length).toBeGreaterThanOrEqual(4);
  });

  it('a fighter dropped onto a floating ledge stands on it', async () => {
    const sim = await inEra('westerns', 2);
    const l = sim.arena.ledges[0];
    const f = sim.fighters[0];
    const t = f.torso.body.translation();
    for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + (l.x + l.w / 2 - t.x), y: q.y - 2.6 }, true); p.body.setLinvel({ x: 0, y: 0 }, true); }
    for (let i = 0; i < 90; i++) sim.step([idle(), idle()]);
    const y = f.torso.body.translation().y;
    expect(y).toBeLessThan(sim.arena.platformTop - l.up - 0.3); // up on the ledge, well above the main platform
    expect(y).toBeGreaterThan(sim.arena.platformTop - l.up - T.stand.height - 0.3);
    expect(f.limp).toBe(false);
  });

  it.each(eras.map((e) => e.id))('%s: random play for 15 seconds stays finite and in bounds', async (id) => {
    const sim = await inEra(id);
    const inputs = fuzzer(17);
    for (let i = 0; i < 900; i++) {
      sim.step(inputs(4));
      for (const f of sim.fighters) {
        if (f.limp) continue;
        for (const p of f.parts) {
          const t = p.body.translation();
          if (!Number.isFinite(t.x) || !Number.isFinite(t.y)) throw new Error(`${id}: frame ${i}: ${p.role} is not a number`);
        }
      }
    }
  }, 60000);

  it('the era changes the round and the round\'s weapon, and a client that joins late builds the right era\'s weapon and arena', async () => {
    const server = await Sim.create(31, 4, false), clientSim = await Sim.create(31, 4, false);
    const room = new Room(server), late = new Mirror(clientSim);
    const inputs = fuzzer(8);
    const seen = new Set<string>();
    let joinedAt = -1, checks = 0;
    for (let i = 0; i < 3600; i++) {
      for (let k = 0; k < 4; k++) room.setInput(k, inputs(4)[k]);
      const s = room.tick();
      seen.add(server.weapon.id);
      if (i > 1500 && joinedAt < 0 && server.era !== 'caveman') { // join in the middle of some later round
        const c = JSON.parse(JSON.stringify(room.catchUp()));
        late.reset(); late.push(c); late.show(c.frame); joinedAt = i;
      }
      if (s && joinedAt >= 0) {
        late.push(JSON.parse(JSON.stringify(s))); late.show(s.frame);
        if (clientSim.weapon.id !== server.weapon.id) throw new Error(`tick ${i} (joined ${joinedAt}): server round ${server.round} era ${server.era} weapon ${server.weapon.id}; client round ${clientSim.round} era ${clientSim.era} weapon ${clientSim.weapon.id}`);
        expect(clientSim.era).toBe(server.era);
        expect(clientSim.fighters[0].stick!.shapes[0]).toEqual(server.fighters[0].stick!.shapes[0]);
        expect(clientSim.arena.ledges).toEqual(server.arena.ledges);
        checks++;
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(3); // several different weapons came up
    expect(joinedAt).toBeGreaterThan(0);
    expect(checks).toBeGreaterThan(100);
    expect(late.desyncs).toBe(0);
  }, 120_000);

  it('better weapons spawn during a round: faster as it goes on, the strong one only later, never more than the cap, and the same every time', async () => {
    const run = async () => {
      const sim = await inEra('pirates', 2);
      const era = eras.find((e) => e.id === 'pirates')!, log: { f: number; kind: string }[] = [];
      for (let i = 0; i < 4000; i++) {
        sim.step([idle(), idle()]);
        for (const e of sim.events) if (e.t === 'spawn') log.push({ f: sim.frame, kind: Object.keys(PROPS)[e.v] });
        expect(sim.props.filter((p) => era.pickups!.includes(p.weapon!.id)).length).toBeLessThanOrEqual(T.spawn.maxLoose);
      }
      return log;
    };
    const log = await run();
    expect(log.length).toBe(T.spawn.maxLoose); // nobody picks anything up here, so it stops at the cap
    expect(log[0].f).toBe(T.spawn.firstGap);
    expect(log.filter((s) => s.kind === 'boat-hook').every((s) => s.f >= T.spawn.strongAfterFrames)).toBe(true);
    expect(log.some((s) => s.kind === 'boat-hook')).toBe(true);
    const gaps = log.slice(1).map((s, i) => s.f - log[i].f);
    expect(gaps[gaps.length - 1]).toBeLessThan(gaps[0]); // more rapid over time
    expect(await run()).toEqual(log);
  }, 60000);
});

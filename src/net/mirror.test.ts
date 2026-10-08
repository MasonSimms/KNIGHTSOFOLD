import { describe, expect, it } from 'vitest';
import { Mirror } from './snapshot';
import { Room } from './room';
import { NEUTRAL } from '../sim/types';
import { Sim } from '../sim/world';
import { botLook } from '../content/looks';
import { tuning as T } from '../content/tuning';
import type { Snapshot } from './snapshot';

// A page's copy that has gone wrong must recover, not break (found on the live server, 2026-10-07: a friend's page could not make a
// pickup of a thing its copy did not have, threw, and threw again on every message after it for the rest of the match).
describe('the online copy', () => {
  it('an event it cannot make is counted as gone wrong (so the page asks for the whole fight again), and the copy carries on', async () => {
    const server = await Sim.create(41, 2, false), client = await Sim.create(41, 2, false);
    const room = new Room(server), mirror = new Mirror(client, 0);
    let last = 0;
    for (let i = 0; i < 30; i++) { const s = room.tick(); if (s) { mirror.push(JSON.parse(JSON.stringify(s)), i * 16); mirror.show(i * 16); last = s.frame; } }
    const bad = room.tick()!;
    bad.ev.push({ t: 'pickup', x: 0, y: 0, v: 100 + 999, owner: 0, victim: -1 }); // (a pickup of a prop this copy does not have)
    expect(() => { mirror.push(JSON.parse(JSON.stringify(bad)), 31 * 16); mirror.show(40 * 16); }).not.toThrow();
    expect(mirror.desyncs).toBeGreaterThan(0);
    let threw = false;
    for (let i = 0; i < 30; i++) { room.setInput(0, NEUTRAL); const s = room.tick(); if (s) try { mirror.push(JSON.parse(JSON.stringify(s)), (32 + i) * 16); mirror.show((40 + i) * 16); } catch { threw = true; } }
    expect(threw, 'it does not try the bad event again').toBe(false);
    expect(last).toBeGreaterThan(0);
  });

  it('a page that rejoins mid-round (even one tick after the round began) builds the same round and stays in step: the recent events repeated for the fast lane are not made twice', async () => {
    const was = { g: T.eras.changeGameplay, s: T.spawn.enabled, m: T.eras.mixStarts, l: T.props.lying, r: T.eras.gunRounds };
    T.eras.changeGameplay = true; T.spawn.enabled = true; T.eras.mixStarts = true; T.props.lying = true; T.eras.gunRounds = true;
    try {
      const server = await Sim.create(1, 4, false);
      server.looks = [server.looks[0], server.looks[1], botLook(), botLook()]; server.reset();
      const room = new Room(server), kinds = (x: Sim) => x.props.map((p) => p.weapon?.id).join(',');
      const snaps: Snapshot[] = [], joins: { frame: number; cu: string }[] = [], kindsBy = new Map<number, string>();
      let round = server.round, startedAt = 0;
      while (server.round < 4) {
        room.setInput(0, NEUTRAL); room.setInput(1, NEUTRAL);
        const s = room.tick();
        if (!s) continue;
        if (server.round !== round) { round = server.round; startedAt = s.frame; }
        snaps.push(JSON.parse(JSON.stringify(s))); kindsBy.set(s.frame, kinds(server));
        if (!server.roundOver && (s.frame === startedAt + 1 || s.frame % 150 === 0)) joins.push({ frame: s.frame, cu: JSON.stringify(room.catchUp()) });
      }
      expect(joins.length).toBeGreaterThan(8);
      for (const { frame, cu } of joins) {
        const client = await Sim.create(1, 4, false);
        client.looks = server.looks.map((l) => ({ ...l }));
        if (client.matchSeed !== server.matchSeed) client.reseed(server.matchSeed);
        const mirror = new Mirror(client, 1), c = JSON.parse(cu) as Snapshot;
        mirror.push(c, 0); mirror.show(frame);
        for (const s of snaps) {
          if (s.frame <= frame) continue;
          if (s.ev.some((e) => e.t === 'newround')) break;
          mirror.push(JSON.parse(JSON.stringify(s)), 0); mirror.show(s.frame);
          expect(kinds(client), `joined at ${frame}, at ${s.frame}`).toBe(kindsBy.get(s.frame));
        }
        expect(mirror.desyncs).toBe(0);
        client.world.free();
      }
    } finally {
      T.eras.changeGameplay = was.g; T.spawn.enabled = was.s; T.eras.mixStarts = was.m; T.props.lying = was.l; T.eras.gunRounds = was.r;
    }
  }, 300_000);

  it('a limb lost on the server comes off in the online copy too (kept on there, it dragged your own fighter about: up to 300 snaps a minute)', async () => {
    const server = await Sim.create(42, 2, false), client = await Sim.create(42, 2, false);
    const room = new Room(server), mirror = new Mirror(client, 0);
    const feed = () => { const s = room.tick(); if (s) { mirror.push(JSON.parse(JSON.stringify(s)), 0); mirror.show(s.frame); } };
    for (let i = 0; i < 20; i++) feed();
    const maim = (who: number, part: unknown) => (server as unknown as { maim(f: unknown, p: unknown, nx: number, ny: number): void }).maim(server.fighters[who], part, 1, -0.3);
    const step = server.step.bind(server);
    server.step = (inputs) => { step(inputs); server.step = step; maim(1, server.fighters[1].legs[0].thigh); maim(0, server.fighters[0].upper); }; // (inside a tick, as a hit does it)
    for (let i = 0; i < 5; i++) feed();
    expect(server.fighters[1].legLost[0] && server.fighters[0].armLost).toBe(true);
    expect(client.fighters[1].legLost[0]).toBe(true);
    expect(client.fighters[0].armLost).toBe(true);
    expect(client.fighters[0].grip).toBeNull();
    expect(mirror.desyncs).toBe(0);
  });
});

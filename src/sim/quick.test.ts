import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { botLook } from '../content/looks';
import { eras } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { Room } from '../net/room';
import { Mirror, WAITING } from '../net/snapshot';
import { Tape } from '../replay/tape';
import { eraFor, mapFor } from './era';
import { NEUTRAL } from './types';
import { Sim } from './world';

// Quick rounds (owner, 2026-10-09): a match is a few eras, three rounds each; the museum only when the era changes, a quick break between
// the rounds of one era, a countdown at the start of every round.
beforeEach(() => { T.match.quickRounds = true; });
afterEach(() => { T.match.quickRounds = false; });
const knockOff = (sim: Sim, who: number) => { for (const p of sim.fighters[who].parts) p.body.setTranslation({ x: 9, y: sim.arena.killY + 2 }, true); };

describe('quick rounds', () => {
  it('a match is four eras in history order, three rounds each, each round of an era on another of its arenas; tie-break rounds stay in the last era', () => {
    const normal = eras.filter((e) => !e.special).map((e) => e.id), per = T.match.roundsPerEra, matches = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const list = Array.from({ length: T.match.rounds }, (_, i) => eraFor(seed, i + 1));
      const firsts = list.filter((_, i) => i % per === 0);
      expect(firsts.length).toBe(4);
      firsts.forEach((e, s) => {
        for (let k = 0; k < per; k++) expect(list[s * per + k].id).toBe(e.id); // the same era for its three rounds
        const maps = Array.from({ length: per }, (_, k) => mapFor(seed, s * per + k + 1, e.id));
        if ((e.alt?.length ?? 0) + 1 >= per) expect(new Set(maps).size).toBe(per); // ...each on another arena
      });
      const order = firsts.filter((e) => !e.special).map((e) => normal.indexOf(e.id));
      expect(order).toEqual([...order].sort((a, b) => a - b)); // in history order
      expect(new Set(order).size).toBe(order.length); // no era twice
      matches.add(order.join());
      expect(eraFor(seed, T.match.rounds + 1).id).toBe(list.at(-1)!.id); // a tie-break round: still the last era...
      if (list.at(-1)!.alt?.length) expect(mapFor(seed, T.match.rounds + 1, list.at(-1)!.id)).not.toBe(mapFor(seed, T.match.rounds, list.at(-1)!.id)); // ...on another arena (where it has one)
    }
    expect(matches.size).toBeGreaterThan(20); // each match its own eras
  });

  it('every round starts with a countdown that holds everyone still, then the fight is on', async () => {
    const sim = await Sim.create(7, 2, false), f = sim.fighters[0], x0 = f.torso.body.translation().x;
    expect(sim.countdown).toBe(T.match.quick.countdown);
    for (let i = 0; i < T.match.quick.countdown - 1; i++) sim.step([{ ...NEUTRAL, moveX: 1 }, NEUTRAL]);
    expect(Math.abs(f.torso.body.translation().x - x0)).toBeLessThan(0.1); // held at the start
    for (let i = 0; i < 60; i++) sim.step([{ ...NEUTRAL, moveX: 1 }, NEUTRAL]);
    expect(sim.countdown).toBe(0);
    expect(f.torso.body.translation().x - x0).toBeGreaterThan(1); // off it goes
    const alone = await Sim.create(7); // (practice has no countdown)
    expect(alone.countdown).toBe(0);
  });

  it('the server waits a moment between two rounds of one era, and the whole museum only when the era changes', async () => {
    const sim = await Sim.create(11, 2, false), room = new Room(sim), waits: { museum: boolean; ticks: number }[] = [];
    for (let r = 0; r < 4; r++) {
      knockOff(sim, 1);
      while (!sim.roundOver) room.tick();
      const museum = sim.eraEnds, round = sim.round;
      let ticks = 0;
      while (sim.round === round) { room.tick(); ticks++; }
      waits.push({ museum, ticks });
    }
    expect(waits.map((w) => w.museum)).toEqual([false, false, true, false]); // rounds 1 and 2: the era goes on; round 3 ends it
    for (const w of waits) if (w.museum) expect(w.ticks).toBeGreaterThan(6 * 60); else expect(w.ticks).toBeLessThan(2 * 60);
  });

  it('a page shows the same countdown, and its own fighter waits for the server through the break and the countdown', async () => {
    const server = await Sim.create(3, 2, false), client = await Sim.create(3, 2, false), room = new Room(server), mirror = new Mirror(client);
    const tick = () => { const s = room.tick()!; mirror.push(JSON.parse(JSON.stringify(s))); mirror.show(s.frame); return s; };
    let s = tick();
    expect(client.countdown).toBe(server.countdown);
    expect(client.countdown).toBeGreaterThan(0);
    expect(s.f[0].st! & WAITING).toBeTruthy();
    while (server.countdown > 0) s = tick();
    s = tick();
    expect(s.f[0].st! & WAITING).toBe(0); // the fight is on: the page moves its own fighter again
    knockOff(server, 1);
    while (!server.roundOver) s = tick();
    expect(s.f[0].st! & WAITING).toBeTruthy(); // the round is won: the server moves everyone
  });

  it('the replay comes only when an era ends: its best moment of the era\'s rounds', async () => {
    const was = T.eras.changeGameplay;
    T.eras.changeGameplay = true;
    try {
      const sim = await Sim.create(31, 4, false), tape = new Tape();
      sim.looks = sim.looks.map(() => botLook());
      sim.reset();
      const got: { round: number; ended: boolean; clipRound: number }[] = [];
      for (let i = 0; i < 60 * 300 && sim.round <= 4; i++) {
        sim.step([NEUTRAL, NEUTRAL, NEUTRAL, NEUTRAL]);
        tape.feed(sim);
        const c = tape.take();
        if (c) got.push({ round: sim.round, ended: sim.eraEnds, clipRound: c.round });
      }
      expect(got.length).toBeGreaterThan(0);
      for (const g of got) { expect(g.ended).toBe(true); expect(g.round % T.match.roundsPerEra).toBe(0); expect(g.clipRound).toBeLessThanOrEqual(g.round); }
    } finally { T.eras.changeGameplay = was; }
  }, 120_000);
});

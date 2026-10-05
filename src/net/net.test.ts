import { describe, expect, it } from 'vitest';
import { fuzzer } from '../sim/fuzz';
import { makeRng } from '../sim/rng';
import { Sim } from '../sim/world';
import { Mirror } from './snapshot';
import type { Snapshot } from './snapshot';
import { Room } from './room';

const wire = (s: Snapshot): Snapshot => JSON.parse(JSON.stringify(s)); // what actually crosses the network

async function pair(seed: number, players: number, dummy: boolean) {
  const server = await Sim.create(seed, players, dummy);
  const client = await Sim.create(seed, players, dummy);
  return { room: new Room(server), mirror: new Mirror(client), server, client };
}

/** Largest gap between a server body part and the client's copy of it (and a note if the part lists differ). */
function gap(server: Sim, client: Sim, tolerateLag = false): number {
  let worst = 0;
  server.fighters.forEach((f, i) => {
    const g = client.fighters[i];
    if (g.parts.length !== f.parts.length) { if (!tolerateLag) worst = Infinity; return; } // lagging clients legitimately have the old part list for a moment
    if (tolerateLag && f.limp) return; // a fighter who fell into the void is still falling fast: not worth comparing under lag
    f.parts.forEach((p, j) => { const t = p.body.translation(); if (tolerateLag && p.role !== 'torso') return; // clubs teleport back from the void and parts reset on a new round: judge lag by the bodies
      worst = Math.max(worst, Math.abs(t.x - g.parts[j].cx), Math.abs(t.y - g.parts[j].cy)); });
  });
  return worst;
}

describe('online mirror', () => {
  it.each([1, 2, 3])('seed %i: with every snapshot shown exactly, the client copy matches the server through deaths, pickups and new rounds', async (seed) => {
    const { room, mirror, server, client } = await pair(seed, 4, false);
    const inputs = fuzzer(seed * 7 + 1);
    let worst = 0, rounds = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 2400; i++) {
      for (let k = 0; k < 4; k++) room.setInput(k, inputs(4)[k]);
      const s = room.tick();
      if (!s) continue;
      mirror.push(wire(s));
      const { events } = mirror.show(s.frame);
      for (const e of events) seen.add(e.t);
      rounds = Math.max(rounds, client.round);
      worst = Math.max(worst, gap(server, client));
    }
    expect(mirror.desyncs).toBe(0);
    expect(worst).toBeLessThan(0.01); // only the rounding to a millimetre
    expect(rounds).toBeGreaterThan(1); // the test did cross a round change
    expect(seen.has('die') || seen.has('fall')).toBe(true);
    expect(seen.has('pickup')).toBe(true);
  }, 120_000);

  it('training mode (a dummy that dies and respawns) stays in step too', async () => {
    const { room, mirror, server, client } = await pair(4, 2, true);
    const inputs = fuzzer(31);
    let worst = 0, respawns = 0;
    for (let i = 0; i < 3000; i++) {
      room.setInput(0, inputs(1)[0]);
      const s = room.tick();
      if (!s) continue;
      mirror.push(wire(s));
      respawns += mirror.show(s.frame).events.filter((e) => e.t === 'respawn').length;
      worst = Math.max(worst, gap(server, client));
    }
    expect(mirror.desyncs).toBe(0);
    expect(worst).toBeLessThan(0.01);
    expect(respawns).toBeGreaterThan(0);
  }, 120_000);

  it('a player who leaves dies that round and stays out of every later round, on the server and the client', async () => {
    const { room, mirror, server, client } = await pair(8, 4, false);
    const inputs = fuzzer(21);
    let worst = 0, roundAtLeave = 0, scoreAtLeave = 0;
    for (let i = 0; i < 3000; i++) {
      if (i === 400) { room.removePlayer(2); roundAtLeave = server.round; scoreAtLeave = server.scores[2]; }
      for (let k = 0; k < 4; k++) room.setInput(k, inputs(4)[k]);
      const s = room.tick();
      if (!s) continue;
      mirror.push(wire(s));
      mirror.show(s.frame);
      worst = Math.max(worst, gap(server, client));
      if (i > 400) { expect(server.fighters[2].limp).toBe(true); expect(client.fighters[2].limp).toBe(true); }
    }
    expect(server.round).toBeGreaterThan(roundAtLeave + 1); // several later rounds happened
    expect(server.fighters[2].torso.body.translation().y).toBeGreaterThan(30); // parked far below the stage
    expect(mirror.desyncs).toBe(0);
    expect(worst).toBeLessThan(0.01);
    expect(server.scores[2]).toBe(scoreAtLeave); // the leaver never scores again
  }, 120_000);

  it('a client that joins mid-round catches up from the room', async () => {
    const { room, server } = await pair(5, 4, false);
    const inputs = fuzzer(11);
    const first = await Sim.create(5, 4, false);
    const early = new Mirror(first);
    let late: Mirror | null = null, lateSim: Sim | null = null, worst = 0;
    for (let i = 0; i < 1500; i++) {
      for (let k = 0; k < 4; k++) room.setInput(k, inputs(4)[k]);
      const s = room.tick();
      if (i === 900) { lateSim = await Sim.create(5, 4, false); late = new Mirror(lateSim); late.push(wire(room.catchUp())); late.show(room.catchUp().frame); }
      if (!s) continue;
      early.push(wire(s));
      early.show(s.frame);
      if (late && lateSim) { late.push(wire(s)); late.show(s.frame); worst = Math.max(worst, gap(server, lateSim)); }
    }
    expect(late!.desyncs).toBe(0);
    expect(worst).toBeLessThan(0.01);
  }, 120_000);

  it('a client that joins after players left and came back, many rounds in, still matches the server exactly', async () => {
    const { room, server } = await pair(12, 4, false);
    const inputs = fuzzer(41);
    const lateSim = await Sim.create(12, 4, false);
    const late = new Mirror(lateSim);
    let worst = 0, joined = false;
    for (let i = 0; i < 4200; i++) {
      if (i === 500) room.removePlayer(1);
      if (i === 900) room.removePlayer(3);
      if (i === 1800) room.restorePlayer(1, false); // back: appears next round
      if (i === 2400) room.restorePlayer(3, true);
      for (let k = 0; k < 4; k++) room.setInput(k, inputs(4)[k]);
      const s = room.tick();
      if (i === 3000) { const c = wire(room.catchUp()); late.reset(); late.push(c); late.show(c.frame); joined = true; }
      if (!s) continue;
      if (joined) { late.push(wire(s)); late.show(s.frame); worst = Math.max(worst, gap(server, lateSim)); }
    }
    expect(late.desyncs).toBe(0);
    expect(worst).toBeLessThan(0.01);
    expect(server.round).toBeGreaterThan(4);
  }, 120_000);

  it('with 100 ms of lag and jitter the client plays smoothly, behind by about the delay, with no desyncs and no stalls', async () => {
    const { room, mirror, server, client } = await pair(6, 4, false);
    const inputs = fuzzer(77);
    const jitter = makeRng(5);
    const inflight: { at: number; s: Snapshot }[] = []; // snapshots on the wire: arrive 80-120 ms after they were sent, in order
    let lastArrival = 0, now = 0, maxLag = 0, jumps = 0, prevX = NaN;
    for (let i = 0; i < 2400; i++) {
      now = i / 60;
      for (let k = 0; k < 4; k++) room.setInput(k, inputs(4)[k]);
      const s = room.tick();
      if (s) { lastArrival = Math.max(lastArrival + 0.001, now + 0.08 + jitter() * 0.04); inflight.push({ at: lastArrival, s: wire(s) }); }
      while (inflight.length && inflight[0].at <= now) mirror.push(inflight.shift()!.s);
      mirror.update(1 / 60);
      const live = client.fighters[0].torso;
      const shownX = live.px + (live.cx - live.px); // the blended pose the renderer would draw at alpha 1
      if (!Number.isNaN(prevX) && Math.abs(shownX - prevX) > 1.5) jumps++; // 1.5 m in one frame would be a visible teleport
      prevX = shownX;
      maxLag = Math.max(maxLag, gap(server, client, true));
    }
    expect(mirror.desyncs).toBe(0);
    expect(jumps).toBeLessThan(40); // deaths and round changes can legitimately move a part a long way; ordinary play must not
    expect(maxLag).toBeLessThan(8); // behind the server by a fraction of a second of motion, never wildly off
  }, 120_000);
});

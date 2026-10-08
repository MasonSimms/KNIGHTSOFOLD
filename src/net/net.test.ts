import { describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import { fuzzer } from '../sim/fuzz';
import { makeRng } from '../sim/rng';
import { NEUTRAL } from '../sim/types';
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
  if (tolerateLag && server.round !== client.round) return 0; // the client is a round behind: the two worlds legitimately differ
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
  it('an input that stays waiting at the server (a tick of delay for good) is taken away after a while (its presses folded in)', async () => {
    const sim = await Sim.create(3, 2, false), room = new Room(sim);
    let n = 0;
    room.setInput(0, NEUTRAL, ++n); // one ahead: from now on, one always waits
    for (let i = 0; i < T.net.inputTrim + 30; i++) { room.setInput(0, NEUTRAL, ++n); room.tick(); }
    const st = room.stats[0];
    expect(st.folded).toBeGreaterThan(0); // trimmed
    const s = room.tick();
    expect(s!.ack![0]).toBe(n); // no input left waiting: the newest one is in use
  });

  it('a new round waits while the room is told to hold it (a page still painting), then starts, and the next pause is the usual one', async () => {
    const sim = await Sim.create(3, 2, false), room = new Room(sim), base = sim.extraRoundPause;
    let hold = true;
    room.hold = () => hold;
    (sim as unknown as { kill(f: unknown, fell: boolean): void }).kill(sim.fighters[1], true);
    let ticks = 0;
    for (; ticks < 2000 && sim.round === 1; ticks++) { room.tick(); if (ticks === T.match.resultFrames + base + 120) hold = false; }
    expect(sim.round).toBe(2);
    expect(ticks).toBeGreaterThan(T.match.resultFrames + base + 110); // it waited past the usual pause
    expect(sim.extraRoundPause).toBe(base);
  });

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

  it.each([4, 5])('seed %i: over the fast lane (snapshots lost, repeated by the WebSocket a little later, out of order) the copy still matches through deaths, pickups and new rounds', async (seed) => {
    const { room, mirror, server, client } = await pair(seed, 4, false);
    const ref = new Mirror(await Sim.create(seed, 4, false)); // (a copy fed every snapshot, in order: what the events should be)
    const inputs = fuzzer(seed * 11 + 3), rng = makeRng(seed);
    const slow: { at: number; s: Snapshot }[] = [];
    let worst = 0, rounds = 0, lost = 0;
    const seen: string[] = [], truth: string[] = [];
    const key = (e: { t: string; owner: number; x: number }) => `${e.t}${e.owner}@${e.x.toFixed(2)}`;
    for (let i = 0; i < 2400; i++) {
      for (let k = 0; k < 4; k++) room.setInput(k, inputs(4)[k]);
      const s = room.tick();
      if (!s) continue;
      const fast = rng(), copy = wire(s);
      if (fast < 0.1) lost++; // lost on the fast lane (1 in 10: far worse than real)
      else if (fast < 0.15) slow.push({ at: i + 2, s: wire(s) }); // overtaken: it turns up two ticks late
      else mirror.push(copy);
      slow.push({ at: i + 8, s: copy }); // ...and the WebSocket brings every one again, later
      while (slow.length && slow[0].at <= i) mirror.push(slow.shift()!.s);
      ref.push(wire(s));
      for (const e of ref.show(s.frame).events) if (e.t === 'die' || e.t === 'fall' || e.t === 'pickup') truth.push(key(e));
      const { events } = mirror.show(s.frame - 1);
      for (const e of events) if (e.t === 'die' || e.t === 'fall' || e.t === 'pickup') seen.push(key(e));
      rounds = Math.max(rounds, client.round);
      if (server.round === client.round) worst = Math.max(worst, gap(server, client, true));
    }
    expect(lost).toBeGreaterThan(100);
    expect(mirror.desyncs).toBe(0);
    expect(rounds).toBeGreaterThan(1);
    expect(seen.slice(0, truth.length - 2)).toEqual(truth.slice(0, truth.length - 2)); // every death and pickup shown once, in order (the last may be a tick behind)
    expect(truth.length).toBeGreaterThan(2);
    expect(worst).toBeLessThan(1.5); // (a tick behind the server, while fighters fly about)
  }, 120_000);

  it('a client that stops drawing for a few seconds (a hidden tab) is still in step when it looks again', async () => {
    const { room, mirror, server, client } = await pair(2, 4, false);
    const inputs = fuzzer(23);
    let hidden = 0;
    for (let i = 0; i < 2400; i++) {
      for (let k = 0; k < 4; k++) room.setInput(k, inputs(4)[k]);
      const s = room.tick();
      if (!s) continue;
      mirror.push(wire(s));
      if (i % 600 < 240) { hidden++; continue; } // 4 s of every 10 nothing is shown (snapshots keep arriving)
      mirror.show(s.frame);
      expect(gap(server, client)).toBeLessThan(0.01);
    }
    expect(hidden).toBeGreaterThan(600);
    expect(mirror.desyncs).toBe(0);
  }, 120_000);

  it('the client copy stays in step when limbs come off (the parts stay, only the joints and the poses change)', async () => {
    const { room, mirror, server, client } = await pair(14, 4, false);
    const inputs = fuzzer(61);
    let worst = 0;
    for (let i = 0; i < 1800; i++) {
      if (i % 150 === 75) {
        const f = server.fighters.find((x) => !x.limp);
        if (f) (server as unknown as { maim(f: unknown, p: unknown, nx: number, ny: number): void }).maim(f, i % 300 === 75 ? f.fore : f.legs[0].thigh, -1, 0);
      }
      for (let k = 0; k < 4; k++) room.setInput(k, inputs(4)[k]);
      const s = room.tick();
      if (!s) continue;
      mirror.push(wire(s));
      mirror.show(s.frame);
      worst = Math.max(worst, gap(server, client));
    }
    expect(mirror.desyncs).toBe(0);
    expect(worst).toBeLessThan(0.01);
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
  it('a line that stalls now and then (wifi): the buffer widens to cover the stalls, then narrows again once the line is steady', async () => {
    const { room, mirror } = await pair(6, 4, false);
    const inputs = fuzzer(78);
    const inflight: { at: number; s: Snapshot }[] = [];
    let lastArrival = 0;
    const waitsBy = [0, 0, 0]; // frames the picture had to wait: while learning (the first 6 s), once learnt (6-30 s), on the steady line after
    for (let i = 0; i < 4200; i++) { // 70 s: for 30 s a 200 ms stall every 2 s (its snapshots arrive in a bunch when it ends), then a steady line
      const now = i / 60;
      for (let k = 0; k < 4; k++) room.setInput(k, inputs(4)[k]);
      const s = room.tick();
      if (s) { const stall = now < 30 && i % 120 < 12 ? 0.2 - (i % 120) / 60 : 0; lastArrival = Math.max(lastArrival + 0.0001, now + 0.05 + stall); inflight.push({ at: lastArrival, s: wire(s) }); }
      while (inflight.length && inflight[0].at <= now) { const x = inflight.shift()!; mirror.push(x.s, x.at * 1000); } // (stamped with the pretend clock)
      const before = mirror.waits;
      mirror.update(1 / 60);
      if (mirror.waits > before) waitsBy[now < 6 ? 0 : now < 30 ? 1 : 2]++;
      if (i === 1799) expect(mirror.delay).toBeGreaterThanOrEqual(8); // 200 ms of stall is about 12 ticks: the buffer covers all but its worst twentieth (net.jitter.percentile), the rest is carried over (extrapolateTicks)
    }
    expect(mirror.desyncs).toBe(0);
    expect(waitsBy[1]).toBe(0); // the buffer learns from the first stall (its snapshots come in a late bunch) and covers the rest
    expect(waitsBy[2]).toBe(0);
    expect(mirror.delay).toBeCloseTo(T.net.blendTicks, 2); // 40 s of a steady line: back to the minimum
  }, 120_000);
});

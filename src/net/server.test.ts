import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { startServer } from '../../server/index';
import type { Server, ServerOptions } from '../../server/index';
import { Sim } from '../sim/world';
import type { ClientMsg, ServerMsg } from './protocol';
import { Mirror } from './snapshot';

/** A tiny test client: remembers every message and lets a test wait for one. */
class Client {
  msgs: ServerMsg[] = [];
  ws: WebSocket;
  closed = false;
  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`);
    this.ws.on('message', (d) => this.msgs.push(JSON.parse(d.toString())));
    this.ws.on('close', () => { this.closed = true; });
  }
  ready() { return new Promise<void>((ok) => (this.ws.readyState === WebSocket.OPEN ? ok() : this.ws.once('open', () => ok()))); }
  send(m: unknown) { this.ws.send(typeof m === 'string' ? m : JSON.stringify(m as ClientMsg)); }
  async wait<T extends ServerMsg['t']>(t: T, pred: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true, ms = 4000): Promise<Extract<ServerMsg, { t: T }>> {
    const end = Date.now() + ms;
    for (;;) {
      const m = this.msgs.find((x) => x.t === t && pred(x as Extract<ServerMsg, { t: T }>));
      if (m) return m as Extract<ServerMsg, { t: T }>;
      if (Date.now() > end) throw new Error(`timed out waiting for ${t}; got ${JSON.stringify(this.msgs.map((x) => x.t))}`);
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  clear() { this.msgs.length = 0; }
  close() { this.ws.close(); }
}

let server: Server | null = null;
const clients: Client[] = [];
async function boot(opts: ServerOptions = {}) { server = await startServer(0, opts); return server; }
async function connect() { const c = new Client(server!.port); clients.push(c); await c.ready(); return c; }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
afterEach(async () => { clients.splice(0).forEach((c) => c.ws.terminate()); await server?.close(); server = null; });

/** Host makes a room, `n - 1` others join it, everyone ends up in the lobby. */
async function lobbyOf(n: number, opts: ServerOptions = {}) {
  await boot(opts);
  const host = await connect();
  host.send({ t: 'create' });
  const { code } = await host.wait('lobby');
  const others: Client[] = [];
  for (let i = 1; i < n; i++) {
    const c = await connect();
    c.send({ t: 'join', code });
    await c.wait('lobby');
    others.push(c);
  }
  await host.wait('lobby', (m) => m.n === n);
  return { host, others, code };
}

/** A lobby of `n` where the host has pressed Start and everyone is in the fight. */
async function fightOf(n: number, opts: ServerOptions = {}) {
  const l = await lobbyOf(n, opts);
  l.host.send({ t: 'start' });
  const all = [l.host, ...l.others];
  const starts = await Promise.all(all.map((c) => c.wait('start')));
  const game = server!.rooms.get(l.code)!.game!;
  return { ...l, all, starts, game, seed: starts[0].seed };
}

/** Kill a fighter the way a fatal hit would (the sim's own kill: ragdoll, event and all). */
const kill = (sim: Sim, i: number) => (sim as unknown as { kill(f: unknown, fell: boolean): void }).kill(sim.fighters[i], true);

const sameParts = (server: Sim, client: Sim) => server.fighters.every((f, i) => f.parts.length === client.fighters[i].parts.length);

describe('room server', () => {
  it('make a room, get a 4-letter code, others join by it, the host starts, everyone gets the same seed and their own slot', async () => {
    const { code, starts, host } = await fightOf(4);
    expect(code).toMatch(/^[A-HJ-KM-NP-Z]{4}$/);
    expect(new Set(starts.map((s) => s.seed)).size).toBe(1);
    expect(starts.map((s) => s.you).sort()).toEqual([0, 1, 2, 3]);
    expect(starts.every((s) => !s.queued && s.token.length > 10)).toBe(true);
    expect((await host.wait('snap')).s.f.length).toBe(4);
  });

  it('only the host can start, and not alone', async () => {
    const { host, others } = await lobbyOf(2);
    others[0].send({ t: 'start' });
    expect((await others[0].wait('error')).why).toMatch(/host/);
    const solo = await connect();
    solo.send({ t: 'create' });
    await solo.wait('lobby');
    solo.send({ t: 'start' });
    expect((await solo.wait('error')).why).toMatch(/at least 2/);
    expect(host.msgs.some((m) => m.t === 'start')).toBe(false);
  });

  it('refuses a wrong code and a fifth player in a lobby (codes ignore case)', async () => {
    const { code } = await lobbyOf(4);
    const extra = await connect();
    extra.send({ t: 'join', code: 'ZZZZ' });
    expect((await extra.wait('error')).why).toMatch(/no room/);
    extra.clear();
    extra.send({ t: 'join', code: code.toLowerCase() });
    expect((await extra.wait('error')).why).toMatch(/full/);
  });

  it('a player moves their own fighter with their inputs, and junk input does no harm', async () => {
    const { host, others } = await fightOf(2);
    const x0 = (await host.wait('snap')).s.f[0].p[0];
    for (let i = 0; i < 60; i++) host.send({ t: 'in', i: { moveX: 1, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false } });
    others[0].send('this is not json');
    others[0].send({ t: 'in', i: { moveX: 'NaN', aim: Infinity, jump: 'yes' } });
    others[0].send({ t: 'in', i: null });
    others[0].send({ t: 'nonsense' });
    await sleep(700);
    const last = [...host.msgs].reverse().find((m) => m.t === 'snap')!;
    if (last.t !== 'snap') throw new Error('no snapshot');
    expect(last.s.f[0].p[0]).toBeGreaterThan(x0 + 0.5);
    expect(others[0].closed).toBe(false);
    expect(host.msgs.filter((m) => m.t === 'snap').every((m) => m.t === 'snap' && m.s.f.every((f) => f.p.every(Number.isFinite)))).toBe(true);
  });

  it('a player who drops out dies that round; the fight goes on for the others and nobody can farm points alone', async () => {
    const { host, others, code } = await fightOf(2);
    others[0].close();
    const gone = await host.wait('snap', (m) => m.s.ev.some((e) => e.t === 'gone' && e.owner === 1), 3000);
    expect(gone.s.ev.some((e) => e.t === 'die' || e.t === 'fall')).toBe(true);
    await sleep(3500); // longer than a round-over pause: a lone player must not win rounds
    const sim = server!.rooms.get(code)!.game!.sim;
    expect(sim.scores.every((s) => s === 0)).toBe(true);
    expect(host.msgs.some((m) => m.t === 'over')).toBe(false); // and the fight was not ended
  });

  it('a newcomer can join a fight under way, is told they appear next round, and their copy of the fight matches the server', async () => {
    const { code, seed, game } = await fightOf(2);
    const late = await connect();
    late.send({ t: 'join', code });
    const start = await late.wait('start');
    expect(start.queued).toBe(true);
    expect(start.you).toBe(2); // the first empty seat
    const mirror = new Mirror(await Sim.create(seed, 4, false));
    mirror.push((await late.wait('snap')).s); // the catch-up snapshot
    const first = (await late.wait('snap')).s;
    mirror.push(first);
    mirror.show(first.frame);
    expect(mirror.desyncs).toBe(0);
    expect(sameParts(game.sim, mirror.sim)).toBe(true);
  });

  it('newcomers fill the empty seats, a fifth is refused, and everyone is alive together once the round turns over', async () => {
    const { code, game } = await fightOf(2);
    for (const slot of [2, 3]) {
      const c = await connect();
      c.send({ t: 'join', code });
      expect((await c.wait('start')).you).toBe(slot);
    }
    const fifth = await connect();
    fifth.send({ t: 'join', code });
    expect((await fifth.wait('error')).why).toMatch(/full/);
    expect(game.sim.fighters[2].limp && game.sim.fighters[3].limp).toBe(true); // queued: not in this round
    kill(game.sim, 0); kill(game.sim, 1); // the round ends
    const round = game.sim.round;
    const end = Date.now() + 8000;
    while (game.sim.round === round && Date.now() < end) await sleep(50);
    await sleep(100);
    expect(game.sim.round).toBe(round + 1);
    expect(game.sim.fighters.every((f) => !f.limp)).toBe(true);
  }, 20000);

  it('a dropped player gets their seat and score back by token, and a new round starts with them in it', async () => {
    const { code, all, starts, game } = await fightOf(3);
    game.sim.scores[1] = 7;
    const token = starts[1].token;
    all[1].ws.terminate(); // a hard drop, no goodbye
    await sleep(200);
    expect(game.sim.fighters[1].limp).toBe(true);
    const back = await connect();
    back.send({ t: 'rejoin', code, token });
    const start = await back.wait('start');
    expect(start.you).toBe(1);
    expect(start.queued).toBe(true);
    expect(game.sim.scores[1]).toBe(7); // their score was kept
    expect(game.sim.gone[1]).toBe(false);
    // kill the other two so the round ends and the next one starts with everyone
    kill(game.sim, 0); kill(game.sim, 2);
    const roundNow = game.sim.round;
    const end = Date.now() + 15000;
    while (game.sim.round === roundNow && Date.now() < end) await sleep(50);
    await sleep(100);
    expect(game.sim.fighters.slice(0, 3).every((f) => !f.limp)).toBe(true); // all three players are in (seat 3 is empty and stays parked)
    expect(game.sim.fighters[3].limp).toBe(true);
  }, 30000);

  it('rejoining with a live old connection takes the seat over (the server may not have noticed the drop yet)', async () => {
    const { code, all, starts, game } = await fightOf(2);
    const again = await connect();
    again.send({ t: 'rejoin', code, token: starts[1].token });
    await again.wait('start');
    await sleep(100);
    expect(all[1].closed).toBe(true); // the old connection was closed
    expect(game.sim.fighters[1].limp).toBe(true); // they were counted as gone for a moment...
    expect(game.sim.gone[1]).toBe(false); // ...and are back
  });

  it('a wrong token cannot take a seat', async () => {
    const { code } = await fightOf(2);
    const thief = await connect();
    thief.send({ t: 'rejoin', code, token: 'not-the-token' });
    expect((await thief.wait('error')).why).toMatch(/seat/);
  });

  it('a dropped player\'s seat is held for them for a while, then a newcomer may take it with a fresh score', async () => {
    const { code, all, game } = await fightOf(4, { reserveMs: 400 });
    game.sim.scores[3] = 5;
    all[3].ws.terminate();
    await sleep(100);
    const early = await connect();
    early.send({ t: 'join', code });
    expect((await early.wait('error')).why).toMatch(/full/); // held for the player who dropped
    await sleep(500);
    early.clear();
    early.send({ t: 'join', code });
    const start = await early.wait('start');
    expect(start.you).toBe(3);
    expect(game.sim.scores[3]).toBe(0);
  });

  it('a fight nobody is connected to is deleted after a while', async () => {
    const { code, all } = await fightOf(2, { emptyMs: 300 });
    all.forEach((c) => c.ws.terminate());
    await sleep(100);
    expect(server!.rooms.has(code)).toBe(true);
    await sleep(1800);
    expect(server!.rooms.has(code)).toBe(false);
  });

  it('the host leaving the lobby hands host to the next player; the host can end a fight back to the lobby', async () => {
    const { host, others } = await lobbyOf(3);
    host.close();
    const lob = await others[0].wait('lobby', (m) => m.n === 2 && m.host);
    expect(lob.you).toBe(0);
    others[0].send({ t: 'start' });
    await others[0].wait('start');
    others[0].send({ t: 'end' });
    await others[1].wait('over');
    await others[1].wait('lobby', (m) => m.n === 2 && !m.host);
  });

  it('the server limits how many rooms exist', async () => {
    await boot({ maxRooms: 1 });
    const a = await connect(), b = await connect();
    a.send({ t: 'create' });
    await a.wait('lobby');
    b.send({ t: 'create' });
    expect((await b.wait('error')).why).toMatch(/full/);
  });
});

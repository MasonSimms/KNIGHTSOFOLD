import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { startServer } from '../../server/index';
import type { Server } from '../../server/index';
import type { ClientMsg, ServerMsg } from './protocol';

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
async function boot(maxRooms = 20) { server = await startServer(0, maxRooms); return server; }
async function connect() { const c = new Client(server!.port); clients.push(c); await c.ready(); return c; }
afterEach(async () => { clients.splice(0).forEach((c) => c.ws.terminate()); await server?.close(); server = null; });

/** Host makes a room, `n - 1` others join it, everyone ends up in the lobby. */
async function lobbyOf(n: number) {
  await boot();
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

describe('room server', () => {
  it('make a room, get a 4-letter code, others join by it, the host starts, everyone gets the same seed and their own slot', async () => {
    const { host, others, code } = await lobbyOf(4);
    expect(code).toMatch(/^[A-HJ-KM-NP-Z]{4}$/);
    host.send({ t: 'start' });
    const starts = await Promise.all([host, ...others].map((c) => c.wait('start')));
    expect(new Set(starts.map((s) => s.seed)).size).toBe(1);
    expect(starts.map((s) => s.you).sort()).toEqual([0, 1, 2, 3]);
    expect(starts.every((s) => s.count === 4)).toBe(true);
    const snap = await host.wait('snap');
    expect(snap.s.f.length).toBe(4);
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

  it('refuses a wrong code, a fifth player, and joining a fight already under way', async () => {
    const { host, code } = await lobbyOf(4);
    const extra = await connect();
    extra.send({ t: 'join', code: 'ZZZZ' });
    expect((await extra.wait('error')).why).toMatch(/no room/);
    extra.clear();
    extra.send({ t: 'join', code: code.toLowerCase() }); // codes are not case sensitive
    expect((await extra.wait('error')).why).toMatch(/full/);
    host.send({ t: 'start' });
    await host.wait('start');
    const late = await connect();
    late.send({ t: 'join', code });
    expect((await late.wait('error')).why).toMatch(/already started/);
  });

  it('a player moves their own fighter with their inputs, and junk input does no harm', async () => {
    const { host, others } = await lobbyOf(2);
    host.send({ t: 'start' });
    await host.wait('start');
    const x0 = (await host.wait('snap')).s.f[0].p[0];
    for (let i = 0; i < 60; i++) host.send({ t: 'in', i: { moveX: 1, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false } });
    others[0].send('this is not json');
    others[0].send({ t: 'in', i: { moveX: 'NaN', aim: Infinity, jump: 'yes' } });
    others[0].send({ t: 'in', i: null });
    others[0].send({ t: 'nonsense' });
    await new Promise((r) => setTimeout(r, 700));
    const last = [...host.msgs].reverse().find((m) => m.t === 'snap')!;
    if (last.t !== 'snap') throw new Error('no snapshot');
    expect(last.s.f[0].p[0]).toBeGreaterThan(x0 + 0.5); // walked right
    expect(others[0].closed).toBe(false); // the server shrugged the junk off
    expect(host.msgs.filter((m) => m.t === 'snap').every((m) => m.t === 'snap' && m.s.f.every((f) => f.p.every(Number.isFinite)))).toBe(true);
  });

  it('a player who disconnects mid-fight dies and is announced to the others; with too few left the fight ends and the room returns to the lobby', async () => {
    const { host, others } = await lobbyOf(3);
    host.send({ t: 'start' });
    await host.wait('start');
    others[1].close();
    const gone = await host.wait('snap', (m) => m.s.ev.some((e) => e.t === 'gone' && e.owner === 2), 3000);
    expect(gone.s.ev.some((e) => e.t === 'die' || e.t === 'fall')).toBe(true);
    others[0].close(); // now only the host is left
    await host.wait('over');
    const lob = await host.wait('lobby', (m) => m.n === 1);
    expect(lob.host).toBe(true);
    expect(server!.rooms.size).toBe(1);
    host.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(server!.rooms.size).toBe(0); // an empty room is deleted
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
    await boot(1);
    const a = await connect(), b = await connect();
    a.send({ t: 'create' });
    await a.wait('lobby');
    b.send({ t: 'create' });
    expect((await b.wait('error')).why).toMatch(/full/);
  });
});

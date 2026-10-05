import { WebSocketServer, WebSocket } from 'ws';
import { cleanInput, MAX_PLAYERS, MIN_PLAYERS } from '../src/net/protocol';
import type { ClientMsg, ServerMsg } from '../src/net/protocol';
import { Room } from '../src/net/room';
import { Sim } from '../src/sim/world';

// The room server: 4-letter room codes, up to 4 players, the host starts the fight, the real sim runs here at 60 Hz.
// Run it with `npm run server`. One process holds every room (ponytail: a single process; shard by room code if one machine is ever too small).

const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no I, L or O: they read as 1 and 0
const DT = 1000 / 60;

interface Player { ws: WebSocket; slot: number }

class GameRoom {
  players: Player[] = []; // in join order; index 0 is the host
  game: { room: Room; sim: Sim } | null = null;
  constructor(readonly code: string) {}
}

export interface Server { port: number; rooms: Map<string, GameRoom>; close(): Promise<void> }

export async function startServer(port: number, maxRooms = 20): Promise<Server> {
  const rooms = new Map<string, GameRoom>();
  const where = new WeakMap<WebSocket, { room: GameRoom; player: Player }>();
  const wss = new WebSocketServer({ port, maxPayload: 4096 }); // inputs are tiny: anything bigger is junk
  await new Promise<void>((ok) => wss.once('listening', ok));

  const send = (ws: WebSocket, m: ServerMsg) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };
  const lobby = (r: GameRoom) => r.players.forEach((p, i) => send(p.ws, { t: 'lobby', code: r.code, n: r.players.length, you: i, host: i === 0 }));
  const newCode = () => { for (;;) { const c = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join(''); if (!rooms.has(c)) return c; } };

  function endGame(r: GameRoom, why: string) {
    r.game = null;
    r.players = r.players.filter((p) => p.ws.readyState === WebSocket.OPEN);
    r.players.forEach((p) => send(p.ws, { t: 'over', why }));
    if (!r.players.length) rooms.delete(r.code); else lobby(r);
  }

  function leave(ws: WebSocket) {
    const at = where.get(ws);
    if (!at) return;
    where.delete(ws);
    const { room: r, player } = at;
    if (r.game) {
      r.game.room.removePlayer(player.slot); // they die this round and are out of every later one
      const left = r.players.filter((p) => p !== player && p.ws.readyState === WebSocket.OPEN);
      r.players = r.players.filter((p) => p !== player);
      if (left.length < MIN_PLAYERS) endGame(r, 'not enough players left');
    } else {
      r.players = r.players.filter((p) => p !== player);
      if (!r.players.length) rooms.delete(r.code); else lobby(r); // the next player in line becomes host
    }
  }

  function onMessage(ws: WebSocket, raw: string) {
    let m: ClientMsg;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const at = where.get(ws);
    if (m.t === 'in') {
      if (at?.room.game) at.room.game.room.setInput(at.player.slot, cleanInput(m.i));
    } else if (m.t === 'create' || m.t === 'join') {
      if (at) return send(ws, { t: 'error', why: 'already in a room' });
      let r: GameRoom | undefined;
      if (m.t === 'create') {
        if (rooms.size >= maxRooms) return send(ws, { t: 'error', why: 'the server is full, try again later' });
        r = new GameRoom(newCode());
        rooms.set(r.code, r);
      } else {
        r = rooms.get(String(m.code).toUpperCase().trim());
        if (!r) return send(ws, { t: 'error', why: 'no room with that code' });
        if (r.game) return send(ws, { t: 'error', why: 'that fight has already started' });
        if (r.players.length >= MAX_PLAYERS) return send(ws, { t: 'error', why: 'that room is full' });
      }
      const player = { ws, slot: r.players.length };
      r.players.push(player);
      where.set(ws, { room: r, player });
      lobby(r);
    } else if (m.t === 'start') {
      if (!at || at.room.game || at.room.players[0] !== at.player) return send(ws, { t: 'error', why: 'only the host can start' });
      const r = at.room;
      if (r.players.length < MIN_PLAYERS) return send(ws, { t: 'error', why: `need at least ${MIN_PLAYERS} players` });
      r.players.forEach((p, i) => { p.slot = i; });
      const seed = Math.floor(Math.random() * 2 ** 31);
      Sim.create(seed, r.players.length, false).then((sim) => {
        if (r.game || !r.players.length) return;
        r.game = { room: new Room(sim), sim };
        r.players.forEach((p) => send(p.ws, { t: 'start', seed, count: r.players.length, you: p.slot }));
      });
    } else if (m.t === 'end') {
      if (at?.room.game && at.room.players[0] === at.player) endGame(at.room, 'the host ended the fight');
    }
  }

  wss.on('connection', (ws) => {
    let alive = true, count = 0;
    ws.on('pong', () => { alive = true; });
    const rate = setInterval(() => { count = 0; }, 1000);
    const beat = setInterval(() => { if (!alive) return ws.terminate(); alive = false; ws.ping(); }, 15000); // a silent drop (no close message) is caught here
    ws.on('message', (d) => { if (++count > 200) return ws.close(1008, 'too many messages'); onMessage(ws, d.toString()); });
    ws.on('close', () => { clearInterval(rate); clearInterval(beat); leave(ws); });
    ws.on('error', () => ws.terminate());
  });

  // One loop for every room: run as many 60 Hz ticks as real time has passed (a few at most, then give up catching up).
  let last = performance.now(), acc = 0;
  const loop = setInterval(() => {
    const now = performance.now();
    acc = Math.min(acc + now - last, DT * 5);
    last = now;
    for (; acc >= DT; acc -= DT) {
      for (const r of rooms.values()) {
        if (!r.game) continue;
        const s = r.game.room.tick();
        if (!s) continue;
        const msg = JSON.stringify({ t: 'snap', s });
        for (const p of r.players) if (p.ws.readyState === WebSocket.OPEN && p.ws.bufferedAmount < 1_000_000) p.ws.send(msg); // a slow client just misses snapshots
      }
    }
  }, 5);

  const address = wss.address();
  return {
    port: address && typeof address === 'object' ? address.port : port, rooms,
    close: () => new Promise<void>((ok) => { clearInterval(loop); wss.clients.forEach((c) => c.terminate()); wss.close(() => ok()); }),
  };
}

// Started directly (node dist-server/index.js): listen on $PORT.
if (process.argv[1] && /dist-server[\\/]index\.js$/.test(process.argv[1])) {
  const s = await startServer(Number(process.env.PORT) || 8080, Number(process.env.MAX_ROOMS) || 20);
  console.log(`Knights of Old room server listening on port ${s.port}`);
}

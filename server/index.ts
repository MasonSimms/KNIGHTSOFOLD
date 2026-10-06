import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { botLook, COLORS, EYES, HATS } from '../src/content/looks';
import type { Look } from '../src/content/looks';
import { cleanInput, EMPTY_MS, MAX_PLAYERS, MIN_PLAYERS, RESERVE_MS } from '../src/net/protocol';
import type { ClientMsg, ServerMsg } from '../src/net/protocol';
import { Room } from '../src/net/room';
import { Sim } from '../src/sim/world';

// The room server: 4-letter room codes, up to 4 players, the host starts the fight, the real sim runs here at 60 Hz.
// People can join a fight under way (they appear next round) and come back after a drop (same seat, same score).
// Run it with `npm run server`. One process holds every room (ponytail: a single process; shard by room code if one machine is ever too small).

const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no I, L or O: they read as 1 and 0
const DT = 1000 / 60;

/** A player's place in a room. It outlives their connection: `ws` is null while they are away, and `token` is how they prove they are the same person.
 *  A bot's seat never has a connection: it is always ready, and a person who joins can take it. */
interface Seat { token: string; ws: WebSocket | null; leftAt: number; look: Look; ready: boolean; bot?: boolean }

class GameRoom {
  seats: (Seat | null)[] = []; // in a lobby: join order. In a fight: exactly MAX_PLAYERS entries, the index is the fighter number
  game: { room: Room; sim: Sim } | null = null;
  emptySince = 0; // when the last player disconnected from a running fight (0 = someone is here)
  constructor(readonly code: string) {}
  get present(): Seat[] { return this.seats.filter((s): s is Seat => !!s?.ws); } // connected players, lowest seat first: the first is the host
}

export interface ServerOptions { maxRooms?: number; reserveMs?: number; emptyMs?: number }
export interface Server { port: number; rooms: Map<string, GameRoom>; close(): Promise<void> }

export async function startServer(port: number, opts: ServerOptions = {}): Promise<Server> {
  const maxRooms = opts.maxRooms ?? 20, reserveMs = opts.reserveMs ?? RESERVE_MS, emptyMs = opts.emptyMs ?? EMPTY_MS;
  const rooms = new Map<string, GameRoom>();
  const where = new WeakMap<WebSocket, { room: GameRoom; seat: Seat }>();
  const wss = new WebSocketServer({ port, maxPayload: 4096 }); // inputs are tiny: anything bigger is junk
  await new Promise<void>((ok) => wss.once('listening', ok));

  const send = (ws: WebSocket | null, m: ServerMsg) => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };
  const newToken = () => randomBytes(12).toString('hex');
  const newCode = () => { for (;;) { const c = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join(''); if (!rooms.has(c)) return c; } };
  const slotOf = (r: GameRoom, seat: Seat) => r.seats.indexOf(seat);
  /** A new player's starting look: the first colour nobody in the room has. */
  const newSeat = (r: GameRoom): Seat => {
    const used = new Set(r.seats.map((s) => s?.look.color));
    return { token: newToken(), ws: null, leftAt: 0, look: { color: COLORS.findIndex((_, i) => !used.has(i)), hat: 'none', eyes: 'round' }, ready: false };
  };
  const botSeat = (): Seat => ({ token: newToken(), ws: null, leftAt: 0, look: botLook(), ready: true, bot: true });
  const applyLooks = (r: GameRoom) => { if (r.game) r.seats.forEach((s, i) => { if (s) r.game!.sim.looks[i] = { ...s.look }; }); };

  const lobby = (r: GameRoom) => {
    const list = r.present;
    const looks = r.seats.map((s) => s?.look ?? null), ready = r.seats.map((s) => !!s?.ready);
    list.forEach((s) => send(s.ws, { t: 'lobby', code: r.code, n: list.length, you: slotOf(r, s), host: s === list[0], token: s.token, looks, ready }));
  };

  /** Tell a player they are in the fight, with everything their client needs to build (or rebuild) its copy of it. */
  function sendStart(r: GameRoom, seat: Seat, queued: boolean, seed: number) {
    const g = r.game!;
    send(seat.ws, { t: 'start', seed, you: slotOf(r, seat), queued, token: seat.token });
    send(seat.ws, { t: 'snap', s: g.room.catchUp() });
  }
  const seeds = new WeakMap<GameRoom, number>();

  function endGame(r: GameRoom, why: string) {
    r.game = null;
    r.seats = r.seats.filter((s): s is Seat => !!s && (!!s.ws || !!s.bot)); // back to a lobby of whoever is still connected (and the bots)
    for (const s of r.seats) if (s) s.ready = !!s.bot;
    r.present.forEach((s) => send(s.ws, { t: 'over', why }));
    if (!r.present.length) rooms.delete(r.code); else lobby(r);
  }

  function leave(ws: WebSocket) {
    const at = where.get(ws);
    if (!at) return;
    where.delete(ws);
    const { room: r, seat } = at;
    if (r.game) {
      seat.ws = null; // the seat is kept for them for a while
      seat.leftAt = Date.now();
      r.game.room.removePlayer(slotOf(r, seat)); // they die this round and sit out until they are back
      if (!r.present.length) r.emptySince = Date.now();
    } else {
      r.seats = r.seats.filter((s) => s !== seat);
      if (!r.present.length) rooms.delete(r.code); else lobby(r); // the next player in line becomes host (a room of only bots is gone)
    }
  }

  function seatPlayer(r: GameRoom, ws: WebSocket, seat: Seat) {
    seat.ws = ws;
    where.set(ws, { room: r, seat });
    r.emptySince = 0;
  }

  function onMessage(ws: WebSocket, raw: string) {
    let m: ClientMsg;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const at = where.get(ws);
    if (m.t === 'in') {
      if (at?.room.game) at.room.game.room.setInput(slotOf(at.room, at.seat), cleanInput(m.i));
    } else if (m.t === 'create') {
      if (at) return send(ws, { t: 'error', why: 'already in a room' });
      if (rooms.size >= maxRooms) return send(ws, { t: 'error', why: 'the server is full, try again later' });
      const r = new GameRoom(newCode());
      rooms.set(r.code, r);
      const seat = newSeat(r);
      r.seats.push(seat);
      seatPlayer(r, ws, seat);
      lobby(r);
    } else if (m.t === 'join') {
      if (at) return send(ws, { t: 'error', why: 'already in a room' });
      const r = rooms.get(String(m.code).toUpperCase().trim());
      if (!r) return send(ws, { t: 'error', why: 'no room with that code' });
      const seat = newSeat(r);
      if (!r.game) {
        if (r.seats.length >= MAX_PLAYERS) { // full: a person takes a bot's place
          const b = r.seats.findIndex((s) => s?.bot);
          if (b < 0) return send(ws, { t: 'error', why: 'that room is full' });
          r.seats.splice(b, 1);
        }
        r.seats.push(seat);
        seatPlayer(r, ws, seat);
        return lobby(r);
      }
      // A fight is under way: take an empty seat (or one whose owner has been away too long). You appear at the start of the next round.
      const now = Date.now();
      let slot = r.seats.findIndex((s) => !s || (!s.bot && !s.ws && now - s.leftAt > reserveMs));
      if (slot < 0) slot = r.seats.findIndex((s) => s?.bot); // no free seat: a bot gives its seat to a person (it leaves now, they appear next round)
      if (slot < 0) return send(ws, { t: 'error', why: 'that room is full' });
      if (r.seats[slot]?.bot) r.game.room.removePlayer(slot);
      if (r.seats[slot]) r.game.room.sim.scores[slot] = 0; // someone else's old seat: a fresh score
      r.seats[slot] = seat;
      seatPlayer(r, ws, seat);
      applyLooks(r);
      r.game.room.restorePlayer(slot, true);
      sendStart(r, seat, true, seeds.get(r)!);
    } else if (m.t === 'rejoin') {
      if (at) return send(ws, { t: 'error', why: 'already in a room' });
      const r = rooms.get(String(m.code).toUpperCase().trim());
      const seat = r?.seats.find((s) => s && s.token === m.token);
      if (!r || !seat) return send(ws, { t: 'error', why: 'that seat is gone' });
      if (seat.ws) { where.delete(seat.ws); seat.ws.terminate(); seat.ws = null; r.game?.room.removePlayer(slotOf(r, seat)); } // their old connection died without the server noticing yet: this one takes over (restorePlayer below puts them back)
      seatPlayer(r, ws, seat);
      if (r.game) {
        r.game.room.restorePlayer(slotOf(r, seat), false);
        sendStart(r, seat, true, seeds.get(r)!);
      } else lobby(r);
    } else if (m.t === 'look') {
      if (!at) return;
      const color = Number(m.color), hat = String(m.hat), eyes = String(m.eyes);
      if (!Number.isInteger(color) || color < 0 || color >= COLORS.length || !(HATS as readonly string[]).includes(hat) || !(EYES as readonly string[]).includes(eyes)) return send(ws, { t: 'error', why: 'that look is not allowed' });
      if (at.room.seats.some((s) => s && s !== at.seat && s.look.color === color)) return send(ws, { t: 'error', why: 'someone already has that colour' });
      at.seat.look = { color, hat: hat as Look['hat'], eyes: eyes as Look['eyes'] };
      applyLooks(at.room);
      if (!at.room.game) lobby(at.room);
    } else if (m.t === 'ready') {
      if (!at || at.room.game) return;
      at.seat.ready = m.ready === true;
      lobby(at.room);
    } else if (m.t === 'bot') {
      if (!at || at.room.game || at.room.present[0] !== at.seat) return send(ws, { t: 'error', why: 'only the host can add bots' });
      const r = at.room, i = Number(m.at);
      if (r.seats[i]?.bot) r.seats.splice(i, 1); // take that bot away
      else if (r.seats.length < MAX_PLAYERS) r.seats.push(botSeat()); // (lobby seats are in join order: the next one is the first empty seat)
      lobby(r);
    } else if (m.t === 'start') {
      if (!at || at.room.game || at.room.present[0] !== at.seat) return send(ws, { t: 'error', why: 'only the host can start' });
      const r = at.room;
      if (r.seats.length < MIN_PLAYERS) return send(ws, { t: 'error', why: `need at least ${MIN_PLAYERS} players` });
      if (r.seats.some((s) => s && !s.ready)) return send(ws, { t: 'error', why: 'not everyone is ready' });
      const seed = Math.floor(Math.random() * 2 ** 31);
      Sim.create(seed, MAX_PLAYERS, false).then((sim) => {
        if (r.game || !r.seats.length) return;
        while (r.seats.length < MAX_PLAYERS) r.seats.push(null);
        sim.gone = r.seats.map((s) => !s); // empty seats are parked from the first round
        sim.looks = Array.from({ length: MAX_PLAYERS }, (_, i) => ({ ...(r.seats[i]?.look ?? { color: i, hat: 'none' as const, eyes: 'round' as const }) }));
        sim.reset();
        r.game = { room: new Room(sim), sim };
        seeds.set(r, seed);
        for (const s of r.present) sendStart(r, s, false, seed);
      });
    } else if (m.t === 'end') {
      if (at?.room.game && at.room.present[0] === at.seat) endGame(at.room, 'the host ended the fight');
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
  let last = performance.now(), acc = 0, sweep = 0;
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
        for (const p of r.present) if (p.ws!.readyState === WebSocket.OPEN && p.ws!.bufferedAmount < 1_000_000) p.ws!.send(msg); // a slow client just misses snapshots
      }
    }
    if (now - sweep > 1000) { // once a second: delete fights nobody is watching (an away player's seat is simply up for grabs after reserveMs: see 'join')
      sweep = now;
      for (const r of rooms.values()) {
        if (!r.game) continue;
        if (!r.present.length && r.emptySince && Date.now() - r.emptySince > emptyMs) rooms.delete(r.code);
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
  const s = await startServer(Number(process.env.PORT) || 8080, { maxRooms: Number(process.env.MAX_ROOMS) || 20 });
  console.log(`Knights of Old room server listening on port ${s.port}`);
}

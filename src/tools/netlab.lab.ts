import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { it } from 'vitest';
import { eras } from '../content/eras';
import { botLook } from '../content/looks';
import { tuning as T } from '../content/tuning';
import { Predictor } from '../net/predict';
import { Room } from '../net/room';
import { Mirror } from '../net/snapshot';
import type { Snapshot } from '../net/snapshot';
import { Bot } from '../sim/bot';
import { makeRng } from '../sim/rng';
import { NEUTRAL } from '../sim/types';
import type { PlayerInput } from '../sim/types';
import { Sim } from '../sim/world';

// npm run netlab: one player plays the real game over a pretend internet connection and reports/NETLAB.md says how it went for them.
// Their buttons are pressed by a bot brain; three bots on the server fight them (rounds, deaths, weapons dropping in: all of it). Both
// ends are the real code: the server's Room, and the page's Mirror and Predictor, run as main.ts runs them (inputs on a 60 Hz clock,
// snapshots blended on the screen's clock). Each line below is a kind of connection. Run it before and after any online change.
// One map, the player standing still (it finds a map whose copy drifts from the server: snaps):  ERA=gladiators MAP=2 IDLE=1 npm run netlab
// Every map, one connection, the player standing still and fighting (writes reports/NETLAB-MAPS.md: run it after building a map):
//   MAPS=1 npm run netlab   (PowerShell: $env:MAPS=1; npm run netlab)
// One way, in ms; jitter: up to this much extra per message; loss: share of messages lost (over a WebSocket a lost one is sent again,
// and everything behind it waits: a stall of about a round trip). PLACEHOLDER lines until the playtest night's `fly logs` say what's real.
const LINES = [
  { name: 'Wired, nearby', ms: 15, jitter: 2, loss: 0 },
  { name: 'Home wifi', ms: 30, jitter: 10, loss: 0.002 },
  { name: 'Busy wifi', ms: 40, jitter: 30, loss: 0.01 },
  { name: 'Coast to coast', ms: 45, jitter: 6, loss: 0.002 },
];
const SECONDS_ALL = Number(process.env.NETLAB_SECONDS) || 90, SEED = Number(process.env.NETLAB_SEED) || 11;
if (process.env.NETLAB_JITTER) T.net.jitter.percentile = Number(process.env.NETLAB_JITTER); // (to compare buffer settings)
if (process.env.NETLAB_CARRY) T.net.extrapolateTicks = Number(process.env.NETLAB_CARRY);
const DT = 1000 / 60;

/** One direction of a WebSocket: in order, each message late by the latency plus some jitter; a lost one holds up everything behind it. */
class Pipe<M> {
  private q: { at: number; m: M }[] = [];
  private last = 0;
  constructor(private ms: number, private jitter: number, private loss: number, private rng: () => number) {}
  send(now: number, m: M): void {
    let at = now + this.ms + this.rng() * this.jitter;
    if (this.rng() < this.loss) at += 2 * this.ms + 3 * DT; // sent again after the receiver's next few messages say it is missing
    this.last = Math.max(this.last, at);
    this.q.push({ at: this.last, m });
  }
  /** What has arrived by `now`, each with when it arrived (a page stamps a message when it comes in, between its frames). */
  take(now: number): { at: number; m: M }[] { const out: { at: number; m: M }[] = []; while (this.q.length && this.q[0].at <= now) out.push(this.q.shift()!); return out; }
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; };

interface Opts { era?: string; map?: number; idle?: boolean; seconds?: number }
async function play(line: (typeof LINES)[number], o: Opts = { era: process.env.ERA, map: Number(process.env.MAP ?? 0), idle: !!process.env.IDLE }) {
  const SECONDS = o.seconds ?? SECONDS_ALL;
  const rng = makeRng(SEED * 31 + line.ms);
  const server = await Sim.create(SEED, 4, false), client = await Sim.create(SEED, 4, false);
  server.looks = server.looks.map((l, i) => (i === 0 ? { ...l } : botLook()));
  if (o.era) for (const x of [server, client]) { x.forceEra = o.era; x.forceMap = o.map ?? 0; } // (ERA=gladiators MAP=2: one map only)
  server.reset(); client.reset();
  const room = new Room(server), mirror = new Mirror(client), pred = new Predictor(mirror, 0), brain = new Bot(SEED + 5);
  const up = new Pipe<{ i: PlayerInput; n: number }>(line.ms, line.jitter, line.loss, rng), down = new Pipe<string>(line.ms, line.jitter, line.loss, rng);
  const sentAt = new Map<number, number>(), inputDelay: number[] = [], behind: number[] = [], buffer: number[] = [], off: number[] = [], alone: number[] = [];
  const truth = new Map<number, number[]>(); // server tick -> the others' torsos (x, y each) as the server really had them
  const lastSeen: number[][] = []; let snapBacks = 0, carrying = false; // the others as drawn last frame (where drawn, where truly): a frame that moves the picture 10 cm more than they really moved is a snap-back
  let fightSnaps = 0, blowsShown = 0, blowsCounted = 0, blowsMatched = 0; // your blows: shown at once on your screen, counted by the server, and both
  let n = 0, acc = 0, lastAck = 0, bytes = 0, packed = 0, snaps = 0, frames = 0, active = 0, shownAlpha = 0, prevMsg = Buffer.alloc(0), tickMs = 0;
  let serverAt = 0, clientAt = 0, lastFrame = 0;
  const end = SECONDS * 1000;
  while (Math.min(serverAt, clientAt) < end) {
    if (serverAt <= clientAt) { // the server's tick
      for (const { m: x } of up.take(serverAt)) room.setInput(0, x.i, x.n);
      const t0 = performance.now(), s = room.tick();
      tickMs += performance.now() - t0;
      if (s) {
        const ack = s.ack![0];
        if (ack !== lastAck && sentAt.has(ack)) inputDelay.push(serverAt - sentAt.get(ack)!);
        lastAck = ack;
        const msg = JSON.stringify(s);
        truth.set(s.frame, s.f.flatMap((g) => { const k = server.fighters[0].parts.indexOf(server.fighters[0].torso); return g.p.length ? [g.p[k * 3], g.p[k * 3 + 1]] : [NaN, NaN]; })); truth.delete(s.frame - 600);
        bytes += msg.length; snaps++;
        const buf = Buffer.from(msg); packed += deflateRawSync(buf, { level: 1, dictionary: prevMsg }).length; prevMsg = buf; // (compressed on the wire, as permessage-deflate does: each message against the one before)
        down.send(serverAt, msg);
      }
      serverAt += DT;
    } else { // a frame on the player's screen (60 Hz, a little uneven, as a browser's are)
      const ft = clientAt - lastFrame;
      lastFrame = clientAt;
      acc += ft;
      for (let k = 0; acc >= DT && k < T.sim.maxStepsPerFrame; k++, acc -= DT) {
        const input = o.idle ? NEUTRAL : brain.think(server, server.fighters[0]); // (IDLE=1: the player stands still and takes what comes) // (it decides from the server's world: what matters here is when it presses)
        n++; sentAt.set(n, clientAt); sentAt.delete(n - 600);
        up.send(clientAt, { i: input, n });
        for (const e of pred.tick(input, n, shownAlpha)) if (e.t === 'hit') blowsShown++;
      }
      if (acc >= DT) acc = 0;
      for (const { at, m } of down.take(clientAt)) {
        const s = JSON.parse(m) as Snapshot, was = { ...pred.stats };
        for (const e of s.ev) if (e.t === 'hit' && e.owner === 0) { blowsCounted++; if (pred.claim(e)) blowsMatched++; }
        mirror.push(s, at); pred.reconcile(s);
        // (only in a fight: a new round or a respawn puts everyone somewhere new, and the guess simply jumps there with it)
        if (pred.stats.checks > was.checks && !s.roundOver && !s.ev.some((e) => e.t === 'newround' || e.t === 'respawn')) {
          const d = pred.stats.off - was.off, me = s.f[0].p, near = s.f.some((g, i) => i > 0 && g.p.length && Math.hypot(g.p[0] - me[0], g.p[1] - me[1]) < 2.5);
          off.push(d); if (!near) alone.push(d);
          if (pred.stats.snaps > was.snaps) fightSnaps++;
        }
      }
      const shown = mirror.update(ft / 1000);
      shownAlpha = shown.alpha;
      const h = mirror.shown, t0 = truth.get(Math.floor(h)), t1 = truth.get(Math.floor(h) + 1);
      client.fighters.forEach((g, i) => { // (the others as they are drawn: between their last two poses, or carried on past the newest)
        if (i === 0 || g.limp || !t0 || !t1) { lastSeen[i] = []; return; }
        const k = h - Math.floor(h), tx = t0[2 * i] + (t1[2 * i] - t0[2 * i]) * k, ty = t0[2 * i + 1] + (t1[2 * i + 1] - t0[2 * i + 1]) * k;
        const x = g.torso.px + (g.torso.cx - g.torso.px) * shown.alpha, y = g.torso.py + (g.torso.cy - g.torso.py) * shown.alpha, L = lastSeen[i] ?? [];
        if (carrying && L.length && Number.isFinite(tx) && Math.hypot(x - L[0] - (tx - L[2]), y - L[1] - (ty - L[3])) > 0.1 && Math.hypot(x - L[0], y - L[1]) < 3) snapBacks++;
        lastSeen[i] = [x, y, tx, ty];
      });
      carrying = shown.alpha > 1; // (carried on past the newest snapshot this frame: the next one may snap back)
      frames++;
      if (pred.active) active++;
      if (clientAt > 3000) { behind.push((serverAt / DT - mirror.shown) * DT); buffer.push(mirror.delay); } // how old what you see of the others is (ms)
      clientAt += DT + (rng() - 0.5) * 2;
    }
  }
  const st = room.stats[0], P = pred.stats, minutes = SECONDS / 60;
  return {
    line, desyncs: mirror.desyncs, snapBytes: bytes / snaps, packedBytes: packed / snaps, tickMs: tickMs / (SECONDS * 60),
    inputMs: avg(inputDelay), input95: pct(inputDelay, 0.95), waiting: st.waiting / Math.max(1, st.ticks), dry: st.dry / Math.max(1, st.ticks), folded: st.folded,
    predicting: active / frames, offCm: avg(off) * 100, aloneCm: avg(alone) * 100, aloneShare: alone.length / Math.max(1, off.length), off95: pct(off, 0.95) * 100, worstCm: Math.max(0, ...off) * 100, snapsPerMin: fightSnaps / minutes, roundSnaps: P.snaps - fightSnaps,
    blowsShown: blowsShown / minutes, blowsCounted: blowsCounted / minutes, blowsMatched: blowsMatched / minutes,
    snapBacksPerMin: snapBacks / minutes,
    behindMs: avg(behind), behind95: pct(behind, 0.95), bufferTicks: avg(buffer), stallsPerMin: mirror.waits / minutes, starvedPerMin: mirror.starved / minutes,
  };
}

it.skipIf(!!process.env.MAPS)('net lab', async () => {
  const rows: Awaited<ReturnType<typeof play>>[] = [];
  for (const line of LINES) { const t0 = performance.now(); rows.push(await play(line)); console.log(`${line.name}: done in ${((performance.now() - t0) / 1000).toFixed(0)} s`); }
  const f0 = (x: number) => x.toFixed(0), f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);
  const table = (head: string[], body: string[][]) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...body.map((r) => `| ${r.join(' | ')} |`)].join('\n');
  const out = `# Net lab (${new Date().toISOString().slice(0, 16).replace('T', ' ')})

${SECONDS_ALL} s of the real game per connection, one player online against three bots on the server (seed ${SEED}). Made by npm run netlab
(src/tools/netlab.lab.ts). The connections are guesses until the playtest night's server log says what friends really have.

## Your own buttons
How long a press takes to be used by the server (one way across the wire plus the wait in the server's queue), and what the server's
queue of your inputs did. Every input waiting in it is another tick (17 ms) before your press counts for everyone else.

${table(['Connection', 'Ping', 'Press to server (avg / 95%)', 'Inputs waiting (avg)', 'Ticks with none arrived', 'Folded'],
  rows.map((r) => [r.line.name, `${2 * r.line.ms} ms`, `${f0(r.inputMs)} / ${f0(r.input95)} ms`, f2(r.waiting), `${f1(r.dry * 100)}%`, f0(r.folded)]))}

## Your own fighter (prediction)
Your fighter moves the moment you press, guessed on your screen; the server checks the guess every snapshot. Off = how far the guess was
from the server in a fight (it is pulled back smoothly); snaps = jumps straight to the server (more than ${T.net.predict.snap} m off; the
jumps at a new round are counted apart, they are meant). Predicting =
share of the time your fighter was moved by your own screen (the rest: knocked down, held, dead, between rounds: the server moves you).

${table(['Connection', 'Predicting', 'Off (avg / 95%)', 'Off with nobody near (share of the time)', 'Worst', 'Snaps a minute', '(at new rounds)'],
  rows.map((r) => [r.line.name, `${f0(r.predicting * 100)}%`, `${f1(r.offCm)} / ${f0(r.off95)} cm`, `${f1(r.aloneCm)} cm (${f0(r.aloneShare * 100)}%)`, `${f0(r.worstCm)} cm`, f1(r.snapsPerMin), String(r.roundSnaps)]))}

## Your blows (instant hit feedback)
Your blow's spark, sound and shake show the moment it lands on your screen (net/predict.ts blows); the server's report of it is then
skipped. Shown at once = of the blows the server counted, how many your screen showed first; missed = shown on your screen, but the server
found the blow missed (a spark for nothing: you hit them where your screen showed them, a moment in the past).

${table(['Connection', 'Blows the server counted (a minute)', 'Shown at once', 'Shown, but missed on the server (a minute)'],
  rows.map((r) => [r.line.name, f1(r.blowsCounted), `${f0(r.blowsCounted ? (100 * r.blowsMatched) / r.blowsCounted : 0)}%`, f1(Math.max(0, r.blowsShown - r.blowsMatched))]))}

## Everyone else
What you see of the others is this far in the past (the wire plus the blend buffer). Stalls = times a minute the picture of them had to
wait for a snapshot; carried on = times it ran past the newest one and carried the motion on instead; snap-backs = times one of them was
drawn moving 10 cm more (or less) in a frame than they really moved (the motion carried on wrong, then the real snapshot came).

${table(['Connection', 'Others shown (avg / 95%)', 'Buffer (ticks)', 'Stalls a minute', 'Carried on a minute', 'Snap-backs a minute', 'Desyncs', 'Data down (compressed)'],
  rows.map((r) => [r.line.name, `${f0(r.behindMs)} / ${f0(r.behind95)} ms`, f1(r.bufferTicks), f1(r.stallsPerMin), f1(r.starvedPerMin), f1(r.snapBacksPerMin), String(r.desyncs), `${f0(r.snapBytes * 60 / 1024)} KB/s (${f0(r.packedBytes * 60 / 1024)} KB/s)`]))}

## The server
One room's work each tick (the fight, its snapshot): ${f2(avg(rows.map((r) => r.tickMs)))} ms on this computer, ${f0(avg(rows.map((r) => r.tickMs)) / (1000 / 60) * 100)}% of one core. A Fly.io shared CPU may use 6.25% of a core
before it spends its saved-up time (at most 500 s), and is then held to 6.25%, stopping for the rest of every 80 ms: a stutter for everyone.
A performance CPU is never held back.
`;
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/NETLAB.md', out);
  console.log(out);
}, 60 * 60 * 1000);

// Every map online (MAPS=1): a page's copy that drifts from the server on one map (the aqueduct's blocks piled into a heap on every page)
// shows as snaps, mostly when the player stands still on it, and as desyncs when the copy's parts no longer match.
it.skipIf(!process.env.MAPS)('every map online', async () => {
  const line = LINES[1], rows: string[][] = [], bad: string[] = [];
  for (const era of eras) for (let map = 0; map <= (era.alt?.length ?? 0); map++) {
    const name = (map ? era.alt![map - 1] : era.arena).name ?? 'main';
    const still = await play(line, { era: era.id, map, idle: true, seconds: 40 }), fight = await play(line, { era: era.id, map, idle: false, seconds: 40 });
    const snaps = still.snapsPerMin + fight.snapsPerMin, desyncs = still.desyncs + fight.desyncs;
    if (snaps > 1.5 || desyncs) bad.push(`${era.name}, ${name}`);
    rows.push([era.name, `${map} ${name}`, still.snapsPerMin.toFixed(1), fight.snapsPerMin.toFixed(1), `${Math.max(still.worstCm, fight.worstCm).toFixed(0)} cm`, String(desyncs)]);
    console.log(rows.at(-1)!.join(' | '));
  }
  const out = `# Net lab: every map online (${new Date().toISOString().slice(0, 16).replace('T', ' ')})

Each map played twice over a ${line.name.toLowerCase()} connection, 40 s each against three bots: the player standing still, then fighting.
Snaps = your own fighter jumping to where the server has it (over ${T.net.predict.snap} m off); desyncs = the page's copy no longer
matching the server's parts. Made by MAPS=1 npm run netlab (src/tools/netlab.lab.ts).

${bad.length ? `**Worth a look:** ${bad.join('; ')}.` : 'Nothing stood out.'}

| Era | Map | Snaps a minute (standing) | (fighting) | Worst guess | Desyncs |
|---|---|---|---|---|---|
${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}
`;
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/NETLAB-MAPS.md', out);
}, 60 * 60 * 1000);

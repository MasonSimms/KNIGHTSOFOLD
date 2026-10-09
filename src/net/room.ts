import { tuning as T } from '../content/tuning';
import type { PlayerInput, SimEvent } from '../sim/types';
import { NEUTRAL } from '../sim/types';
import type { Sim } from '../sim/world';
import { Tape } from '../replay/tape';
import type { Clip } from '../replay/tape';
import { STRUCTURAL, takeSnapshot } from './snapshot';
import type { Snapshot } from './snapshot';

/** Server side: owns the real sim, steps it at 60 Hz with the latest input from each player, and makes a snapshot every few ticks. */
export class Room {
  private ticks = 0;
  private inputs: PlayerInput[];
  private queue: { i: PlayerInput; n: number }[][]; // each player's inputs not used yet (one per tick)
  private acks: number[]; // the number of the input each player's fighter last moved by (the snapshot says it: prediction needs it)
  private pending: SimEvent[] = [];
  private log: SimEvent[] = []; // structural events since the round began, so a late joiner can catch up
  private tape = new Tape(); // the round, for its end-of-round replay
  private backlog: number[]; // per player: ticks in a row with an input still waiting after this one (see tuning.net.inputTrim)
  private lastN: number[]; // per player: the number of the newest input taken (the same input comes over both lanes: the second is dropped)
  private recent: [number, SimEvent[]][] = []; // structural events of the last few ticks, repeated in every snapshot (Snapshot.back)
  /** Per player, how their buttons have been arriving (the server log, npm run netlab): ticks counted, inputs left waiting summed over
   *  them (each one waiting is a tick of delay), ticks with none arrived (the last one used again), inputs folded into the next. */
  stats: { ticks: number; waiting: number; dry: number; folded: number }[];
  /** Online: true while the next round (`round`) must wait (the server: not every page has its pictures painted yet). Null: never. */
  hold: ((round: number) => boolean) | null = null;
  private stretched = 0; // ticks the pause before this next round was stretched by (waiting for pictures): taken off again once it starts

  constructor(readonly sim: Sim, readonly snapEvery = T.net.snapEvery) {
    this.inputs = sim.fighters.map(() => NEUTRAL);
    this.queue = sim.fighters.map(() => []);
    this.acks = sim.fighters.map(() => 0);
    this.lastN = sim.fighters.map(() => 0);
    this.backlog = sim.fighters.map(() => 0);
    this.stats = sim.fighters.map(() => ({ ticks: 0, waiting: 0, dry: 0, folded: 0 }));
    sim.extraRoundPause = Math.max(0, this.breakPause()); // (one round per era: the museum after every round. Quick rounds: set as each round is won)
  }

  /** How long the pause after the round just won must be (frames, over the usual T.match.resultFrames): the next round waits for what
   *  every page shows. The museum when the era changes: the freeze, the camera pulling back, the replay in the painting, the slide to the
   *  next painting and into it (render/museum.ts). Between two rounds of one era, the quick break: the slow motion and the wall sweeping
   *  across (main.ts quickBreak). */
  private breakPause(): number {
    const X = T.transition, Q = T.match.quick;
    const frames = !T.match.quickRounds || this.sim.eraEnds ? X.freezeFrames + Math.ceil((X.zoomOut + X.slide + X.zoomIn) * 60) + (T.replay.enabled ? Tape.frames : 0) + 20 : Math.ceil((Q.slowSeconds + Q.wipe) * 60) + 10;
    return frames - T.match.resultFrames;
  }

  /** A player's next input (n counts them). One is used per tick; with none waiting the previous one is used again. Too many waiting
   *  (a burst after a stall) and the oldest are folded into the next: a press in them still counts. */
  setInput(slot: number, input: PlayerInput, n = 0): void {
    const q = this.queue[slot];
    if (!q) return;
    if (n > 0) { if (n <= this.lastN[slot]) return; this.lastN[slot] = n; } // (already taken: it came the other way first)
    q.push({ i: input, n });
    while (q.length > T.net.inputQueue) this.fold(slot);
  }

  /** The only input waiting is used now, merged with the one just taken (its presses count; one tick of movement is merged away). */
  private trimOne(slot: number): void {
    const x = this.queue[slot].shift()!, a = this.inputs[slot];
    this.inputs[slot] = { ...x.i, jump: a.jump || x.i.jump, attack: a.attack || x.i.attack, drop: a.drop || x.i.drop, dodge: a.dodge || x.i.dodge };
    this.acks[slot] = x.n;
    this.stats[slot].folded++;
  }

  /** The oldest waiting input is folded into the next: its presses still count, its tick of movement is merged away. */
  private fold(slot: number): void {
    const q = this.queue[slot], [a, b] = q;
    b.i = { ...b.i, jump: a.i.jump || b.i.jump, attack: a.i.attack || b.i.attack, drop: a.i.drop || b.i.drop, dodge: a.i.dodge || b.i.dodge };
    q.shift();
    this.stats[slot].folded++;
  }

  /** One 60 Hz tick. Returns a snapshot on every `snapEvery`th tick. */
  tick(): Snapshot | null {
    this.queue.forEach((q, i) => {
      const x = q.shift(), st = this.stats[i];
      if (x) { this.inputs[i] = x.i; this.acks[i] = x.n; } else if (this.acks[i]) st.dry++;
      if (this.acks[i]) { st.ticks++; st.waiting += q.length; }
      this.backlog[i] = q.length ? this.backlog[i] + 1 : 0;
      if (this.backlog[i] > T.net.inputTrim && q.length >= 1) { q.length > 1 ? this.fold(i) : this.trimOne(i); this.backlog[i] = 0; } // (a tick of delay that has stayed: taken away)
    });
    const S = this.sim, round = S.round;
    if (this.hold && S.roundOver && !S.matchOver && !S.endsMatch && S.roundFrames + 1 >= T.match.resultFrames + S.extraRoundPause && this.hold(round + 1)) { S.extraRoundPause++; this.stretched++; } // (the next round waits a tick more)
    this.sim.step(this.inputs);
    if (S.round !== round && this.stretched) { S.extraRoundPause -= this.stretched; this.stretched = 0; }
    if (T.match.quickRounds && S.roundOver && S.roundFrames === 0) { S.extraRoundPause = this.breakPause(); this.stretched = 0; } // (the round was just won: the museum or the quick break)
    this.ticks++;
    if (this.ticks % this.snapEvery !== 0) { this.tape.feed(this.sim); this.collect(); return null; }
    this.collect();
    const s = takeSnapshot(this.sim, this.ticks, this.pending);
    s.ack = this.acks.slice();
    this.pending = [];
    this.tape.feed(this.sim, s);
    const mine = s.ev.filter((e) => STRUCTURAL.has(e.t));
    while (this.recent.length && this.recent[0][0] <= this.ticks - T.net.eventRepeat) this.recent.shift();
    const back = this.recent.slice();
    if (mine.length) this.recent.push([this.ticks, mine]);
    return back.length ? { ...s, back } : s; // (the replay keeps the snapshot without them)
  }

  /** The replay of the round just over, once it is ready (send it to everyone). */
  takeClip(): Clip | null { return this.tape.take(); }

  /** A new page took this seat (a rejoin, a reload): its inputs count from 1 again. */
  forgetInputs(slot: number): void { this.lastN[slot] = 0; if (this.queue[slot]) this.queue[slot].length = 0; }

  /** A player left: their fighter dies now and they are out of every later round. */
  removePlayer(slot: number): void {
    this.sim.events.length = 0; // (events normally belong to a tick; collect the ones this makes)
    this.sim.removePlayer(slot);
    this.collect();
  }

  /** A player is back or new: they join at the start of the next round. */
  restorePlayer(slot: number, fresh: boolean): void {
    this.sim.events.length = 0;
    this.sim.restorePlayer(slot, fresh);
    this.collect();
  }

  private collect(): void {
    for (const e of this.sim.events) {
      const copy = { ...e };
      this.pending.push(copy);
      if (e.t === 'newround') { this.log.length = 0; continue; } // a new round rebuilds everything: earlier events no longer matter, and the event itself is not replayed to a joiner (they build that round directly)
      if (STRUCTURAL.has(e.t)) this.log.push(copy);
    }
  }

  /** For a client that joins (or rejoins) mid-round: the current poses plus every structural event of this round, to replay first. */
  catchUp(): Snapshot {
    // A fighter parked at the start of the round (a seat nobody is in) made no event, so say so: every ragdolled fighter first, then the round's events.
    const parked: SimEvent[] = this.sim.fighters.filter((f) => f.ragdolled).map((f) => ({ t: 'die', x: 0, y: 0, v: 0, owner: f.index, victim: f.index }));
    const gone: SimEvent[] = this.sim.gone.flatMap((g, i) => (g ? [{ t: 'gone' as const, x: 0, y: 0, v: 0, owner: i, victim: -1 }] : []));
    return takeSnapshot(this.sim, this.ticks, [...parked, ...gone, ...this.log]);
  }
}

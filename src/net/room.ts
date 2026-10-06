import { tuning as T } from '../content/tuning';
import type { PlayerInput, SimEvent } from '../sim/types';
import { NEUTRAL } from '../sim/types';
import type { Sim } from '../sim/world';
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

  constructor(readonly sim: Sim, readonly snapEvery = T.net.snapEvery) {
    this.inputs = sim.fighters.map(() => NEUTRAL);
    this.queue = sim.fighters.map(() => []);
    this.acks = sim.fighters.map(() => 0);
  }

  /** A player's next input (n counts them). One is used per tick; with none waiting the previous one is used again. Too many waiting
   *  (a burst after a stall) and the oldest are folded into the next: a press in them still counts. */
  setInput(slot: number, input: PlayerInput, n = 0): void {
    const q = this.queue[slot];
    if (!q) return;
    q.push({ i: input, n });
    while (q.length > T.net.inputQueue) {
      const [a, b] = q;
      b.i = { ...b.i, jump: a.i.jump || b.i.jump, attack: a.i.attack || b.i.attack, drop: a.i.drop || b.i.drop, dodge: a.i.dodge || b.i.dodge };
      q.shift();
    }
  }

  /** One 60 Hz tick. Returns a snapshot on every `snapEvery`th tick. */
  tick(): Snapshot | null {
    this.queue.forEach((q, i) => { const x = q.shift(); if (x) { this.inputs[i] = x.i; this.acks[i] = x.n; } });
    this.sim.step(this.inputs);
    this.ticks++;
    this.collect();
    if (this.ticks % this.snapEvery !== 0) return null;
    const s = takeSnapshot(this.sim, this.ticks, this.pending);
    s.ack = this.acks.slice();
    this.pending = [];
    return s;
  }

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

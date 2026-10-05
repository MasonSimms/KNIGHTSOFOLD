import type { PlayerInput, SimEvent } from '../sim/types';
import { NEUTRAL } from '../sim/types';
import type { Sim } from '../sim/world';
import { STRUCTURAL, takeSnapshot } from './snapshot';
import type { Snapshot } from './snapshot';

/** Server side: owns the real sim, steps it at 60 Hz with the latest input from each player, and makes a snapshot every few ticks. */
export class Room {
  private ticks = 0;
  private inputs: PlayerInput[];
  private pending: SimEvent[] = [];
  private log: SimEvent[] = []; // structural events since the round began, so a late joiner can catch up

  constructor(readonly sim: Sim, readonly snapEvery = 3) {
    this.inputs = sim.fighters.map(() => NEUTRAL);
  }

  /** A player's newest input (a missing or late one just means the previous input keeps being used). */
  setInput(slot: number, input: PlayerInput): void {
    if (slot >= 0 && slot < this.inputs.length) this.inputs[slot] = input;
  }

  /** One 60 Hz tick. Returns a snapshot on every `snapEvery`th tick. */
  tick(): Snapshot | null {
    this.sim.step(this.inputs);
    this.ticks++;
    this.collect();
    if (this.ticks % this.snapEvery !== 0) return null;
    const s = takeSnapshot(this.sim, this.ticks, this.pending);
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
      if (e.t === 'newround') this.log.length = 0; // a new round rebuilds everything: earlier events no longer matter (catchUp rebuilds who is parked or gone from the sim itself)
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

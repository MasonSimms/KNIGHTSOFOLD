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
    for (const e of this.sim.events) {
      const copy = { ...e };
      this.pending.push(copy);
      if (e.t === 'newround') this.log.length = 0; // a new round rebuilds everything: earlier events no longer matter
      if (STRUCTURAL.has(e.t)) this.log.push(copy);
    }
    if (this.ticks % this.snapEvery !== 0) return null;
    const s = takeSnapshot(this.sim, this.ticks, this.pending);
    this.pending = [];
    return s;
  }

  /** For a client that joins (or rejoins) mid-round: the current poses plus every structural event of this round, to replay first. */
  catchUp(): Snapshot {
    return takeSnapshot(this.sim, this.ticks, this.log.slice());
  }
}

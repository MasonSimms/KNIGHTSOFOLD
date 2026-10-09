// The end-of-round replay (owner: the end of every era replays its best moment, about 5 s). While a round is fought, the tape keeps where
// everything was (snapshots: the same ones the server sends online) and what happened; when the round is over, the round's best moment
// (the highlights spotter) is cut out as a clip. A clip is plain data: online the server sends it, and anyone plays it the same way
// (a Mirror, as for online play: no physics is run again, so every browser sees exactly what happened).
import { tuning as T } from '../content/tuning';
import type { Look } from '../content/looks';
import { STRUCTURAL, takeSnapshot } from '../net/snapshot';
import type { Snapshot } from '../net/snapshot';
import type { SimEvent } from '../sim/types';
import type { Sim } from '../sim/world';
import { Spotter } from './highlights';

export interface Clip {
  seed: number; count: number; dummy: boolean; round: number; era: string; map: number; looks: Look[]; // to build the round
  snaps: Snapshot[]; // the moment, every other frame; the first one carries everything that happened in the round before it
}

type Round = { era: string }; // (the spotter's name for a round)

export class Tape {
  private spotter = new Spotter<Round>();
  private key: Round | null = null;
  private round = -1;
  private lastFrame = 0;
  private start: SimEvent[] = []; // how the round began: seats parked, players gone
  private log: { f: number; e: SimEvent }[] = []; // every structural event of the round, with its frame
  private kept: { f: number; s: Snapshot }[] = []; // the round, every other frame, the last keepSeconds
  private carry: SimEvent[] = []; // the events of a frame that was not kept go with the next one
  private due = -1; // the frame the clip can be cut (the round is over and the moment has played out)
  private ready: Clip | null = null;
  private best: { clip: Clip; score: number } | null = null; // quick rounds: the era's best moment so far (it plays when the era ends)

  /**
   * After every step. `snap` is that step's snapshot (the server already makes one; otherwise one is made here), with its events.
   * Returns nothing: take() the clip once one is ready.
   */
  feed(sim: Sim, snap?: Snapshot): void {
    if (!T.replay.enabled || !sim.matchActive) return;
    const s = snap ?? takeSnapshot(sim, sim.frame, sim.events.map((e) => ({ ...e })));
    if (sim.round !== this.round || sim.frame < this.lastFrame) this.newRound(sim);
    this.lastFrame = sim.frame;
    // (the round starting is not part of it: the clip's copy is built in this round already, and replaying "newround" would build the next)
    const ev = s.ev.filter((e) => e.t !== 'newround');
    this.spotter.feed(sim, this.key, ev);
    for (const e of ev) {
      if (STRUCTURAL.has(e.t)) this.log.push({ f: sim.frame, e });
      if (e.t === 'round') this.due = sim.frame + T.replay.after;
    }
    if (sim.frame % 2 === 0 || this.due === sim.frame) { this.kept.push({ f: sim.frame, s: { ...s, ev: [...this.carry, ...ev] } }); this.carry = []; }
    else this.carry.push(...ev);
    while (this.kept.length && this.kept[0].f < sim.frame - T.replay.keepSeconds * 60) this.kept.shift();
    if (this.due >= 0 && sim.frame >= this.due) {
      this.due = -1;
      const c = this.cut(sim);
      if (c && (!this.best || c.score >= this.best.score)) this.best = c;
      if (sim.eraEnds) { this.ready = this.best?.clip ?? null; this.best = null; } // (between two rounds of one era there is no replay: the quick break)
    }
  }

  /** The clip of the era just over (quick rounds: its best moment from all its rounds; otherwise the round's), once (null until then, or
   *  if nothing was worth showing). */
  take(): Clip | null { const c = this.ready; this.ready = null; return c; }

  /** How many frames the replay takes to watch (the server waits this much longer between rounds). */
  static get frames(): number { return Math.ceil((T.replay.before + T.replay.after) / T.replay.speed); }

  private newRound(sim: Sim): void {
    if (sim.round <= this.round) this.best = null; // (a new match)
    this.round = sim.round;
    this.key = { era: sim.era };
    this.log = []; this.kept = []; this.carry = []; this.due = -1;
    // A seat parked at the start of the round (nobody in it) made no event: say so first, as the server's catch-up does.
    this.start = [
      ...sim.fighters.filter((f) => f.ragdolled).map((f): SimEvent => ({ t: 'die', x: 0, y: 0, v: 0, owner: f.index, victim: f.index })),
      ...sim.gone.flatMap((g, i): SimEvent[] => (g ? [{ t: 'gone', x: 0, y: 0, v: 0, owner: i, victim: -1 }] : [])),
    ];
  }

  private cut(sim: Sim): { clip: Clip; score: number } | null {
    const m = this.spotter.moments.filter((x) => x.rec === this.key).sort((a, b) => b.score - a.score)[0];
    if (!m) return null;
    const from = m.at - T.replay.before, to = m.at + T.replay.after;
    const window = this.kept.filter((k) => k.f >= from && k.f <= to);
    if (window.length < 2) return null;
    const first = window[0];
    const before = this.log.filter((l) => l.f <= first.f).map((l) => l.e); // everything that changed the bodies up to the first frame shown
    const snaps = [{ ...first.s, ev: [...this.start, ...before] }, ...window.slice(1).map((k) => k.s)];
    return { clip: { seed: sim.matchSeed, count: sim.fighters.length, dummy: sim.practising, round: sim.round, era: sim.era, map: sim.map, looks: sim.looks.map((l) => ({ ...l })), snaps }, score: m.score };
  }
}

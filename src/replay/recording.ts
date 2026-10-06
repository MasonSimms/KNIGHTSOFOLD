// Replays. The fight is deterministic, so a round is fully described by how it started (the match seed, the round, the era and map, who
// is playing and how they look, the training settings) and the buttons everyone pressed each frame. That is all a recording keeps: a minute
// of a 4-player round is a few hundred kilobytes, and playing it back gives the exact same fight, body for body. Highlights are moments in
// these recordings (highlights.ts).
import { tuning } from '../content/tuning';
import type { Look } from '../content/looks';
import type { PlayerInput } from '../sim/types';
import { Sim } from '../sim/world';

export interface Recording {
  v: 1;
  seed: number; count: number; dummy: boolean; // the match
  round: number; era: string; map: number; // the round
  looks: Look[]; gone: boolean[]; training: Sim['training']; // who was there
  tuning: string; // fingerprint of every gameplay number: a replay made with other numbers would not play the same
  inputs: PlayerInput[][]; // the buttons each fighter pressed, frame by frame
}

/** A short fingerprint of the tuning (FNV-1a of its JSON). */
export function tuningFingerprint(): string {
  let h = 0x811c9dc5;
  for (const ch of JSON.stringify(tuning)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h.toString(16);
}

/** Keeps the recordings of the last few rounds. Call before() with the inputs just before every sim.step. */
export class Recorder {
  current: Recording | null = null;
  readonly done: Recording[] = [];
  constructor(private keep = 30, private maxFrames = 60 * 60 * 10) {} // the last 30 rounds; a round (or a training session) longer than 10 minutes stops recording

  before(sim: Sim, inputs: PlayerInput[]): void {
    if (sim.frame === 0 || !this.current) this.start(sim); // a fresh round (or a reset) starts a new recording
    const r = this.current!;
    if (r.inputs.length < this.maxFrames) r.inputs.push(inputs.slice(0, sim.fighters.length).map((i) => ({ ...i })));
  }

  private start(sim: Sim): void {
    if (this.current?.inputs.length) { this.done.push(this.current); if (this.done.length > this.keep) this.done.shift(); }
    this.current = {
      v: 1, seed: sim.matchSeed, count: sim.fighters.length, dummy: sim.practising, round: sim.round, era: sim.era, map: sim.map,
      looks: sim.looks.map((l) => ({ ...l })), gone: [...sim.gone], training: { ...sim.training }, tuning: tuningFingerprint(), inputs: [],
    };
  }
}

/** Rebuild a recorded round at its first frame (a fresh copy of the game, separate from the one being played). */
export async function rebuild(r: Recording): Promise<Sim> {
  const sim = await Sim.create(r.seed, r.count, r.dummy);
  sim.looks = r.looks.map((l) => ({ ...l }));
  sim.gone = [...r.gone];
  sim.training = { ...r.training };
  sim.forceMap = r.map;
  sim.buildRound(r.round, r.era);
  return sim;
}

/** Play a recording forward to `frame` (as fast as the computer can: nothing is drawn). */
export function stepTo(sim: Sim, r: Recording, frame: number): void {
  while (sim.frame < frame && sim.frame < r.inputs.length) sim.step(r.inputs[sim.frame]);
}

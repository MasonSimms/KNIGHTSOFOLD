import { tuning as T } from '../content/tuning';
import type { SimEvent } from '../sim/types';
import type { Look } from '../content/looks';
import type { Sim } from '../sim/world';

// What the server sends the clients: where every body part is, plus the structural events since the last snapshot (deaths, pickups,
// respawns, new rounds) so the client's copy of the sim keeps the same list of parts. Plain JSON-safe data.
export interface Snapshot {
  frame: number; // server tick
  round: number;
  roundOver: boolean;
  roundWinner: number;
  scores: number[];
  f: { hp: number; back: boolean; p: number[] }[]; // per fighter: hp, on the background plane, and x, y, angle for each part
  era: string;
  map: number;
  props: number[]; // x, y, angle of every loose prop (planks, logs...)
  boat?: number[]; // x, y, angle of the ship, on a map with one
  outfits: number[];
  looks: Look[]; // everyone's colour and hat (so a player who joins late or rejoins sees the right ones)
  ev: SimEvent[];
}

const TELEPORT = 4; // metres moved between two snapshots (50 ms) that can only be a teleport
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function takeSnapshot(sim: Sim, frame: number, ev: SimEvent[]): Snapshot {
  return {
    frame, round: sim.round, roundOver: sim.roundOver, roundWinner: sim.roundWinner, scores: sim.scores.slice(), ev,
    era: sim.era, map: sim.map, outfits: sim.outfits.slice(),
    props: sim.props.flatMap((p) => { const t = p.body.translation(); return [r3(t.x), r3(t.y), r3(p.body.rotation())]; }), looks: sim.looks.map((l) => ({ ...l })),
    boat: sim.boat ? [r3(sim.boat.body.translation().x), r3(sim.boat.body.translation().y), r3(sim.boat.body.rotation())] : undefined,
    f: sim.fighters.map((f) => ({ hp: r3(f.hp), back: f.inBack, p: f.parts.flatMap((p) => { const t = p.body.translation(); return [r3(t.x), r3(t.y), r3(p.body.rotation())]; }) })),
  };
}

/** Events that change which parts exist or who holds what: the only ones a client must replay to keep its parts in step. */
export const STRUCTURAL = new Set(['die', 'fall', 'pickup', 'respawn', 'newround', 'gone', 'back', 'spawn']);

/** Client side: a copy of the sim that is never stepped. It replays structural events, then has its poses written in from snapshots. */
export class Mirror {
  desyncs = 0; // how many times a snapshot's part count disagreed with ours: should stay 0 (it means a missed or misordered event)
  private snaps: Snapshot[] = [];
  private applied = -1; // server tick of the newest snapshot whose events were replayed
  private head = 0; // the server tick being shown (it runs `delay` ticks behind the newest snapshot, so there is always a pair to blend)
  private started = false;
  private lastLooks = '';
  private fresh = true; // nothing shown yet: the first snapshot says which round and era to build

  constructor(readonly sim: Sim, readonly delay = T.net.blendTicks) {}

  push(s: Snapshot): void {
    if (this.fresh) { // a new client (or one that rejoined): build the round the server is in, with its era's weapon and arena
      this.fresh = false;
      if (s.round !== this.sim.round || s.era !== this.sim.era) this.sim.buildRound(s.round, s.era);
    }
    if (s.frame > (this.snaps.at(-1)?.frame ?? -1)) this.snaps.push(s);
    if (this.snaps.length > 60) this.snaps.shift();
  }

  /** Start over from a fresh build (a rejoining client): forget everything and replay from the next catch-up snapshot. */
  reset(): void {
    this.snaps = []; this.applied = -1; this.started = false; this.fresh = true;
    this.sim.gone.fill(false);
    this.sim.reset();
  }

  /** Advance the clock by real seconds and show the world. Returns the blend between the last two poses (for renderer.draw) and the events now due. */
  update(seconds: number): { alpha: number; events: SimEvent[] } {
    const latest = this.snaps.at(-1);
    if (!latest) return { alpha: 1, events: [] };
    const target = latest.frame - this.delay;
    if (!this.started) { this.head = target; this.started = true; }
    this.head += seconds * 60;
    const err = target - this.head;
    this.head = Math.abs(err) > 12 ? target : this.head + err * 0.05; // drift back toward the target gently, jump if far off
    this.head = Math.min(this.head, latest.frame);
    return this.show(this.head);
  }

  /** Show the world at server tick `at` (exact: used directly by tests). */
  show(at: number): { alpha: number; events: SimEvent[] } {
    const due: SimEvent[] = [];
    for (const s of this.snaps) {
      if (s.frame > at || s.frame <= this.applied) continue;
      for (const e of s.ev) { due.push(e); if (STRUCTURAL.has(e.t)) this.sim.mirrorEvent(e); }
      this.applied = s.frame;
    }
    let ai = -1;
    this.snaps.forEach((s, i) => { if (s.frame <= at) ai = i; });
    if (ai < 0) return { alpha: 1, events: due };
    const a = this.snaps[ai], b = this.snaps[ai + 1] ?? a;
    const alpha = b === a ? 1 : Math.min(1, Math.max(0, (at - a.frame) / (b.frame - a.frame)));
    const sim = this.sim;
    const looksNow = JSON.stringify(a.looks);
    if (looksNow !== this.lastLooks) { this.lastLooks = looksNow; sim.version++; } // someone picked a new hat or colour: the renderer must redraw the fighters
    sim.era = a.era; sim.map = a.map; sim.outfits = a.outfits; sim.looks = a.looks;
    sim.scores = a.scores.slice(); sim.round = a.round; sim.roundOver = a.roundOver; sim.roundWinner = a.roundWinner;
    if (a.props.length !== sim.props.length * 3) this.desyncs++;
    else {
      const pb = b.props.length === a.props.length ? b.props : a.props;
      sim.props.forEach((p, j) => {
        const tele = Math.hypot(pb[j * 3] - a.props[j * 3], pb[j * 3 + 1] - a.props[j * 3 + 1]) > TELEPORT;
        const from = tele ? pb : a.props;
        p.px = from[j * 3]; p.py = from[j * 3 + 1]; p.pa = from[j * 3 + 2];
        p.cx = pb[j * 3]; p.cy = pb[j * 3 + 1]; p.ca = pb[j * 3 + 2];
      });
    }
    if (sim.boat && a.boat) { const bb = b.boat ?? a.boat; Object.assign(sim.boat, { px: a.boat[0], py: a.boat[1], pa: a.boat[2], cx: bb[0], cy: bb[1], ca: bb[2] }); }
    sim.fighters.forEach((f, i) => {
      const pa = a.f[i]?.p, pb = b.f[i]?.p;
      if (!pa || pa.length !== f.parts.length * 3) { this.desyncs++; return; }
      const to = pb && pb.length === pa.length ? pb : pa; // the next snapshot has a different part count (a death just happened): hold still until we get there
      f.hp = a.f[i].hp; f.inBack = a.f[i].back;
      f.parts.forEach((p, j) => {
        const teleport = Math.hypot(to[j * 3] - pa[j * 3], to[j * 3 + 1] - pa[j * 3 + 1]) > TELEPORT; // a club back from the void, a new round: do not smear it across the screen
        const from = teleport ? to : pa;
        p.px = from[j * 3]; p.py = from[j * 3 + 1]; p.pa = from[j * 3 + 2];
        p.cx = to[j * 3]; p.cy = to[j * 3 + 1]; p.ca = to[j * 3 + 2];
      });
    });
    return { alpha, events: due };
  }
}

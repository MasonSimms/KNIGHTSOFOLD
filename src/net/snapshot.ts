import { tuning as T } from '../content/tuning';
import type { SimEvent } from '../sim/types';
import type { Look } from '../content/looks';
import type { Sim } from '../sim/world';
import type { Fighter } from '../sim/fighter';

// What the server sends the clients: where every body part is, plus the structural events since the last snapshot (deaths, pickups,
// respawns, new rounds) so the client's copy of the sim keeps the same list of parts. Plain JSON-safe data.
export interface Snapshot {
  frame: number; // server tick
  round: number;
  roundOver: boolean;
  roundWinner: number;
  matchOver?: boolean; // the match is over: the crown (and who won it)
  matchWinner?: number;
  scores: number[];
  f: { hp: number; back: boolean; p: number[]; st?: number }[]; // per fighter: hp, on the background plane, x, y, angle for each part, and state flags (FREE: see fighterState)
  simFrame?: number; // the round's own frame (the waves follow it)
  bl?: number[]; // bullets in flight: id, x, y, start x, start y, shooter for each (for drawing them)
  era: string;
  map: number;
  props: number[]; // x, y, angle of every loose prop (planks, logs...)
  pf?: number[]; // which loose props are on fire (their places in the list)
  jt?: number[]; // water tower leaks: x, y, direction, frames left for each
  boats?: number[]; // x, y, angle of each ship, on a map with them
  ack?: number[]; // per player: the number of their last input this tick used
  outfits: number[];
  looks: Look[]; // everyone's colour and hat (so a player who joins late or rejoins sees the right ones)
  ev: SimEvent[];
  back?: [number, SimEvent[]][]; // the structural events of the last few ticks again, by tick (on the fast lane a snapshot can be lost: the next ones bring its events)
}

/** What the server says a fighter is doing that only it decides (a hit, a grab): 0 = free, moving on their own buttons (prediction may run). */
export function fighterState(f: Fighter): number {
  return (f.knock > 0 ? 1 : 0) | (f.stun > 0 ? 2 : 0) | (f.carried > 0 || f.slamBy >= 0 ? 4 : 0) | (f.hold ? 8 : 0) | (f.limp ? 16 : 0) | (f.inBack ? 32 : 0)
    | (f.burning > 0 ? 64 : 0) | (f.stick?.burning ? 128 : 0) // (on fire, and their weapon on fire: for the picture)
    | (f.grip ? HOLDING : 0); // their weapon is in their hand (a page moving its own fighter must let go when the server says it was thrown or knocked away)
}

export const HOLDING = 256;
const TELEPORT = 4; // metres moved between two snapshots (50 ms) that can only be a teleport
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function takeSnapshot(sim: Sim, frame: number, ev: SimEvent[]): Snapshot {
  return {
    frame, round: sim.round, roundOver: sim.roundOver, roundWinner: sim.roundWinner, scores: sim.scores.slice(), ev, matchOver: sim.matchOver, matchWinner: sim.matchWinner,
    era: sim.era, map: sim.map, outfits: sim.outfits.slice(),
    props: sim.props.flatMap((p) => { const t = p.body.translation(); return [r3(t.x), r3(t.y), r3(p.body.rotation())]; }), looks: sim.looks.map((l) => ({ ...l })),
    boats: sim.boats.length ? sim.boats.flatMap((s) => [r3(s.body.translation().x), r3(s.body.translation().y), r3(s.body.rotation())]) : undefined,
    f: sim.fighters.map((f) => ({ hp: r3(f.hp), back: f.inBack, st: fighterState(f), p: f.parts.flatMap((p) => { const t = p.body.translation(); return [r3(t.x), r3(t.y), r3(p.body.rotation())]; }) })),
    simFrame: sim.frame,
    pf: sim.props.flatMap((p, i) => (p.burning ? [i] : [])),
    jt: sim.jets.flatMap((j) => [r3(j.x), r3(j.y), j.dir, j.left]),
    bl: sim.bullets.flatMap((u) => [u.id, r3(u.x), r3(u.y), r3(u.ox), r3(u.oy), u.owner]),
  };
}

/** Events that change which parts exist or who holds what: the only ones a client must replay to keep its parts in step. */
export const STRUCTURAL = new Set(['die', 'fall', 'pickup', 'respawn', 'newround', 'gone', 'back', 'spawn', 'shot', 'snap', 'break', 'shatter', 'boom']);

/** Client side: a copy of the sim that is never stepped. It replays structural events, then has its poses written in from snapshots. */
export class Mirror {
  desyncs = 0; // how many times a snapshot's part count disagreed with ours: should stay 0 (it means a missed or misordered event)
  private snaps: Snapshot[] = [];
  private evAt = new Map<number, SimEvent[]>(); // events by server tick, not yet shown: each snapshot's own, and repeated in the next ones (back)
  private known = new Set<number>(); // ticks whose events have come in (the same snapshot comes by both lanes: its events count once)
  private head = 0; // the server tick being shown (it runs `delay` ticks behind the newest snapshot, so there is always a pair to blend)
  private started = false;
  private lastLooks = '';
  private fresh = true; // nothing shown yet: the first snapshot says which round and era to build

  own = -1; // a fighter this page moves itself (prediction): its poses are not written in from snapshots
  delay: number; // how many ticks the shown world runs behind the newest snapshot: sized to how unevenly snapshots arrive (see target)
  starved = 0; // frames on which the shown time ran past the newest snapshot (a stall the buffer did not cover; the motion carries on for a few ticks)
  waits = 0; // ...and frames on which it ran out even of that and the picture had to wait: what a player sees as a stutter (the overlay shows it)
  private calm = 0; // seconds since the buffer last narrowed
  private late: number[] = []; // how late each recent snapshot arrived (ms after its tick, by this page's clock)
  private sorted = new Float64Array(0);
  private want = 0; // the buffer the arrivals call for (ticks): see target
  private lastFrame = -1; // the newest snapshot's tick at the last update (to tell a flowing stream from a stalled one)
  constructor(readonly sim: Sim, delay = T.net.blendTicks, readonly keep = 60) { this.delay = delay; this.want = delay; } // keep: snapshots held (a replay clip holds all of its own)
  /** The server tick being shown now (the newest snapshot's minus the buffer, give or take). */
  get shown(): number { return this.head; }

  /** A snapshot from the server; `at` = when it arrived (ms, this page's clock). */
  push(s: Snapshot, at = performance.now()): void {
    if (this.fresh) { // a new client (or one that rejoined): build the round the server is in, with its era's weapon and arena
      this.fresh = false;
      if (s.round !== this.sim.round || s.era !== this.sim.era) this.sim.buildRound(s.round, s.era);
    }
    this.note(s.frame, s.ev);
    for (const [f, ev] of s.back ?? []) this.note(f, ev);
    if (s.frame <= (this.snaps.at(-1)?.frame ?? -1)) return; // (the same snapshot by the other lane, or one overtaken: its events are in, its poses are old)
    this.late.push(at - s.frame * (1000 / 60));
    if (this.late.length > T.net.jitter.window) this.late.shift();
    this.want = this.target();
    this.snaps.push(s);
    while (this.snaps.length > this.keep) { // only the last second is kept. A page that is not drawing (a hidden tab) still gets every snapshot:
      const old = this.snaps.shift()!; // one it never showed still has its deaths and pickups made, or the copy would never match again
      this.replay(old.frame, null);
    }
    if (this.known.size > 2400) for (const f of this.known) if (f < s.frame - 1200) this.known.delete(f);
  }

  /** The events of server tick `frame` have come in (the first time only). */
  private note(frame: number, ev: SimEvent[]): void {
    if (this.known.has(frame)) return;
    this.known.add(frame);
    if (ev.length) this.evAt.set(frame, ev);
  }

  /** Replay the events up to tick `at`, in tick order: structural ones rebuild the parts here; `due` collects them all, to be shown and heard. */
  private replay(at: number, due: SimEvent[] | null): void {
    if (!this.evAt.size) return;
    for (const f of [...this.evAt.keys()].sort((x, y) => x - y)) {
      if (f > at) break;
      for (const e of this.evAt.get(f)!) { due?.push(e); if (STRUCTURAL.has(e.t)) this.sim.mirrorEvent(e); }
      this.evAt.delete(f);
    }
  }

  /** Start over from a fresh build (a rejoining client): forget everything and replay from the next catch-up snapshot. */
  reset(): void {
    this.snaps = []; this.started = false; this.fresh = true; this.late = []; this.evAt.clear(); this.known.clear();
    this.sim.gone.fill(false);
    this.sim.reset();
  }

  /** Advance the clock by real seconds and show the world. Returns the blend between the last two poses (for renderer.draw) and the events now due. */
  update(seconds: number): { alpha: number; events: SimEvent[] } {
    const latest = this.snaps.at(-1);
    if (!latest) return { alpha: 1, events: [] };
    const N = T.net;
    if (!this.started) { this.head = latest.frame - this.delay; this.started = true; }
    this.head += seconds * 60;
    // A jitter buffer sized to the connection (see target): it widens at once when snapshots start arriving more unevenly, and narrows
    // again a tick at a time once they have been steady for a while. A stall it does not cover is carried over (show extrapolates).
    const starved = this.head > latest.frame, flowing = latest.frame !== this.lastFrame;
    this.lastFrame = latest.frame;
    if (starved) this.starved++;
    if (this.want > this.delay) { this.delay = this.want; this.calm = 0; }
    else if ((this.calm += seconds) > N.blendRelax) { this.calm = 0; this.delay = Math.max(this.want, this.delay - 1); }
    const err = latest.frame - this.delay - this.head;
    // Behind the target (a tab that was hidden): jump. Ahead of it while the stream flows (the buffer just widened): run slow, never slower
    // than half speed, until the stream has built the buffer up. During a stall time runs on at full speed, so the buffer measures the whole
    // stall and the next one like it is covered: past the newest snapshot the motion carries on for a moment (show extrapolates), then waits.
    if (err > 12) this.head = latest.frame - this.delay; else if (flowing || err > 0) this.head += Math.max(err * 0.05, -0.5 * seconds * 60);
    if (this.head > latest.frame + N.extrapolateTicks) { this.waits++; this.head = latest.frame + N.extrapolateTicks; }
    return this.show(this.head);
  }

  /** The buffer (ticks) that covers how unevenly the last few seconds of snapshots arrived: blendTicks, plus how much later than the
   *  quickest one the slow ones came, at T.net.jitter.percentile (1 = every hiccup, smooth but later; 0.9 = all but the worst tenth, the
   *  rare stall carried over instead, sooner). Snapshots come a tick apart, so how late each was against its own tick is the jitter. */
  private target(): number {
    const N = T.net, n = this.late.length;
    if (n < 30) return Math.max(this.want, N.blendTicks); // (not enough to judge yet)
    if (this.sorted.length !== n) this.sorted = new Float64Array(n);
    this.sorted.set(this.late);
    this.sorted.sort();
    const spread = this.sorted[Math.min(n - 1, Math.floor((n - 1) * N.jitter.percentile))] - this.sorted[0];
    return Math.min(N.blendMax, N.blendTicks + spread / (1000 / 60));
  }

  /** Show the world at server tick `at` (exact: used directly by tests). */
  show(at: number): { alpha: number; events: SimEvent[] } {
    const due: SimEvent[] = [];
    let ai = -1;
    this.snaps.forEach((s, i) => { if (s.frame <= at) ai = i; });
    if (ai < 0) return { alpha: 1, events: due };
    this.replay(this.snaps[ai].frame, due); // (up to the snapshot whose poses are shown: its parts are the ones those events make)
    let a = this.snaps[ai], b = this.snaps[ai + 1] ?? a;
    // Past the newest snapshot (the stream stalled): carry the last motion on, alpha above 1 between the last two (only while they have
    // the same parts: across a death or a new round the older poses do not match what is built now).
    const prev = this.snaps[ai - 1];
    if (b === a && at > a.frame && prev && prev.props.length === a.props.length && prev.f.every((x, i) => x.p.length === a.f[i].p.length)) { b = a; a = prev; }
    const alpha = b === a ? 1 : Math.max(0, (at - a.frame) / (b.frame - a.frame));
    const sim = this.sim;
    const looksNow = JSON.stringify(a.looks);
    if (looksNow !== this.lastLooks) { this.lastLooks = looksNow; sim.version++; } // someone picked a new hat or colour: the renderer must redraw the fighters
    sim.era = a.era; sim.map = a.map; sim.outfits = a.outfits; sim.looks = a.looks;
    sim.scores = a.scores.slice(); sim.round = a.round; sim.roundOver = a.roundOver; sim.roundWinner = a.roundWinner; sim.matchOver = !!a.matchOver; sim.matchWinner = a.matchWinner ?? -1;
    sim.props.forEach((p, j) => { p.burning = a.pf?.includes(j) ? 1 : 0; });
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
    if (a.boats) { const ab = a.boats, bb = b.boats ?? ab; sim.boats.forEach((s, k) => { if (ab.length > k * 3 + 2) Object.assign(s, { px: ab[k * 3], py: ab[k * 3 + 1], pa: ab[k * 3 + 2], cx: bb[k * 3], cy: bb[k * 3 + 1], ca: bb[k * 3 + 2] }); }); }
    if (b.simFrame !== undefined) sim.frame = b.simFrame;
    sim.jets = []; for (let k = 0, jt = a.jt ?? []; k < jt.length; k += 4) sim.jets.push({ x: jt[k], y: jt[k + 1], dir: jt[k + 2], left: jt[k + 3] });
    // Bullets: each one between where it was in the two snapshots (one new in the later one appears there).
    sim.bullets.length = 0;
    const bb = b.bl ?? [], ab = a.bl ?? [];
    for (let k = 0; k < bb.length; k += 6) {
      let j = -1;
      for (let q = 0; q < ab.length; q += 6) if (ab[q] === bb[k]) { j = q; break; }
      const x = bb[k + 1], y = bb[k + 2];
      sim.bullets.push({ id: bb[k], x, y, px: j >= 0 ? ab[j + 1] : x, py: j >= 0 ? ab[j + 2] : y, vx: 0, vy: 0, ox: bb[k + 3], oy: bb[k + 4], owner: bb[k + 5], gun: '', calibre: 0, impact: 0, push: 0, age: 0, bounced: false, wet: false });
    }
    sim.fighters.forEach((f, i) => {
      const pa = a.f[i]?.p, pb = b.f[i]?.p;
      if (!pa || pa.length !== f.parts.length * 3) { this.desyncs++; return; }
      const to = pb && pb.length === pa.length ? pb : pa; // the next snapshot has a different part count (a death just happened): hold still until we get there
      f.hp = a.f[i].hp; f.inBack = a.f[i].back;
      const st = a.f[i].st ?? 0;
      f.burning = st & 64 ? 1 : 0;
      if (f.stick) f.stick.burning = st & 128 ? 1 : 0;
      if (i === this.own) return; // (this page moves it)
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

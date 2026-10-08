import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { RigidBody, World } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import { attachedParts, isWeapon } from '../sim/fighter';
import type { Fighter, Part } from '../sim/fighter';
import type { PlayerInput, SimEvent } from '../sim/types';
import { HOLDING } from './snapshot';
import type { Mirror, Snapshot } from './snapshot';

// Prediction (owner: your own fighter answers your keys at once online, behind a switch). The page moves its own fighter with its own
// buttons the moment they are pressed, in its copy of the world, where everything else (the other fighters, the weapons lying about, the
// ship) follows the server, so you still bump into them. The server stays the judge: every snapshot says which of your inputs it has used
// (ack) and where your fighter was after it; the page compares that with where it had you after the same input and nudges you toward the
// server (a big difference: straight there). While the server says something it alone decides is happening to you (knocked down,
// stunned, held, holding someone, dead), you simply follow the server, as without prediction. When it starts again (or a guess was far
// off), it starts from the newest place the server has you and quickly replays the buttons the server has not used yet, so the guess is
// where the server will have you; on screen your fighter slides there from where it was drawn (shift) instead of jumping.

const SERVER_ONLY = 1 | 2 | 4 | 8 | 16 | 512 | 1024 | 2048 | 4096; // knocked, stunned, held, holding someone, dead, on a grappling hook's rope, tangled in a net, frozen, in a bubble (snapshot.fighterState)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Predictor {
  private hist = new Map<number, { x: number; y: number }>(); // input number -> where this page had the body after it
  private on = false;
  private state = 16; // the server's flags for this fighter, from the newest snapshot (until one comes: not free)
  private round = -1; // the newest snapshot's round (until this page has built that round too, there is nothing to guess with)
  private sent = new Map<number, PlayerInput>(); // input number -> the buttons (to replay the ones still on their way)
  private n = 0; // the newest input number
  private last: { p: number[]; frame: number; ack: number } | null = null; // the newest snapshot's poses of this fighter, after input ack...
  private before: { p: number[]; frame: number } | null = null; // ...and the one before it (how fast each part was moving)
  /** Where your fighter is drawn, less where the guess has it (m): after a fresh start it closes over a few ticks (T.net.predict.smooth). */
  shift = { x: 0, y: 0 };
  /** How the guess has gone (the F3 overlay, npm run netlab): snapshots checked, the total and worst distance off (m), jumps straight to the server. */
  stats = { checks: 0, off: 0, worst: 0, snaps: 0, starts: 0 };

  constructor(private mirror: Mirror, public slot: number) {}

  /** This page is moving its own fighter right now. */
  get active(): boolean { return this.on; }

  /** One tick of your own buttons (input number n), moved at once. alpha: where the shown world is between its two snapshots.
   *  Returns what to show at once (your own shot's flash and bang). */
  tick(input: PlayerInput, n: number, alpha: number): SimEvent[] {
    const sim = this.mirror.sim, f = sim.fighters[this.slot];
    this.sent.set(n, input); this.n = n;
    if (this.sent.size > T.net.predict.history) this.sent.delete(this.sent.keys().next().value!);
    if (!f || f.limp || (this.state & SERVER_ONLY) || this.round !== sim.round) { this.stop(); return []; }
    const starting = !this.on, mine = new Set(this.mine(f));
    // Other fighters (and their weapons) do not touch yours here: what happens when fighters meet (a body hit, a knock back, a grab) is the
    // server's to decide, and a guess at it only threw your fighter about. Yours still stands on the ground and bumps into loose things.
    const meBit = 1 << (this.slot + 1);
    for (const g of sim.fighters) for (const p of g.parts) {
      if (mine.has(p)) continue;
      drive(p.body, p, alpha);
      for (const c of p.colliders) { const gr = c.collisionGroups(); if (gr & meBit) c.setCollisionGroups(((gr & 0xffff0000) | (gr & 0xffff & ~meBit)) >>> 0); }
    }
    for (const p of sim.props) { if (p.links?.length) unlink(sim.world, p); drive(p.body, p, alpha); }
    for (const s of sim.boats) follow(s.body, { px: s.px, py: s.py, pa: s.pa, cx: s.cx, cy: s.cy, ca: s.ca }, alpha);
    for (const p of mine) { if (!p.body.isDynamic()) p.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true); if (p.body.gravityScale() !== 1) p.body.setGravityScale(1, true); }
    if (starting) this.start(f, alpha, n - 1);
    this.shift.x *= T.net.predict.smooth; this.shift.y *= T.net.predict.smooth;
    const shown = sim.predictStep(this.slot, input);
    for (const p of mine) { const t = p.body.translation(); p.px = p.cx; p.py = p.cy; p.pa = p.ca; p.cx = t.x; p.cy = t.y; p.ca = p.body.rotation(); }
    const t = f.torso.body.translation();
    this.hist.set(n, { x: t.x, y: t.y });
    if (this.hist.size > T.net.predict.history) this.hist.delete(this.hist.keys().next().value!);
    return shown;
  }

  /** A snapshot from the server: what it says about you, and how far your guess was off. */
  reconcile(s: Snapshot): void {
    if (this.last && s.frame <= this.last.frame && s.frame > this.last.frame - 120) return; // (the same snapshot by the other lane, or an older one overtaken; far older is a new fight)
    const me = s.f[this.slot];
    this.state = me?.st ?? 16;
    this.round = s.round;
    const f = this.mirror.sim.fighters[this.slot], ack = s.ack?.[this.slot];
    if (me && ack !== undefined) { this.before = this.last; this.last = { p: me.p, frame: s.frame, ack }; } // (kept through a round change too: the new round starts from it)
    if (this.round !== this.mirror.sim.round) return; // (a new round is coming: its poses are for a map this page has not built yet)
    // The server has your weapon out of your hand (thrown, knocked away) and this page did not know (a drop is not one of the events it
    // replays): let go here too, or your fighter would be pulled toward wherever the weapon really is.
    if (f?.grip && me && !((me.st ?? 0) & HOLDING)) { this.mirror.sim.world.removeImpulseJoint(f.grip, true); f.grip = null; f.charge = 0; f.release = 0; f.throwPending = false; }
    if (!this.on || !me || !f || ack === undefined || me.p.length !== f.parts.length * 3) return;
    const h = this.hist.get(ack);
    for (const k of [...this.hist.keys()]) if (k <= ack) this.hist.delete(k); else break;
    if (!h) return;
    const ti = f.parts.indexOf(f.torso), ex = me.p[ti * 3] - h.x, ey = me.p[ti * 3 + 1] - h.y, d = Math.hypot(ex, ey), P = T.net.predict;
    this.stats.checks++; this.stats.off += d; this.stats.worst = Math.max(this.stats.worst, d);
    if (d > P.snap) {
      this.stats.snaps++; // far off (a hit that threw you, a wrong guess): start again from where the server has you
      const t = f.torso.body.translation(), x = t.x, y = t.y;
      this.rebase(f, this.n);
      const now = f.torso.body.translation();
      this.shift.x += x - now.x; this.shift.y += y - now.y;
      return;
    }
    if (d < P.deadzone) return;
    const k = Math.min(P.blendMax, P.blend + d * P.blendPerMetre), kx = ex * k, ky = ey * k; // a share of the difference each snapshot (a bigger share when further off): smooth, and it closes in a few ticks
    for (const p of this.mine(f)) { const t = p.body.translation(); p.body.setTranslation({ x: t.x + kx, y: t.y + ky }, true); p.cx += kx; p.cy += ky; p.px += kx; p.py += ky; }
    for (const v of this.hist.values()) { v.x += kx; v.y += ky; } // (the guesses after it were made from the same mistake)
  }

  /** Stop predicting (the server moves you again). */
  stop(): void { this.on = false; this.mirror.own = -1; this.hist.clear(); this.shift.x = this.shift.y = 0; }

  /** Start (input n is next): from where the server will have you, drawn sliding there from where you are shown now. */
  private start(f: Fighter, alpha: number, upTo: number): void {
    this.on = true;
    this.stats.starts++;
    this.mirror.own = this.slot;
    const x = lerp(f.torso.px, f.torso.cx, alpha), y = lerp(f.torso.py, f.torso.cy, alpha);
    if (!this.rebase(f, upTo)) { // (no news of you from the server yet: from where you are shown, moving as you are shown)
      for (const p of this.mine(f)) {
        place(p, lerp(p.px, p.cx, alpha), lerp(p.py, p.cy, alpha), p.pa + wrap(p.ca - p.pa) * alpha);
        p.body.setLinvel({ x: (p.cx - p.px) * 60, y: (p.cy - p.py) * 60 }, true); // (two snapshots are a tick apart)
        p.body.setAngvel(wrap(p.ca - p.pa) * 60, true);
      }
      return;
    }
    const t = f.torso.body.translation();
    this.shift.x = x - t.x; this.shift.y = y - t.y;
  }

  /** Put your fighter where the newest snapshot has it (moving as it was) and replay your buttons after that one, up to input upTo:
   *  where the server will have you once those arrive. False if there is no snapshot of you to start from. */
  private rebase(f: Fighter, upTo: number): boolean {
    const L = this.last, B = this.before, mine = this.mine(f);
    if (!L || L.p.length !== f.parts.length * 3) return false;
    const gap = B && B.p.length === L.p.length && L.frame > B.frame ? L.frame - B.frame : 0;
    f.parts.forEach((p, j) => {
      if (!mine.includes(p)) return;
      place(p, L.p[j * 3], L.p[j * 3 + 1], L.p[j * 3 + 2]);
      const v = gap ? 60 / gap : 0, b = gap ? B!.p : L.p;
      p.body.setLinvel({ x: (L.p[j * 3] - b[j * 3]) * v, y: (L.p[j * 3 + 1] - b[j * 3 + 1]) * v }, true);
      p.body.setAngvel(wrap(L.p[j * 3 + 2] - b[j * 3 + 2]) * v, true);
    });
    this.hist.clear();
    for (let k = Math.max(L.ack + 1, upTo - T.net.predict.replayMax + 1); k <= upTo; k++) {
      const i = this.sent.get(k);
      if (!i) continue;
      this.mirror.sim.predictStep(this.slot, i);
      const t = f.torso.body.translation();
      this.hist.set(k, { x: t.x, y: t.y });
    }
    for (const p of mine) { const t = p.body.translation(); p.px = p.cx = t.x; p.py = p.cy = t.y; p.pa = p.ca = p.body.rotation(); }
    return true;
  }

  /** The parts that move with you (not a club you dropped, not a limb you lost). */
  private mine(f: Fighter): Part[] { return attachedParts(f); }
}

/**
 * Another fighter's body part or a loose weapon: steered (its speed set each tick) to where the server shows it. It is still a normal body,
 * so you can push it a little as on the server; a kinematic one would be an immovable wall and your fighter would part from the server
 * every time it walked into someone.
 */
function drive(b: RigidBody, p: { px: number; py: number; pa: number; cx: number; cy: number; ca: number }, alpha: number): void {
  if (!b.isDynamic()) b.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
  if (b.gravityScale() !== 0) b.setGravityScale(0, true);
  const t = b.translation(), x = lerp(p.px, p.cx, alpha) + (p.cx - p.px), y = lerp(p.py, p.cy, alpha) + (p.cy - p.py); // (where it will be after this tick)
  const k = T.net.predict.drive; // (soft: pushed, it gives way like a fighter standing there; what you see of it is the server's picture anyway)
  b.setLinvel({ x: (x - t.x) * k + (p.cx - p.px) * 60, y: (y - t.y) * k + (p.cy - p.py) * 60 }, true);
  b.setAngvel(wrap(p.pa + wrap(p.ca - p.pa) * alpha + wrap(p.ca - p.pa) - b.rotation()) * 60, true);
}

/** A bridge plank's or a hanging thing's joints, on this page: gone. The server holds the bridge together and breaks it; here every piece is
 *  steered to where the server has it, and a joint the server has broken would drag its neighbours after it (a fallen aqueduct block
 *  piled four more up into a heap on every page, and your fighter, standing on the heap, kept snapping back to the server's bridge). */
function unlink(world: World, p: Part): void {
  for (const j of p.links!) if (world.getImpulseJoint(j.handle)) world.removeImpulseJoint(j, true);
  p.links = [];
}

/** A body that follows the server exactly: kinematic (the ship). */
function follow(b: RigidBody, p: { px: number; py: number; pa: number; cx: number; cy: number; ca: number }, alpha: number): void {
  if (b.isFixed()) return;
  if (!b.isKinematic()) b.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
  b.setNextKinematicTranslation({ x: lerp(p.px, p.cx, alpha), y: lerp(p.py, p.cy, alpha) });
  b.setNextKinematicRotation(p.pa + wrap(p.ca - p.pa) * alpha);
}

function place(p: Part, x: number, y: number, a: number): void {
  p.body.setTranslation({ x, y }, true);
  p.body.setRotation(a, true);
  p.px = p.cx = x; p.py = p.cy = y; p.pa = p.ca = a;
}

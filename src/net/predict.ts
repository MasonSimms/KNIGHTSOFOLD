import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { RigidBody } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import type { Fighter, Part } from '../sim/fighter';
import type { PlayerInput } from '../sim/types';
import type { Mirror, Snapshot } from './snapshot';

// Prediction (owner: your own fighter answers your keys at once online, behind a switch). The page moves its own fighter with its own
// buttons the moment they are pressed, in its copy of the world, where everything else (the other fighters, the weapons lying about, the
// ship) follows the server, so you still bump into them. The server stays the judge: every snapshot says which of your inputs it has used
// (ack) and where your fighter was after it; the page compares that with where it had you after the same input and nudges you toward the
// server (a big difference: straight there). While the server says something it alone decides is happening to you (knocked down,
// stunned, held, holding someone, dead), you simply follow the server, as without prediction.

const SERVER_ONLY = 1 | 2 | 4 | 8 | 16; // knocked, stunned, held, holding someone, dead (snapshot.fighterState)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Predictor {
  private hist = new Map<number, { x: number; y: number }>(); // input number -> where this page had the body after it
  private on = false;
  private state = 16; // the server's flags for this fighter, from the newest snapshot (until one comes: not free)

  constructor(private mirror: Mirror, public slot: number) {}

  /** This page is moving its own fighter right now. */
  get active(): boolean { return this.on; }

  /** One tick of your own buttons (input number n), moved at once. alpha: where the shown world is between its two snapshots. */
  tick(input: PlayerInput, n: number, alpha: number): void {
    const sim = this.mirror.sim, f = sim.fighters[this.slot];
    if (!f || f.limp || (this.state & SERVER_ONLY)) { this.stop(); return; }
    if (!this.on) this.start(f, alpha);
    const mine = new Set(this.mine(f));
    // Other fighters (and their weapons) do not touch yours here: what happens when fighters meet (a body hit, a knock back, a grab) is the
    // server's to decide, and a guess at it only threw your fighter about. Yours still stands on the ground and bumps into loose things.
    const meBit = 1 << (this.slot + 1);
    for (const g of sim.fighters) for (const p of g.parts) {
      if (mine.has(p)) continue;
      drive(p.body, p, alpha);
      for (const c of p.colliders) { const gr = c.collisionGroups(); if (gr & meBit) c.setCollisionGroups(((gr & 0xffff0000) | (gr & 0xffff & ~meBit)) >>> 0); }
    }
    for (const p of sim.props) drive(p.body, p, alpha);
    if (sim.boat) follow(sim.boat.body, { px: sim.boat.px, py: sim.boat.py, pa: sim.boat.pa, cx: sim.boat.cx, cy: sim.boat.cy, ca: sim.boat.ca }, alpha);
    for (const p of mine) { if (!p.body.isDynamic()) p.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true); if (p.body.gravityScale() !== 1) p.body.setGravityScale(1, true); }
    sim.predictStep(this.slot, input);
    for (const p of mine) { const t = p.body.translation(); p.px = p.cx; p.py = p.cy; p.pa = p.ca; p.cx = t.x; p.cy = t.y; p.ca = p.body.rotation(); }
    const t = f.torso.body.translation();
    this.hist.set(n, { x: t.x, y: t.y });
    if (this.hist.size > T.net.predict.history) this.hist.delete(this.hist.keys().next().value!);
  }

  /** A snapshot from the server: what it says about you, and how far your guess was off. */
  reconcile(s: Snapshot): void {
    const me = s.f[this.slot];
    this.state = me?.st ?? 16;
    const f = this.mirror.sim.fighters[this.slot], ack = s.ack?.[this.slot];
    if (!this.on || !me || !f || ack === undefined || me.p.length !== f.parts.length * 3) return;
    const h = this.hist.get(ack);
    for (const k of [...this.hist.keys()]) if (k <= ack) this.hist.delete(k); else break;
    if (!h) return;
    const ti = f.parts.indexOf(f.torso), ex = me.p[ti * 3] - h.x, ey = me.p[ti * 3 + 1] - h.y, d = Math.hypot(ex, ey), P = T.net.predict;
    if (d > P.snap) { // far off (a hit that threw you, a wrong guess): straight to where the server has you
      f.parts.forEach((p, j) => { if (this.mine(f).includes(p)) place(p, me.p[j * 3], me.p[j * 3 + 1], me.p[j * 3 + 2]); });
      this.hist.clear();
      return;
    }
    if (d < P.deadzone) return;
    const k = Math.min(P.blendMax, P.blend + d * P.blendPerMetre), kx = ex * k, ky = ey * k; // a share of the difference each snapshot (a bigger share when further off): smooth, and it closes in a few ticks
    for (const p of this.mine(f)) { const t = p.body.translation(); p.body.setTranslation({ x: t.x + kx, y: t.y + ky }, true); p.cx += kx; p.cy += ky; p.px += kx; p.py += ky; }
    for (const v of this.hist.values()) { v.x += kx; v.y += ky; } // (the guesses after it were made from the same mistake)
  }

  /** Stop predicting (the server moves you again). */
  stop(): void { this.on = false; this.mirror.own = -1; this.hist.clear(); }

  /** Start from where the server shows you, moving as it shows you. */
  private start(f: Fighter, alpha: number): void {
    this.on = true;
    this.mirror.own = this.slot;
    for (const p of this.mine(f)) {
      place(p, lerp(p.px, p.cx, alpha), lerp(p.py, p.cy, alpha), p.pa + wrap(p.ca - p.pa) * alpha);
      p.body.setLinvel({ x: (p.cx - p.px) * 60, y: (p.cy - p.py) * 60 }, true); // (two snapshots are a tick apart)
      p.body.setAngvel(wrap(p.ca - p.pa) * 60, true);
    }
  }

  /** The parts that move with you (not a club you dropped, not a limb you lost). */
  private mine(f: Fighter): Part[] {
    return f.parts.filter((p) => !(p.role === 'stick' && !f.grip) && !(f.armLost && (p.role === 'upper' || p.role === 'fore'))
      && !f.legs.some((l, i) => f.legLost[i] && (p === l.thigh || p === l.shin)));
  }
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

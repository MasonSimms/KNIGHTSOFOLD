// What sways on a fighter's head (looks only, like the cape: the simulation never sees it): the chains hanging off hats and hair
// (content/hats.ts), googly eyes' loose pupils, and the afro's squish. Plain maths with no Pixi, so it can be tested; the renderer only
// reads the points. Everything is in head radii, in world axes (y down); forces in the tuning are m/s² and are turned into head radii
// per second² with the fighter's real head size, so a portrait (drawn bigger) sways like the fight.
import type { DangleSpec } from '../content/hats';
import { tuning as T } from '../content/tuning';

/** The head this moment, in head radii: its centre, how far it is turned (radians), and the way it faces (1 right, -1 left). */
export interface Head { x: number; y: number; rot: number; side: number }

/** A point given in head radii on a head facing right, in the world. */
export function onHead(h: Head, x: number, y: number): [number, number] {
  const c = Math.cos(h.rot), s = Math.sin(h.rot), mx = x * h.side;
  return [h.x + mx * c - y * s, h.y + mx * s + y * c];
}
/** The direction an angle (0 = down, positive toward the face) points on that head. */
function restDir(h: Head, angle: number): [number, number] {
  const c = Math.cos(h.rot), s = Math.sin(h.rot), x = Math.sin(angle) * h.side, y = Math.cos(angle);
  return [x * c - y * s, x * s + y * c];
}

export interface Chain { x: Float64Array; y: Float64Array; px: Float64Array; py: Float64Array; live: boolean }
export const makeChain = (links: number): Chain => ({ x: new Float64Array(links), y: new Float64Array(links), px: new Float64Array(links), py: new Float64Array(links), live: false });

/**
 * One step of a chain: each point keeps its momentum, falls, trails away from the facing, flutters and is blown by the wind (m/s), each link
 * turns toward its rest (the first toward the spec's rest angle on the head, the others toward the line of the link before), then the links
 * get their lengths back. The anchor is pinned to the head, so a spinning or knocked head whips the chain round.
 * The stiffness is squared, so the scale from cloth (0) to rigid (1) is even: a link turning even a fifth of the way back every frame is stiff.
 */
export function stepChain(c: Chain, spec: DangleSpec, head: Head, dt: number, time: number, wind = 0): void {
  const D = T.finish.dangle, n = spec.links, seg = spec.length / (n - 1), h = Math.min(dt, D.maxDt), toR = 1 / T.fighter.headRadius;
  const [ax, ay] = onHead(head, spec.anchor[0], spec.anchor[1]), [rx, ry] = restDir(head, spec.rest);
  if (!c.live) { for (let i = 0; i < n; i++) { c.x[i] = c.px[i] = ax + rx * seg * i; c.y[i] = c.py[i] = ay + ry * seg * i; } c.live = true; }
  if (h <= 0) return;
  const damp = spec.damping ?? D.damping, grav = D.gravity * (spec.gravity ?? 1) * toR, trail = (spec.trail ?? D.trail) * toR, flutter = (spec.flutter ?? D.flutter) * toR;
  const push = -head.side * trail + wind * T.finish.wind.cape * toR;
  for (let i = 1; i < n; i++) {
    const vx = (c.x[i] - c.px[i]) * damp, vy = (c.y[i] - c.py[i]) * damp;
    c.px[i] = c.x[i]; c.py[i] = c.y[i];
    c.x[i] += vx + (push + Math.sin(time * D.flutterRate + i * 0.9) * flutter) * h * h;
    c.y[i] += vy + (grav + Math.cos(time * D.flutterRate * 0.7 + i) * flutter * 0.5) * h * h;
  }
  c.x[0] = c.px[0] = ax; c.y[0] = c.py[0] = ay;
  const k = spec.stiffness >= 1 ? 1 : 1 - Math.pow(1 - spec.stiffness ** 2, h * 60);
  for (let i = 1; i < n; i++) {
    let dx = rx, dy = ry;
    if (i > 1) { dx = c.x[i - 1] - c.x[i - 2]; dy = c.y[i - 1] - c.y[i - 2]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; }
    c.x[i] += (c.x[i - 1] + dx * seg - c.x[i]) * k;
    c.y[i] += (c.y[i - 1] + dy * seg - c.y[i]) * k;
  }
  for (let it = 0; it < D.iterations; it++) for (let i = 1; i < n; i++) {
    const dx = c.x[i] - c.x[i - 1], dy = c.y[i] - c.y[i - 1], d = Math.hypot(dx, dy) || 1e-6, f = seg / d;
    c.x[i] = c.x[i - 1] + dx * f; c.y[i] = c.y[i - 1] + dy * f;
  }
}

/** A googly eye's loose pupil: where it is from the middle of its eye, and its speed (head radii, world axes). */
export interface Pupil { x: number; y: number; vx: number; vy: number }
/**
 * One step of a loose pupil: a spring pulls it to the middle, it is slowed, it is flung the opposite way to the head's acceleration
 * (head radii/s², world axes) and falls; it stays inside the white (`room` from the middle), bouncing off the rim.
 */
export function stepPupil(p: Pupil, ax: number, ay: number, dt: number, room: number): void {
  const G = T.finish.googly, h = Math.min(dt, T.finish.dangle.maxDt), g = T.finish.dangle.gravity / T.fighter.headRadius;
  p.vx += (-G.spring * p.x - G.damping * p.vx - ax) * h;
  p.vy += (-G.spring * p.y - G.damping * p.vy - ay + g) * h;
  p.x += p.vx * h; p.y += p.vy * h;
  const d = Math.hypot(p.x, p.y);
  if (d > room) {
    const nx = p.x / d, ny = p.y / d, out = p.vx * nx + p.vy * ny;
    p.x = nx * room; p.y = ny * room;
    if (out > 0) { p.vx -= (1 + G.bounce) * out * nx; p.vy -= (1 + G.bounce) * out * ny; }
  }
}

/** The afro's squish: how squashed it is (0 = round, + = wide and short) and how fast that is changing. */
export interface Squish { s: number; v: number }
/** One step of the squish: a head stopping hard as it falls (a landing, a hit; `ay` = its vertical acceleration, head radii/s²) squashes it, then it wobbles back. */
export function stepSquish(q: Squish, ay: number, dt: number): void {
  const A = T.finish.afro, h = Math.min(dt, T.finish.dangle.maxDt);
  q.v += (-A.spring * q.s - A.damping * q.v - ay * A.kick) * h;
  q.s = Math.max(-A.max, Math.min(A.max, q.s + q.v * h));
}

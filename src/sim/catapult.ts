import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import { PROPS } from '../content/props';
import { tuning as T } from '../content/tuning';
import { createProp, worldGroups } from './fighter';
import type { Part } from './fighter';
import type { Arena, Sim } from './world';

// The catapult (Medieval: Battlements and Catapult): a throwing arm on an axle, lying cocked with its cup low behind the axle (to the
// right); it throws toward the left. Load the cup with anything (a stone, a barrel, a fighter standing in it), knock its lever over (a
// hit, a shove, a shot, a thrown thing: past tuning.catapult.trip) and the arm whips up and throws it. The arm is moved by the rules,
// not left to the physics (a kinematic body, steered each frame): it swings up at `spin`, stops at `release`, holds, winds back down by
// itself, and can be fired again. Arm and lever are loose things in sim.props (an online copy steers them to the server's like any
// other); the lever is a stick on a sprung hinge, bolted (nobody carries it off). Shot to pieces (wood snaps), the catapult is wrecked.

export interface Catapult { arm: Part; lever: Part; pivot: { x: number; y: number }; low: number; fired: number }

/** How long the arm takes to swing up: faster and faster, reaching tuning.catapult.spin as it stops (a sudden full speed would knock
 *  the load out of the cup straight up instead of carrying it round and letting it go forward). */
const swingTime = (c: Catapult) => (2 * (T.catapult.release - c.low)) / T.catapult.spin;

/** The arm's elevation (radians above level, its cup end behind the axle) at a frame: cocked, swinging up, holding, winding down. */
function armAngle(c: Catapult, frame: number): number {
  const C = T.catapult, t = c.fired < 0 ? Infinity : (frame - c.fired) * T.sim.dt, swing = swingTime(c);
  if (t < swing) return c.low + (C.release - c.low) * (t / swing) ** 2;
  if (t < swing + C.hold) return C.release;
  if (t < swing + C.hold + C.wind) { const k = (t - swing - C.hold) / C.wind; return C.release + (c.low - C.release) * k * k * (3 - 2 * k); }
  return c.low;
}

/** Where the arm's middle is and how it is turned at elevation a (it reaches `back` in front of the axle and `arm` behind it). */
function pose(c: Catapult, a: number): { x: number; y: number; rot: number } {
  const m = (T.catapult.arm - T.catapult.back) / 2;
  return { x: c.pivot.x + Math.cos(a) * m, y: c.pivot.y - Math.sin(a) * m, rot: -a };
}

export function buildCatapult(sim: Sim, K: NonNullable<Arena['catapult']>, top: number): Catapult {
  const C = T.catapult, W = sim.world, len = C.arm + C.back, S = PROPS['catapult-arm'];
  const c: Catapult = { arm: null!, lever: null!, pivot: { x: K.x, y: top - C.pivot }, low: -Math.asin((C.pivot - C.cupLow) / C.arm), fired: -1 };
  const p0 = pose(c, c.low);
  const arm = createProp(W, p0.x, p0.y, p0.rot, { kind: 'catapult-arm', ...S, len });
  arm.body.setBodyType(RAPIER.RigidBodyType.KinematicVelocityBased, true);
  const lip = { k: 'box' as const, hw: 0.04, hh: 0.15, x: len / 2 - 0.04, y: -(S.thick / 2 + 0.15), rot: 0 }; // (the cup's outer lip: what holds the load in as the arm swings)
  arm.colliders.push(W.createCollider(RAPIER.ColliderDesc.cuboid(lip.hw, lip.hh).setTranslation(lip.x, lip.y).setFriction(0.8).setCollisionGroups(worldGroups), arm.body));
  arm.shapes.push(lip);
  const L = PROPS.lever, base = top - 0.04;
  const lever = createProp(W, K.lever, base - L.len / 2, -Math.PI / 2, { kind: 'lever', ...L });
  lever.bolted = true;
  const hinge = W.createImpulseJoint(RAPIER.JointData.revolute({ x: 0, y: 0 }, { x: -L.len / 2, y: 0 }), W.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(K.lever, base).setRotation(-Math.PI / 2)), lever.body, true) as RAPIER.RevoluteImpulseJoint;
  hinge.setLimits(-C.leverSwing, C.leverSwing);
  hinge.configureMotorPosition(0, C.leverStiff, C.leverDamp); // (a spring standing it back up)
  c.arm = arm; c.lever = lever;
  for (const p of [arm, lever]) { sim.props.push(p); sim.machine.push(p); sim.partByBody.set(p.body.handle, p); }
  return c;
}

/** Before the physics each frame: the lever knocked over fires it; the arm is steered to where it is next frame. */
export function stepCatapult(sim: Sim, c: Catapult): void {
  if (!sim.props.includes(c.arm)) return; // (shot to pieces: wrecked)
  const C = T.catapult, dt = T.sim.dt;
  if (c.fired >= 0 && (sim.frame - c.fired) * dt >= swingTime(c) + C.hold + C.wind) c.fired = -1; // wound back down: ready again
  if (c.fired < 0 && sim.props.includes(c.lever)) {
    const lean = Math.atan2(Math.sin(c.lever.body.rotation() + Math.PI / 2), Math.cos(c.lever.body.rotation() + Math.PI / 2));
    if (Math.abs(lean) > C.trip) { c.fired = sim.frame; const t = c.lever.body.translation(); sim.events.push({ t: 'cut', x: t.x, y: t.y, v: 0, owner: -1, victim: -1 }); }
  }
  const next = pose(c, armAngle(c, sim.frame + 1)), b = c.arm.body, t = b.translation();
  b.setLinvel({ x: (next.x - t.x) / dt, y: (next.y - t.y) / dt }, true);
  b.setAngvel((next.rot - b.rotation()) / dt, true);
}

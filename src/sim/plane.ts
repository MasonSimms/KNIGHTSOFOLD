import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import { PROPS } from '../content/props';
import { tuning as T } from '../content/tuning';
import { createProp, terrainGroups } from './fighter';
import type { Part } from './fighter';
import type { Arena, Sim } from './world';

// Biplane Wing (World War I): the fight is on a biplane in flight, seen from behind: its lower wing is the floor and the upper wing a
// second floor over it (arena.plane; tuning.plane). Off a wing tip is the sky. It flies steady for a moment, then bobs and banks, and
// every so often lurches: it drops faster than you fall (everyone on it floats off the wing for a moment) and climbs back. Its flight is a
// pure function of the frame, so a round plays the same every time and an online copy agrees. It is one loose thing in sim.props, bolted
// and moved by the rules (a kinematic body steered each frame, like the catapult's arm), drawn from its weaponArt.ts picture.

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Where the lower wing's middle is at a (possibly fractional) frame, and how far it is banked (radians, + = right wing down). */
export function planeAt(A: Arena, frame: number): { x: number; y: number; rot: number } {
  const P = T.plane, t = frame * T.sim.dt - P.calm, base = A.platformTop + PROPS.biplane.thick / 2, x = A.plane!.x;
  if (t <= 0) return { x, y: base, rot: 0 };
  const k = Math.min(1, t / P.ease); // (the bobbing and banking come in gently)
  let y = base + k * P.bob * Math.sin((2 * Math.PI * t) / P.bobPeriod);
  const u = t - P.lurchEvery, l = u % P.lurchEvery; // (the first lurch a while in)
  if (u >= 0 && l < P.lurchTime) y += P.lurchDrop * (l / P.lurchTime) ** 2; // dropping, faster and faster
  else if (u >= 0 && l < P.lurchTime + P.lurchRise) { const q = (l - P.lurchTime) / P.lurchRise; y += P.lurchDrop * (1 - q * q * (3 - 2 * q)); } // and back up
  return { x, y, rot: k * P.bank * Math.sin((2 * Math.PI * t) / P.bankPeriod) };
}

export function buildPlane(sim: Sim): Part {
  const S = PROPS.biplane, P = T.plane, p = planeAt(sim.arena, 0);
  const part = createProp(sim.world, p.x, p.y, 0, { kind: 'biplane', ...S });
  part.body.setBodyType(RAPIER.RigidBodyType.KinematicVelocityBased, true);
  const upper = { k: 'box' as const, hw: P.upper / 2, hh: P.upperThick / 2, x: 0, y: -(S.thick / 2 + P.gap - P.upperThick / 2), rot: 0 };
  part.colliders.push(sim.world.createCollider(RAPIER.ColliderDesc.cuboid(upper.hw, upper.hh).setTranslation(upper.x, upper.y).setFriction(0.8), part.body));
  part.shapes.push(upper);
  for (const c of part.colliders) c.setCollisionGroups(terrainGroups); // (ground: you stand on it, and a swing passes through it)
  part.bolted = true; part.clock = true; // (an online page puts it where its flight has it: Sim.poseMachines)
  sim.props.push(part); sim.machine.push(part); sim.partByBody.set(part.body.handle, part);
  return part;
}

/** The plane on to where its flight has it at `frame` (next frame, on the server; an online page, the frame it is predicting). */
export function placePlane(sim: Sim, part: Part, frame: number, jump = false): void {
  if (!sim.props.includes(part)) return; // (gone: nothing to steer)
  const n = planeAt(sim.arena, frame), b = part.body, t = b.translation(), dt = T.sim.dt;
  if (jump || Math.hypot(n.x - t.x, n.y - t.y) > 3) { b.setTranslation({ x: n.x, y: n.y }, true); b.setRotation(n.rot, true); b.setLinvel({ x: 0, y: 0 }, true); b.setAngvel(0, true); return; } // (far off: put it there)
  b.setLinvel({ x: (n.x - t.x) / dt, y: (n.y - t.y) / dt }, true);
  b.setAngvel(wrap(n.rot - b.rotation()) / dt, true);
}

/** Before the physics each frame: the plane on to where its flight has it next frame. */
export function stepPlane(sim: Sim, part: Part): void {
  placePlane(sim, part, sim.frame + 1);
}

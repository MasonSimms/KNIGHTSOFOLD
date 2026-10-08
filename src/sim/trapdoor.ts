import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { RigidBody } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import { terrainGroups } from './fighter';
import type { Arena, Sim } from './world';

// Trapdoors (Gladiators: Colosseum Floor): doors set into the floor over the pit, hinged at one edge. Each swings open on a timetable
// (arena.trapdoors at, tuning.trapdoor cycle): it rattles for a moment first, drops open, hangs open a while, then swings shut. Whoever
// is on it when it opens drops into the pit (the void). The doors' swing is a pure function of the frame, so a round plays the same every
// time and an online copy moves them the same way.

type Door = Arena['trapdoors'][number];
export interface Trapdoor { body: RigidBody; door: Door }

/** How far open a door is at a (possibly fractional) frame, as an angle (radians: 0 shut, a quarter turn hanging straight down), with
 *  the rattle that gives it away just before it opens. */
export function doorAngle(d: Door, frame: number): number {
  const D = T.trapdoor, t = frame * T.sim.dt, since = (((t - d.at) % D.cycle) + D.cycle) % D.cycle, until = t < d.at ? d.at - t : D.cycle - since;
  let open = 0;
  if (t >= d.at) {
    if (since < D.swing) open = (since / D.swing) ** 2; // (dropping open, faster and faster)
    else if (since < D.open) open = 1;
    else if (since < D.open + D.close) { const k = (since - D.open) / D.close; open = 1 - k * k * (3 - 2 * k); }
  }
  const rattle = until < D.tell ? Math.sin(t * D.rattleRate) * D.rattle : 0;
  return -d.hinge * (open * (Math.PI / 2) + rattle);
}

/** Where a door's middle is and how it is turned, at a frame. */
export function doorPose(A: Arena, d: Door, frame: number): { x: number; y: number; rot: number } {
  const a = doorAngle(d, frame), half = d.w / 2, h = T.trapdoor.thick / 2, side = -d.hinge; // (the door reaches from its hinge away to the other edge)
  const hx = d.hinge < 0 ? d.x : d.x + d.w, hy = A.platformTop, c = Math.cos(a), s = Math.sin(a), lx = side * half, ly = h;
  return { x: hx + lx * c - ly * s, y: hy + lx * s + ly * c, rot: a };
}

export function buildDoors(sim: Sim): Trapdoor[] {
  const A = sim.arena;
  return A.trapdoors.map((door) => {
    const p = doorPose(A, door, 0);
    const body = sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y).setRotation(p.rot));
    sim.world.createCollider(RAPIER.ColliderDesc.cuboid(door.w / 2, T.trapdoor.thick / 2).setFriction(A.friction).setCollisionGroups(terrainGroups), body);
    return { body, door };
  });
}

/** Before the physics each frame: every door to where it is next frame (or at `frame`: an online page, predicting). */
export function stepDoors(sim: Sim, doors: Trapdoor[], frame = sim.frame + 1, jump = false): void {
  for (const { body, door } of doors) {
    const p = doorPose(sim.arena, door, frame);
    if (jump) { body.setTranslation({ x: p.x, y: p.y }, true); body.setRotation(p.rot, true); continue; } // (straight there: an online page catching up)
    body.setNextKinematicTranslation({ x: p.x, y: p.y });
    body.setNextKinematicRotation(p.rot);
  }
}

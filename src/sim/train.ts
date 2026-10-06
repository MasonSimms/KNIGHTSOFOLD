import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { RigidBody } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import { terrainGroups } from './fighter';
import type { Arena, Sim } from './world';

// The Train (owner): the fight is on the roofs of a moving train (the cars are the floor; the painting rushes past). Head-height wooden
// signs and tunnel mouths come at you from the right: get down (or jump a sign), or be swept off. Thrown into one, it hurts like a
// wall. Each one comes round on a fixed timetable (arena.train), a pure function of the frame, with a whistle just before.

export interface Passing { body: RigidBody; kind: 'sign' | 'tunnel'; at: number }

/** The size of a passing thing (half width, half height) and the height of its middle. */
function shapeOf(A: Arena, kind: 'sign' | 'tunnel') {
  const P = T.train;
  if (kind === 'sign') return { hw: P.signW / 2, hh: P.signH / 2, y: A.platformTop - P.signUp - P.signH / 2 };
  const bottom = A.platformTop - P.tunnelUp, top = -1; // a tunnel's mouth: from its roof down to just above someone lying flat
  return { hw: P.tunnelW / 2, hh: (bottom - top) / 2, y: (bottom + top) / 2 };
}

/** Where each passing thing is at a (possibly fractional) frame: off to the right until its time, then across, then gone left. */
export function passingAt(A: Arena, frame: number): { kind: 'sign' | 'tunnel'; x: number; y: number; hw: number; hh: number }[] {
  const tr = A.train;
  if (!tr) return [];
  const t = frame * T.sim.dt;
  return tr.passing.map((p) => {
    const s = shapeOf(A, p.kind), from = A.viewW + 1 + s.hw, run = ((t - p.at) % tr.cycle + tr.cycle) % tr.cycle;
    const x = t < p.at ? 50 : from - run * tr.speed; // (waiting off to the right until its first time)
    return { kind: p.kind, x: x < -s.hw - 3 ? -50 : x, y: s.y, hw: s.hw, hh: s.hh };
  });
}

export function buildTrain(sim: Sim): Passing[] {
  const A = sim.arena;
  return passingAt(A, 0).map((p, i) => {
    const body = sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y));
    sim.world.createCollider(RAPIER.ColliderDesc.cuboid(p.hw, p.hh).setFriction(0.3).setCollisionGroups(terrainGroups), body);
    return { body, kind: p.kind, at: A.train!.passing[i].at };
  });
}

/** Before the physics each frame: move everything passing to where it is next frame (and blow the whistle just before one comes). */
export function stepTrain(sim: Sim, passing: Passing[]): void {
  const A = sim.arena, tr = A.train!, next = passingAt(A, sim.frame + 1), cycle = Math.round(tr.cycle / T.sim.dt);
  passing.forEach((p, i) => {
    const n = next[i], now = p.body.translation();
    if (Math.abs(n.x - now.x) > 2) p.body.setTranslation({ x: n.x, y: n.y }, true); // (back round to the right: no sweep across)
    else p.body.setNextKinematicTranslation({ x: n.x, y: n.y });
    const due = Math.round((p.at - T.train.whistle) / T.sim.dt); // (counted in whole frames: exactly once each time round)
    if (sim.frame >= due && (sim.frame - due) % cycle === 0) sim.events.push({ t: 'whistle', x: A.viewW, y: n.y, v: p.kind === 'tunnel' ? 1 : 0, owner: -1, victim: -1 });
  });
}

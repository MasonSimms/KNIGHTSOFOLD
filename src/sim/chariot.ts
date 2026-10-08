import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { RigidBody } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import { letGo, terrainGroups } from './fighter';
import type { Part } from './fighter';
import type { Arena, Sim } from './world';

// Chariot Track (Gladiators): a runaway chariot charges across the track on a timetable (arena.chariot), one way and then the other,
// raising dust just before it comes. Whoever it catches is flung ahead of it (hurt, knocked down, often out of the picture): jump it, or
// get up on the spina. Its run is a pure function of the frame, so a round plays the same every time and an online copy agrees.

export interface Chariot { body: RigidBody; run: number; hit: Set<number> } // hit: the fighters it has flung on this run (once each)

/** Where the chariot is at a (possibly fractional) frame: its middle, which way it is going (0 while it is away) and which run it is on. */
export function chariotAt(A: Arena, frame: number): { x: number; y: number; dir: number; run: number } {
  const C = A.chariot!, H = T.chariot, t = frame * T.sim.dt - C.at, run = Math.floor(t / C.cycle), y = A.platformTop - H.height / 2;
  const dir = run % 2 === 0 ? C.dir : -C.dir, start = dir > 0 ? -H.len / 2 - 2 : A.viewW + H.len / 2 + 2, d = (t - run * C.cycle) * C.speed;
  if (t < 0 || d > A.viewW + H.len + 4) return { x: -50, y, dir: 0, run }; // (away, waiting off to the side)
  return { x: start + dir * d, y, dir, run };
}

export function buildChariot(sim: Sim): Chariot {
  const p = chariotAt(sim.arena, 0), H = T.chariot;
  const body = sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y));
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(H.len / 2, H.height / 2).setFriction(0.3).setCollisionGroups(terrainGroups), body);
  return { body, run: p.run, hit: new Set() };
}

/** The chariot on to where it is at `frame` (next frame, on the server; an online page, the frame it is predicting). */
export function placeChariot(sim: Sim, ch: Chariot, frame: number, jump = false): ReturnType<typeof chariotAt> {
  const n = chariotAt(sim.arena, frame), now = ch.body.translation();
  if (jump || Math.abs(n.x - now.x) > 3) ch.body.setTranslation({ x: n.x, y: n.y }, true); // (to the start of a run, or away: no sweep across)
  else ch.body.setNextKinematicTranslation({ x: n.x, y: n.y });
  return n;
}

/** Before the physics each frame: the chariot on to where it is next frame, and whatever it touches flung ahead of it. */
export function stepChariot(sim: Sim, ch: Chariot): void {
  const H = T.chariot, n = placeChariot(sim, ch, sim.frame + 1);
  if (n.run !== ch.run) { ch.run = n.run; ch.hit.clear(); }
  if (!n.dir) return;
  const col = ch.body.collider(0), hit: Part[] = [];
  sim.world.contactPairsWith(col, (other) => { // (collected first: nothing may change during the scan)
    const vb = other.parent(), part = vb && sim.partByBody.get(vb.handle);
    if (part) sim.world.contactPair(col, other, (m) => { if (m.numSolverContacts() > 0) hit.push(part); });
  });
  for (const part of hit) {
    if (part.role === 'prop') { if (part.body.isDynamic() && part.body.linvel().x * n.dir < H.fling.x / 2) part.body.setLinvel({ x: n.dir * H.fling.x, y: -H.fling.y / 2 }, true); continue; }
    const f = sim.fighters[part.owner];
    if (!f || ch.hit.has(f.index)) continue;
    ch.hit.add(f.index);
    for (const g of sim.fighters) if (g.held === f) letGo(sim.world, g, false, sim.events);
    if (f.hold) letGo(sim.world, f, false, sim.events);
    for (const q of f.parts) q.body.setLinvel({ x: n.dir * H.fling.x, y: -H.fling.y }, true);
    sim.trampled(f, H.impact, n.dir);
    f.knock = f.stun = T.knock.maxFrames;
  }
}

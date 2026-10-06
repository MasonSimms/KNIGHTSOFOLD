import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { RigidBody } from '@dimforge/rapier2d-deterministic-compat';
import { PROPS } from '../content/props';
import { tuning as T } from '../content/tuning';
import { createProp, letGo, setBackPlane, terrainGroups } from './fighter';
import type { Part } from './fighter';
import type { Arena, Sim } from './world';

// The Mammoth Chase (owner): the ground is a treadmill sliding left, carrying everyone (and every rock, log and body) toward a woolly
// mammoth at the left edge: run right to stay ahead. Touching the mammoth gets you tossed out of the picture (a knock-off). Rocks and
// logs keep riding in from the right. The floor is a row of moving sections that loop round out of sight; the mammoth's gallop is a
// pure function of the frame, so a round plays the same every time. Walking on a moving floor is relative to it (fighter.ts).

export interface Chase { segs: RigidBody[]; mammoth: RigidBody; obstacles: Part[]; tossed: Set<number> }

const SEG = 8; // m: one floor section
/** The mammoth's own collision group: everything in the play plane bumps into it, but someone it has tossed (moved to the background
 *  plane) flies over it and out of the picture instead of bouncing back off its face. */
const MAMMOTH = ((0x1000 << 16) | 0xffff) >>> 0;

/** Where the mammoth is at a frame (its middle) and how it rocks as it gallops (the renderer draws it from this too). */
export function mammothPose(A: Arena, frame: number): { x: number; y: number; rot: number } {
  const M = T.chase, ph = frame * T.sim.dt * M.gallop * Math.PI * 2;
  return { x: (A.chase?.mammothX ?? 0) + Math.sin(ph * 0.25) * M.surge, y: A.platformTop - M.height / 2 - Math.abs(Math.sin(ph)) * M.bob, rot: Math.sin(ph) * M.rock };
}

/** A rock or log on the treadmill at x. */
function onBelt(sim: Sim, kind: string, x: number): Part {
  const spec = PROPS[kind], p = createProp(sim.world, x, sim.arena.platformTop - spec.thick / 2 - 0.02, 0, { kind, ...spec });
  sim.props.push(p);
  sim.partByBody.set(p.body.handle, p);
  return p;
}

export function buildChase(sim: Sim): Chase {
  const A = sim.arena, C = A.chase!, M = T.chase, n = Math.ceil((A.viewW + 3 * SEG) / SEG);
  const segs = Array.from({ length: n }, (_, i) => {
    const b = sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicVelocityBased().setTranslation(-SEG + (i + 0.5) * SEG, A.platformTop + A.platformThickness / 2).setLinvel(-C.speed, 0));
    sim.world.createCollider(RAPIER.ColliderDesc.cuboid(SEG / 2, A.platformThickness / 2).setFriction(A.friction).setCollisionGroups(terrainGroups), b);
    return b;
  });
  const p = mammothPose(A, 0);
  const mammoth = sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y));
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(M.length / 2, M.height / 2).setCollisionGroups(MAMMOTH), mammoth);
  const obstacles = C.obstacles.map((kind, i) => onBelt(sim, kind, A.viewW + 2 + i * C.gap));
  return { segs, mammoth, obstacles, tossed: new Set() };
}

/** Floor sections gone out of sight on the left come round to the right (also on an online page predicting its own fighter). */
export function loopFloor(ch: Chase): void {
  for (const b of ch.segs) { const t = b.translation(); if (t.x < -1.5 * SEG) b.setTranslation({ x: t.x + ch.segs.length * SEG, y: t.y }, true); }
}

/** Each frame after the physics: sections that went out of sight on the left come round to the right, the mammoth gallops on, whatever
 *  it touches is tossed, and rocks and logs that are gone come round again from the right. */
export function stepChase(sim: Sim, ch: Chase): void {
  const A = sim.arena, C = A.chase!, M = T.chase;
  loopFloor(ch);
  const p = mammothPose(A, sim.frame + 1);
  ch.mammoth.setNextKinematicTranslation({ x: p.x, y: p.y });
  ch.mammoth.setNextKinematicRotation(p.rot);
  const col = ch.mammoth.collider(0), toss = { x: -M.toss.x, y: -M.toss.y }, hit: Part[] = [];
  sim.world.contactPairsWith(col, (other) => { // (what it touches is collected first: nothing may change during the scan)
    const vb = other.parent(), part = vb && sim.partByBody.get(vb.handle);
    if (part) sim.world.contactPair(col, other, (m) => { if (m.numSolverContacts() > 0) hit.push(part); });
  });
  for (const part of hit) {
    if (part.role === 'prop') { if (part.body.linvel().x > toss.x / 2) part.body.setLinvel(toss, true); continue; }
    const f = sim.fighters[part.owner];
    if (!f || ch.tossed.has(f.index)) continue;
    ch.tossed.add(f.index); // (once: they fly out of the picture, a knock-off)
    for (const g of sim.fighters) if (g.held === f) letGo(sim.world, g, false, sim.events);
    if (f.hold) letGo(sim.world, f, false, sim.events);
    f.knock = f.stun = T.knock.maxFrames;
    setBackPlane(f, true); f.dodge = 1e9; // (behind the mammoth, for good: over it and out of the picture)
    for (const q of f.parts) { q.body.setLinvel(toss, true); q.body.setAngvel(M.tossSpin, true); }
    const t = f.torso.body.translation();
    sim.events.push({ t: 'trample', x: t.x, y: t.y, v: 0, owner: -1, victim: f.index });
  }
  for (const o of ch.obstacles) {
    const t = o.body.translation();
    if (t.x > -3 && t.y < A.killY) continue;
    o.body.setTranslation({ x: A.viewW + 2 + ((sim.frame * 0.618) % 1) * C.gap, y: A.platformTop - (o.weapon?.thickness ?? 0.5) / 2 - 0.02 }, true); // (spaced a little irregularly)
    o.body.setRotation(0, true);
    o.body.setLinvel({ x: -C.speed, y: 0 }, true);
    o.body.setAngvel(0, true);
  }
}

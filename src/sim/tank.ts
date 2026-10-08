import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import { PROPS } from '../content/props';
import { tuning as T } from '../content/tuning';
import { createProp, letGo, terrainGroups } from './fighter';
import type { Part } from './fighter';
import type { Arena, Sim } from './world';

// The Slow Tank (World War I): a tank crawls across the field on a timetable (arena.tank: its engine runs a while at x0, it crawls to x1 at
// `speed`, waits `wait` s, crawls back, waits, and again), a pure function of the frame, so a round plays the same every time and an online
// copy agrees. Its hull and turret are ground to stand on (you ride it); its front shoves whoever is in the way, and its tracks hurt and
// knock down whoever they reach (tuning.tank). It stops just short of either end of the field, so whoever it shoves goes off. It is one
// loose thing in sim.props, bolted and moved by the rules (a kinematic body steered each frame, like the catapult's arm), drawn from its
// weaponArt.ts picture.

export interface Tank { part: Part; next: number[] } // next: the frame from which each fighter can be hurt by the tracks again

/** Where the tank's middle is at a frame, and which way it is crawling (0: waiting). */
export function tankAt(A: Arena, frame: number): { x: number; dir: number } {
  const K = A.tank!, t = frame * T.sim.dt, leg = (K.x1 - K.x0) / K.speed, u = t % (2 * (leg + K.wait));
  if (u < K.wait) return { x: K.x0, dir: 0 };
  if (u < K.wait + leg) return { x: K.x0 + (u - K.wait) * K.speed, dir: 1 };
  if (u < 2 * K.wait + leg) return { x: K.x1, dir: 0 };
  return { x: K.x1 - (u - 2 * K.wait - leg) * K.speed, dir: -1 };
}

export function buildTank(sim: Sim, top: number): Tank {
  const S = PROPS.tank, H = T.tank, p = tankAt(sim.arena, 0);
  const part = createProp(sim.world, p.x, top - S.thick / 2, 0, { kind: 'tank', ...S });
  part.body.setBodyType(RAPIER.RigidBodyType.KinematicVelocityBased, true);
  const turret = { k: 'box' as const, hw: H.turretW / 2, hh: H.turretH / 2, x: H.turretX, y: -(S.thick + H.turretH) / 2, rot: 0 };
  part.colliders.push(sim.world.createCollider(RAPIER.ColliderDesc.cuboid(turret.hw, turret.hh).setTranslation(turret.x, turret.y).setFriction(0.8), part.body));
  part.shapes.push(turret);
  for (const c of part.colliders) c.setCollisionGroups(terrainGroups); // (ground: you stand on it, and a swing passes through it)
  part.bolted = true;
  sim.props.push(part); sim.machine.push(part); sim.partByBody.set(part.body.handle, part);
  return { part, next: [] };
}

/** Before the physics each frame: the tank on to where it is next frame; whoever is in front of its tracks is run over. */
export function stepTank(sim: Sim, k: Tank): void {
  if (!sim.props.includes(k.part)) return; // (gone: nothing to steer)
  const A = sim.arena, H = T.tank, dt = T.sim.dt, b = k.part.body, t = b.translation(), n = tankAt(A, sim.frame + 1), now = tankAt(A, sim.frame);
  b.setLinvel({ x: (n.x - t.x) / dt, y: 0 }, true);
  if (!now.dir) return;
  const front = t.x + (now.dir * PROPS.tank.len) / 2;
  for (const f of sim.fighters) {
    if (f.limp || (k.next[f.index] ?? 0) > sim.frame) continue;
    const q = f.torso.body.translation(), ahead = (q.x - front) * now.dir;
    if (ahead < -0.3 || ahead > H.reach || q.y < A.platformTop - H.reachUp) continue; // (in front of the tracks, down on the ground: not riding it)
    k.next[f.index] = sim.frame + Math.round(H.every / dt);
    for (const g of sim.fighters) if (g.held === f) letGo(sim.world, g, false, sim.events);
    sim.trampled(f, H.impact, now.dir);
    f.knock = f.stun = Math.max(f.knock, H.knock);
  }
}

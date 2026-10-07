import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import { wrapAngle } from './fighter';
import type { Fighter, Part } from './fighter';
import type { Sim } from './world';

// Weapons that do more than hit (owner, batch one): a thrown spear flies point-first and sticks into the ground and walls until someone
// pulls it out; a grenade's fuse starts when it leaves a hand, and then it goes off (world.blast). Shields (props.ts: material 'shield',
// push) and the gravity hammer (pull) are part of the hit itself (world.ts hit). Numbers: tuning.special.

/** Every weapon not in a hand: a fighter's own one they let go of, or one lying about (with whose it is). */
function loose(sim: Sim): [Part, Fighter | undefined][] {
  const out: [Part, Fighter | undefined][] = sim.props.map((p) => [p, undefined]);
  for (const g of sim.fighters) if (g.stick && !g.grip) out.push([g.stick, g]);
  return out;
}

/** Before the physics: a flying spear turns its point into the way it is going, like an arrow. */
export function aimSpears(sim: Sim): void {
  const S = T.special;
  for (const [p] of loose(sim)) {
    if (!p.weapon?.spear || !p.body.isDynamic()) continue;
    const v = p.body.linvel();
    if (Math.hypot(v.x, v.y) < S.spearFly) continue;
    p.body.setAngvel(wrapAngle(Math.atan2(v.y, v.x) - p.body.rotation()) * S.spearTurn, true);
  }
}

/** After the physics: a spear that flew point-first into the ground or a wall stays stuck there (picking it up frees it: fighter.ts). */
export function stickSpears(sim: Sim): void {
  const S = T.special;
  for (const [p, g] of loose(sim)) {
    if (!p.weapon?.spear || !p.body.isDynamic() || Math.hypot(p.vx, p.vy) < S.spearStick) continue;
    if (Math.abs(wrapAngle(Math.atan2(p.vy, p.vx) - p.body.rotation())) > S.spearPointFirst) continue;
    let hit = false;
    for (const c of p.colliders) sim.world.contactPairsWith(c, (o) => { if (!hit && o.parent()?.isFixed()) sim.world.contactPair(c, o, (m) => { if (m.numSolverContacts() > 0) hit = true; }); });
    if (!hit) continue;
    p.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    const t = p.body.translation();
    sim.events.push({ t: 'thunk', x: t.x, y: t.y, v: 0, owner: g?.index ?? -1, victim: -1 });
  }
}

/** Each frame: a grenade's fuse starts when it leaves a hand and runs down (picked up again, it keeps running: throw it back quick). */
export function fuses(sim: Sim): void {
  const all = loose(sim);
  for (const g of sim.fighters) if (g.stick && g.grip && g.stick.fuse !== undefined) all.push([g.stick, g]); // (in a hand again, its fuse still running)
  for (const [p, g] of all) {
    if (!p.weapon?.fuse) continue;
    if (p.fuse === undefined) {
      if (!g || g.grip) continue; // (one lying about untouched has no fuse running)
      p.fuse = Math.round(p.weapon.fuse / T.sim.dt);
      p.thrower = g.index;
    }
    if (--p.fuse > 0) continue;
    const t = p.body.translation(), holder = g?.stick === p ? g : undefined, at = holder ? -1 : sim.props.indexOf(p);
    sim.events.push({ t: 'boom', x: t.x, y: t.y, v: T.special.blastRadius, owner: holder?.index ?? -1, victim: at });
    goneOff(sim, p, holder);
    sim.blast(t.x, t.y, p.thrower ?? -1);
  }
}

/** The grenade itself is gone (also used by the online copies: 'boom'). */
export function goneOff(sim: Sim, p: Part, holder: Fighter | undefined): void {
  sim.removeBody(p, holder);
  sim.version++;
}

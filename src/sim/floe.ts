import { tuning as T } from '../content/tuning';
import { isWeapon } from './fighter';
import type { Sim } from './world';

// Ice floes (Vikings: Ice Floe Fjord, arena.boats crack): a hard landing or a body slammed onto a floe cracks it, and after
// tuning.floe.cracks cracks it sinks (water.ts floatBoat), taking whoever is on it into the water. A sunk floe stays under for the round.

/** After the physics each frame: anyone who has come down hard on a floe cracks it. */
export function crackFloes(sim: Sim): void {
  const F = T.floe;
  for (const b of sim.boats) {
    if (!b.crack || b.sunkAt >= 0 || sim.frame < b.crackWait) continue;
    const col = b.body.collider(0), fv = b.body.linvel(), hits: { x: number; y: number }[] = [];
    sim.world.contactPairsWith(col, (other) => {
      const vb = other.parent(), part = vb && sim.partByBody.get(vb.handle);
      if (!part || part.owner < 0 || part.role === 'prop' || isWeapon(part) || part.vy - fv.y < F.crackSpeed) return; // a body coming down on it (not a weapon's swing)
      sim.world.contactPair(col, other, (m) => { if (m.numSolverContacts() > 0) hits.push(part.body.translation()); });
    });
    const at = hits[0];
    if (!at) continue;
    b.crackWait = sim.frame + F.wait;
    if (++b.cracks >= F.cracks) b.sunkAt = sim.frame;
    sim.events.push({ t: 'cut', x: at.x, y: at.y, v: 0, owner: -1, victim: -1 }); // (the crack: heard like a plank snapping)
  }
}

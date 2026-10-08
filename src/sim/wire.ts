import { tuning as T } from '../content/tuning';
import type { Sim } from './world';
import { floorAt } from './world';

// Barbed wire (World War I: No Man's Land; arena.wire): coils on the ground. Whoever is in one is snagged (f.snag, read by the controls):
// they only shuffle and cannot jump out, and every so often it scratches them (tuning.wire). Jump it, go round it, or throw someone into
// it. Where the coils are is a pure function of the map, so an online page guessing its own fighter is slowed the same; only the server
// does the scratching.

/** Each frame before the physics: who is in the wire. `only`: just these fighters (an online page guessing its own: no scratches). */
export function applyWire(sim: Sim, only?: Sim['fighters']): void {
  const A = sim.arena, W = T.wire;
  if (!A.wire.length) return;
  for (const f of only ?? sim.fighters) {
    const t = f.torso.body.translation();
    const inIt = !f.limp && !f.inBack && A.wire.some((z) => t.x > z.x && t.x < z.x + z.w && t.y > floorAt(A, t.x) - W.height - 0.6); // (its middle low enough to be in the coil, not jumping over it)
    f.snag = inIt ? f.snag + 1 : 0;
    if (!only && inIt && f.snag % Math.round(W.every / T.sim.dt) === 1) sim.scorch(f, W.hurt, 'body');
  }
}

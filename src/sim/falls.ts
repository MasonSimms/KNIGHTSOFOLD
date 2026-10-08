import type { RigidBody } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import type { Sim } from './world';

// The Aqueduct Bridge (Gladiators): water runs along its stone deck, and where a block has been knocked out it pours through the gap: a
// column of falling water that pushes down whatever is in it (someone at the edge of the gap is washed over). The gaps are found from
// where the blocks are (a block well away from its place has gone), so an online copy sees the same falls as the server.

/** The open gaps in the aqueduct's deck: each one's left and right edge, and the deck's height there. */
export function fallsOf(sim: Sim): { x0: number; x1: number; y: number }[] {
  const b = sim.arena.bridge;
  if (!b?.water) return [];
  const half = (b.x1 - b.x0) / b.planks / 2, out: { x0: number; x1: number; y: number }[] = [];
  sim.bridge.forEach((p, i) => {
    const h = sim.bridgeHome[i], t = p.body.isValid() ? p.body.translation() : { x: 1e9, y: 1e9 };
    if (Math.hypot(t.x - h.x, t.y - h.y) > T.aqueduct.gone) out.push({ x0: h.x - half, x1: h.x + half, y: h.y });
  });
  return out;
}

/** Each frame: the falling water pushes down everything in it (only: just these fighters, for an online page guessing its own fighter). */
export function applyFalls(sim: Sim, only?: Sim['fighters']): void {
  const W = T.aqueduct, dt = T.sim.dt;
  for (const f of fallsOf(sim)) {
    const push = (b: RigidBody) => {
      const t = b.translation();
      if (t.x > f.x0 && t.x < f.x1 && t.y > f.y - 0.6 && t.y < f.y + W.fallDepth) b.applyImpulse({ x: 0, y: W.fallPush * b.mass() * dt }, true);
    };
    for (const g of only ?? sim.fighters) for (const p of g.parts) push(p.body);
    if (!only) for (const p of sim.props) if (p.body.isDynamic()) push(p.body);
  }
}

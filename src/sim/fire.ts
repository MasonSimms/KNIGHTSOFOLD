import { tuning as T } from '../content/tuning';
import type { Part } from './fighter';
import { surfaceY } from './water';
import type { Sim } from './world';

// Fire (owner): standing in flames hurts over time and sets you burning for a few seconds, still hurting after you get out (the sea puts
// it out). Wooden weapons and loose wood catch fire too, and a burning one sets alight whoever it touches (a burning club is a torch).
// The arena's fires are arena.fires (a campfire); all the numbers are tuning.fire.

/** In the flames of one of the arena's fires? */
function inFlames(sim: Sim, x: number, y: number): boolean {
  const A = sim.arena;
  for (const z of A.fires) {
    const top = A.platformTop - z.up;
    if (x >= z.x && x <= z.x + z.w && y <= top + 0.1 && y >= top - T.fire.height) return true;
  }
  return false;
}

const flammable = (p: Part) => (p.weapon?.material ?? 'wood') === 'wood' && !p.weapon?.gun;

export function applyFire(sim: Sim): void {
  const F = T.fire, A = sim.arena, dt = T.sim.dt;
  const ignite = (x: number, y: number, owner: number, victim: number) => sim.events.push({ t: 'ignite', x, y, v: 0, owner, victim });
  for (const f of sim.fighters) {
    if (f.limp) { f.burning = 0; continue; }
    if (A.fires.length) for (const p of f.parts) {
      if (p.role === 'stick' || p.role === 'off') continue;
      const t = p.body.translation();
      if (!inFlames(sim, t.x, t.y)) continue;
      if (f.burning === 0) ignite(t.x, t.y, -1, f.index);
      f.burning = F.burnFrames;
      sim.scorch(f, F.flameDps * dt);
      break;
    }
    if (f.wet > T.swim.wetAt && !f.tar) f.burning = 0; // into the sea: out
    if (f.burning > 0) { f.burning--; sim.scorch(f, F.burnDps * dt); }
  }
  // Wood: loose, or in a hand
  const wood: [Part, number][] = sim.props.map((p) => [p, -1]);
  for (const g of sim.fighters) if (g.stick) wood.push([g.stick, g.grip ? g.index : -1]);
  for (const [p, holder] of wood) {
    if (!flammable(p)) continue;
    const t = p.body.translation();
    if (A.fires.length && inFlames(sim, t.x, t.y)) { if (!p.burning) ignite(t.x, t.y, holder, -1); p.burning = F.woodFrames; }
    if (!p.burning) continue;
    if (A.sea && t.y > surfaceY(A, sim.frame, t.x)) { p.burning = 0; continue; }
    p.burning--;
    for (const c of p.colliders) sim.world.contactPairsWith(c, (other) => { // whoever it touches catches fire (not the one holding it)
      const vb = other.parent(), vp = vb && sim.partByBody.get(vb.handle);
      const v = vp && vp.role !== 'prop' && vp.role !== 'stick' ? sim.fighters[vp.owner] : undefined;
      if (!v || v.index === holder || v.limp || v.inBack || v.burning > 0) return;
      sim.world.contactPair(c, other, (m) => {
        if (m.numSolverContacts() === 0 || v.burning > 0) return;
        v.burning = F.burnFrames;
        ignite(t.x, t.y, holder, v.index);
      });
    });
  }
}

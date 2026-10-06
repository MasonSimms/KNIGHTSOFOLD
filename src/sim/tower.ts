import type { RigidBody } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import type { Sim } from './world';

// The Water Tower (owner): a bullet through the side of the tank springs a leak: water jets out of the hole in an arc for a few seconds
// and shoves whatever it catches (off the catwalk, off the tank). The tank is arena.tower; the numbers are tuning.tower.

export interface Jet { x: number; y: number; dir: number; left: number }

/** A bullet hit the ground at (x, y) on a surface facing nx: if that is the tank's side, below its rim, it springs a leak there. */
export function leak(sim: Sim, x: number, y: number, nx: number): void {
  const A = sim.arena, tk = A.tower, W = T.tower;
  if (!tk || x < tk.x - 0.05 || x > tk.x + tk.w + 0.05 || y < A.platformTop + W.rim || Math.abs(nx) < 0.5 || sim.jets.length >= W.maxJets) return;
  sim.jets.push({ x, y, dir: Math.sign(nx), left: W.jetFrames });
  sim.events.push({ t: 'leak', x, y, v: Math.sign(nx), owner: -1, victim: -1 });
}

/** How far the water has dropped `d` metres out from its hole (it falls as it flies). */
export function jetY(j: Jet, d: number): number {
  const t = d / T.tower.jetSpeed;
  return j.y + 0.5 * T.sim.gravity * t * t;
}

/** Each frame: the jets shove what is in their water (harder near the hole), and run dry. */
export function applyJets(sim: Sim): void {
  const W = T.tower, dt = T.sim.dt;
  for (let i = sim.jets.length - 1; i >= 0; i--) {
    const j = sim.jets[i];
    if (--j.left <= 0) { sim.jets.splice(i, 1); continue; }
    const k = Math.min(1, j.left / W.fadeFrames); // (weaker as it runs dry)
    const push = (b: RigidBody): boolean => {
      const t = b.translation(), d = (t.x - j.x) * j.dir;
      if (d < 0 || d > W.reach || Math.abs(t.y - jetY(j, d)) > W.width) return false;
      b.applyImpulse({ x: j.dir * W.push * b.mass() * dt * k * (1 - d / W.reach), y: 0 }, true);
      return true;
    };
    for (const f of sim.fighters) {
      let caught = false;
      for (const p of f.parts) caught = push(p.body) || caught;
      if (caught && !f.limp) f.stun = Math.max(f.stun, W.stagger); // a blast of water knocks you off balance: you cannot dig your heels in
    }
    for (const p of sim.props) if (p.body.isDynamic()) push(p.body);
  }
}

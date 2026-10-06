import { tuning as T } from '../content/tuning';
import type { Arena, Sim } from './world';

// Wind (owner): some maps are windy. It sways capes, grass, smoke, flames, paint and bullet trails a lot (render side), and pushes
// fighters in the air, loose things and bullets a little. It gusts: a steady part plus gusts that come and go, a pure function of the
// frame (the same every time a round is played). The map's own numbers are arena.wind; how hard it pushes is tuning.wind.

/** The wind at a frame (m/s; + blows toward +x). Fractional frames are fine (the renderer blends). */
export function windAt(A: Arena, frame: number): number {
  const w = A.wind;
  if (!w) return 0;
  const t = frame * T.sim.dt;
  const swell = 0.5 + 0.5 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 1.3); // slow rises and falls
  const gust = Math.max(0, Math.sin(t * 1.9 + Math.sin(t * 0.5) * 2)) ** 3; // sharp gusts now and then
  return w.dir * (w.base + w.gust * Math.max(swell, gust));
}

/** Each frame before the physics: the push. A fighter in the air drifts with it (the controls steer relative to it, like a moving floor:
 *  fighter.ts); standing, your feet hold you. The dead, loose things and bullets are simply pushed. */
export function applyWind(sim: Sim): void {
  const A = sim.arena;
  if (!A.wind) return;
  const W = T.wind, k = windAt(A, sim.frame) / W.full, dt = T.sim.dt;
  for (const f of sim.fighters) {
    f.drift = W.drift * k;
    if (f.limp) for (const p of f.parts) p.body.applyImpulse({ x: W.loose * k * p.body.mass() * dt, y: 0 }, true);
  }
  for (const p of sim.props) if (p.body.isDynamic()) p.body.applyImpulse({ x: W.loose * k * p.body.mass() * dt, y: 0 }, true);
  for (const u of sim.bullets) u.vx += W.bullet * k * dt;
}

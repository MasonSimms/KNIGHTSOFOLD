import { Container, Graphics } from 'pixi.js';
import { tuning as T } from '../content/tuning';

// Falling drops of paint or water (a lost limb's drips, a wet fighter, a splash's crown): one pooled list, one Graphics. Looks only.

interface Drop { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; color: number }

export function createDrops(layer: Container, n = 64) {
  const g = new Graphics();
  layer.addChild(g);
  const drops: Drop[] = Array.from({ length: n }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, r: 0, color: 0 }));
  let next = 0;
  return {
    /** A drop of radius r (m) at (x, y), flung at (vx, vy) m/s, falling under gravity for `life` seconds. */
    add(x: number, y: number, r: number, color: number, life: number, vx = 0, vy = 0) { Object.assign(drops[next++ % n], { x, y, vx, vy, life, max: life, r, color }); },
    draw(seconds: number) {
      g.clear();
      for (const d of drops) {
        if (d.life <= 0) continue;
        d.life -= seconds;
        d.vy += T.sim.gravity * seconds; d.x += d.vx * seconds; d.y += d.vy * seconds;
        g.circle(d.x, d.y, d.r).fill({ color: d.color, alpha: Math.min(1, (d.life / d.max) * 3) });
      }
    },
    clear() { for (const d of drops) d.life = 0; g.clear(); },
  };
}
export type Drops = ReturnType<typeof createDrops>;

import { Container, Graphics } from 'pixi.js';
import { tuning as T } from '../content/tuning';
import { jetY } from '../sim/tower';
import { fallsOf } from '../sim/falls';
import type { Sim } from '../sim/world';

// Water leaking from the water tower (sim/tower.ts): an arc from the hole, thick and pale where it leaves, wobbling, thinner as it runs dry.
// And the aqueduct's water pouring through a gap in its deck (sim/falls.ts): a wobbling sheet down out of the picture.

export function createJets(layer: Container) {
  const g = new Graphics();
  layer.addChild(g);
  let time = 0;
  return {
    draw(sim: Sim, seconds: number, wind = 0) {
      time += seconds;
      g.clear();
      const W = T.tower, C = { ...T.finish.jet, windBend: T.finish.wind.jet };
      for (const j of sim.jets) {
        const k = Math.min(1, j.left / W.fadeFrames), pts: number[] = [];
        for (let d = 0; d <= W.reach + 0.6; d += 0.2) pts.push(j.x + j.dir * d + wind * C.windBend * d * d, jetY(j, d) + Math.sin(time * 18 + d * 3) * 0.03 * d); // (the wind bends it)
        g.poly(pts, false).stroke({ width: C.width * k, color: C.color, alpha: C.alpha, cap: 'round', join: 'round' });
        g.poly(pts, false).stroke({ width: C.width * 0.35 * k, color: 0xffffff, alpha: C.alpha, cap: 'round', join: 'round' });
      }
      for (const f of fallsOf(sim)) {
        const w = (f.x1 - f.x0) * 0.8, mid = (f.x0 + f.x1) / 2, bottom = sim.arena.viewH + 1;
        for (let s = -1; s <= 1; s++) { // three strands, wavering as they fall, the middle one palest
          const pts: number[] = [];
          for (let y = f.y - 0.2; y <= bottom; y += 0.4) pts.push(mid + s * w * 0.3 + Math.sin(time * 9 + y * 2.3 + s) * 0.05 + wind * C.windBend * (y - f.y) * 0.3, y);
          g.poly(pts, false).stroke({ width: s ? w * 0.45 : w * 0.55, color: s ? C.color : 0xffffff, alpha: C.alpha * (s ? 1 : 0.7), cap: 'round', join: 'round' });
        }
      }
    },
  };
}

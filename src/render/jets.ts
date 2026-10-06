import { Container, Graphics } from 'pixi.js';
import { tuning as T } from '../content/tuning';
import { jetY } from '../sim/tower';
import type { Sim } from '../sim/world';

// Water leaking from the water tower (sim/tower.ts): an arc from the hole, thick and pale where it leaves, wobbling, thinner as it runs dry.

export function createJets(layer: Container) {
  const g = new Graphics();
  layer.addChild(g);
  let time = 0;
  return {
    draw(sim: Sim, seconds: number) {
      time += seconds;
      g.clear();
      const W = T.tower, C = T.finish.jet;
      for (const j of sim.jets) {
        const k = Math.min(1, j.left / W.fadeFrames), pts: number[] = [];
        for (let d = 0; d <= W.reach + 0.6; d += 0.2) pts.push(j.x + j.dir * d, jetY(j, d) + Math.sin(time * 18 + d * 3) * 0.03 * d);
        g.poly(pts, false).stroke({ width: C.width * k, color: C.color, alpha: C.alpha, cap: 'round', join: 'round' });
        g.poly(pts, false).stroke({ width: C.width * 0.35 * k, color: 0xffffff, alpha: C.alpha, cap: 'round', join: 'round' });
      }
    },
  };
}

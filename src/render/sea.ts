import { Container, Graphics, Sprite } from 'pixi.js';
import { paintingFor } from '../content/paintings';
import { tuning as T } from '../content/tuning';
import { surfaceY } from '../sim/water';
import type { Sim } from '../sim/world';
import { paintedHull, paintedWater } from './painter/sprites';

// The sea on the screen (maps with water): the painted ship, riding where the physics puts it, and the near water in front of the play
// plane, its surface following the waves (submerged bodies and the hull show through it a little). A fighter going in makes a ring.

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function createSea(ring: (x: number, y: number, color: number) => void) {
  const hull = new Container(), water = new Container(); // hull: in the play plane, behind everyone; water: in front of the play plane
  const mask = new Graphics(), crest = new Graphics(), pts: number[] = [];
  water.addChild(mask, crest);
  let ship: Sprite | null = null, sea: Sprite | null = null;
  const wasWet: boolean[] = [];

  return {
    hull, water,
    /** Paint this round's ship and water (a new round or a new era). */
    build(sim: Sim) {
      ship?.destroy(); sea?.destroy(); ship = sea = null;
      const A = sim.arena;
      water.visible = hull.visible = !!A.sea;
      if (!A.sea) return;
      const pa = paintingFor(sim.era), P = T.finish.paint, K = { relief: P.relief, bristle: P.bristle, jitter: P.jitter, under: P.under };
      const top = A.platformTop + A.sea.level - 0.4, h = A.viewH - top + 0.5;
      const wt = paintedWater(A.viewW + 1, h, pa.void[0], pa.void[1], pa.mist, K);
      sea = new Sprite(wt.tex);
      sea.position.set(-0.5, top);
      sea.scale.set(1 / wt.ppm);
      sea.alpha = T.finish.water.alpha;
      sea.mask = mask;
      water.addChildAt(sea, 0);
      if (sim.boat) {
        const h2 = paintedHull(sim.boat.w, sim.boat.depth, A.sea.level, { ...pa.plat, hot: pa.hot }, K);
        ship = new Sprite(h2.tex);
        ship.anchor.set(h2.ax, h2.ay);
        ship.scale.set(1 / h2.ppm);
        hull.addChild(ship);
      }
      wasWet.length = 0;
    },
    draw(sim: Sim, alpha: number) {
      const A = sim.arena, b = sim.boat;
      if (!A.sea || !sea) return;
      if (ship && b) { ship.position.set(lerp(b.px, b.cx, alpha), lerp(b.py, b.cy, alpha)); ship.rotation = b.pa + wrap(b.ca - b.pa) * alpha; }
      // the surface, between the last two frames
      const at = sim.frame - 1 + alpha, step = 0.3;
      pts.length = 0;
      for (let x = -0.5; x <= A.viewW + 0.5 + 1e-6; x += step) pts.push(x, surfaceY(A, at, x));
      mask.clear().poly([...pts, A.viewW + 0.5, A.viewH + 1, -0.5, A.viewH + 1]).fill(0xffffff);
      crest.clear().poly(pts, false).stroke({ width: T.finish.water.crestWidth, color: parseInt(paintingFor(sim.era).mist.slice(1), 16), alpha: T.finish.water.crestAlpha, cap: 'round', join: 'round' });
      for (const f of sim.fighters) { // into the water: a ring where they went in
        const wet = f.wet > T.swim.wetAt;
        if (wet && !wasWet[f.index]) { const t = f.torso.body.translation(); ring(t.x, surfaceY(A, sim.frame, t.x), 0xffffff); }
        wasWet[f.index] = wet;
      }
    },
  };
}

import { Container, Graphics, Sprite } from 'pixi.js';
import { paintingFor } from '../content/paintings';
import { tuning as T } from '../content/tuning';
import type { Part } from '../sim/fighter';
import { surfaceY, tarAt } from '../sim/water';
import type { Sim } from '../sim/world';
import { paintedHull, paintedWater } from './painter/sprites';

// The sea on the screen (maps with water): the painted ship, riding where the physics puts it, and the near water in front of the play
// plane, its surface following the waves (submerged bodies and the hull show through it a little). Anything going in is reported to
// `enter` (a fighter or a loose thing: where, how fast, and whether it is tar) for the ring and the splash.

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function createSea(enter: (x: number, y: number, speed: number, tar: boolean) => void) {
  const hull = new Container(), water = new Container(); // hull: in the play plane, behind everyone; water: in front of the play plane
  const mask = new Graphics(), crest = new Graphics(), pts: number[] = [];
  water.addChild(mask, crest);
  const ships: Sprite[] = [];
  let sea: Sprite | null = null;
  const pits: Sprite[] = []; // tar pits: still, black, glossy
  const wasWet: boolean[] = [];
  const propIn = new WeakMap<Part, boolean>(); // loose things: under the surface last frame?

  return {
    hull, water,
    /** Paint this round's ship and water (a new round or a new era). */
    build(sim: Sim) {
      ships.splice(0).forEach((s) => s.destroy()); sea?.destroy(); sea = null;
      pits.splice(0).forEach((s) => s.destroy());
      const A = sim.arena, P = T.finish.paint, K = { relief: P.relief, bristle: P.bristle, jitter: P.jitter, under: P.under };
      water.visible = !!A.sea || A.tar.length > 0;
      hull.visible = !!A.sea;
      wasWet.length = 0;
      for (const pit of A.tar) { // a pool of tar (or lava) filling the gap, from its surface down out of the picture
        const top = A.platformTop + pit.level, C = pit.lava ? T.finish.lava : T.finish.tar, t = paintedWater(pit.w + 0.1, A.viewH - top + 0.5, C.top, C.deep, C.sheen, K), s = new Sprite(t.tex);
        s.position.set(pit.x - 0.05, top);
        s.scale.set(1 / t.ppm);
        s.alpha = C.alpha;
        water.addChild(s);
        pits.push(s);
      }
      if (!A.sea) return;
      const pa = paintingFor(sim.era);
      const top = A.platformTop + A.sea.level - (A.sea.tide?.rise ?? 0) - 0.4, h = A.viewH - top + 0.5; // (as high as the tide will come)
      const wt = paintedWater(A.viewW + 1, h, pa.void[0], pa.void[1], pa.mist, K);
      sea = new Sprite(wt.tex);
      sea.position.set(-0.5, top);
      sea.scale.set(1 / wt.ppm);
      sea.alpha = T.finish.water.alpha;
      sea.mask = mask;
      water.addChildAt(sea, 0);
      sim.boats.forEach((b, i) => {
        const h2 = paintedHull(b.w, b.depth, A.sea!.level, { ...pa.plat, hot: pa.hot }, K, A.boats[i]?.look), ship = new Sprite(h2.tex);
        ship.anchor.set(h2.ax, h2.ay);
        ship.scale.set(1 / h2.ppm);
        hull.addChild(ship);
        ships.push(ship);
      });
    },
    draw(sim: Sim, alpha: number) {
      const A = sim.arena;
      for (const f of sim.fighters) { // into the water (or the tar): a splash where they went in
        const wet = f.wet > T.swim.wetAt;
        if (wet && !wasWet[f.index]) { const t = f.torso; enter(t.cx, surfaceY(A, sim.frame, t.cx), (t.cy - t.py) * 60, f.tar); }
        wasWet[f.index] = wet;
      }
      if (sim.frame > 5) for (const p of sim.props) { // loose things going in (not what starts the round under the surface)
        const tar = tarAt(A, p.cx), inside = (!!A.sea || !!tar) && p.cy > surfaceY(A, sim.frame, p.cx);
        if (inside && !propIn.get(p)) enter(p.cx, surfaceY(A, sim.frame, p.cx), (p.cy - p.py) * 60, !!tar);
        propIn.set(p, inside);
      }
      if (!A.sea || !sea) return;
      sim.boats.forEach((b, k) => { const ship = ships[k]; if (ship) { ship.position.set(lerp(b.px, b.cx, alpha), lerp(b.py, b.cy, alpha)); ship.rotation = b.pa + wrap(b.ca - b.pa) * alpha; } });
      // the surface, between the last two frames
      const at = sim.frame - 1 + alpha, step = 0.3;
      pts.length = 0;
      for (let x = -0.5; x <= A.viewW + 0.5 + 1e-6; x += step) pts.push(x, surfaceY(A, at, x));
      mask.clear().poly([...pts, A.viewW + 0.5, A.viewH + 1, -0.5, A.viewH + 1]).fill(0xffffff);
      crest.clear().poly(pts, false).stroke({ width: T.finish.water.crestWidth, color: parseInt(paintingFor(sim.era).mist.slice(1), 16), alpha: T.finish.water.crestAlpha, cap: 'round', join: 'round' });
    },
  };
}

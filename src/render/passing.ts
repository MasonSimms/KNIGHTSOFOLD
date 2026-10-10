import { Container, Sprite } from 'pixi.js';
import { tuning as T } from '../content/tuning';
import { passingAt } from '../sim/train';
import type { Sim } from '../sim/world';
import { paintedBox, paintedShape, paintKnobs, PPM } from './painter/sprites';

// The train (sim/train.ts): its cars (standing still: the land moves past them) and what passes it, a wooden sign hanging from a post
// and a tunnel's stone mouth, drawn where the sim says they are.

export function createPassing(layer: Container) {
  const items: { kind: 'sign' | 'tunnel'; k: Container }[] = [];
  let cars = new Container();
  return {
    /** cars: where the train's cars go (behind the fighters). */
    build(sim: Sim, carLayer: Container) {
      for (const it of items) it.k.destroy({ children: true });
      items.length = 0;
      cars.destroy({ children: true });
      cars = new Container();
      carLayer.addChild(cars);
      const K = paintKnobs(), A = sim.arena;
      if (A.train) for (const g of A.ground) { // a boxcar: its body under the roof you fight on, and its wheels
        const body = new Sprite(paintedBox(g.w / 2, A.platformThickness / 2, T.colors.things.car, K)[0]);
        body.anchor.set(0.5); body.width = g.w; body.height = A.platformThickness; body.position.set(g.x + g.w / 2, A.platformTop + A.platformThickness / 2);
        cars.addChild(body);
        for (const wx of [g.x + 0.9, g.x + 1.7, g.x + g.w - 1.7, g.x + g.w - 0.9]) {
          const w = new Sprite(paintedShape({ k: 'ball', r: 0.32 }, T.colors.things.wheel, K)[0]);
          w.anchor.set(0.5); w.scale.set(1 / PPM); w.position.set(wx, A.platformTop + A.platformThickness + 0.15);
          cars.addChild(w);
        }
      }
      for (const q of passingAt(sim.arena, 0)) {
        const k = new Container(), C = T.colors.things;
        const add = (hw: number, hh: number, color: number, y: number) => {
          const tex = paintedBox(hw, hh, color, K)[0], s = new Sprite(tex);
          s.anchor.set(0.5); s.width = hw * 2; s.height = hh * 2; s.y = y;
          k.addChild(s);
        };
        if (q.kind === 'sign') { add(0.06, (q.y + 1) / 2, C.post, -(q.y + 1) / 2 - q.hh); add(q.hw, q.hh, C.sign, 0); } // the post it hangs from, down from above the picture
        else add(q.hw, q.hh, C.tunnel, 0);
        layer.addChild(k);
        items.push({ kind: q.kind, k });
      }
    },
    draw(sim: Sim, alpha: number) {
      if (!items.length) return;
      passingAt(sim.arena, sim.frame - 1 + alpha).forEach((q, i) => items[i]?.k.position.set(q.x, q.y));
    },
  };
}

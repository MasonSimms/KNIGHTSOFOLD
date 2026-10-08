import { Container, Graphics, Sprite } from 'pixi.js';
import { tuning as T } from '../content/tuning';
import { chariotAt } from '../sim/chariot';
import type { Sim } from '../sim/world';
import { paintedChariot } from './painter/sprites';

// The runaway chariot (sim/chariot.ts): drawn where the sim says it is, facing the way it runs, with dust rising at its edge of the
// picture just before it comes in and kicked up behind it as it goes.

export function createChariot(layer: Container) {
  const dust = new Graphics();
  layer.addChild(dust);
  let sprite: Sprite | null = null, ppm = 1;
  return {
    build(sim: Sim) {
      sprite?.destroy();
      sprite = null;
      if (!sim.arena.chariot) return;
      const P = T.finish.paint, H = T.chariot, C = T.colors.things;
      const t = paintedChariot(H.len, H.height, C.chariot, C.horse, { relief: P.relief, bristle: P.bristle, jitter: P.jitter, under: P.under });
      sprite = new Sprite(t.tex);
      sprite.anchor.set(0.5);
      ppm = t.ppm;
      layer.addChild(sprite);
    },
    draw(sim: Sim, alpha: number) {
      dust.clear();
      if (!sprite) return;
      const A = sim.arena, at = sim.frame - 1 + alpha, c = chariotAt(A, at), soon = chariotAt(A, at + T.chariot.tell / T.sim.dt);
      sprite.visible = c.dir !== 0;
      sprite.position.set(c.x, c.y);
      sprite.scale.set((c.dir || 1) / ppm, 1 / ppm);
      const puff = (x: number, n: number, spread: number) => { for (let i = 0; i < n; i++) { const r = 0.25 + ((i * 0.37 + at * 0.01) % 1) * 0.35; dust.circle(x + Math.sin(i * 2.1 + at * 0.05) * spread, A.platformTop - r * 0.8 - (i % 3) * 0.2, r).fill({ color: 0xc8b48e, alpha: 0.35 }); } };
      if (soon.dir && !c.dir) puff(soon.dir > 0 ? 0.3 : A.viewW - 0.3, 6, 0.5); // coming: dust at its edge of the picture
      if (c.dir) puff(c.x - c.dir * (T.chariot.len / 2 + 0.4), 4, 0.4); // going: dust behind it
    },
  };
}

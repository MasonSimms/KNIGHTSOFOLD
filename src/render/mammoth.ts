import { Container, Sprite } from 'pixi.js';
import { tuning as T } from '../content/tuning';
import { mammothPose } from '../sim/chase';
import type { Sim } from '../sim/world';
import { paintedMammoth, paintKnobs } from './painter/sprites';

// The woolly mammoth of the Mammoth Chase, galloping at the left edge (where the sim says it is: sim/chase.ts mammothPose).

export function createMammoth(layer: Container) {
  const s = new Sprite();
  s.anchor.set(0.5);
  s.visible = false;
  layer.addChild(s);
  return {
    build(sim: Sim) {
      s.visible = !!sim.arena.chase;
      if (!s.visible) return;
      const m = paintedMammoth(T.chase.length, T.chase.height, paintKnobs());
      s.texture = m.tex;
      s.scale.set(1 / m.ppm);
    },
    draw(sim: Sim, alpha: number) {
      if (!s.visible) return;
      const p = mammothPose(sim.arena, sim.frame - 1 + alpha);
      s.position.set(p.x, p.y);
      s.rotation = p.rot;
    },
  };
}

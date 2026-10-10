import { Container, Sprite } from 'pixi.js';
import { tuning as T } from '../content/tuning';
import { doorPose } from '../sim/trapdoor';
import type { Sim } from '../sim/world';
import { paintedBox, paintKnobs } from './painter/sprites';

// The trapdoors in the floor (sim/trapdoor.ts): painted wooden doors, drawn where the sim says they are (shut, rattling, or hanging open).

export function createDoors(layer: Container) {
  const sprites: Sprite[] = [];
  return {
    build(sim: Sim) {
      for (const s of sprites) s.destroy();
      sprites.length = 0;
      const K = paintKnobs();
      for (const d of sim.arena.trapdoors) {
        const s = new Sprite(paintedBox(d.w / 2, T.trapdoor.thick / 2, T.colors.things.trapdoor, K)[0]);
        s.anchor.set(0.5); s.width = d.w; s.height = T.trapdoor.thick;
        layer.addChild(s);
        sprites.push(s);
      }
    },
    draw(sim: Sim, alpha: number) {
      sim.arena.trapdoors.forEach((d, i) => { const p = doorPose(sim.arena, d, sim.frame - 1 + alpha), s = sprites[i]; if (s) { s.position.set(p.x, p.y); s.rotation = p.rot; } });
    },
  };
}

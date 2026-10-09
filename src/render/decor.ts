import { Container, Sprite } from 'pixi.js';
import { tuning as T } from '../content/tuning';
import { WEAPON_ART } from '../content/weaponArt';
import { floorAt } from '../sim/world';
import type { Sim } from '../sim/world';
import { paintedWeapon, PPM } from './painter/sprites';

// A map's painted scenery that is not in the game (arena.decor): a torii gate standing behind the fighters. Its picture is a weaponArt.ts
// drawing whose y = 0 is its foot; it stands on the floor under it, `up` higher. Looks only: the simulation never sees it. And the coils
// of barbed wire (arena.wire: the simulation snags whoever is in them, sim/wire.ts).

export function createDecor(layer: Container) {
  return {
    build(sim: Sim) {
      for (const c of layer.removeChildren()) c.destroy();
      const A = sim.arena, P = T.finish.paint, K = { relief: P.relief, bristle: P.bristle, jitter: P.jitter, under: P.under };
      for (const d of A.decor) {
        const art = WEAPON_ART[d.kind], pic = art && paintedWeapon(d.kind, art.len, K, true);
        if (!pic) continue;
        const s = new Sprite(pic.tex[0]);
        s.anchor.set(pic.ax, pic.ay);
        s.scale.set(1 / pic.ppm);
        s.position.set(d.x, floorAt(A, d.x) - d.up);
        layer.addChild(s);
      }
      for (const z of A.wire) { // barbed wire (sim/wire.ts): its coils, about a metre each, across its width
        const n = Math.max(1, Math.round(z.w)), pic = paintedWeapon('wire', z.w / n, K, true);
        for (let i = 0; pic && i < n; i++) {
          const s = new Sprite(pic.tex[0]), x = z.x + ((i + 0.5) * z.w) / n;
          s.anchor.set(pic.ax, pic.ay);
          s.scale.set(1 / pic.ppm);
          s.position.set(x, floorAt(A, x));
          layer.addChild(s);
        }
      }
    },
  };
}

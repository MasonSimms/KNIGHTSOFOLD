import { Container, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { tuning as T } from '../content/tuning';
import type { Part } from '../sim/fighter';
import type { Sim } from '../sim/world';
import { paintedFlame, paintedShape, paintKnobs, PPM } from './painter/sprites';

// Fire on the screen (sim/fire.ts decides what burns): the arena's fires are crossed logs under a bed of painted flames that flicker
// (each flame stretches and shrinks on its own rhythm, and the brush strokes boil), and anything burning carries small flames of its own.

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function createFlames(layer: Container) {
  const beds = new Container(), K = paintKnobs;
  layer.addChild(beds);
  let tex: Texture[] = [], time = 0;
  const bed: { s: Sprite; h: number; f: number; ph: number }[] = [];
  const pool: Sprite[] = [];
  const flame = (i: number) => {
    while (pool.length <= i) { const s = new Sprite(); s.anchor.set(0.5, 1); layer.addChild(s); pool.push(s); }
    return pool[i];
  };
  const flick = (f: number, ph: number) => 0.8 + 0.12 * Math.sin(time * f + ph) + 0.08 * Math.sin(time * f * 2.3 + ph * 1.7);

  return {
    /** This round's fires (a new round or a new era). */
    build(sim: Sim) {
      beds.removeChildren().forEach((c) => c.destroy());
      bed.length = 0;
      const A = sim.arena;
      if (!A.fires.length && !tex.length) return; // (nothing burns until a map has a fire)
      tex = paintedFlame(K());
      const log = paintedShape({ k: 'cap', r: 0.07, hl: 0.4 }, 0x4a2e1a, K());
      for (const z of A.fires) {
        const top = A.platformTop - z.up;
        for (const [dx, rot] of [[-0.12, 1.2], [0.12, -1.2]]) { // two logs crossed
          const s = new Sprite(log[0]);
          s.anchor.set(0.5); s.scale.set(1 / PPM); s.rotation = rot; s.position.set(z.x + z.w / 2 + dx, top - 0.06);
          beds.addChild(s);
        }
        const n = Math.max(3, Math.round(z.w / 0.2));
        for (let i = 0; i < n; i++) {
          const s = new Sprite(tex[i % tex.length]), mid = 1 - Math.abs((i + 0.5) / n - 0.5) * 1.4; // taller in the middle
          s.anchor.set(0.5, 1); s.position.set(z.x + ((i + 0.5) / n) * z.w, top + 0.02);
          beds.addChild(s);
          bed.push({ s, h: (T.fire.height / 0.6) * 1.25 * mid, f: 7 + (i * 2.9) % 5, ph: i * 1.3 });
        }
      }
    },
    draw(sim: Sim, alpha: number, seconds: number, variant: number, wind = 0) {
      const lean = Math.max(-0.6, Math.min(0.6, wind * T.finish.wind.flame)); // flames lean with the wind
      time += seconds;
      for (const b of bed) { b.s.rotation = lean * (0.8 + 0.2 * flick(b.f, b.ph)); b.s.texture = tex[variant % tex.length]; b.s.scale.set(b.h * (0.9 + 0.1 * flick(b.f * 0.7, b.ph)) / PPM, b.h * flick(b.f, b.ph) / PPM); }
      let n = 0;
      const on = (p: Part, size: number, along = 0) => { // a small flame on a burning part, at `along` metres from its middle
        if (!tex.length) tex = paintedFlame(K());
        const x = lerp(p.px, p.cx, alpha), y = lerp(p.py, p.cy, alpha), a = p.pa + (p.ca - p.pa) * alpha;
        const s = flame(n++);
        s.visible = true; s.texture = tex[(variant + n) % tex.length]; s.rotation = lean;
        s.position.set(x + Math.cos(a) * along, y + Math.sin(a) * along + 0.05);
        s.scale.set(size / PPM, (size * flick(8 + n, n)) / PPM);
      };
      for (const f of sim.fighters) {
        if (f.burning > 0 && !f.limp) for (const p of f.parts) if (p.role === 'torso' || p.role === 'head' || p.role === 'thigh') on(p, p.role === 'torso' ? 1.3 : 0.9);
        if (f.stick?.burning) on(f.stick, 0.9, (f.stick.weapon?.length ?? 1) * 0.3);
      }
      for (const p of sim.props) if (p.burning) { on(p, 0.8, -(p.weapon?.length ?? 1) * 0.2); on(p, 0.9, (p.weapon?.length ?? 1) * 0.2); }
      for (let i = n; i < pool.length; i++) pool[i].visible = false;
    },
  };
}

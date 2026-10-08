import { Container, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { tuning as T } from '../content/tuning';
import type { Part } from '../sim/fighter';
import type { SimEvent } from '../sim/types';
import type { Sim } from '../sim/world';
import type { Drops } from './drops';

// A lost limb (owner's visuals handoff, effects): paint drips from its cut end for a few seconds, and where it comes to rest it lies in a
// small pool of its owner's paint (on the paint layer, under everyone, like the splats). Looks only; everything is pooled.

interface Lost { part: Part; color: number; left: number; still: number; pooled: boolean; ex: number; ey: number } // ex, ey: the cut end, in the part's own frame

export function createLimbs(paintLayer: Container, drops: Drops, splatTex: Texture[]) {
  const pools = Array.from({ length: 8 }, (_, i) => { const s = new Sprite(splatTex[i % splatTex.length]); s.anchor.set(0.5, 0.35); s.visible = false; paintLayer.addChild(s); return s; });
  let nextPool = 0;
  const lost: Lost[] = [];

  return {
    /** A limb came off: the victim's loose head, upper arm or thigh nearest the event starts dripping (`color`: the victim's paint). */
    onEvent(e: SimEvent, sim: Sim, color: number) {
      if (e.t !== 'dismember') return;
      const f = sim.fighters[e.victim];
      if (!f) return;
      let best: Part | undefined, bd = 0.5;
      for (const p of f.parts) {
        if (p.role !== 'head' && p.role !== 'upper' && p.role !== 'thigh') continue;
        const d = Math.hypot(p.cx - e.x, p.cy - e.y);
        if (d < bd) { bd = d; best = p; }
      }
      if (!best || lost.some((l) => l.part === best)) return;
      const F = T.fighter, end = best.role === 'head' ? [0, F.headRadius] : best.role === 'upper' ? [-F.armLength / 2, 0] : [0, -T.legs.thigh / 2]; // the neck, the shoulder, the hip
      lost.push({ part: best, color, left: T.finish.hits.dripSeconds, still: 0, pooled: false, ex: end[0], ey: end[1] });
    },
    /** Each frame, after the fighters have moved. */
    draw(alpha: number, seconds: number) {
      const H = T.finish.hits;
      for (let i = lost.length - 1; i >= 0; i--) {
        const l = lost[i], p = l.part, x = p.px + (p.cx - p.px) * alpha, y = p.py + (p.cy - p.py) * alpha, c = Math.cos(p.ca), s = Math.sin(p.ca);
        if (l.left > 0 && Math.random() < seconds * H.dripsPerSecond) drops.add(x + l.ex * c - l.ey * s, y + l.ex * s + l.ey * c, H.drop, l.color, H.dropSeconds); // a drop falls from the cut end
        l.left -= seconds;
        l.still = Math.hypot(p.cx - p.px, p.cy - p.py) > 0.003 ? 0 : l.still + seconds;
        if (!l.pooled && l.still >= H.poolAfter) { // it has come to rest: a pool of paint under it
          l.pooled = true;
          const sp = pools[nextPool++ % pools.length];
          sp.position.set(x, y + H.poolDrop); sp.scale.set(H.pool / 100 / 45); sp.rotation = (Math.random() - 0.5) * 0.3; sp.tint = l.color; sp.alpha = T.splat.alpha; sp.visible = true;
        }
        if (l.left <= 0 && l.pooled) lost.splice(i, 1);
      }
    },
    /** A new round: nothing carries over. */
    clear() { lost.length = 0; for (const s of pools) s.visible = false; },
  };
}

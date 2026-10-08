import { Container, Graphics } from 'pixi.js';
import { paintingFor } from '../content/paintings';
import { tuning as T } from '../content/tuning';
import type { SimEvent } from '../sim/types';

// Motion on the screen (owner's visuals handoff, effects): a tapered cream brushstroke trailing a weapon's tip through a fast swing (the
// era's hot colour after a charged swing), a cream dab where any hit lands (a big burst with a red core for a big hit), and dust kicked
// up off the floor in the floor's own colour: a landing (more the harder), a wall jump's scuff, a dodge's push-off, a stomp's ring.
// Looks only; everything is pooled.

type Puff = (x: number, y: number, size: number, color: number, alpha: number, life: number, rise: number) => void;
const KEEP = 16; // tip positions remembered per fighter (more than any trail is long)
const CREAM = 0xf1e8d2, CORE = 0xc8282c;
const hex = (s: string) => parseInt(s.slice(1), 16);

/** A four-pointed star, radius 1 (a painter's dab of light). */
const star = (g: Graphics, color: number, r = 1) => g.poly([0, -r, 0.22 * r, -0.22 * r, r, 0, 0.22 * r, 0.22 * r, 0, r, -0.22 * r, 0.22 * r, -r, 0, -0.22 * r, -0.22 * r]).fill(color);

export function createMotion(layer: Container, puff: Puff) {
  const trails = new Graphics();
  layer.addChild(trails);
  const tips = Array.from({ length: 4 }, () => ({ xs: new Float32Array(KEEP), ys: new Float32Array(KEEP), n: 0, seen: false, hot: false }));
  const dabs = Array.from({ length: 12 }, () => {
    const g = new Graphics(), core = new Graphics();
    star(g, CREAM); core.circle(0, 0, 0.32).fill(CORE); // (the core shows only on a big hit)
    g.addChild(core);
    g.visible = false;
    layer.addChild(g);
    return { g, core, age: 1, size: 0 };
  });
  let nextDab = 0;

  const dab = (x: number, y: number, big: boolean) => {
    const M = T.finish.motion, d = dabs[nextDab++ % dabs.length];
    d.g.position.set(x, y); d.g.rotation = Math.random() * Math.PI; d.g.visible = true; d.core.visible = big;
    d.age = 0; d.size = (big ? M.bigDab : M.dab) / 2;
  };
  /** Dust off the floor around (x, y): `n` puffs spread `w` either side. */
  const dust = (x: number, y: number, n: number, w: number, size: number, color: number) => {
    for (let i = 0; i < n; i++) puff(x + (n > 1 ? (i / (n - 1) - 0.5) * 2 * w : 0), y - 0.05, size * (0.8 + Math.random() * 0.4), color, T.finish.motion.dust, 0.5 + Math.random() * 0.25, 0.25 + Math.random() * 0.2);
  };

  return {
    onEvent(e: SimEvent, era: string) {
      const M = T.finish.motion, ground = hex(paintingFor(era).plat.lip);
      if (e.t === 'hit' || e.t === 'stomp') dab(e.x, e.y, e.v >= M.bigImpact);
      if (e.t === 'land') { const k = Math.min(1, Math.max(0, (e.v - M.landMin) / (M.landFull - M.landMin))); if (e.v >= M.landMin) dust(e.x, e.y, 2 + Math.round(3 * k), 0.15 + 0.3 * k, 0.25 + 0.3 * k, ground); }
      else if (e.t === 'jump' && e.v !== 0) dust(e.x + e.v * 0.22, e.y, 2, 0.04, 0.22, ground); // a wall jump: a scuff off the wall
      else if (e.t === 'dodge') dust(e.x, e.y + T.stand.height, 2, 0.12, 0.2, ground); // the push-off
      else if (e.t === 'stomp') for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; puff(e.x + Math.cos(a) * 0.35, e.y + Math.sin(a) * 0.15, 0.3, ground, M.dust, 0.55, 0.15); } // a ring of dust
    },
    /** This frame, fighter i's weapon tip is at (x, y); `armed`: swinging it in a hand; `hot`: after a charged swing. */
    track(i: number, x: number, y: number, armed: boolean, hot: boolean) {
      const t = tips[i];
      if (!t) return;
      if (!armed) { t.n = 0; return; }
      t.xs.copyWithin(1, 0); t.ys.copyWithin(1, 0); // (newest first)
      t.xs[0] = x; t.ys[0] = y; t.n = Math.min(KEEP, t.n + 1); t.seen = true; t.hot = hot;
    },
    /** Each frame, after the fighters have moved: the trails and the dabs. */
    draw(seconds: number, era: string) {
      const M = T.finish.motion, hot = hex(paintingFor(era).hot);
      trails.clear();
      for (const t of tips) {
        if (!t.seen) { t.n = 0; continue; } // (not tracked this frame: no weapon in hand)
        t.seen = false;
        const n = Math.min(t.n, M.trailFrames);
        if (n < 3 || seconds <= 0 || Math.hypot(t.xs[0] - t.xs[1], t.ys[0] - t.ys[1]) / seconds < M.trailSpeed) continue; // only through a fast swing
        const left: number[] = [], right: number[] = [];
        for (let k = 0; k < n; k++) { // the stroke's edges, narrowing from the tip back to nothing
          const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1), dx = t.xs[a] - t.xs[b], dy = t.ys[a] - t.ys[b], d = Math.hypot(dx, dy) || 1, w = (M.trailWidth / 2) * (1 - k / (n - 1));
          left.push(t.xs[k] - (dy / d) * w, t.ys[k] + (dx / d) * w);
          right.unshift(t.xs[k] + (dy / d) * w, t.ys[k] - (dx / d) * w);
        }
        trails.poly([...left, ...right]).fill({ color: t.hot ? hot : CREAM, alpha: M.trailAlpha });
      }
      for (const d of dabs) {
        if (!d.g.visible) continue;
        d.age += seconds / M.dabSeconds;
        if (d.age >= 1) { d.g.visible = false; continue; }
        d.g.scale.set(d.size * (0.6 + 0.6 * d.age));
        d.g.alpha = 1 - d.age * d.age;
      }
    },
    /** A new round: nothing carries over. */
    clear() { for (const t of tips) t.n = 0; for (const d of dabs) d.g.visible = false; trails.clear(); },
  };
}

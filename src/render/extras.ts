import { Container, Graphics } from 'pixi.js';
import { paintingFor } from '../content/paintings';
import { PROPS } from '../content/props';
import { tuning as T } from '../content/tuning';
import { surfaceY, tarAt } from '../sim/water';
import type { SimEvent } from '../sim/types';
import type { Sim } from '../sim/world';
import type { Drops } from './drops';

// Water and era extras (owner's visuals handoff, effects): a crown of water and ripples where something falls in, drips off anyone who came
// out of the water, slow thick bubbles plopping on a tar pit, a cyan energy spark on every Space Age hit, and purple rings closing inward
// where the Gravity Hammer lands. Looks only; nothing is allocated while playing beyond a few small records.

const hex = (s: string) => parseInt(s.slice(1), 16);
interface Ripple { x: number; y: number; age: number; color: number }
interface Bubble { x: number; y: number; age: number }
interface Spark { x: number; y: number; age: number; a: number }
interface Pull { x: number; y: number; age: number }

export function createExtras(fxLayer: Container, drops: Drops) {
  const surface = new Container(), onWater = new Graphics(), g = new Graphics(); // surface: in front of the water (ripples, bubbles); g: with the other effects
  surface.addChild(onWater);
  fxLayer.addChild(g);
  const ripples: Ripple[] = [], bubbles: Bubble[] = [], sparks: Spark[] = [], pulls: Pull[] = [];
  const wetLeft: number[] = [0, 0, 0, 0], wetTar: boolean[] = [false, false, false, false]; // per fighter: seconds of dripping left, and whether it is tar
  let bubbleIn = 0;
  const waterColor = (sim: Sim, tar: boolean) => (tar ? hex(T.finish.tar.sheen) : hex(paintingFor(sim.era).mist));

  return {
    surface,
    /** Something went into the water (or the tar) at (x, y) at `speed` m/s: a crown of drops (the faster, the higher) and two ripples. */
    splash(sim: Sim, x: number, y: number, speed: number, tar: boolean) {
      const X = T.finish.extras, k = Math.min(1, speed / X.crownSpeed), color = waterColor(sim, tar);
      for (let i = 0, n = Math.round(X.crownDrops * (0.3 + 0.7 * k)); i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, s = X.crownRise * (0.4 + 0.6 * k) * (0.6 + Math.random() * 0.6);
        drops.add(x, y, 0.02 + Math.random() * 0.025, color, 0.7, Math.cos(a) * s, Math.sin(a) * s);
      }
      ripples.push({ x, y, age: 0, color }, { x, y, age: -0.25, color });
    },
    onEvent(e: SimEvent, sim: Sim) {
      if (e.t !== 'hit') return;
      if (sim.era === 'scifi') sparks.push({ x: e.x, y: e.y, age: 0, a: Math.random() * Math.PI });
      if (PROPS[e.w ?? '']?.pull) pulls.push({ x: e.x, y: e.y, age: 0 });
    },
    draw(sim: Sim, seconds: number) {
      const X = T.finish.extras, A = sim.arena;
      // dripping wet: anyone who came out of the water drips for a while
      for (const f of sim.fighters) {
        if (f.wet > 0.05) { wetLeft[f.index] = X.dripSeconds; wetTar[f.index] = f.tar; continue; }
        if (wetLeft[f.index] <= 0) continue;
        wetLeft[f.index] -= seconds;
        if (Math.random() < seconds * X.dripsPerSecond) { const p = f.parts[Math.floor(Math.random() * f.parts.length)]; drops.add(p.cx + (Math.random() - 0.5) * 0.1, p.cy + 0.05, 0.02, waterColor(sim, wetTar[f.index]), 0.5); }
      }
      // tar: every so often a thick bubble swells on a pit and plops
      if (A.tar.length && (bubbleIn -= seconds) <= 0) {
        bubbleIn = X.bubbleEvery * (0.5 + Math.random());
        const pit = A.tar[Math.floor(Math.random() * A.tar.length)], x = pit.x + 0.2 + Math.random() * (pit.w - 0.4);
        bubbles.push({ x, y: surfaceY(A, sim.frame, x), age: 0 });
      }
      onWater.clear();
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i], k = (b.age += seconds) / X.bubbleSeconds;
        if (k >= 1) { bubbles.splice(i, 1); ripples.push({ x: b.x, y: b.y, age: 0.3, color: hex(T.finish.tar.sheen) }); drops.add(b.x, b.y - 0.1, 0.03, hex(T.finish.tar.top), 0.5, (Math.random() - 0.5) * 0.6, -1.2); continue; } // the plop
        const r = X.bubble * Math.sqrt(k);
        onWater.circle(b.x, b.y, r).fill({ color: hex(T.finish.tar.top), alpha: 0.95 }).circle(b.x - r * 0.35, b.y - r * 0.35, r * 0.25).fill({ color: hex(T.finish.tar.sheen), alpha: 0.6 });
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i], k = (r.age += seconds) / X.rippleSeconds;
        if (k >= 1) { ripples.splice(i, 1); continue; }
        if (k < 0) continue;
        const rx = 0.15 + X.ripple * k;
        onWater.ellipse(r.x, r.y, rx, rx * 0.22).stroke({ width: 0.03, color: r.color, alpha: 0.7 * (1 - k) });
      }
      g.clear();
      for (let i = sparks.length - 1; i >= 0; i--) { // Space Age: a cyan X of light, a white core
        const s = sparks[i], k = (s.age += seconds) / X.sparkSeconds;
        if (k >= 1) { sparks.splice(i, 1); continue; }
        const L = X.spark * (0.5 + 0.5 * k);
        for (let j = 0; j < 4; j++) { const a = s.a + (j * Math.PI) / 2 + 0.3; g.moveTo(s.x, s.y).lineTo(s.x + Math.cos(a) * L, s.y + Math.sin(a) * L).stroke({ width: 0.03, color: 0x7ff6ff, alpha: 1 - k, cap: 'round' }); }
        g.circle(s.x, s.y, 0.05 * (1 - k) + 0.02).fill({ color: 0xffffff, alpha: 1 - k });
      }
      for (let i = pulls.length - 1; i >= 0; i--) { // the Gravity Hammer: three rings closing inward
        const p = pulls[i], k = (p.age += seconds) / X.pullSeconds;
        if (k >= 1) { pulls.splice(i, 1); continue; }
        for (let j = 0; j < 3; j++) { const kj = Math.min(1, Math.max(0, k * 1.3 - j * 0.15)); g.circle(p.x, p.y, X.pull * (1 - kj) + 0.05).stroke({ width: 0.035, color: 0x8f6fe8, alpha: 0.8 * (1 - kj) }); }
      }
    },
    /** A new round: nothing carries over. */
    clear() { ripples.length = 0; bubbles.length = 0; sparks.length = 0; pulls.length = 0; wetLeft.fill(0); onWater.clear(); g.clear(); },
  };
}

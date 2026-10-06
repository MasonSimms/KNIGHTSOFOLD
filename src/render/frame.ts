import { Container, Graphics, TilingSprite } from 'pixi.js';
import { tuning as T } from '../content/tuning';
import type { SimEvent } from '../sim/types';
import { paintedMoulding } from './painter/sprites';
import type { SpriteKnobs } from './painter/sprites';

// The painting's frame (owner): a thin carved gold frame around the game picture. Someone knocked out of the picture through it (and
// killed) smashes it there: a jagged hole with cracks running along the frame and gold splinters flying. A bullet leaving the picture
// chips a small crack. The damage lasts the round (each era is its own painting). Decoration only: nothing in the fight touches it.

type Edge = 0 | 1 | 2 | 3; // top, right, bottom, left
interface Damage { edge: Edge; t: number; hole: boolean; size: number; jag: number[] }
interface Shard { g: Graphics; x: number; y: number; vx: number; vy: number; spin: number; life: number; max: number }
export interface Box { x: number; y: number; w: number; h: number }

const GOLD_LIGHT = 0xf2d48a, CRACK = 0x2a1a08, BEHIND = 0x141018;

export function createFrame(parent: Container, K: SpriteKnobs) {
  const root = new Container();
  parent.addChild(root);
  const tex = paintedMoulding(K);
  const sides = [0, 1, 2, 3].map(() => { const s = new TilingSprite({ texture: tex, width: 1, height: 1 }); root.addChild(s); return s; });
  const marks = new Graphics();
  root.addChild(marks);
  const shards: Shard[] = Array.from({ length: 48 }, () => { const g = new Graphics(); g.visible = false; root.addChild(g); return { g, x: 0, y: 0, vx: 0, vy: 0, spin: 0, life: 0, max: 1 }; });
  let nextShard = 0;
  const damage: Damage[] = [];
  let box: Box = { x: 0, y: 0, w: 1, h: 1 }, th = 1, dirty = true;

  /** A point along an edge (t: 0..1 left to right, or top to bottom), its direction along the edge and inward into the picture. */
  const at = (edge: Edge, t: number) => {
    const { x, y, w, h } = box;
    return edge === 0 ? { x: x + t * w, y, ax: 1, ay: 0, ix: 0, iy: 1 }
      : edge === 1 ? { x: x + w, y: y + t * h, ax: 0, ay: 1, ix: -1, iy: 0 }
      : edge === 2 ? { x: x + t * w, y: y + h, ax: 1, ay: 0, ix: 0, iy: -1 }
      : { x, y: y + t * h, ax: 0, ay: 1, ix: 1, iy: 0 };
  };

  const shard = (x: number, y: number, vx: number, vy: number, size: number) => {
    const s = shards[nextShard++ % shards.length];
    s.g.clear().poly([-size, -size * 0.4, size, 0, -size, size * 0.4]).fill(Math.random() < 0.5 ? GOLD_LIGHT : 0xb38a35);
    s.g.visible = true; s.g.alpha = 1;
    Object.assign(s, { x, y, vx, vy, spin: (Math.random() - 0.5) * 20, life: 0.9, max: 0.9 });
  };

  /** Damage at an edge: a hole (someone went through) or a crack (a bullet), with splinters flying out along `dir` (+1 out, -1 in). */
  const hit = (edge: Edge, t: number, hole: boolean) => {
    const size = hole ? T.finish.frame.hole : T.finish.frame.crack;
    damage.push({ edge, t, hole, size, jag: Array.from({ length: 16 }, () => Math.random()) });
    dirty = true;
    const p = at(edge, t), n = hole ? 14 : 4, speed = box.h * (hole ? 0.6 : 0.3);
    for (let i = 0; i < n; i++) {
      const out = Math.random() < 0.6 ? -1 : 1, a = Math.atan2(p.iy * out, p.ix * out) + (Math.random() - 0.5) * 1.6;
      shard(p.x + p.ax * (Math.random() - 0.5) * th * size, p.y + p.ay * (Math.random() - 0.5) * th * size, Math.cos(a) * speed * (0.4 + Math.random()), Math.sin(a) * speed * (0.4 + Math.random()), th * (hole ? 0.35 : 0.2) * (0.5 + Math.random()));
    }
  };

  function drawMarks() {
    marks.clear();
    for (const d of damage) {
      const p = at(d.edge, d.t), half = (d.size * th) / 2, j = d.jag;
      const pt = (along: number, across: number) => [p.x + p.ax * along + p.ix * across, p.y + p.ay * along + p.iy * across];
      if (d.hole) { // a jagged gap right through the frame, its edges splintered bright, cracks running along the frame from it
        const poly = [
          ...pt(-half * (0.7 + j[0] * 0.4), -1), ...pt(-half * (0.9 + j[1] * 0.3), th * 0.3), ...pt(-half * (0.6 + j[2] * 0.5), th * 0.65), ...pt(-half * (0.8 + j[3] * 0.4), th + 1),
          ...pt(half * (0.8 + j[4] * 0.4), th + 1), ...pt(half * (0.6 + j[5] * 0.5), th * 0.6), ...pt(half * (0.9 + j[6] * 0.3), th * 0.3), ...pt(half * (0.7 + j[7] * 0.4), -1),
        ];
        marks.poly(poly).fill(BEHIND).stroke({ width: Math.max(1, th * 0.08), color: GOLD_LIGHT, alpha: 0.9 });
      }
      for (const side of [-1, 1]) { // cracks along the frame, zigzagging away from the damage
        let a = side * half * 0.8, c = th * (0.3 + j[8 + (side > 0 ? 1 : 0)] * 0.4);
        marks.moveTo(...(pt(a, c) as [number, number]));
        const steps = d.hole ? 5 : 2;
        for (let k = 0; k < steps; k++) {
          a += side * th * (0.5 + j[(k + 10) % 16] * 0.6);
          c = Math.max(th * 0.1, Math.min(th * 0.9, c + (j[(k + 3) % 16] - 0.5) * th * 0.5));
          marks.lineTo(...(pt(a, c) as [number, number]));
        }
        marks.stroke({ width: Math.max(1, th * 0.07), color: CRACK, alpha: 0.85 });
      }
      if (!d.hole) marks.poly([...pt(-th * 0.15, th), ...pt(0, th * 0.65), ...pt(th * 0.15, th)]).fill(CRACK); // a chip out of the inner lip
    }
  }

  return {
    container: root,
    /** Something happened in the fight: a knock-off through the edge (a hole), or a bullet leaving the picture (a crack). */
    onEvent(e: SimEvent, viewW: number, viewH: number) {
      if (e.t === 'exit') {
        const edge: Edge = e.y <= 0 ? 0 : e.x >= viewW ? 1 : e.y >= viewH ? 2 : 3;
        hit(edge, edge === 0 || edge === 2 ? e.x / viewW : e.y / viewH, false);
      } else if (e.t === 'fall') {
        if (e.x >= 0 && e.x <= viewW && e.y >= 0 && e.y <= viewH) return; // (went under in the sea, inside the picture: the frame is not touched)
        const edge: Edge = e.y > viewH ? 2 : e.x < 0 ? 3 : e.x > viewW ? 1 : 0;
        const t = edge === 0 || edge === 2 ? e.x / viewW : e.y / viewH;
        hit(edge, Math.max(0.03, Math.min(0.97, t)), true);
      }
    },
    /** Each frame: the frame around the picture's box on screen, its damage, the flying splinters. */
    draw(b: Box, seconds: number) {
      if (b.x !== box.x || b.y !== box.y || b.w !== box.w || b.h !== box.h) {
        box = { ...b };
        th = Math.max(5, b.h * T.finish.frame.width);
        const k = th / tex.height;
        const set = (s: TilingSprite, x: number, y: number, rot: number, len: number) => { s.position.set(x, y); s.rotation = rot; s.width = len; s.height = th; s.tileScale.set(k); };
        set(sides[0], b.x, b.y, 0, b.w); // each strip's inner edge faces the picture
        set(sides[1], b.x + b.w, b.y, Math.PI / 2, b.h);
        set(sides[2], b.x + b.w, b.y + b.h, Math.PI, b.w);
        set(sides[3], b.x, b.y + b.h, -Math.PI / 2, b.h);
        dirty = true;
      }
      if (dirty) { drawMarks(); dirty = false; }
      for (const s of shards) {
        if (!s.g.visible) continue;
        s.life -= seconds;
        if (s.life <= 0) { s.g.visible = false; continue; }
        s.vy += box.h * 1.6 * seconds; // (they fall)
        s.x += s.vx * seconds; s.y += s.vy * seconds;
        s.g.position.set(s.x, s.y); s.g.rotation += s.spin * seconds; s.g.alpha = Math.min(1, (s.life / s.max) * 2);
      }
    },
    /** A new round (a new painting): a whole frame again. */
    clear() { damage.length = 0; dirty = true; for (const s of shards) s.g.visible = false; },
  };
}

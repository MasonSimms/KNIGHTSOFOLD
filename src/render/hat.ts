// A fighter's hat or hairstyle, for the fight and the portraits: its static parts painted like the fighters (painter/sprites.ts
// paintedHat) on the head, turned with the facing and boiling with the rest; and what sways (looks only, like the cape): the chains in
// content/hats.ts drawn as painted rope strips with their bells, ties and pom-poms, and the afro's squish. Also googly eyes' loose pupils.
import { Container, Graphics, MeshRope, Point, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { DANGLES } from '../content/hats';
import type { DangleSpec } from '../content/hats';
import type { Hat } from '../content/looks';
import { tuning as T } from '../content/tuning';
import { makeChain, stepChain, stepPupil, stepSquish } from './dangle';
import type { Chain, Head, Pupil, Squish } from './dangle';
import { paintedHat, paintedShape, paintedStrip, PPM } from './painter/sprites';
import type { LoosePupil } from './render';

export interface HatView {
  show(variant: number, side: number): void; // this moment's boil variant, facing `side`
  /** Move what sways. (kx, ky, krot) = where the head's container is and how it is turned, in its parent's units; `wind` in m/s. */
  step(kx: number, ky: number, krot: number, side: number, dt: number, time: number, wind: number): void;
  /** Glasses worn over the eyes (Graham): the caller mirrors them with the facing like the eyes. */
  glasses?: Container;
}

const knobs = () => { const P = T.finish.paint; return { relief: P.relief, bristle: P.bristle, jitter: P.jitter, under: P.under }; };
/** The centre of the head (at (hx, hy) in its container), in head radii. */
const headAt = (kx: number, ky: number, krot: number, hx: number, hy: number, headR: number, side: number): Head => {
  const c = Math.cos(krot), s = Math.sin(krot);
  return { x: (kx + hx * c - hy * s) / headR, y: (ky + hx * s + hy * c) / headR, rot: krot, side };
};
/** Follows a point and gives its acceleration (nothing until it has seen it move twice). */
function tracker() {
  let x = 0, y = 0, vx = 0, vy = 0, seen = 0;
  return (nx: number, ny: number, dt: number): [number, number] => {
    if (dt <= 0) return [0, 0];
    const nvx = (nx - x) / dt, nvy = (ny - y) / dt, a: [number, number] = seen >= 2 ? [(nvx - vx) / dt, (nvy - vy) / dt] : [0, 0];
    seen = Math.min(2, seen + 1); x = nx; y = ny; vx = nvx; vy = nvy;
    return a;
  };
}

interface Dangle { spec: DangleSpec; chain: Chain; rope: MeshRope | null; pts: Point[]; tex: Texture[]; tips: { s: Sprite; tex: Texture[]; ahead: number }[] }
const TIPS: Record<NonNullable<DangleSpec['tip']>, { r: number; color: number; ahead: number }[]> = {
  bell: [{ r: 0.12, color: 0xb8893a, ahead: 0 }],
  pompom: [{ r: 0.33, color: 0xf1e6cf, ahead: 0 }],
  tie: [{ r: 0.12, color: 0xc8282a, ahead: 0 }, { r: 0.16, color: -1, ahead: 0.14 }], // a red tie, then a tuft of the hair beyond it
  curl: [{ r: 0.2, color: -1, ahead: 0.05 }], // a round curl in the hair's colour (Graham, Bubby)
};

/** Hairstyles whose cloud of curls squashes on a hard landing and wobbles back (render/dangle.ts stepSquish). */
const SQUISHY = new Set<Hat>(['afro', 'bubby']);

/** Graham's glasses (drawn crisp like the eyes, not painted): browline frames, a thick dark tortoiseshell bar across the top of each lens,
 *  thin steel rims below, a steel bridge, the arms back toward the ears, faintly tinted lenses with a glint. Centred on the head, facing
 *  right, sized to frame the eyes (render.ts drawEyes: eyes at x -0.36 and 0.41 head radii). */
function drawGlasses(headR: number): Container {
  const c = new Container(), g = new Graphics(), U = 100, r = headR * U, TORT = 0x2a1a12, FLECK = 0x7a4a26, STEEL = 0x9a9488;
  g.scale.set(1 / U);
  c.addChild(g);
  const lens = [[-0.36, 0.02], [0.41, 0.02]], rx = 0.34, ry = 0.28;
  for (const [x, y] of lens) {
    g.roundRect((x - rx) * r, (y - ry) * r, 2 * rx * r, 2 * ry * r, 0.12 * r).fill({ color: 0xeaf2f2, alpha: 0.13 }).stroke({ width: 0.035 * r, color: STEEL });
    g.moveTo((x - rx - 0.02) * r, (y - ry * 0.2) * r).quadraticCurveTo(x * r, (y - ry - 0.1) * r, (x + rx + 0.02) * r, (y - ry * 0.2) * r).stroke({ width: 0.1 * r, color: TORT, cap: 'round' }); // the browline
    for (const dx of [-0.18, 0.05, 0.22]) g.circle((x + dx) * r, (y - ry + 0.01) * r, 0.025 * r).fill(FLECK); // tortoiseshell flecks
    g.moveTo((x + 0.12) * r, (y - 0.16) * r).quadraticCurveTo((x + 0.22) * r, (y - 0.12) * r, (x + 0.24) * r, (y - 0.02) * r).stroke({ width: 0.03 * r, color: 0xffffff, alpha: 0.55, cap: 'round' }); // a glint
  }
  g.moveTo(-0.02 * r, -0.1 * r).quadraticCurveTo(0.025 * r, -0.16 * r, 0.07 * r, -0.1 * r).stroke({ width: 0.04 * r, color: STEEL }); // the bridge
  g.moveTo(-0.71 * r, -0.12 * r).lineTo(-1.0 * r, -0.16 * r).stroke({ width: 0.07 * r, color: TORT, cap: 'round' }); // the arms
  g.moveTo(0.76 * r, -0.12 * r).lineTo(0.97 * r, -0.15 * r).stroke({ width: 0.07 * r, color: TORT, cap: 'round' });
  return c;
}

/**
 * Put a hat on a head: its parts go into `head` (the container that moves and turns with the head), centred on (hx, hy) in it; what is
 * behind the head (most swaying parts, the afro's curls) goes underneath everything else in that container, what hangs in front of the
 * face (Fubo's bangs) over everything, the eyes too. `headR` is in the container's
 * units (metres in the fight, metres x zoom in a portrait); `tint` = the player's colour. Null for Bare.
 */
export function makeHat(hat: Hat, head: Container, hx: number, hy: number, headR: number, tint: number): HatView | null {
  const K = knobs(), sprites: { s: Sprite; tex: Texture[]; back: boolean }[] = [], specs = DANGLES[hat] ?? [];
  for (const back of [false, true]) {
    const painted = paintedHat(hat, headR, tint, K, back);
    if (!painted) continue;
    const s = new Sprite(painted.tex[0]);
    s.anchor.set(painted.ax, painted.ay);
    s.scale.set(1 / PPM);
    s.position.set(hx, hy);
    if (back) head.addChildAt(s, 0); else head.addChild(s);
    sprites.push({ s, tex: painted.tex, back });
  }
  if (!sprites.length && !specs.length) return null;
  const dangles: Dangle[] = [], squish: Squish | null = SQUISHY.has(hat) ? { s: 0, v: 0 } : null, track = tracker();
  const glasses = hat === 'graham' ? drawGlasses(headR) : null; // over the eyes: raised above them on the first step, like the bangs
  if (glasses) { glasses.position.set(hx, hy); head.addChild(glasses); }
  const holders = [new Container(), new Container()]; // behind the head, and in front of the face (raised over the eyes on the first step, once they are on)
  for (const h of holders) h.scale.set(1 / PPM); // the ropes work in texture pixels
  if (specs.some((d) => !d.front)) head.addChildAt(holders[0], 0);
  if (specs.some((d) => d.front)) head.addChild(holders[1]);
  let raised = false;
  for (const spec of specs) {
    const holder = holders[spec.front ? 1 : 0], pts = Array.from({ length: spec.links }, () => new Point(0, 0)), tex = spec.width[0] > 0 ? paintedStrip(spec, headR, K) : [];
    const rope = tex.length ? new MeshRope({ texture: tex[0], points: pts }) : null;
    if (rope) { rope.alpha = spec.alpha ?? 1; holder.addChild(rope); }
    const tips = (spec.tip ? TIPS[spec.tip] : []).map((t) => {
      const tex = paintedShape({ k: 'ball', r: t.r * headR }, t.color < 0 ? parseInt(spec.colors[0].slice(1), 16) : t.color, K), s = new Sprite(tex[0]);
      s.anchor.set(0.5);
      holder.addChild(s);
      return { s, tex, ahead: t.ahead };
    });
    dangles.push({ spec, chain: makeChain(spec.links), rope, pts, tex, tips });
  }
  let side = 1;
  return {
    glasses: glasses ?? undefined,
    show(variant, facing) {
      side = facing;
      for (const { s, tex, back } of sprites) {
        s.texture = tex[variant];
        const q = back && squish ? squish.s : 0; // (the afro's curls squash wide and short)
        s.scale.set((facing * (1 + q)) / PPM, (1 - q) / PPM);
      }
      for (const d of dangles) { if (d.rope) d.rope.texture = d.tex[variant]; for (const t of d.tips) t.s.texture = t.tex[variant]; }
    },
    step(kx, ky, krot, facing, dt, time, wind) {
      side = facing;
      if (!raised) { if (holders[1].parent) head.addChild(holders[1]); if (glasses) head.addChild(glasses); raised = true; }
      const h = headAt(kx, ky, krot, hx, hy, headR, side), [, ay] = track(h.x, h.y, dt);
      if (squish) stepSquish(squish, ay, dt);
      const c = Math.cos(-krot), s = Math.sin(-krot), local = (x: number, y: number, p: Point) => { const wx = x * headR - kx, wy = y * headR - ky; p.set((wx * c - wy * s) * PPM, (wx * s + wy * c) * PPM); };
      for (const d of dangles) {
        stepChain(d.chain, d.spec, h, dt, time, wind);
        const n = d.spec.links, { x, y } = d.chain;
        for (let i = 0; i < n; i++) local(x[i], y[i], d.pts[i]);
        for (const t of d.tips) { // at the tip, or a little beyond it along the last link
          const dx = x[n - 1] - x[n - 2], dy = y[n - 1] - y[n - 2], l = Math.hypot(dx, dy) || 1;
          local(x[n - 1] + (dx / l) * t.ahead, y[n - 1] + (dy / l) * t.ahead, t.s.position);
        }
      }
    },
  };
}

/** Googly eyes' loose pupils (null for other eyes): they rattle round inside the eye with the head's knocks. The eyes are at (hx, hy) in `head`'s container. */
export function makeGoogly(eyes: Container & { pupils?: LoosePupil[] }, hx: number, hy: number, headR: number): Pick<HatView, 'step'> | null {
  const loose = eyes.pupils;
  if (!loose?.length) return null;
  const state: Pupil[] = loose.map(() => ({ x: 0, y: 0.08, vx: 0, vy: 0 })), track = tracker();
  return {
    step(kx, ky, krot, side, dt) {
      const h = headAt(kx, ky, krot, hx, hy, headR, side), [ax, ay] = track(h.x, h.y, dt), c = Math.cos(-krot), s = Math.sin(-krot);
      loose.forEach((p, i) => {
        const q = state[i];
        stepPupil(q, ax, ay, dt, p.room);
        p.g.position.set(p.x + (q.x * c - q.y * s) * side * p.unit, p.y + (q.x * s + q.y * c) * p.unit); // (world offset -> the eye's own turned, mirrored frame)
      });
    },
  };
}

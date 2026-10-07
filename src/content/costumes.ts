// What everyone wears in each era (owner's visuals handoff: art-guide/visuals/costumes.png). One piece per era, worn automatically: over
// the body, never the head, under the hat; the player's colour still shows wherever it leaves the body bare, so the same fighter is
// recognisable all match. A few flat shapes, which the painter shades and paints over and clips to the body (render/painter/sprites.ts
// paintedCostume). Drawn facing right, in metres from the hips (the body's middle), up negative: the body is the pill 0.18 either side,
// from y -0.48 at the shoulders to 0.04 at the hips; the head sits on it at y -0.55. Looks only.
import type { Paint } from './weaponArt';

export type CostumePiece =
  | { k: 'poly'; pts: [number, number][]; c: Paint }
  /** A round thing: radius r (rx across when it is an oval). */
  | { k: 'ball'; x: number; y: number; r: number; rx?: number; c: Paint }
  /** A five-pointed star (a lawman's badge). */
  | { k: 'star'; x: number; y: number; r: number; c: Paint };

const PELT = ['#E2BA7A', '#C99A58', '#8E6532'], SPOT = ['#6A4325', '#4E2F18', '#2C190C'];
const VEST = ['#9A6438', '#7A4A28', '#4A2A14'], BANDANA = ['#E0473A', '#C42A22', '#7A1410'], TIN = ['#F6E08E', '#D9B04A', '#8C6A1C'];
const NAVY = ['#3E4C86', '#283260', '#141A38'], SAILCLOTH = ['#F8F1DE', '#E8DCC0', '#B8A684'], LEATHER = ['#8A5A36', '#5E3A20', '#2E1A0C'];
const BRASS = ['#F2D27A', '#C89A3A', '#7A5A1A'], WHITE = ['#FFFFFF', '#F2EEE6', '#C8C0B0'];

const ball = (x: number, y: number, r: number, c: Paint, rx?: number): CostumePiece => ({ k: 'ball', x, y, r, rx, c });
const poly = (c: Paint, pts: [number, number][]): CostumePiece => ({ k: 'poly', pts, c });
/** A strap from (x0, y0) to (x1, y1), half-width w. */
const strap = (x0: number, y0: number, x1: number, y1: number, w: number, c: Paint): CostumePiece => {
  const d = Math.hypot(x1 - x0, y1 - y0), nx = (-(y1 - y0) / d) * w, ny = ((x1 - x0) / d) * w;
  return poly(c, [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]);
};
/** Bands across the whole body from y0 down to y1, each `width` tall, every `gap`. */
const bands = (y0: number, y1: number, width: number, gap: number, c: Paint): CostumePiece[] =>
  Array.from({ length: Math.floor((y1 - y0) / gap) + 1 }, (_, i) => poly(c, [[-0.3, y0 + i * gap], [0.3, y0 + i * gap], [0.3, y0 + i * gap + width], [-0.3, y0 + i * gap + width]]));

export const COSTUMES: Record<string, CostumePiece[]> = {
  // Spotted pelt: slung over the back shoulder and down across the body to the front hip, its edge torn; the chest on the facing side bare
  caveman: [
    poly(PELT, [[-0.3, -0.55], [-0.02, -0.55], [0.02, -0.44], [0.06, -0.38], [0.05, -0.31], [0.1, -0.25], [0.09, -0.18], [0.15, -0.12], [0.14, -0.05], [0.22, 0.0], [0.3, 0.1], [-0.3, 0.1]]),
    ...[[-0.1, -0.4, 0.028], [-0.03, -0.27, 0.024], [-0.12, -0.17, 0.03], [0.04, -0.11, 0.022], [-0.06, -0.03, 0.026], [0.1, 0.0, 0.02], [-0.14, -0.3, 0.018]]
      .map(([x, y, r]) => ball(x, y, r, SPOT, r * 1.25)),
  ],
  // Vest and bandana: two leather panels open down the middle (the player's colour shows as the shirt), a red neckerchief knotted at the
  // throat with white dots, a tin star on the chest
  westerns: [
    poly(VEST, [[-0.3, -0.55], [-0.05, -0.55], [-0.02, -0.36], [-0.05, 0.1], [-0.3, 0.1]]),
    poly(VEST, [[0.05, -0.55], [0.3, -0.55], [0.3, 0.1], [0.05, 0.1], [0.04, -0.36]]),
    poly(BANDANA, [[-0.16, -0.43], [0.16, -0.43], [0.12, -0.35], [0.0, -0.22], [-0.12, -0.35]]), // (just under the chin: the head covers the top of the body)
    ...[[-0.07, -0.35], [0.06, -0.35], [0.0, -0.29], [0.01, -0.36]].map(([x, y]) => ball(x, y, 0.009, WHITE)),
    { k: 'star', x: 0.11, y: -0.22, r: 0.045, c: TIN },
  ],
  // Sailor's stripes: a cream shirt with navy stripes, a leather baldric over the back shoulder to the front hip, a brass buckle
  pirates: [
    poly(SAILCLOTH, [[-0.3, -0.55], [0.3, -0.55], [0.3, 0.1], [-0.3, 0.1]]),
    ...bands(-0.42, 0.04, 0.045, 0.1, NAVY), // (fewer, broader stripes: at play size the body is about 40 px tall, and thin ones blur to pale blue)
    strap(-0.16, -0.5, 0.2, 0.05, 0.035, LEATHER),
    poly(BRASS, [[-0.01, -0.255], [0.05, -0.255], [0.05, -0.195], [-0.01, -0.195]]), // (on the baldric, halfway down it)
    poly(LEATHER, [[0.005, -0.24], [0.035, -0.24], [0.035, -0.21], [0.005, -0.21]]),
  ],
};

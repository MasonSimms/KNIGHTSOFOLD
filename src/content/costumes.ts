// What everyone wears in each era (owner's visuals handoff: art-guide/visuals/costumes.png). One piece per era, worn automatically: over
// the body, never the head, under the hat; the player's colour still shows wherever it leaves the body bare, so the same fighter is
// recognisable all match. A few flat shapes, which the painter shades and paints over and clips to the body (render/painter/sprites.ts
// paintedCostume). Drawn facing right, in metres from the hips (the body's middle), up negative: the body is the pill 0.18 either side,
// from y -0.48 at the shoulders to 0.04 at the hips; the head sits on it at y -0.55. Looks only.
import type { Paint } from './weaponArt';

/** A colour ramp, or 'player': the wearer's own colour, shaded (the Medieval chevron, the Space suit's stripes). */
export type Dye = Paint | 'player';
export type CostumePiece =
  | { k: 'poly'; pts: [number, number][]; c: Dye }
  /** A round thing: radius r (rx across when it is an oval). */
  | { k: 'ball'; x: number; y: number; r: number; rx?: number; c: Dye }
  /** A five-pointed star (a lawman's badge). */
  | { k: 'star'; x: number; y: number; r: number; c: Dye };

const PELT = ['#E2BA7A', '#C99A58', '#8E6532'], SPOT = ['#6A4325', '#4E2F18', '#2C190C'];
const VEST = ['#9A6438', '#7A4A28', '#4A2A14'], BANDANA = ['#E0473A', '#C42A22', '#7A1410'], TIN = ['#F6E08E', '#D9B04A', '#8C6A1C'];
const NAVY = ['#3E4C86', '#283260', '#141A38'], SAILCLOTH = ['#F8F1DE', '#E8DCC0', '#B8A684'], LEATHER = ['#8A5A36', '#5E3A20', '#2E1A0C'];
const BRASS = ['#F2D27A', '#C89A3A', '#7A5A1A'], WHITE = ['#FFFFFF', '#F2EEE6', '#C8C0B0'];

const GOLD = ['#F8E08E', '#E2B33C', '#8C6A1C'], TURQUOISE = ['#7FE0D2', '#2FA898', '#14604F'], CARNELIAN = ['#E8774E', '#B8402A', '#6A1E10'];
const BRONZE = ['#F2C66C', '#C8943A', '#74521A'], BRONZE_LINE = ['#9A6A22', '#74501A', '#4A3210'], STRAP = ['#9A6A44', '#6A4428', '#3A2414'];
const FUR = ['#C8C4BC', '#9C978E', '#5E5A54'], IRON = ['#9DA3A9', '#686E75', '#353A3F'], MAIL = ['#B8BCC0', '#8A8F94', '#55595E'];
const RINGS = ['#5A5E62', '#3E4246', '#24272A'], TABARD = ['#F8F1DE', '#E6D9B8', '#A89A78'], LACQUER = ['#D2443A', '#A42820', '#5A1410'], GUARD = ['#9A2A22', '#6E1812', '#3A0A06'];
const LACE = ['#F6E2A8', '#E0C070', '#9A7A34'], KHAKI = ['#C8B07A', '#A08A54', '#5E5030'], OLIVE = ['#7E8A58', '#5C6640', '#323A22'];
const OLIVE_RIB = ['#56603A', '#3E4628', '#22281A'], CHARCOAL = ['#5A5E66', '#3C4048', '#1E2026'], POUCH = ['#8A8E96', '#686C74', '#3A3C42'];
const ORANGE = ['#FFB04A', '#F07A1E', '#9A4410'], SUIT = ['#FFFFFF', '#E8ECF0', '#A8B0BA'], RING_GREY = ['#D8DEE4', '#9AA4AE', '#5A6470'];
const PANEL = ['#3A3F5A', '#232838', '#10121C'], GLOW_CYAN = ['#F4FFFF', '#7FF2F4', '#1FA9B8'], GLOW_PINK = ['#FFF0FB', '#F45FD4', '#A21F8A'];

const ball = (x: number, y: number, r: number, c: Dye, rx?: number): CostumePiece => ({ k: 'ball', x, y, r, rx, c });
const poly = (c: Dye, pts: [number, number][]): CostumePiece => ({ k: 'poly', pts, c });
/** A rectangle from (x0, y0) to (x1, y1). */
const rect = (x0: number, y0: number, x1: number, y1: number, c: Dye): CostumePiece => poly(c, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
/** The whole body in one colour (everything is clipped to it). */
const whole = (c: Dye): CostumePiece => rect(-0.3, -0.55, 0.3, 0.1, c);
/** A strap from (x0, y0) to (x1, y1), half-width w. */
const strap = (x0: number, y0: number, x1: number, y1: number, w: number, c: Dye): CostumePiece => {
  const d = Math.hypot(x1 - x0, y1 - y0), nx = (-(y1 - y0) / d) * w, ny = ((x1 - x0) / d) * w;
  return poly(c, [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]);
};
/** Bands across the whole body from y0 down to y1, each `width` tall, every `gap`. */
const bands = (y0: number, y1: number, width: number, gap: number, c: Dye): CostumePiece[] =>
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
  // Usekh collar: a broad collar of gold, turquoise and carnelian bands curving across the shoulders and upper chest
  egypt: [GOLD, TURQUOISE, CARNELIAN, GOLD, TURQUOISE].map((c, i) => ball(0, -0.47, 0.25 - i * 0.04, c, 0.3)),
  // Bronze cuirass: a muscled bronze chest plate (chest, middle line and stomach marked), leather straps over the shoulders and hanging
  // at the hips
  gladiators: [
    whole(BRONZE),
    strap(-0.15, -0.3, -0.03, -0.26, 0.008, BRONZE_LINE), strap(0.03, -0.26, 0.15, -0.3, 0.008, BRONZE_LINE), // the chest
    strap(0, -0.3, 0, -0.06, 0.007, BRONZE_LINE), strap(-0.1, -0.17, 0.1, -0.17, 0.007, BRONZE_LINE), strap(-0.09, -0.1, 0.09, -0.1, 0.007, BRONZE_LINE),
    rect(-0.3, -0.55, -0.12, -0.36, STRAP), rect(0.12, -0.55, 0.3, -0.36, STRAP), // over the shoulders
    ...[-0.15, -0.075, 0, 0.075, 0.15].map((x) => rect(x - 0.03, -0.035, x + 0.03, 0.1, STRAP)), // hanging at the hips
  ],
  // Fur mantle: grey fur over the shoulders with a tufted edge, pinned with an iron brooch; the player's colour below as the tunic
  vikings: [
    poly(FUR, [[-0.3, -0.55], [0.3, -0.55], [0.3, -0.28], [0.2, -0.24], [0.15, -0.3], [0.09, -0.26], [0.04, -0.32], [-0.02, -0.27], [-0.07, -0.33], [-0.12, -0.27], [-0.18, -0.31], [-0.24, -0.25], [-0.3, -0.28]]),
    ball(0, -0.34, 0.03, IRON), ball(0, -0.34, 0.012, RINGS),
  ],
  // Mail and tabard: chainmail, and over it a cream tabard down the front with a chevron in the player's colour
  medieval: [
    whole(MAIL),
    ...Array.from({ length: 12 * 18 }, (_, i) => ball(-0.165 + (i % 12) * 0.03 + (Math.floor(i / 12) % 2) * 0.015, -0.47 + Math.floor(i / 12) * 0.03, 0.006, RINGS)), // the rings
    rect(-0.1, -0.45, 0.1, 0.1, TABARD),
    poly('player', [[-0.1, -0.3], [0, -0.2], [0.1, -0.3], [0.1, -0.22], [0, -0.12], [-0.1, -0.22]]),
  ],
  // Lacquered armour: a red lacquered chest plate laced across in gold cord, and shoulder guards
  samurai: [
    whole(LACQUER),
    ...bands(-0.38, 0.0, 0.012, 0.07, LACE),
    rect(-0.3, -0.55, -0.11, -0.34, GUARD), rect(0.11, -0.55, 0.3, -0.34, GUARD), // the shoulder guards (darker)...
    ...[-0.45, -0.39].flatMap((y) => [rect(-0.3, y, -0.11, y + 0.01, LACE), rect(0.11, y, 0.3, y + 0.01, LACE)]), // ...laced too
  ],
  // Trench webbing: khaki braces down the front to a belt, and a gas-mask satchel at the hip
  ww1: [
    strap(-0.1, -0.5, -0.08, -0.03, 0.02, KHAKI), strap(0.1, -0.5, 0.08, -0.03, 0.02, KHAKI),
    rect(-0.3, -0.07, 0.3, -0.015, KHAKI),
    rect(0.02, -0.12, 0.19, 0.04, KHAKI), rect(0.02, -0.12, 0.19, -0.075, OLIVE), // the satchel and its flap
  ],
  // Flak vest: olive ribbed panels, open down the front
  vietnam: [
    poly(OLIVE, [[-0.3, -0.55], [-0.03, -0.55], [-0.03, 0.1], [-0.3, 0.1]]), poly(OLIVE, [[0.03, -0.55], [0.3, -0.55], [0.3, 0.1], [0.03, 0.1]]),
    ...[-0.36, -0.27, -0.18, -0.09, 0.0].flatMap((y) => [rect(-0.3, y, -0.04, y + 0.016, OLIVE_RIB), rect(0.04, y, 0.3, y + 0.016, OLIVE_RIB)]),
  ],
  // Plate carrier: a charcoal vest with a row of pouches and an orange name tape
  modern: [
    whole(CHARCOAL),
    rect(-0.09, -0.33, 0.09, -0.295, ORANGE),
    rect(-0.17, -0.15, -0.065, 0.0, POUCH), rect(-0.05, -0.15, 0.05, 0.0, POUCH), rect(0.065, -0.15, 0.17, 0.0, POUCH),
  ],
  // Void suit: a white suit, a helmet ring at the neck, a dark chest panel with glowing lights, stripes in the player's colour
  scifi: [
    whole(SUIT),
    ball(0, -0.49, 0.1, RING_GREY, 0.24),
    rect(-0.3, -0.3, -0.11, -0.26, 'player'), rect(0.11, -0.3, 0.3, -0.26, 'player'),
    rect(-0.08, -0.32, 0.08, -0.22, PANEL), ball(-0.04, -0.27, 0.013, GLOW_CYAN), ball(0, -0.27, 0.013, GLOW_PINK), ball(0.04, -0.27, 0.013, GLOW_CYAN),
  ],
};

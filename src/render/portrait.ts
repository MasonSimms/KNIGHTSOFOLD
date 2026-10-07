// Painted portraits for the Hall of Champions: the player's own fighter (colour, hat, eyes, the cape) posed as a bust with folded hands in
// front of a painted landscape, painted with the same brushwork as the fight. Three boil variants, like the fighters in the fight.
// Drawn by a small off-screen Pixi renderer of its own (only the menus use it).
import { Application, Container, Rectangle, Sprite } from 'pixi.js';
import { COLORS } from '../content/looks';
import type { Look } from '../content/looks';
import { paintingFor } from '../content/paintings';
import { tuning as T } from '../content/tuning';
import type { Shape } from '../sim/fighter';
import { paintPicture } from './painter/backdrops';
import { paintedCape, PPM, VARIANTS } from './painter/sprites';
import { makeHat } from './hat';
import { addPainted, drawEyes, drawShape, mix, UNDER, updatePainted } from './render';
import { BOT_GRAYS, drawRobotHead } from './robot';
import type { Painted } from './render';

export const PORTRAIT = { w: 300, h: 380 }; // canvas pixels
const Z = 2.2; // a portrait is a close-up: shapes are painted this much bigger than in the fight (finer strokes for their size)
const BACKGROUND = 'medieval'; // whose landscape stands behind every portrait (each seat sees a different stretch of it)
const NO_GROUND = { slabs: [], ledges: [], ledgeThick: 0, top: 1080, thick: 0, walls: [] };

let app: Promise<Application> | null = null;
let land: Promise<ImageBitmap | null> | null = null;

/**
 * The three painted variants of one player's portrait (seat picks the stretch of landscape behind them). bare: the figure alone, no
 * landscape or varnish (a bust to stand on a pedestal); crown: wearing the crown whatever their hat (a bot too). The last few are kept:
 * the Hall paints each player's, and the round break's score cards show the same ones without painting them again mid-match.
 */
export function paintPortrait(look: Look, seat: number, opts: { bare?: boolean; crown?: boolean } = {}): Promise<HTMLCanvasElement[]> {
  const key = JSON.stringify([look, seat, opts]), hit = kept.get(key);
  if (hit) return hit;
  const made = paint(look, seat, opts);
  kept.set(key, made);
  if (kept.size > 16) kept.delete(kept.keys().next().value!); // (browsing hats in the Hall paints a new one each time: forget the oldest)
  return made;
}
const kept = new Map<string, Promise<HTMLCanvasElement[]>>();

async function paint(look: Look, seat: number, opts: { bare?: boolean; crown?: boolean }): Promise<HTMLCanvasElement[]> {
  app ??= (async () => { const a = new Application(); await a.init({ width: PORTRAIT.w, height: PORTRAIT.h, backgroundAlpha: 0, antialias: true, preference: 'webgl' }); return a; })();
  land ??= paintPicture(BACKGROUND, NO_GROUND, 640, 360);
  const [a, back] = await Promise.all([app, opts.bare ? null : land]);
  const { w: W, h: H } = PORTRAIT, F = T.fighter, LG = T.legs, P = T.finish.paint, K = { relief: P.relief, bristle: P.bristle, jitter: P.jitter, under: P.under };
  const hex = look.bot ? BOT_GRAYS[seat % BOT_GRAYS.length] : COLORS[look.color]?.hex ?? COLORS[0].hex, limb = mix(hex, 0x000000, 0.18);

  // The figure, in metres x Z around the hips, drawn at PPM pixels per unit: painted textures land 1:1 on the canvas.
  const stage = new Container(), fig = new Container(), under = new Container();
  fig.scale.set(PPM);
  fig.position.set(W / 2, H - 6);
  stage.addChild(fig);
  fig.addChild(under);
  const z = (s: Shape): Shape => (s.k === 'ball' ? { ...s, r: s.r * Z, x: s.x * Z, y: s.y * Z } : s.k === 'box' ? { ...s, hw: s.hw * Z, hh: s.hh * Z, x: s.x * Z, y: s.y * Z } : { ...s, r: s.r * Z, hl: s.hl * Z, x: s.x * Z, y: s.y * Z });
  const parts: [Shape, number][] = [ // body, head, and the hands folded in front (the arms are lost in the pose, as in the old portraits)
    [{ k: 'cap', r: F.torsoRadius, hl: LG.torsoHalf, x: 0, y: LG.torsoY, rot: 0 }, hex],
    [{ k: 'ball', r: F.headRadius, x: 0, y: F.headY }, hex],
    [{ k: 'ball', r: F.fistRadius * 0.85, x: 0.05, y: -0.12 }, limb], [{ k: 'ball', r: F.fistRadius * 0.85, x: -0.03, y: -0.1 }, limb],
  ].map(([s, c]) => [z(s as Shape), c as number]);
  const capeTex = paintedCape(parseInt(paintingFor(BACKGROUND).hot.slice(1), 16), K), capes: Sprite[] = [];
  for (const side of look.bot ? [] : [-1, 1]) { // the cape hangs from both shoulders behind the body, like a cloak (a robot has none)
    const c = new Sprite(capeTex[0]);
    c.anchor.set(0, 0.5);
    c.scale.set(Z / PPM);
    c.position.set(side * 0.1 * Z, (F.shoulderY - 0.03) * Z);
    c.rotation = Math.PI / 2 - side * 0.38;
    fig.addChild(c);
    capes.push(c);
  }
  const painted: Painted[] = [];
  for (const [s, color] of parts) {
    const u = drawShape(s, UNDER);
    u.position.x += T.finish.underOffset * Z; u.position.y += T.finish.underOffset * Z;
    under.addChild(u);
    painted.push(addPainted(fig, s, color));
  }
  const headY = F.headY * Z, hat = opts.crown ? makeHat('crown', fig, 0, headY, F.headRadius * Z, hex) : look.bot ? null : makeHat(look.hat, fig, 0, headY, F.headRadius * Z, hex), eyes = look.bot ? drawRobotHead(F.headRadius * Z, hex) : drawEyes(F.headRadius * Z, look.eyes, hex); // eyes over the hat, as in the fight
  eyes.position.set(0, headY);
  fig.addChild(eyes);

  const out: HTMLCanvasElement[] = [];
  for (let v = 0; v < VARIANTS; v++) {
    painted.forEach((p) => updatePainted(p, 0, v));
    for (const c of capes) c.texture = capeTex[v];
    for (let i = 0; i < 90; i++) hat?.step(0, 0, 0, 1, 1 / 60, v * 2.1 + i / 60, 0.25 * Math.sin(v * 2.1 + i / 40)); // what sways settles, in a slight breeze that differs per variant
    hat?.show(v, 1);
    const fg = a.renderer.extract.canvas({ target: stage, frame: new Rectangle(0, 0, W, H) }) as HTMLCanvasElement;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    if (opts.bare) { ctx.drawImage(fg, 0, 0, W, H); out.push(c); continue; }
    if (back) { // a portrait-shaped stretch of the landscape, a different one for each seat
      const sh = back.height, sw = (sh * W) / H, sx = [0.42, 0.12, 0.7, 0.28][seat % 4] * (back.width - sw);
      ctx.drawImage(back, sx, 0, sw, sh, 0, 0, W, H);
    } else { ctx.fillStyle = '#3b4a3a'; ctx.fillRect(0, 0, W, H); }
    ctx.drawImage(fg, 0, 0, W, H);
    // varnish: darker toward the edges, and a warm glaze over everything
    const g = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.22, W / 2, H * 0.5, H * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(24,14,4,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(255,238,210)'; ctx.fillRect(0, 0, W, H);
    out.push(c);
  }
  stage.destroy({ children: true });
  return out;
}

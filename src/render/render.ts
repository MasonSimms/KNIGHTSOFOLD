import { Application, BlurFilter, Container, Graphics, MeshRope, Point, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { RenderTexture } from 'pixi.js';
import { eraById, eras } from '../content/eras';
import { COLORS, HATS } from '../content/looks';
import { COSTUMES } from '../content/costumes';
import { createOilFilter, setOilScale } from './oilpaint';
import { createBackdrops } from './painter/backdrops';
import { BOT_GRAYS, drawRobotHead } from './robot';
import { createSea } from './sea';
import { createFx } from './fx';
import { createLimbs } from './limbs';
import { createDrops } from './drops';
import { createExtras } from './extras';
import { createMotion } from './motion';
import { createFrame } from './frame';
import { createFlames } from './flames';
import { createMammoth } from './mammoth';
import { createPassing } from './passing';
import { createDoors } from './trapdoors';
import { createChariot } from './chariot';
import { createDecor } from './decor';
import { createJets } from './jets';
import { windAt } from '../sim/wind';
import { eraFor, mapFor } from '../sim/era';
import { createLight } from './light';
import { makeGoogly, makeHat } from './hat';
import type { HatView } from './hat';
import { CAPE, paintedBox, paintedCape, paintedCostume, paintedFront, paintedShape, paintedSplats, paintedStreaks, paintedWeapon, PPM, VARIANTS } from './painter/sprites';
import { ITEMS, PROPS } from '../content/props';
import { paintingFor } from '../content/paintings';
import type { Eyes } from '../content/looks';
import { tuning as T } from '../content/tuning';
import type { Fighter, Part, Shape } from '../sim/fighter';
import type { SimEvent } from '../sim/types';
import { arenaFor, wallsOf } from '../sim/world';
import type { Arena, Sim } from '../sim/world';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (a: number) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));

export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.min(255, Math.max(0, Math.round(lerp((a >> s) & 255, (b >> s) & 255, t)))); // (clamped: a colour out of range throws in Pixi and loses the frame)
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// Pixi picks curve detail from the size it is drawn at, and our shapes are fractions of a metre, so draw big and scale down
// (otherwise heads come out as octagons).
const BIG = 100;

/** Eye whites on a body this light (Bone, the dummy) get a thin dark rim, or they vanish into the face. */
export const rimEyes = (body: number) => (0.2126 * ((body >> 16) & 255) + 0.7152 * ((body >> 8) & 255) + 0.0722 * (body & 255)) / 255 > 0.8;
/** A googly eye's loose pupil (render/hat.ts makeGoogly moves it): the middle of its eye and the pixels per head radius in the eyes' Graphics, and how far it can roam from the middle (head radii). */
export interface LoosePupil { g: Graphics; x: number; y: number; unit: number; room: number }

/** Big painted eyes (art direction, as in the package's fighters): cream discs with dark pupils, drawn at the head's centre; the caller
 * flips them with the facing. They stay crisp (the package keeps eyes out of the paint). Sizes in head radii (LOOKS_HANDOFF.md). Fierce: a
 * brow slanting down toward the nose cuts the top off each eye. Sad: the reverse, the brow lifting toward the nose. Sleepy: a heavy lid
 * across the middle; sly: a flat lid just above it, pupils glancing ahead. Startled: big whites, pinprick pupils, arched brows. Googly:
 * bigger rimmed whites with loose pupils (`pupils` on the container). Cyclops: one big eye. Bloodshot: pink veined whites under heavy lids
 * in a lighter tint of the body colour, bags below. Wall-eyed: each pupil at the outer edge of its eye. (The eye itself is cut, so it works
 * over any hat.) `body` = the body's colour (very light ones get rimmed whites). */
export function drawEyes(headR: number, eyes: Eyes = 'round', body = 0xd8402a): Container & { pupils?: LoosePupil[] } {
  const rim = rimEyes(body), c: Container & { pupils?: LoosePupil[] } = new Container(), inner = new Container(), r = headR * BIG, g = new Graphics(), ink = 0x120d0a, cream = 0xf7f2e0;
  /** A disc with everything above `top(x)` cut away. */
  const cut = (cx: number, cy: number, rad: number, top: (x: number) => number) => {
    const pts: number[] = [];
    for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2, px = cx + rad * Math.cos(a); pts.push(px, Math.max(cy + rad * Math.sin(a), top(px))); }
    return pts;
  };
  const line = (x0: number, x1: number, y: (x: number) => number, width: number) => g.moveTo(x0, y(x0)).lineTo(x1, y(x1)).stroke({ width: r * width, color: ink, cap: 'round' });
  inner.scale.set(1 / BIG);
  inner.addChild(g);
  c.addChild(inner);
  if (eyes === 'cyclops') {
    const x = r * 0.07, y = -r * 0.07, px = x + r * 0.08, py = y + r * 0.03;
    if (rim) g.circle(x, y, r * 0.46).fill(ink);
    g.circle(x, y, r * 0.43).fill(cream).circle(px, py, r * 0.2).fill(ink).circle(px - r * 0.07, py - r * 0.07, r * 0.055).fill(cream);
  } else for (const dx of [-0.36, 0.41]) {
    const x = r * dx, inward = dx < 0 ? 1 : -1; // toward the nose
    const e = r * (eyes === 'googly' ? 0.33 : eyes === 'startled' ? 0.32 : 0.255), out = (px: number) => ((px - x) * -inward) / e; // -1 at the inner end, 1 at the outer
    const top = eyes === 'fierce' ? (px: number) => -e * 0.85 + e * 0.75 * (1 - out(px)) / 2 // high at the outer end, low at the inner end
      : eyes === 'sad' ? (px: number) => -e * 0.85 + e * 0.75 * (1 + out(px)) / 2 // high at the inner end, low at the outer end
      : eyes === 'sleepy' ? () => -e * 0.05
      : eyes === 'sly' ? (px: number) => -e * 0.15 + e * 0.12 * out(px) // just above the middle, a little lower at the outer end
      : () => -Infinity;
    const [pr, ox, oy] = eyes === 'googly' ? [0.15, 0, 0.08] : eyes === 'startled' ? [0.07, 0, 0] : eyes === 'sleepy' ? [0.13, 0.073, 0.07] : eyes === 'sly' ? [0.13, 0.1, 0.05] : eyes === 'sad' ? [0.13, 0.06, 0.07] : eyes === 'bloodshot' ? [0.08, 0.04, 0.13] : eyes === 'walleyed' ? [0.13, -inward * 0.11, 0] : [0.13, 0.073, 0.023];
    if (rim || eyes === 'googly') g.poly(cut(x, 0, e + r * 0.03, top)).fill(ink);
    g.poly(cut(x, 0, e, top)).fill(eyes === 'bloodshot' ? 0xf2d9cc : cream);
    if (eyes === 'bloodshot') for (const [a, l] of [[0.1, 0.6], [-0.25, 0.5], [Math.PI + 0.2, 0.45]]) { // thin red veins from the corners
      const sx = x - inward * Math.cos(a) * e * 0.95, sy = Math.sin(a) * e * 0.6;
      g.moveTo(sx, sy).quadraticCurveTo(sx + inward * Math.cos(a) * e * l * 0.5, sy + e * 0.12, sx + inward * Math.cos(a) * e * l, sy - e * 0.05).stroke({ width: r * 0.022, color: 0xc8352b });
    }
    if (eyes === 'googly') { // the pupil is its own shape, so it can rattle round the eye
      const p = new Graphics().circle(0, 0, r * pr).fill(ink);
      p.position.set(x + r * ox, r * oy);
      inner.addChild(p);
      (c.pupils ??= []).push({ g: p, x, y: 0, unit: r, room: (e - r * pr) / r });
    } else g.poly(cut(x + r * ox, r * oy, r * pr, top)).fill(ink);
    if (eyes === 'fierce' || eyes === 'sad') line(x - inward * e * 1.2, x + inward * e * 1.15, top, 0.1);
    if (eyes === 'sleepy' || eyes === 'sly') line(x - e * 1.05, x + e * 1.05, top, 0.07);
    if (eyes === 'bloodshot') { // a heavy droopy lid over the top half, its dark edge, a faint bag below
      const lid = e * 0.08, pts: number[] = [];
      for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; pts.push(x + (e + r * 0.01) * Math.cos(a), Math.min(lid, (e + r * 0.01) * Math.sin(a))); }
      g.poly(pts).fill(mix(body, 0xffffff, 0.25));
      line(x - e, x + e, () => lid, 0.06);
      g.moveTo(x + e * 1.1 * Math.cos(Math.PI * 0.2), e * 1.1 * Math.sin(Math.PI * 0.2)).arc(x, 0, e * 1.1, Math.PI * 0.2, Math.PI * 0.8).stroke({ width: r * 0.04, color: ink, alpha: 0.3, cap: 'round' });
    }
    if (eyes === 'startled') g.moveTo(x + e * 1.45 * Math.cos(-Math.PI * 0.7), e * 0.2 + e * 1.45 * Math.sin(-Math.PI * 0.7)).arc(x, e * 0.2, e * 1.45, -Math.PI * 0.7, -Math.PI * 0.3).stroke({ width: r * 0.06, color: ink, cap: 'round' });
  }
  return c;
}

export function drawShape(s: Shape, color: number): Graphics {
  const g = new Graphics();
  if (s.k === 'ball') g.circle(0, 0, s.r * BIG);
  else if (s.k === 'box') g.rect(-s.hw * BIG, -s.hh * BIG, s.hw * 2 * BIG, s.hh * 2 * BIG);
  else g.roundRect(-s.r * BIG, -(s.hl + s.r) * BIG, s.r * 2 * BIG, (s.hl + s.r) * 2 * BIG, s.r * BIG);
  g.fill(color);
  g.scale.set(1 / BIG);
  g.position.set(s.x, s.y);
  if (s.k !== 'ball') g.rotation = s.rot;
  return g;
}

// The light comes from the upper left (as in the paintings). A painted capsule is lit from its own left; when the other side faces the
// light, its mirror image fades in instead.
const LX = -0.6, LY = -0.8;
export const UNDER = 0x1a120d; // the dark underpaint showing at the lower right of every fighter and object (the package's lost-and-found edge)

/** One painted ball or capsule on a part: a sprite (and its mirror image, for a capsule). */
export interface Painted { s: Shape; tex: Texture[]; a: Sprite; b: Sprite | null }
export function addPainted(parent: Container, s: Shape, color: number): Painted {
  const P = T.finish.paint;
  const K = { relief: P.relief, bristle: P.bristle, jitter: P.jitter, under: P.under };
  const tex = s.k === 'box' ? paintedBox(s.hw, s.hh, color, K) : paintedShape(s.k === 'ball' ? { k: 'ball', r: s.r } : { k: 'cap', r: s.r, hl: s.hl }, color, K);
  const mk = (mirror: boolean) => {
    const sp = new Sprite(tex[0]);
    sp.anchor.set(0.5);
    sp.scale.set((mirror ? -1 : 1) / PPM, 1 / PPM);
    sp.position.set(s.x, s.y);
    if (s.k !== 'ball') sp.rotation = s.rot;
    parent.addChild(sp);
    return sp;
  };
  return { s, tex, a: mk(false), b: s.k === 'cap' ? mk(true) : null };
}
/** Keep a painted shape lit from the upper left however its part is turned, and show this moment's boil variant. */
export function updatePainted(p: Painted, partRot: number, variant: number): void {
  p.a.texture = p.tex[variant];
  if (p.b) {
    p.b.texture = p.tex[variant];
    const phi = partRot + (p.s.k === 'cap' ? p.s.rot : 0), d = Math.cos(phi) * LX + Math.sin(phi) * LY, t = Math.min(1, Math.max(0, (d + 0.2) / 0.4));
    p.b.alpha = t * t * (3 - 2 * t);
  } else if (p.s.k === 'ball') p.a.rotation = -partRot; // a ball keeps its highlight at the upper left
}
/** A weapon with its own picture (content/weaponArt.ts) instead of a plain rod: one sprite on the part. `tint`: its dark underpaint or
 *  its shadow. Null when it has none (a plank, a leg). */
export function addWeapon(parent: Container, p: Part, tint?: number): Painted | null {
  const P = T.finish.paint, w = p.weapon, art = w && paintedWeapon(p.chainOf ? `${w.id}-head` : w.id, w.length, { relief: P.relief, bristle: P.bristle, jitter: P.jitter, under: P.under }); // (a chain weapon's head has its own picture)
  if (!art) return null;
  const sp = new Sprite(art.tex[0]);
  sp.anchor.set(art.ax, art.ay);
  sp.scale.set(1 / art.ppm);
  if (tint !== undefined) sp.tint = tint;
  parent.addChild(sp);
  return { s: p.shapes[0], tex: art.tex, a: sp, b: null };
}

/** The cape: a rope mesh along a short chain of points that swings with the fighter (looks only: the simulation never sees it). */
interface Cape { rope: MeshRope; pts: Point[]; x: Float32Array; y: Float32Array; px: Float32Array; py: Float32Array; tex: Texture[]; live: boolean }
const CAPE_LINKS = 6;
function makeCape(parent: Container, tex: Texture[]): Cape {
  const pts = Array.from({ length: CAPE_LINKS }, () => new Point(0, 0)), holder = new Container();
  const rope = new MeshRope({ texture: tex[0], points: pts });
  holder.scale.set(1 / PPM); // the rope works in texture pixels
  holder.zIndex = -5; // behind the body, in front of the underpaint
  holder.addChild(rope);
  parent.addChild(holder);
  const z = () => new Float32Array(CAPE_LINKS);
  return { rope, pts, x: z(), y: z(), px: z(), py: z(), tex, live: false };
}
/** Cloth: each point keeps its momentum, falls, trails a little behind the way the fighter faces, flutters, and keeps its distance. */
function stepCape(c: Cape, ax: number, ay: number, side: number, dt: number, time: number, variant: number, wind = 0): void {
  const seg = CAPE.length / (CAPE_LINKS - 1), C = T.finish.cape;
  if (!c.live) { for (let i = 0; i < CAPE_LINKS; i++) { c.x[i] = c.px[i] = ax; c.y[i] = c.py[i] = ay + i * seg; } c.live = true; }
  const h = Math.min(dt, 1 / 30);
  for (let i = 1; i < CAPE_LINKS; i++) {
    const vx = (c.x[i] - c.px[i]) * C.damping, vy = (c.y[i] - c.py[i]) * C.damping;
    c.px[i] = c.x[i]; c.py[i] = c.y[i];
    c.x[i] += vx + (-side * C.trail + Math.sin(time * C.flutterRate + i * 0.9) * C.flutter * (1 + Math.abs(wind) * 0.15) + wind * T.finish.wind.cape) * h * h; // (the wind blows it out and makes it flap)
    c.y[i] += vy + (C.gravity + Math.cos(time * C.flutterRate * 0.7 + i) * C.flutter * 0.5) * h * h;
  }
  c.x[0] = c.px[0] = ax; c.y[0] = c.py[0] = ay;
  for (let it = 0; it < 4; it++) for (let i = 1; i < CAPE_LINKS; i++) {
    const dx = c.x[i] - c.x[i - 1], dy = c.y[i] - c.y[i - 1], d = Math.hypot(dx, dy) || 1e-6, k = seg / d;
    c.x[i] = c.x[i - 1] + dx * k; c.y[i] = c.y[i - 1] + dy * k;
  }
  for (let i = 0; i < CAPE_LINKS; i++) c.pts[i].set(c.x[i] * PPM, c.y[i] * PPM);
  c.rope.texture = c.tex[variant];
}

/** A small texture painted in code (used for the vignette): no asset files. */
function canvasTexture(size: number, paint: (ctx: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d')!);
  return Texture.from(c);
}

interface Entry {
  f: Fighter;
  group: Container; // everything of one fighter, so the dodge can shrink them about the torso
  c: Container[]; // one per part
  vis: number; // 0 = normal plane, 1 = background plane (smoothed)
  painted: Painted[][]; // per part: its painted shapes
  cape: Cape; // the hot-colour cape flowing from the shoulders
  under: Container[]; // per part: its dark underpaint silhouette (drawn behind the whole fighter, offset down-right)
  soft: Container[]; // per part: its share of the fighter's faint soft shadow on the map (in the shadow layer)
  shade: Container; // all of this fighter's soft shadow
  eyes: Container[]; // painted eyes: they look the way the fighter faces
  hat: HatView | null; // the player's hat, on the head
  costume: { s: Sprite; tex: Texture[] } | null; // the era's costume, on the body (content/costumes.ts)
  googly: Pick<HatView, 'step'> | null; // googly eyes' loose pupils
  head: Container | null; // the container the head is in (what sways on the head follows it)
  blur: BlurFilter; // softens the fighter as they slip back into the background plane (dodge)
  crushed: boolean; // flattened by a stomp or a crash
  sq: number; // how flat (0..1, eases toward 1 once crushed)
  hand: number; // which way up their weapon is drawn: the way they faced when they last held it (so a blade's edge stays on top)
}

/** Graphics quality levels. High = everything; Medium = no extra resolution on high-density screens; Low = for slower computers. */
export type Quality = 'high' | 'medium' | 'low';
const QUALITY: Record<Quality, { maxResolution: number; paintWidth: number; boil: boolean; shadows: boolean; blur: boolean; grain: boolean }> = {
  high: { maxResolution: 2, paintWidth: 1280, boil: true, shadows: true, blur: true, grain: true },
  medium: { maxResolution: 1, paintWidth: 1280, boil: true, shadows: true, blur: true, grain: true },
  low: { maxResolution: 0.75, paintWidth: 960, boil: false, shadows: false, blur: false, grain: false },
};
let Q = QUALITY.high;

export async function createRenderer(sim: Sim, host: HTMLElement) {
  const app = new Application();
  await app.init({ resizeTo: window, background: T.colors.void, antialias: true, autoDensity: true, resolution: window.devicePixelRatio });
  host.appendChild(app.canvas);
  app.ticker.stop(); // main.ts owns the loop and calls draw()

  const view = new Container(); // metres -> pixels, letterboxed, shaken
  const game = new Container(); // everything the fight draws (the museum between eras draws it into a painting instead)
  app.stage.addChild(game);
  game.addChild(view);
  const actors = new Container(); // fighters, props and paint: the live oil filter covers these (the backdrop is already painted)
  const O = T.finish.oil, oil = createOilFilter(O.radius, O.relief, O.stroke);
  if (O.enabled && !location.search.includes('nooil')) actors.filters = [oil];
  const backdrops = createBackdrops();
  const A = sim.arena; // (only the view size is read from this one: it never changes)
  // The backdrop: an oil painting of the era with the round's ground in it (painted in a worker: painter/), with depth of field painted in.
  // Until it is ready (the first second or so), the flat placeholder arena below shows instead.
  const painted = new Sprite(Texture.EMPTY), flat = new Container();
  const sky = new Graphics(), platform = new Graphics(), walls = new Graphics();
  flat.addChild(sky, platform, walls);
  const grain = new TilingSprite({ texture: canvasTexture(128, (ctx) => { // canvas weave: fine noise over the whole picture (screen space)
    const d = ctx.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    ctx.putImageData(d, 0, 0);
  }), width: 1, height: 1 });
  const tintWash = new Graphics(); // an era colour wash over everything (screen space; sized in draw())
  /** (Re)paint the arena in an era's colours. */
  let paintedEra = '';
  const paintArena = (id: string) => {
    const era = eraById(id), A = sim.arena;
    paintedEra = id;
    sky.clear().rect(0, 0, A.viewW, A.viewH).fill(era.sky);
    const st = { ...T.finish.style, ...era.style }; // this era's painting style
    grain.alpha = st.grain;
    tintWash.clear().rect(0, 0, 1, 1).fill(st.tint);
    tintWash.alpha = st.tintAlpha;
    platform.clear();
    for (const g of A.boats.length ? [] : A.ground.length ? A.ground : [{ x: A.platformX, w: A.platformW } as Arena['ground'][number]]) platform.rect(g.x, A.platformTop - (g.up ?? 0), g.w, g.thick ?? A.platformThickness).fill(era.platform);
    for (const l of A.ledges) platform.rect(l.x, A.platformTop - l.up, l.w, A.ledgeThick).fill(era.platform).stroke({ width: 0.04, color: T.colors.platformEdge });
    walls.clear();
    for (const w of wallsOf(A)) {
      walls.rect(w.x, w.top, A.wallThickness, A.killY + 2 - w.top).fill(era.wall);
    }
  };
  paintArena(sim.era);
  const paintLayer = new Container(), paintBlur = new BlurFilter({ strength: T.finish.paintBlur, quality: 2 }); // the paint is soaked into the picture: slightly soft
  paintLayer.filters = [paintBlur];
  const splatLayer = new Container(); // sharp effects (rings)
  const backLayer = new Container(); // a dodging fighter is drawn here, behind everyone else
  const fighterLayer = new Container();
  const propLayer = new Container(); // planks, logs and other loose objects
  const ropes = new Graphics(); // what hangs from ropes (lanterns)
  actors.addChild(paintLayer, ropes, propLayer, backLayer, fighterLayer, splatLayer);
  // The three planes (owner): background (the painted backdrop, blurred and hazed), the play plane (fighters, ground, props: sharp, each
  // fighter lifted off the map by a faint soft shadow) and, on some maps, a front plane between us and the fighters, slightly out of focus.
  const shadows = new Container(), shadowBlur = new BlurFilter({ strength: 4, quality: 2 });
  shadows.filters = [shadowBlur];
  const front = new Container(), frontBlur = new BlurFilter({ strength: 3, quality: 3 });
  front.filters = [frontBlur];
  const frontItems: { s: Sprite; x: number; speed: number }[] = [];
  // A moving map (the Mammoth Chase, the Train): the painting slides by. After it, a mirrored copy and another copy, so the join never shows.
  // A fast one is blurred along the way it moves (speed: and it hides the join).
  const rolling = [new Sprite(Texture.EMPTY), new Sprite(Texture.EMPTY)], backdrop = new Container(), rollBlur = new BlurFilter({ strength: 0, quality: 2 });
  backdrop.addChild(painted, ...rolling);
  const lightLayer = new Container(); // the lights' glow and a room's darkness: over the background only (light never hides anyone)
  view.addChild(flat, backdrop, lightLayer, shadows, actors, front);
  const light = createLight(lightLayer);


  // Cheap global finish on top of everything (screen space).
  const vignette = new Sprite(canvasTexture(256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 182);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }));
  vignette.alpha = T.finish.vignetteAlpha;
  const dusk = new Graphics().rect(0, 0, 1, 1).fill(0xffffff); // sudden death: the painting darkens (tinted and sized in draw())
  dusk.alpha = 0;
  game.addChild(grain, tintWash, dusk, vignette);
  const box = new Graphics(); // the picture's frame on screen: zoomed in, nothing may spill outside it
  game.addChild(box);
  const frame = createFrame(game, { relief: T.finish.paint.relief, bristle: T.finish.paint.bristle, jitter: T.finish.paint.jitter, under: T.finish.paint.under }); // the gold frame, over everything (screen space)
  let zoom = 1, camX = A.viewW / 2, camY = A.viewH / 2; // the subtle camera (tuning.camera)

  // Splat decal pool (ring buffer: no allocation after start-up).
  // Painted paint: blobs with drips running down (white, tinted with the colour of whoever bled), soaked into the picture.
  const P1 = T.finish.paint, splatTexs = paintedSplats({ relief: P1.relief, bristle: P1.bristle, jitter: P1.jitter, under: P1.under });
  const splats: Sprite[] = [];
  for (let i = 0; i < T.splat.max; i++) {
    const s = new Sprite(splatTexs[i % splatTexs.length]);
    s.anchor.set(0.5, 0.35);
    s.visible = false;
    paintLayer.addChild(s);
    splats.push(s);
  }
  let nextSplat = 0, shownRound = sim.round;
  const growing: { s: Sprite; to: number; t: number; dur: number }[] = []; // splats that spread out over a moment
  const splat = (x: number, y: number, radiusPx: number, color: number, grow = 0, alpha: number = T.splat.alpha) => {
    const s = splats[nextSplat++ % splats.length];
    s.position.set(x, y);
    s.scale.set(radiusPx / 100 / 45); // px at 1080p -> metres (the painted blob is about 45 texture px across its middle)
    s.rotation = (Math.random() - 0.5) * 0.4; // drips always run more or less down
    if (grow > 0) { growing.push({ s, to: s.scale.x, t: 0, dur: grow }); s.scale.set(0); }
    s.tint = color;
    s.alpha = alpha;
    s.visible = true;
  };
  // Streaks of paint (a knock-off): a pool of painted streaks that shoot out from where someone went off, toward the middle of the picture.
  const streakTexs = paintedStreaks({ relief: P1.relief, bristle: P1.bristle, jitter: P1.jitter, under: P1.under });
  const streaks = Array.from({ length: 28 }, (_, i) => { const s = new Sprite(streakTexs[i % streakTexs.length]); s.anchor.set(0, 0.5); s.visible = false; paintLayer.addChild(s); return s; });
  let nextStreak = 0;
  const flying: { s: Sprite; len: number; t: number; delay: number }[] = [];
  const lerpR = (r: number[], k: number) => r[0] + (r[1] - r[0]) * k;
  /** The paint a fighter leaves: their colour, shaded toward umber when it is so light it would read as dust. */
  const paintOf = (c: number) => (rimEyes(c) ? mix(c, 0x6e5a44, T.splat.lightShade) : c);
  /** Someone went off at (x, y): their paint streaks onto the canvas from the edge where they went out toward the middle. */
  const paintStreaks = (x: number, y: number, color: number) => {
    const S = T.splat.streaks, ex = Math.max(0.3, Math.min(A.viewW - 0.3, x)), ey = Math.max(0.3, Math.min(A.viewH - 0.3, y)), base = Math.atan2(A.viewH / 2 - ey, A.viewW / 2 - ex);
    color = paintOf(color);
    splat(ex, ey, S.burst, color, 0.2); // a burst where they went out, the streaks flying from it
    const n = Math.round(lerpR(S.count, Math.random()));
    for (let i = 0; i < n; i++) {
      const s = streaks[nextStreak++ % streaks.length], len = lerpR(S.length, Math.random()), w = lerpR(S.width, Math.random());
      s.position.set(ex + (Math.random() - 0.5) * 0.6, ey + (Math.random() - 0.5) * 0.6);
      s.rotation = base + (Math.random() * 2 - 1) * S.spread;
      s.scale.set(0, w / 100 / 30); // grows to its length (the painted streak is 260 px long, its head about 30 px across)
      s.tint = color; s.alpha = S.alpha; s.visible = true;
      flying.push({ s, len: len / 2.6, t: 0, delay: i * 0.04 });
    }
  };
  /** A hit: a subtle spray of the hurt player's paint, flung the way the blow went. */
  let windNow = 0; // (the wind at the last drawn frame: paint flung in it lands downwind)
  const spray = (e: SimEvent, color: number) => {
    const P = T.splat.spray;
    if (e.v < P.minImpact) return; // a tap leaves no paint
    color = paintOf(color);
    const k = Math.min(1, e.v / 100), a = sim.fighters[e.owner]?.torso, b = sim.fighters[e.victim]?.torso;
    const dir = a && b ? Math.atan2(b.cy - a.cy, b.cx - a.cx) : -Math.PI / 2;
    for (let i = 0, n = Math.round(lerpR(P.drops, k)); i < n; i++) {
      const d = lerpR(P.reach, Math.random()) * (0.5 + k), ang = dir + (Math.random() - 0.5) * 1.1;
      splat(e.x + Math.cos(ang) * d + windNow * T.finish.wind.spray * d * 10, e.y + Math.sin(ang) * d, lerpR(P.size, Math.random()) * (0.6 + 0.6 * k), color, 0, P.alpha);
    }
  };
  // Big-hit indicator rings (a small pool: nothing is allocated while playing).
  const rings = Array.from({ length: 8 }, () => {
    const g = new Graphics().circle(0, 0, 50).stroke({ width: 6, color: T.indicator.color });
    g.visible = false;
    splatLayer.addChild(g);
    return { g, age: 99 };
  });
  let nextRing = 0;
  const ring = (x: number, y: number, color: number) => {
    const r = rings[nextRing++ % rings.length];
    r.g.position.set(x, y);
    r.g.tint = color;
    r.age = 0;
    r.g.visible = true;
  };
  const fxLayer = new Container(); // gunfire: bullets and their trails, flashes, sparks, splinters, smoke
  actors.addChild(fxLayer);
  const drops = createDrops(fxLayer); // drips and drops: paint off a lost limb, water off a wet fighter, a splash's crown
  const extras = createExtras(fxLayer, drops); // water and era extras: splash crowns, ripples, tar bubbles, Space sparks, Gravity Hammer rings
  const limbs = createLimbs(paintLayer, drops, splatTexs); // a lost limb: paint dripping from its cut end, a pool where it lies
  const fx = createFx(fxLayer, splatTexs);
  const motion = createMotion(fxLayer, fx.puff, paintLayer, splatTexs); // swing trails, hit dabs, dust, a hurt fighter's paint landing on the floor
  const flames = createFlames(fxLayer); // the arena's fires, and flames on whatever is burning
  const mammoth = createMammoth(propLayer);
  const passing = createPassing(fxLayer); // signs and tunnels passing the train (in front of everyone)
  const doors = createDoors(propLayer); // trapdoors in the floor
  const chariot = createChariot(fxLayer); // the runaway chariot (in front of everyone: it runs them down)
  const jets = createJets(fxLayer); // water leaking from the water tower
  /** A weapon's or a thing's colour: a gun's metal, scenery's own wood, otherwise the stick colour. */
  const thingColor = (p: Part) => (p.weapon?.gun ? T.colors.gun : T.colors.things[p.weapon?.id ?? ''] ?? T.colors.stick);
  const sea = createSea((x, y, speed, tar) => { ring(x, y, tar ? 0x3a2c20 : 0xffffff); extras.splash(sim, x, y, speed, tar); }); // the ship and the near water, on a map with a sea; a ring and a crown where something goes in
  actors.addChildAt(sea.hull, 0); // (the ship is the floor: behind everything in the play plane)
  const decorLayer = new Container(), decor = createDecor(decorLayer); // a map's painted scenery (a torii gate): behind everything in the play plane
  actors.addChildAt(decorLayer, 0);
  view.addChildAt(sea.water, view.getChildIndex(front)); // the water: in front of the play plane, behind the front plane
  view.addChildAt(extras.surface, view.getChildIndex(sea.water) + 1); // ripples and tar bubbles: on the water's surface, in front of it
  const playerColor = (i: number) => (sim.looks[i]?.bot ? BOT_GRAYS[i % BOT_GRAYS.length] : COLORS[sim.looks[i]?.color ?? i % COLORS.length].hex); // each player's chosen colour (a bot is a shade of gray)
  const fighterColor = (f: Fighter) => (f.controlled ? playerColor(f.index) : T.colors.dummy); // the training dummy has its own colour

  /** The body a costume fits: the torso pill and, kept clear, the head. */
  const costumeBody = () => ({ r: T.fighter.torsoRadius, hl: T.legs.torsoHalf, y: T.legs.torsoY, headY: T.fighter.headY, headR: T.fighter.headRadius });
  // Paint every lobby colour's body parts in idle moments after start-up, so picking a colour never stalls a round.
  const prewarm: (() => void)[] = [];
  const P0 = T.finish.paint, K0 = { relief: P0.relief, bristle: P0.bristle, jitter: P0.jitter, under: P0.under };
  for (const hex of [...COLORS.map((c) => c.hex), ...BOT_GRAYS]) for (const p of sim.fighters[0]?.parts ?? []) for (const s of p.shapes) {
    const col = p.role === 'stick' ? T.colors.stick : p.role === 'off' ? mix(hex, 0x000000, 0.32) : p.role === 'upper' || p.role === 'fore' || p.role === 'thigh' || p.role === 'shin' ? mix(hex, 0x000000, 0.18) : hex;
    if (s.k !== 'box') prewarm.push(() => paintedShape(s.k === 'ball' ? { k: 'ball', r: s.r } : { k: 'cap', r: s.r, hl: s.hl }, col, K0));
  }
  // every era's costume, in the order a match plays them (round 1 needs the first at once); one per colour where it is dyed in the wearer's
  for (const era of eras) if (COSTUMES[era.id]) for (const hex of COSTUMES[era.id].some((p) => p.c === 'player') ? [...COLORS.map((c) => c.hex), T.colors.dummy] : [0]) prewarm.push(() => paintedCostume(era.id, costumeBody(), hex, K0));
  for (const it of ITEMS) if (it.spec.len * it.spec.thick <= 1.5) prewarm.push(() => paintedWeapon(it.id, it.spec.len, K0)); // every weapon's picture (not the big scenery: a gatehouse or an obelisk took seconds; a map paints its own when it is loaded)
  for (const hat of HATS) for (const c of COLORS) prewarm.push(() => { const k = new Container(); makeHat(hat, k, 0, 0, T.fighter.headRadius, c.hex); k.destroy({ children: true }); }); // and every hat (painted once; the cap, top hat and beanie per colour)
  // Only while nothing is being drawn (a menu is up): one job can take over 100 ms, a visible freeze in a fight. Anything still unpainted
  // when it is needed is painted then, as before the warm-up.
  let drawnAt = 0, warmOn = true; // warmOn: only while a menu is up (main.ts): in a match the museum between rounds draws without draw(), and a job there froze it (or the round after it) for seconds
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 50));
  const warmNext = () => { if (!warmOn || performance.now() - drawnAt < 300) { idle(warmNext); return; } const job = prewarm.shift(); if (job) { job(); idle(warmNext); } };
  idle(warmNext);

  let scale = 1, shake = 0, builtVersion = -1;
  const entries: Entry[] = [];

  const propEntries: { p: Part; k: Container; painted: Painted[]; under: Container }[] = [];
  let boil = 0, variant = 0; // the painted fighters "boil": their brush strokes change a few times a second

  function rebuild() {
    for (const e of propEntries) e.k.destroy({ children: true });
    propEntries.length = 0;
    for (const p of sim.props) {
      const k = new Container(), under = new Container();
      k.addChild(under);
      const art = addWeapon(k, p);
      if (art) addWeapon(under, p, UNDER); else for (const s of p.shapes) under.addChild(drawShape(s, UNDER));
      const painted = art ? [art] : p.shapes.map((s, i) => addPainted(k, s, i > 0 && p.weapon?.gun ? T.colors.stick : thingColor(p)));
      if (p.weapon?.id === 'pane') k.alpha = T.finish.glassAlpha; // (glass: you see through it)
      propLayer.addChild(k);
      propEntries.push({ p, k, painted, under });
    }
    for (const e of entries) { e.group.destroy({ children: true }); e.shade.destroy({ children: true }); }
    sea.build(sim);
    decor.build(sim);
    flames.build(sim);
    mammoth.build(sim);
    light.build(sim);
    passing.build(sim, propLayer);
    doors.build(sim);
    chariot.build(sim);
    // The front plane of this arena (looks only).
    for (const it of frontItems) it.s.destroy();
    frontItems.length = 0;
    const pa = paintingFor(sim.era), PK = { relief: T.finish.paint.relief, bristle: T.finish.paint.bristle, jitter: T.finish.paint.jitter, under: T.finish.paint.under };
    for (const it of sim.arena.front) {
      const s = new Sprite(paintedFront(it.kind, pa.side.slice(0, 4), PK));
      s.anchor.set(0.5, 1);
      s.scale.set((it.scale ?? 1) / PPM);
      s.position.set(it.x, it.y);
      front.addChild(s);
      frontItems.push({ s, x: it.x, speed: it.speed ?? 0 });
    }
    fighterLayer.removeChildren();
    entries.length = 0;
    for (const f of sim.fighters) {
      const group = new Container();
      const base = fighterColor(f);
      group.sortableChildren = true;
      const c: Container[] = [], eyes: Container[] = [], painted: Painted[][] = [], under: Container[] = [], soft: Container[] = [], shadeC = new Container();
      let hatView: HatView | null = null, googly: Entry['googly'] = null, head: Entry['head'] = null, costume: Entry['costume'] = null;
      shadows.addChild(shadeC);
      const underAll = new Container();
      underAll.zIndex = -10;
      group.addChild(underAll);
      const bot = f.controlled && !!sim.looks[f.index]?.bot; // a computer player: a gray robot, no hat, no cape
      const cape = makeCape(group, paintedCape(parseInt(paintingFor(sim.era).hot.slice(1), 16), { relief: T.finish.paint.relief, bristle: T.finish.paint.bristle, jitter: T.finish.paint.jitter, under: T.finish.paint.under }));
      for (const p of f.parts as Part[]) {
        const k = new Container(), u = new Container();
        k.zIndex = p.role === 'off' ? -2 : p.role === 'stick' || p.role === 'flail' ? -0.5 : p.role === 'thigh' || p.role === 'shin' ? -1 : 0; // the second arm is behind everything, then the legs; a held club is behind the hand and arm so it looks gripped
        const color = p.role === 'stick' || p.role === 'flail' ? thingColor(p) : base;
        const shade = p.role === 'off' ? mix(color, 0x000000, 0.32) : p.role === 'upper' || p.role === 'fore' || p.role === 'thigh' || p.role === 'shin' ? mix(color, 0x000000, 0.18) : color;
        const art = p.role === 'stick' || p.role === 'flail' ? addWeapon(k, p) : null;
        painted.push(art ? [art] : p.shapes.map((s, i) => addPainted(k, s, p.role === 'stick' && i > 0 && p.weapon?.gun ? T.colors.stick : shade)));
        if (p.role === 'torso' && !bot) { // the era's costume over the body, under the hat (a bot stays a plain robot, as with the cape)
          const P = T.finish.paint, made = paintedCostume(sim.era, costumeBody(), base, { relief: P.relief, bristle: P.bristle, jitter: P.jitter, under: P.under });
          if (made) { const sp = new Sprite(made.tex[0]); sp.anchor.set(made.ax, made.ay); sp.scale.set(1 / PPM); k.addChild(sp); costume = { s: sp, tex: made.tex }; }
        }
        if (art) addWeapon(u, p, UNDER); else for (const s of p.shapes) u.addChild(drawShape(s, UNDER));
        underAll.addChild(u);
        under.push(u);
        const sh = new Container();
        if (art) addWeapon(sh, p, 0x000000); else for (const s of p.shapes) sh.addChild(drawShape(s, 0x000000));
        shadeC.addChild(sh);
        soft.push(sh);
        // The hat goes on the head: the head part once it has come off, otherwise the head ball on the torso.
        const hat = f.controlled && !bot ? sim.looks[f.index]?.hat : undefined;
        const onHead = p.role === 'head' || (p.role === 'torso' && !f.ragdolled);
        if (hat && onHead) {
          hatView = makeHat(hat, k, 0, p.role === 'torso' ? T.fighter.headY : 0, T.fighter.headRadius, color);
        }
        if (onHead) {
          const hy = p.role === 'torso' ? T.fighter.headY : 0, ey = bot ? drawRobotHead(T.fighter.headRadius, base) : drawEyes(T.fighter.headRadius, f.controlled ? sim.looks[f.index]?.eyes : 'round', base);
          ey.position.set(0, hy); k.addChild(ey); eyes.push(ey);
          if (hatView?.glasses) eyes.push(hatView.glasses); // (glasses turn and go limp with the eyes)
          googly = bot ? null : makeGoogly(ey, 0, hy, T.fighter.headRadius);
          head = k;
        }
        group.addChild(k);
        c.push(k);
      }
      if (bot) cape.rope.parent!.visible = false;
      fighterLayer.addChild(group);
      entries.push({ f, group, c, eyes, hat: hatView, costume, googly, head, painted, under, soft, shade: shadeC, cape, blur: new BlurFilter({ strength: 0, quality: 3 }), vis: 0, crushed: false, sq: 0, hand: f.side });
    }
    builtVersion = sim.version;
  }

  return {
    /** The picture itself (a highlight can be saved as a video from it). */
    canvas: app.canvas,
    /** For the museum between eras: the app, what the fight draws, and where its picture is on screen. */
    app, game,
    box() { const s = Math.min(app.screen.width / A.viewW, app.screen.height / A.viewH); return { x: (app.screen.width - A.viewW * s) / 2, y: (app.screen.height - A.viewH * s) / 2, w: A.viewW * s, h: A.viewH * s }; },
    /** Draw another copy of the game from now on (a replay), or the live one again. The picture starts clean. */
    /** Graphics quality (the settings screen): how much the picture asks of the computer. */
    setQuality(level: Quality) {
      Q = QUALITY[level];
      T.finish.paint.width = Q.paintWidth; // (a new width paints the backdrops again, once, and keeps them)
      app.renderer.resolution = Math.min(window.devicePixelRatio, Q.maxResolution);
      app.renderer.resize(app.screen.width, app.screen.height);
      front.filters = Q.blur ? [frontBlur] : null;
      paintLayer.filters = Q.blur ? [paintBlur] : null; // (Low: no blur anywhere, for slower computers)
      grain.visible = Q.grain;
      builtVersion = -1; // (repaint everything)
    },
    /** The warm-up may paint (a menu is up) or not (a match, its museum). */
    warm(on: boolean) { warmOn = on; },
    show(s: Sim) { sim = s; builtVersion = -1; paintedEra = ''; shownRound = -1; shake = 0; },
    /** Everything a fight in `s` needs, painted before it is shown (owner: nothing half-painted): its fighters (colours, costumes, hats), the
     *  things on its map, the era's pickups, and its backdrop (the next round's is started). Only what it needs: the rest of the warm-up
     *  (every other colour, era and weapon) waits for idle moments. Resolves when done, or after `maxMs` so a slow machine still gets its fight. */
    /** Online: the Hall knows the match's seed before the host starts, so its first two rounds' backdrops are painted while everyone readies up. */
    prepare(seed: number) { for (const round of [1, 2]) { const era = eraFor(seed, round).id; backdrops.prefetch(era, arenaFor(era, mapFor(seed, round, era))); } },
    async preload(s: Sim, maxMs: number): Promise<void> {
      const t0 = performance.now(), shown = sim, up = s.upcoming();
      const backdrop = backdrops.ready(s.era, s.arena); // (painted in its worker meanwhile)
      sim = s; rebuild(); sim = shown; builtVersion = -1; // (everything this round shows is painted building it once; whatever is shown is built again next draw)
      for (const id of eraById(s.era).pickups ?? []) { const p = PROPS[id]; if (p) paintedWeapon(id, p.len, K0); } // (and what will drop in)
      await Promise.race([backdrop, new Promise((ok) => setTimeout(ok, Math.max(0, maxMs - (performance.now() - t0))))]);
      backdrops.prefetch(up.era, up.arena);
    },
    /** Screen pixels -> world metres. */
    toWorld(px: number, py: number) { return { x: (px - view.x) / view.scale.x, y: (py - view.y) / view.scale.y }; },
    onEvent(e: SimEvent) {
      fx.onEvent(e);
      extras.onEvent(e, sim);
      motion.onEvent(e, sim.era);
      frame.onEvent(e, A.viewW, A.viewH);
      if (e.t === 'hit' || e.t === 'stomp') {
        const boost = e.head ? 1.5 : 1;
        const big = e.v * boost - T.shake.minImpact; // only big hits shake the screen
        if (big > 0) shake = Math.min(T.shake.max, Math.max(shake, big * T.shake.perImpact));
        if (e.victim >= 0) spray(e, fighterColor(sim.fighters[e.victim] ?? sim.fighters[0])); // the hurt player's own paint
        if (e.victim >= 0) { const a = sim.fighters[e.owner]?.torso, b = sim.fighters[e.victim]?.torso; motion.hitPaint(e.x, e.y, a && b ? Math.sign(b.cx - a.cx) || 1 : 1, paintOf(fighterColor(sim.fighters[e.victim] ?? sim.fighters[0])), e.v); } // ...flying off onto the floor
        if (e.v * boost >= T.indicator.minImpact) ring(e.x, e.y, T.indicator.color);
        if (e.how === 'shot') shake = Math.max(shake, Math.min(T.shake.max, (PROPS[e.w ?? '']?.gun?.push ?? 0) * T.guns.pushMul * T.finish.bullets.hitShake)); // shot: a jolt, bigger the harder the gun shoves
      } else if (e.t === 'shot') { // a gun going off kicks the picture, the big ones hard (owner: guns felt at both ends)
        shake = Math.max(shake, Math.min(T.shake.max, (PROPS[e.w ?? '']?.gun?.kick ?? 0) * T.guns.kickMul * T.finish.bullets.shotShake));
      } else if (e.t === 'disarm') {
        ring(e.x, e.y, 0xffd24a); // a golden ring where a club is knocked loose
      } else if (e.t === 'explode') { // a cartoon burst: big rings and a spray of colour (the pieces fly on their own)
        ring(e.x, e.y, 0xffffff); ring(e.x, e.y, 0xffd24a);
        shake = Math.max(shake, T.death.shake);
        for (let i = 0; i < 8; i++) splat(e.x + Math.cos(i * 0.785) * 0.4, e.y + Math.sin(i * 0.785) * 0.4, T.splat.radiusMax, playerColor(e.victim));
      } else if (e.t === 'fall') { // someone went off the stage: streaks of their paint fly onto the canvas from where they went out
        const S = T.splat.streaks;
        paintStreaks(e.x, e.y, S.color === 'player' ? fighterColor(sim.fighters[e.owner] ?? sim.fighters[0]) : S.color);
        shake = Math.max(shake, T.death.shake);
      } else if (e.t === 'crash') { // a knocked-down fighter hitting a wall or the floor
        ring(e.x, e.y, 0xffffff);
        shake = Math.max(shake, Math.min(T.shake.max, e.v * T.knock.crashShake));
      } else if (e.t === 'cut') {
        ring(e.x, e.y, 0xc9a26a); // a snapped rope or plank
        shake = Math.max(shake, T.bridge.shake);
      } else if (e.t === 'dismember') {
        ring(e.x, e.y, 0xffffff);
        limbs.onEvent(e, sim, playerColor(e.victim));
        splat(e.x, e.y, T.splat.radiusMax * 0.8, playerColor(e.victim));
      } else if (e.t === 'boom') {
        shake = Math.max(shake, T.shake.max * T.special.blastShake);
      } else if (e.t === 'crush') {
        const v = entries.find((x) => x.f.index === e.victim);
        if (v) v.crushed = true;
        ring(e.x, e.y + 0.3, 0xcccccc);
        shake = Math.max(shake, T.death.shake);
      } else if (e.t === 'splash') { // a bullet into the water: a ring and a small crown
        ring(e.x, e.y, 0xffffff);
        extras.splash(sim, e.x, e.y, T.finish.extras.crownSpeed * 0.4, false);
      } else if (e.t === 'parry') {
        ring(e.x, e.y, 0x9fe8ff); // a bright double ring where a swing is blocked, and a little shake
        ring(e.x, e.y, 0xffffff);
        shake = Math.max(shake, T.parry.shake);
      }
    },
    /** Draw the world between its last two states (alpha). own: online prediction moves your fighter on its own ticks (its own alpha), drawn
     *  shifted by (dx, dy) while it slides to a fresh guess. */
    draw(alpha: number, frameSeconds: number, own?: { slot: number; alpha: number; dx: number; dy: number }, target?: RenderTexture) {
      drawnAt = performance.now();
      scale = Math.min(app.screen.width / A.viewW, app.screen.height / A.viewH);
      vignette.width = app.screen.width;
      vignette.height = app.screen.height;
      const px = app.screen.height / 1080;
      actors.filterArea = new Rectangle(0, 0, app.screen.width, app.screen.height);
      setOilScale(oil, app.screen.height / 1080);
      grain.width = tintWash.width = dusk.width = app.screen.width;
      grain.height = tintWash.height = dusk.height = app.screen.height;
      { // sudden death (tuning.match.suddenDeath): as everyone left drains, the edges close in and the picture darkens, throbbing
        const D = T.finish.dusk, late = sim.matchActive && !sim.roundOver ? (sim.frame - T.match.suddenDeath.after) * T.sim.dt : 0, k = Math.min(1, Math.max(0, late) / D.seconds);
        dusk.tint = D.color;
        dusk.alpha = k * D.wash * (1 + D.throb * Math.sin(performance.now() * 0.001 * Math.PI * 2 * D.rate));
        vignette.alpha = T.finish.vignetteAlpha + (1 - T.finish.vignetteAlpha) * k * D.vignette;
      }
      paintBlur.strength = T.finish.paintBlur * px;
      if (sim.round !== shownRound) { // a new round: the picture is clean again (the paint lasts the whole round)
        shownRound = sim.round;
        for (const s of splats) s.visible = false;
        for (const s of streaks) s.visible = false;
        fx.clear();
        limbs.clear();
        extras.clear();
        drops.clear();
        motion.clear();
        frame.clear();
        growing.length = 0; flying.length = 0;
      }
      for (let i = flying.length - 1; i >= 0; i--) { // streaks shooting across (fast, slowing as they land)
        const f = flying[i]; f.t += frameSeconds;
        const k = Math.min(1, Math.max(0, (f.t - f.delay) / T.splat.streaks.seconds));
        f.s.scale.x = (f.len / 100) * (1 - (1 - k) ** 3);
        if (k >= 1) flying.splice(i, 1);
      }
      for (let i = growing.length - 1; i >= 0; i--) { const g = growing[i]; g.t += frameSeconds; const k = Math.min(1, g.t / g.dur); g.s.scale.set(g.to * k * (2 - k)); if (k >= 1) growing.splice(i, 1); }
      if (paintedEra !== sim.era) paintArena(sim.era); // a new round in a new era
      const tex = backdrops.get(sim.era, sim.arena); // the painted backdrop (null while it is being painted)
      if (tex && painted.texture !== tex) { painted.texture = tex; painted.width = A.viewW; painted.height = A.viewH; backdrops.prefetch(sim.upcoming().era, sim.upcoming().arena); }
      painted.visible = !!tex;
      flat.visible = !tex;
      const speed = sim.arena.roll, W = A.viewW, roll = speed && tex ? ((((speed * (sim.frame - 1 + alpha) * T.sim.dt) % (2 * W)) + 2 * W) % (2 * W)) : 0;
      painted.x = -roll;
      backdrop.filters = speed && Q.blur ? [rollBlur] : null;
      rollBlur.strengthX = speed * T.finish.rollBlur * px; rollBlur.strengthY = 0;
      rolling.forEach((r, i) => {
        r.visible = !!speed && !!tex;
        if (!r.visible) return;
        r.texture = tex!; r.height = A.viewH; r.width = W;
        if (i === 0) { r.scale.x = -Math.abs(r.scale.x); r.x = 2 * W - roll; } else r.x = 2 * W - roll; // (the mirrored copy reaches back from its right edge)
      });
      if (builtVersion !== sim.version) rebuild();
      boil += frameSeconds * T.finish.boilFps;
      const wind = windAt(sim.arena, sim.frame - 1 + alpha); // (sways capes, grass, smoke, flames, paint, trails)
      windNow = wind;
      variant = Q.boil ? Math.floor(boil) % VARIANTS : 0;
      const off = T.finish.underOffset, SH = T.finish.shadow;
      shadowBlur.strength = SH.blur * px;
      shadows.alpha = SH.alpha;
      shadows.visible = Q.shadows;
      frontBlur.strength = T.finish.front.blur * px;
      const span = A.viewW + 4, now = boil / T.finish.boilFps; // a moving front item slides across and comes round again
      for (const it of frontItems) {
        if (it.speed) it.s.x = ((((it.x + it.speed * now + 2) % span) + span) % span) - 2;
        it.s.skew.x = -(wind * T.finish.wind.grass + Math.sin(now * 2.3 + it.x) * Math.abs(wind) * 0.006); // grass bends with the wind
      }
      ropes.clear();
      for (const { p, k, painted: pp, under } of propEntries) {
        k.position.set(lerp(p.px, p.cx, alpha), lerp(p.py, p.cy, alpha));
        k.rotation = p.pa + wrap(p.ca - p.pa) * alpha;
        k.scale.x = p.flipped ? -1 : 1; // an empty gun is drawn turned round (held by the barrel)
        under.position.set(off * (Math.cos(k.rotation) + Math.sin(k.rotation)), off * (Math.cos(k.rotation) - Math.sin(k.rotation))); // world offset down-right
        for (const q of pp) updatePainted(q, k.rotation, variant);
        if (p.hang && p.links?.length) { const h = (p.weapon?.thickness ?? 0.3) / 2; ropes.moveTo(p.hang.x, p.hang.y).lineTo(k.x + Math.sin(k.rotation) * h, k.y - Math.cos(k.rotation) * h).stroke({ width: 0.03, color: 0x2a1c12 }); } // a lantern's rope
      }
      shake *= Math.pow(T.shake.decayPerSecond, frameSeconds);
      for (const r of rings) {
        if (!r.g.visible) continue;
        r.age += frameSeconds / T.indicator.seconds;
        if (r.age >= 1) { r.g.visible = false; continue; }
        r.g.scale.set((0.2 + r.age * T.indicator.radius) / 50); // metres: grows from small to full size (the ring is drawn with radius 50)
        r.g.alpha = 1 - r.age;
      }
      const sx = (Math.random() - 0.5) * 2 * shake, sy = (Math.random() - 0.5) * 2 * shake;
      { // the camera: two fighters left in a fight, it eases in a little on them
        const C = T.camera, alive = sim.matchActive && !sim.roundOver ? sim.fighters.filter((f) => f.controlled && !f.limp && !sim.gone[f.index]) : [];
        let tz = 1, tx = A.viewW / 2, ty = A.viewH / 2;
        if (alive.length === 2) {
          const [a, b] = alive.map((f) => f.torso), x0 = Math.min(a.cx, b.cx) - C.margin, x1 = Math.max(a.cx, b.cx) + C.margin, y0 = Math.min(a.cy, b.cy) - C.margin, y1 = Math.max(a.cy, b.cy) + C.margin;
          tz = Math.max(1, Math.min(C.twoLeftZoom, A.viewW / (x1 - x0), A.viewH / (y1 - y0)));
          tx = (x0 + x1) / 2; ty = (y0 + y1) / 2;
        }
        const k = 1 - Math.exp(-C.ease * frameSeconds);
        zoom += (tz - zoom) * k; camX += (tx - camX) * k; camY += (ty - camY) * k;
        const hw = A.viewW / (2 * zoom), hh = A.viewH / (2 * zoom), cx = Math.max(hw, Math.min(A.viewW - hw, camX)), cy = Math.max(hh, Math.min(A.viewH - hh, camY));
        view.scale.set(scale * zoom);
        view.position.set(app.screen.width / 2 - cx * scale * zoom + sx, app.screen.height / 2 - cy * scale * zoom + sy);
        const zoomed = zoom > 1.001;
        if (zoomed) box.clear().rect((app.screen.width - A.viewW * scale) / 2, (app.screen.height - A.viewH * scale) / 2, A.viewW * scale, A.viewH * scale).fill(0xffffff);
        view.mask = zoomed ? box : null;
        box.visible = zoomed;
      }
      light.draw(sim, now);
      for (const e of entries) {
        const { f, c } = e;
        const so = light.shadowOf(lerp(f.torso.px, f.torso.cx, alpha), lerp(f.torso.py, f.torso.cy, alpha), SH); // the shadow falls away from the nearest light
        e.vis = Math.min(1, Math.max(0, e.vis + ((f.inBack ? 1 : 0) - e.vis) * Math.min(1, T.dodge.visualRate * frameSeconds)));
        if (e.crushed) e.sq = Math.min(1, e.sq + frameSeconds / T.death.squashSeconds);
        const tint = mix(0xffffff, 0x55556a, e.vis * T.dodge.visualShade); // behind everyone: a little darker (no damage tint: health stays hidden)
        e.blur.strength = e.vis * T.dodge.visualBlur * px;
        e.group.filters = Q.blur && e.vis > 0.02 ? [e.blur] : null; // no filter cost unless they are dodging
        const layer = f.inBack ? backLayer : fighterLayer;
        if (e.group.parent !== layer) layer.addChild(e.group);
        const mine = own && f.index === own.slot, a = mine ? own.alpha : alpha, sx = mine ? own.dx : 0, sy = mine ? own.dy : 0;
        f.parts.forEach((p, i) => {
          const k = c[i];
          k.position.set(lerp(p.px, p.cx, a) + sx, lerp(p.py, p.cy, a) + sy);
          k.rotation = p.pa + wrap(p.ca - p.pa) * a + (p === f.stick ? fx.twirl(f.index) : 0); // (an emptied gun twirls round in the hand)
          if (p === f.stick && f.grip) e.hand = f.side;
          if (p === f.stick) { const half = ((p.weapon?.length ?? 1) / 2) * (p.flipped ? -1 : 1); motion.track(f.index, k.x + Math.cos(k.rotation) * half, k.y + Math.sin(k.rotation) * half, !!f.grip && !f.limp, f.release > 0, p.weapon?.impactFactor ?? T.stick.impactFactor, c[0].x, c[0].y); } // (its tip, for the swing trail)
          if (p.role === 'stick') k.scale.set(p.flipped ? -1 : 1, e.hand);
          k.tint = tint;
          const u = e.under[i];
          u.position.set(k.x + off, k.y + off);
          u.rotation = k.rotation;
          u.scale.copyFrom(k.scale);
          for (const q of e.painted[i]) updatePainted(q, k.rotation, variant);
          const sh = e.soft[i];
          sh.position.set(k.x + so.x, k.y + so.y);
          sh.rotation = k.rotation;
          sh.scale.copyFrom(k.scale);
        });
        e.shade.alpha = (1 - e.vis) * so.a; // a fighter slipping into the background plane leaves the play plane's shadow behind
        for (const ey of e.eyes) ey.scale.x = f.side * (f.limp ? 0.6 : 1); // look the way you face
        if (e.head) { const k = e.head; e.hat?.step(k.x, k.y, k.rotation, f.side, frameSeconds, now, wind); e.googly?.step(k.x, k.y, k.rotation, f.side, frameSeconds, now, wind); } // (what sways on the head)
        e.hat?.show(variant, f.side);
        if (e.costume) { e.costume.s.texture = e.costume.tex[variant]; e.costume.s.scale.x = f.side / PPM; }
        const torso = c[0], tc = Math.cos(torso.rotation), ts = Math.sin(torso.rotation), cx = -f.side * T.finish.cape.backX, cy = T.finish.cape.shoulderY;
        stepCape(e.cape, torso.x + tc * cx - ts * cy, torso.y + ts * cx + tc * cy, f.side, frameSeconds, boil / T.finish.boilFps, variant, wind);
        // Dodge: the fighter turns toward the screen (looks narrower), slips behind everyone else and sits a touch higher, then turns back.
        e.group.pivot.set(torso.x, torso.y);
        e.group.position.set(torso.x, torso.y - T.dodge.visualRaise * e.vis + T.death.squashDrop * e.sq);
        e.group.scale.set(lerp(1, T.dodge.visualSquash, e.vis) * (1 + T.death.squashWide * e.sq), lerp(1, 0.97, e.vis) * (1 - T.death.squashFlat * e.sq));
      }
      motion.draw(frameSeconds, sim.era, sim.arena);
      for (const p of [...sim.props, ...sim.fighters.flatMap((f) => f.parts)]) { // chain weapons: the chain, a run of links from the handle's far end to its head
        const h = p.head;
        if (!h) continue;
        const a = lerp(p.pa, p.ca, alpha), half = (p.weapon?.length ?? 0.4) / 2, tx = lerp(p.px, p.cx, alpha) + Math.cos(a) * half, ty = lerp(p.py, p.cy, alpha) + Math.sin(a) * half;
        const hx = lerp(h.px, h.cx, alpha), hy = lerp(h.py, h.cy, alpha), d = Math.hypot(hx - tx, hy - ty), n = Math.max(2, Math.round(d / 0.045));
        const color = p.weapon?.id === 'flail' ? 0xd9a93a : 0x6a7077;
        for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; ropes.circle(tx + (hx - tx) * t, ty + (hy - ty) * t, 0.02).stroke({ width: 0.012, color }); }
      }
      for (const z of sim.zones) { // a black hole: a dark middle, a violet rim, rings closing in on it
        const t = (performance.now() / 1000) % 1;
        for (let r = 0; r < 3; r++) { const k = 1 - ((t + r / 3) % 1); ropes.circle(z.x, z.y, 0.3 + 2.6 * k).stroke({ width: 0.03, color: 0x8a5cff, alpha: 0.5 * (1 - k) }); }
        ropes.circle(z.x, z.y, 0.34).fill({ color: 0x8a5cff, alpha: 0.6 }).circle(z.x, z.y, 0.26).fill(0x0b0814);
      }
      for (const f of sim.fighters) { // the ray guns' effects (sim/effects.ts): a block of ice round the frozen, a bubble round the floating
        if ((!f.frozen && !f.bubble) || f.limp) continue;
        const cx = lerp(f.torso.px, f.torso.cx, alpha), cy = lerp(f.torso.py, f.torso.cy, alpha);
        if (f.frozen) ropes.roundRect(cx - 0.5, cy - 1.0, 1.0, 2.0, 0.18).fill({ color: 0xbfe6f5, alpha: 0.42 }).stroke({ width: 0.03, color: 0xeaf8ff, alpha: 0.8 });
        if (f.bubble) ropes.circle(cx, cy + 0.15, 1.05).fill({ color: 0xd8f0ff, alpha: 0.16 }).stroke({ width: 0.025, color: 0xffffff, alpha: 0.55 }).circle(cx - 0.4, cy - 0.35, 0.14).fill({ color: 0xffffff, alpha: 0.5 });
      }
      for (const f of sim.fighters) { // tangled in a net: the mesh over them
        if (!f.tangled || f.limp) continue;
        const cx = lerp(f.torso.px, f.torso.cx, alpha), cy = lerp(f.torso.py, f.torso.cy, alpha) + 0.1, R = 0.55;
        for (let i = -3; i <= 3; i++) {
          const o = (i / 3) * R;
          ropes.moveTo(cx + o - R * 0.6, cy - R).lineTo(cx + o + R * 0.6, cy + R).stroke({ width: 0.018, color: 0x9c8458 });
          ropes.moveTo(cx + o + R * 0.6, cy - R).lineTo(cx + o - R * 0.6, cy + R).stroke({ width: 0.018, color: 0x9c8458 });
        }
      }
      for (let k = 0, H = sim.hookLines; k + 3 < H.length; k += 4) { // grappling hooks: the rope from the hook's end of the weapon (sagging while it flies, taut once it bites), and the hook
        const e = entries[H[k]], st = e?.f.stick, c = st ? e.c[e.f.parts.indexOf(st)] : undefined;
        if (!e || !st || !c) continue;
        const half = ((st.weapon?.length ?? 1) / 2) * c.scale.x, tx = c.x + Math.cos(c.rotation) * half, ty = c.y + Math.sin(c.rotation) * half, hx = H[k + 1], hy = H[k + 2];
        if (st.weapon?.gun?.beam) { ropes.moveTo(tx, ty).lineTo(hx, hy).stroke({ width: 0.16, color: 0x8a5cff, alpha: 0.25 }).moveTo(tx, ty).lineTo(hx, hy).stroke({ width: 0.04, color: 0xd9c8ff, alpha: 0.9 }); continue; } // a tractor beam: a violet ray
        const sag = (H[k + 3] ? 0.02 : 0.12) * Math.hypot(hx - tx, hy - ty);
        ropes.moveTo(tx, ty).quadraticCurveTo((tx + hx) / 2, (ty + hy) / 2 + sag, hx, hy).stroke({ width: 0.035, color: T.colors.things.rope ?? 0xb09a6a });
        if (st.weapon?.lasso) ropes.ellipse(hx, hy, 0.16, 0.1).stroke({ width: 0.03, color: T.colors.things.rope ?? 0xb09a6a }); // the loop
        else ropes.circle(hx, hy, 0.06).fill(0x3a3e43);
      }
      for (const e of entries) { // a gun in hand: the Marksman's thin aim line while it is held still; a charging gun glowing at its mouth
        const st = e.f.stick, G = st?.weapon?.gun, c = st && e.f.grip && G && !st.flipped ? e.c[e.f.parts.indexOf(st)] : undefined;
        if (!c || !G || (!G.aimLine && !e.f.gunCharge)) continue;
        const half = ((st!.weapon?.length ?? 1) / 2) * c.scale.x, ca = Math.cos(c.rotation), sa = Math.sin(c.rotation), tx = c.x + ca * half, ty = c.y + sa * half;
        if (G.aimLine && Math.hypot(st!.cx - st!.px, st!.cy - st!.py) < 0.01) ropes.moveTo(tx, ty).lineTo(tx + ca * 16, ty + sa * 16).stroke({ width: 0.035, color: 0xd8402a, alpha: 0.55 });
        if (e.f.gunCharge && G.charge) ropes.circle(tx, ty, 0.04 + 0.14 * (e.f.gunCharge / G.charge)).fill({ color: G.look?.color ?? 0xffffff, alpha: 0.5 });
      }
      sea.draw(sim, alpha);
      fx.draw(sim, alpha, frameSeconds, wind);
      limbs.draw(alpha, frameSeconds);
      extras.draw(sim, frameSeconds);
      drops.draw(frameSeconds);
      flames.draw(sim, alpha, frameSeconds, variant, wind);
      mammoth.draw(sim, alpha);
      passing.draw(sim, alpha);
      doors.draw(sim, alpha);
      chariot.draw(sim, alpha);
      jets.draw(sim, frameSeconds, wind);
      const bx = (app.screen.width - A.viewW * scale) / 2, by = (app.screen.height - A.viewH * scale) / 2;
      frame.draw({ x: bx, y: by, w: A.viewW * scale, h: A.viewH * scale }, frameSeconds);
      if (target) { // into a painting (the museum): just the picture, cropped to its box
        const was = game.visible;
        game.visible = true;
        game.position.set(-bx, -by);
        app.renderer.render({ container: game, target, clear: true });
        game.position.set(0, 0);
        game.visible = was;
      } else app.render();
    },
  };
}
export type Renderer = Awaited<ReturnType<typeof createRenderer>>;

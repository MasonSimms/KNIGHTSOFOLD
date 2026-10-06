import { Application, BlurFilter, Container, Graphics, MeshRope, Point, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import { eraById } from '../content/eras';
import { COLORS } from '../content/looks';
import { createOilFilter, setOilScale } from './oilpaint';
import { createBackdrops } from './painter/backdrops';
import { CAPE, paintedCape, paintedFront, paintedShape, paintedSplats, PPM, VARIANTS } from './painter/sprites';
import { paintingFor } from '../content/paintings';
import type { Hat } from '../content/looks';
import { tuning as T } from '../content/tuning';
import type { Fighter, Part, Shape } from '../sim/fighter';
import type { SimEvent } from '../sim/types';
import { wallXs } from '../sim/world';
import type { Sim } from '../sim/world';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (a: number) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// Pixi picks curve detail from the size it is drawn at, and our shapes are fractions of a metre, so draw big and scale down
// (otherwise heads come out as octagons).
const BIG = 100;

/** A hat for the head (placeholder vector shapes until the art arrives). Drawn at the origin = the centre of the head; units are metres. */
function drawHat(hat: Hat, tint: number, headR: number): Graphics | null {
  if (hat === 'none') return null;
  const g = new Graphics(), r = headR * BIG;
  const dark = mix(tint, 0x000000, 0.3);
  if (hat === 'cap') { g.arc(0, -r * 0.2, r * 1.02, Math.PI, 0).fill(dark); g.rect(-r * 0.2, -r * 0.35, r * 1.5, r * 0.28).fill(dark); }
  else if (hat === 'tophat') { g.rect(-r * 1.2, -r * 0.95, r * 2.4, r * 0.3).fill(0x222222); g.rect(-r * 0.7, -r * 2.2, r * 1.4, r * 1.3).fill(0x222222); g.rect(-r * 0.7, -r * 1.2, r * 1.4, r * 0.25).fill(tint); }
  else if (hat === 'helmet') { g.arc(0, -r * 0.1, r * 1.1, Math.PI, 0).fill(0x8a929b); g.rect(-r * 1.1, -r * 0.15, r * 2.2, r * 0.22).fill(0x6b727a); }
  else if (hat === 'crown') { g.poly([-r * 0.9, -r * 0.8, -r * 0.9, -r * 1.8, -r * 0.45, -r * 1.2, 0, -r * 1.9, r * 0.45, -r * 1.2, r * 0.9, -r * 1.8, r * 0.9, -r * 0.8]).fill(0xf2c230); }
  else if (hat === 'horns') { g.arc(0, -r * 0.1, r * 1.02, Math.PI, 0).fill(0x8a929b); g.poly([-r * 0.9, -r * 0.5, -r * 1.7, -r * 1.7, -r * 0.5, -r * 0.9]).fill(0xeeeeee); g.poly([r * 0.9, -r * 0.5, r * 1.7, -r * 1.7, r * 0.5, -r * 0.9]).fill(0xeeeeee); }
  else if (hat === 'cowboy') { g.ellipse(0, -r * 0.75, r * 1.9, r * 0.35).fill(0x8a6a44); g.rect(-r * 0.7, -r * 1.7, r * 1.4, r * 1.0).fill(0x8a6a44); }
  else if (hat === 'beanie') { g.arc(0, -r * 0.2, r * 1.05, Math.PI, 0).fill(tint); g.circle(0, -r * 1.3, r * 0.25).fill(0xffffff); }
  g.scale.set(1 / BIG);
  return g;
}

/** Big painted eyes (art direction, as in the package's fighters): two cream discs with dark pupils, drawn at the head's centre; the caller
 * flips them with the facing. They stay crisp (the package keeps eyes out of the paint). */
function drawEyes(headR: number): Container {
  const c = new Container(), r = headR * BIG, g = new Graphics();
  for (const dx of [-0.36, 0.41]) g.circle(r * dx, 0, r * 0.255).fill(0xf7f2e0).circle(r * (dx + 0.073), r * 0.023, r * 0.13).fill(0x120d0a);
  g.scale.set(1 / BIG);
  c.addChild(g);
  return c;
}

function drawShape(s: Shape, color: number): Graphics {
  const g = new Graphics();
  if (s.k === 'ball') g.circle(0, 0, s.r * BIG);
  else g.roundRect(-s.r * BIG, -(s.hl + s.r) * BIG, s.r * 2 * BIG, (s.hl + s.r) * 2 * BIG, s.r * BIG);
  g.fill(color);
  g.scale.set(1 / BIG);
  g.position.set(s.x, s.y);
  if (s.k === 'cap') g.rotation = s.rot;
  return g;
}

// The light comes from the upper left (as in the paintings). A painted capsule is lit from its own left; when the other side faces the
// light, its mirror image fades in instead.
const LX = -0.6, LY = -0.8;
const UNDER = 0x1a120d; // the dark underpaint showing at the lower right of every fighter and object (the package's lost-and-found edge)

/** One painted ball or capsule on a part: a sprite (and its mirror image, for a capsule). */
interface Painted { s: Shape; tex: Texture[]; a: Sprite; b: Sprite | null }
function addPainted(parent: Container, s: Shape, color: number): Painted {
  const P = T.finish.paint;
  const tex = paintedShape(s.k === 'ball' ? { k: 'ball', r: s.r } : { k: 'cap', r: s.r, hl: s.hl }, color, { relief: P.relief, bristle: P.bristle, jitter: P.jitter, under: P.under });
  const mk = (mirror: boolean) => {
    const sp = new Sprite(tex[0]);
    sp.anchor.set(0.5);
    sp.scale.set((mirror ? -1 : 1) / PPM, 1 / PPM);
    sp.position.set(s.x, s.y);
    if (s.k === 'cap') sp.rotation = s.rot;
    parent.addChild(sp);
    return sp;
  };
  return { s, tex, a: mk(false), b: s.k === 'cap' ? mk(true) : null };
}
/** Keep a painted shape lit from the upper left however its part is turned, and show this moment's boil variant. */
function updatePainted(p: Painted, partRot: number, variant: number): void {
  p.a.texture = p.tex[variant];
  if (p.b) {
    p.b.texture = p.tex[variant];
    const phi = partRot + (p.s.k === 'cap' ? p.s.rot : 0), d = Math.cos(phi) * LX + Math.sin(phi) * LY, t = Math.min(1, Math.max(0, (d + 0.2) / 0.4));
    p.b.alpha = t * t * (3 - 2 * t);
  } else p.a.rotation = -partRot; // a ball keeps its highlight at the upper left
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
function stepCape(c: Cape, ax: number, ay: number, side: number, dt: number, time: number, variant: number): void {
  const seg = CAPE.length / (CAPE_LINKS - 1), C = T.finish.cape;
  if (!c.live) { for (let i = 0; i < CAPE_LINKS; i++) { c.x[i] = c.px[i] = ax; c.y[i] = c.py[i] = ay + i * seg; } c.live = true; }
  const h = Math.min(dt, 1 / 30);
  for (let i = 1; i < CAPE_LINKS; i++) {
    const vx = (c.x[i] - c.px[i]) * C.damping, vy = (c.y[i] - c.py[i]) * C.damping;
    c.px[i] = c.x[i]; c.py[i] = c.y[i];
    c.x[i] += vx + (-side * C.trail + Math.sin(time * C.flutterRate + i * 0.9) * C.flutter) * h * h;
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
  blur: BlurFilter; // softens the fighter as they slip back into the background plane (dodge)
  crushed: boolean; // flattened by a stomp or a crash
  sq: number; // how flat (0..1, eases toward 1 once crushed)
}

export async function createRenderer(sim: Sim, host: HTMLElement) {
  const app = new Application();
  await app.init({ resizeTo: window, background: T.colors.void, antialias: true, autoDensity: true, resolution: window.devicePixelRatio });
  host.appendChild(app.canvas);
  app.ticker.stop(); // main.ts owns the loop and calls draw()

  const view = new Container(); // metres -> pixels, letterboxed, shaken
  app.stage.addChild(view);
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
    for (const g of A.ground.length ? A.ground : [{ x: A.platformX, w: A.platformW }]) platform.rect(g.x, A.platformTop, g.w, A.platformThickness).fill(era.platform);
    for (const l of A.ledges) platform.rect(l.x, A.platformTop - l.up, l.w, A.ledgeThick).fill(era.platform).stroke({ width: 0.04, color: T.colors.platformEdge });
    walls.clear();
    for (const cx of wallXs(A)) {
      walls.rect(cx - A.wallThickness / 2, A.wallTop, A.wallThickness, A.killY + 2 - A.wallTop).fill(era.wall);
    }
  };
  paintArena(sim.era);
  const paintLayer = new Container(), paintBlur = new BlurFilter({ strength: T.finish.paintBlur, quality: 2 }); // the paint is soaked into the picture: slightly soft
  paintLayer.filters = [paintBlur];
  const splatLayer = new Container(); // sharp effects (rings)
  const backLayer = new Container(); // a dodging fighter is drawn here, behind everyone else
  const fighterLayer = new Container();
  const propLayer = new Container(); // planks, logs and other loose objects
  actors.addChild(paintLayer, propLayer, backLayer, fighterLayer, splatLayer);
  // The three planes (owner): background (the painted backdrop, blurred and hazed), the play plane (fighters, ground, props: sharp, each
  // fighter lifted off the map by a faint soft shadow) and, on some maps, a front plane between us and the fighters, slightly out of focus.
  const shadows = new Container(), shadowBlur = new BlurFilter({ strength: 4, quality: 2 });
  shadows.filters = [shadowBlur];
  const front = new Container(), frontBlur = new BlurFilter({ strength: 3, quality: 3 });
  front.filters = [frontBlur];
  const frontItems: { s: Sprite; x: number; speed: number }[] = [];
  view.addChild(flat, painted, shadows, actors, front);


  // Cheap global finish on top of everything (screen space).
  const vignette = new Sprite(canvasTexture(256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 182);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }));
  vignette.alpha = T.finish.vignetteAlpha;
  app.stage.addChild(grain, tintWash, vignette);

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
  const splat = (x: number, y: number, radiusPx: number, color: number, grow = 0) => {
    const s = splats[nextSplat++ % splats.length];
    s.position.set(x, y);
    s.scale.set(radiusPx / 100 / 45); // px at 1080p -> metres (the painted blob is about 45 texture px across its middle)
    s.rotation = (Math.random() - 0.5) * 0.4; // drips always run more or less down
    if (grow > 0) { growing.push({ s, to: s.scale.x, t: 0, dur: grow }); s.scale.set(0); }
    s.tint = color;
    s.alpha = T.splat.alpha;
    s.visible = true;
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
  const playerColor = (i: number) => COLORS[sim.looks[i]?.color ?? i % COLORS.length].hex; // each player's chosen colour
  const fighterColor = (f: Fighter) => (f.controlled ? playerColor(f.index) : T.colors.dummy); // the training dummy has its own colour

  // Paint every lobby colour's body parts in idle moments after start-up, so picking a colour never stalls a round.
  const prewarm: (() => void)[] = [];
  const P0 = T.finish.paint, K0 = { relief: P0.relief, bristle: P0.bristle, jitter: P0.jitter, under: P0.under };
  for (const { hex } of COLORS) for (const p of sim.fighters[0]?.parts ?? []) for (const s of p.shapes) {
    const col = p.role === 'stick' ? T.colors.stick : p.role === 'off' ? mix(hex, 0x000000, 0.32) : p.role === 'upper' || p.role === 'fore' || p.role === 'thigh' || p.role === 'shin' ? mix(hex, 0x000000, 0.18) : hex;
    prewarm.push(() => paintedShape(s.k === 'ball' ? { k: 'ball', r: s.r } : { k: 'cap', r: s.r, hl: s.hl }, col, K0));
  }
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 50));
  const warmNext = () => { const job = prewarm.shift(); if (job) { job(); idle(warmNext); } };
  idle(warmNext);

  let scale = 1, shake = 0, builtVersion = -1;
  const entries: Entry[] = [];

  const propEntries: { p: Part; k: Container; painted: Painted[]; under: Graphics }[] = [];
  let boil = 0, variant = 0; // the painted fighters "boil": their brush strokes change a few times a second

  function rebuild() {
    for (const e of propEntries) e.k.destroy({ children: true });
    propEntries.length = 0;
    for (const p of sim.props) {
      const k = new Container(), under = new Graphics();
      for (const s of p.shapes) under.addChild(drawShape(s, UNDER));
      k.addChild(under);
      const painted = p.shapes.map((s) => addPainted(k, s, T.colors.stick));
      propLayer.addChild(k);
      propEntries.push({ p, k, painted, under });
    }
    for (const e of entries) { e.group.destroy({ children: true }); e.shade.destroy({ children: true }); }
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
      shadows.addChild(shadeC);
      const underAll = new Container();
      underAll.zIndex = -10;
      group.addChild(underAll);
      const cape = makeCape(group, paintedCape(parseInt(paintingFor(sim.era).hot.slice(1), 16), { relief: T.finish.paint.relief, bristle: T.finish.paint.bristle, jitter: T.finish.paint.jitter, under: T.finish.paint.under }));
      for (const p of f.parts as Part[]) {
        const k = new Container(), u = new Container();
        k.zIndex = p.role === 'off' ? -2 : p.role === 'stick' ? -0.5 : p.role === 'thigh' || p.role === 'shin' ? -1 : 0; // the second arm is behind everything, then the legs; a held club is behind the hand and arm so it looks gripped
        const color = p.role === 'stick' ? T.colors.stick : base;
        const shade = p.role === 'off' ? mix(color, 0x000000, 0.32) : p.role === 'upper' || p.role === 'fore' || p.role === 'thigh' || p.role === 'shin' ? mix(color, 0x000000, 0.18) : color;
        painted.push(p.shapes.map((s) => addPainted(k, s, shade)));
        for (const s of p.shapes) u.addChild(drawShape(s, UNDER));
        underAll.addChild(u);
        under.push(u);
        const sh = new Container();
        for (const s of p.shapes) sh.addChild(drawShape(s, 0x000000));
        shadeC.addChild(sh);
        soft.push(sh);
        // The hat goes on the head: the head part once it has come off, otherwise the head ball on the torso.
        const hat = f.controlled ? sim.looks[f.index]?.hat : undefined;
        const onHead = p.role === 'head' || (p.role === 'torso' && !f.ragdolled);
        if (hat && onHead) {
          const h = drawHat(hat, color, T.fighter.headRadius);
          if (h) { h.position.set(0, p.role === 'torso' ? T.fighter.headY : 0); k.addChild(h); }
        }
        if (onHead) { const ey = drawEyes(T.fighter.headRadius); ey.position.set(0, p.role === 'torso' ? T.fighter.headY : 0); k.addChild(ey); eyes.push(ey); }
        group.addChild(k);
        c.push(k);
      }
      fighterLayer.addChild(group);
      entries.push({ f, group, c, eyes, painted, under, soft, shade: shadeC, cape, blur: new BlurFilter({ strength: 0, quality: 3 }), vis: 0, crushed: false, sq: 0 });
    }
    builtVersion = sim.version;
  }

  return {
    /** Screen pixels -> world metres. */
    toWorld(px: number, py: number) { return { x: (px - view.x) / scale, y: (py - view.y) / scale }; },
    onEvent(e: SimEvent) {
      if (e.t === 'hit' || e.t === 'stomp') {
        const boost = e.head ? 1.5 : 1;
        const big = e.v * boost - T.shake.minImpact; // only big hits shake the screen
        if (big > 0) shake = Math.min(T.shake.max, Math.max(shake, big * T.shake.perImpact));
        splat(e.x, e.y, Math.min(T.splat.radiusMax, T.splat.radiusMin + e.v * T.splat.radiusPerImpact) * boost, playerColor(e.owner));
        if (e.v * boost >= T.indicator.minImpact) ring(e.x, e.y, T.indicator.color);
      } else if (e.t === 'disarm') {
        ring(e.x, e.y, 0xffd24a); // a golden ring where a club is knocked loose
      } else if (e.t === 'explode') { // a cartoon burst: big rings and a spray of colour (the pieces fly on their own)
        ring(e.x, e.y, 0xffffff); ring(e.x, e.y, 0xffd24a);
        shake = Math.max(shake, T.death.shake);
        for (let i = 0; i < 8; i++) splat(e.x + Math.cos(i * 0.785) * 0.4, e.y + Math.sin(i * 0.785) * 0.4, T.splat.radiusMax, playerColor(e.victim));
      } else if (e.t === 'fall') { // someone fell off the stage: red paint splashes up the edge of the picture where they went
        const x = Math.max(0.6, Math.min(A.viewW - 0.6, e.x)), y = e.y > A.viewH ? A.viewH - 0.15 : Math.max(0.6, Math.min(A.viewH - 0.6, e.y));
        for (let i = 0; i < 9; i++) splat(x + (Math.random() - 0.5) * 1.8, y - Math.random() * 1.0, 30 + Math.random() * 55, T.death.fallPaint, 0.18 + Math.random() * 0.2);
        shake = Math.max(shake, T.death.shake);
      } else if (e.t === 'crash') { // a knocked-down fighter hitting a wall or the floor
        ring(e.x, e.y, 0xffffff);
        shake = Math.max(shake, Math.min(T.shake.max, e.v * T.knock.crashShake));
      } else if (e.t === 'cut') {
        ring(e.x, e.y, 0xc9a26a); // a snapped rope or plank
        shake = Math.max(shake, T.bridge.shake);
      } else if (e.t === 'dismember') {
        ring(e.x, e.y, 0xffffff);
        splat(e.x, e.y, T.splat.radiusMax * 0.8, playerColor(e.victim));
      } else if (e.t === 'crush') {
        const v = entries.find((x) => x.f.index === e.victim);
        if (v) v.crushed = true;
        ring(e.x, e.y + 0.3, 0xcccccc);
        shake = Math.max(shake, T.death.shake);
      } else if (e.t === 'parry') {
        ring(e.x, e.y, 0x9fe8ff); // a bright double ring where a swing is blocked, and a little shake
        ring(e.x, e.y, 0xffffff);
        shake = Math.max(shake, T.parry.shake);
      }
    },
    draw(alpha: number, frameSeconds: number) {
      scale = Math.min(app.screen.width / A.viewW, app.screen.height / A.viewH);
      view.scale.set(scale);
      vignette.width = app.screen.width;
      vignette.height = app.screen.height;
      const px = app.screen.height / 1080;
      actors.filterArea = new Rectangle(0, 0, app.screen.width, app.screen.height);
      setOilScale(oil, app.screen.height / 1080);
      grain.width = tintWash.width = app.screen.width;
      grain.height = tintWash.height = app.screen.height;
      paintBlur.strength = T.finish.paintBlur * px;
      if (sim.round !== shownRound) { // a new round: the picture is clean again (the paint lasts the whole round)
        shownRound = sim.round;
        for (const s of splats) s.visible = false;
        growing.length = 0;
      }
      for (let i = growing.length - 1; i >= 0; i--) { const g = growing[i]; g.t += frameSeconds; const k = Math.min(1, g.t / g.dur); g.s.scale.set(g.to * k * (2 - k)); if (k >= 1) growing.splice(i, 1); }
      if (paintedEra !== sim.era) paintArena(sim.era); // a new round in a new era
      const tex = backdrops.get(sim.era, sim.arena); // the painted backdrop (null while it is being painted)
      if (tex && painted.texture !== tex) { painted.texture = tex; painted.width = A.viewW; painted.height = A.viewH; backdrops.prefetch(sim.upcoming().era, sim.upcoming().arena); }
      painted.visible = !!tex;
      flat.visible = !tex;
      if (builtVersion !== sim.version) rebuild();
      boil += frameSeconds * T.finish.boilFps;
      variant = Math.floor(boil) % VARIANTS;
      const off = T.finish.underOffset, SH = T.finish.shadow;
      shadowBlur.strength = SH.blur * px;
      shadows.alpha = SH.alpha;
      frontBlur.strength = T.finish.front.blur * px;
      const span = A.viewW + 4, now = boil / T.finish.boilFps; // a moving front item slides across and comes round again
      for (const it of frontItems) if (it.speed) it.s.x = ((((it.x + it.speed * now + 2) % span) + span) % span) - 2;
      for (const { p, k, painted: pp, under } of propEntries) {
        k.position.set(lerp(p.px, p.cx, alpha), lerp(p.py, p.cy, alpha));
        k.rotation = p.pa + wrap(p.ca - p.pa) * alpha;
        under.position.set(off * (Math.cos(k.rotation) + Math.sin(k.rotation)), off * (Math.cos(k.rotation) - Math.sin(k.rotation))); // world offset down-right
        for (const q of pp) updatePainted(q, k.rotation, variant);
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
      view.position.set((app.screen.width - A.viewW * scale) / 2 + sx, (app.screen.height - A.viewH * scale) / 2 + sy);
      for (const e of entries) {
        const { f, c } = e;
        e.vis += ((f.inBack ? 1 : 0) - e.vis) * Math.min(1, T.dodge.visualRate * frameSeconds);
        if (e.crushed) e.sq = Math.min(1, e.sq + frameSeconds / T.death.squashSeconds);
        const tint = mix(0xffffff, 0x55556a, e.vis * T.dodge.visualShade); // behind everyone: a little darker (no damage tint: health stays hidden)
        e.blur.strength = e.vis * T.dodge.visualBlur * px;
        e.group.filters = e.vis > 0.02 ? [e.blur] : null; // no filter cost unless they are dodging
        const layer = f.inBack ? backLayer : fighterLayer;
        if (e.group.parent !== layer) layer.addChild(e.group);
        f.parts.forEach((p, i) => {
          const k = c[i];
          k.position.set(lerp(p.px, p.cx, alpha), lerp(p.py, p.cy, alpha));
          k.rotation = p.pa + wrap(p.ca - p.pa) * alpha;
          k.tint = tint;
          const u = e.under[i];
          u.position.set(k.x + off, k.y + off);
          u.rotation = k.rotation;
          for (const q of e.painted[i]) updatePainted(q, k.rotation, variant);
          const sh = e.soft[i];
          sh.position.set(k.x + SH.x, k.y + SH.y);
          sh.rotation = k.rotation;
        });
        e.shade.alpha = 1 - e.vis; // a fighter slipping into the background plane leaves the play plane's shadow behind
        for (const ey of e.eyes) ey.scale.x = f.side * (f.limp ? 0.6 : 1); // look the way you face
        const torso = c[0], tc = Math.cos(torso.rotation), ts = Math.sin(torso.rotation), cx = -f.side * T.finish.cape.backX, cy = T.finish.cape.shoulderY;
        stepCape(e.cape, torso.x + tc * cx - ts * cy, torso.y + ts * cx + tc * cy, f.side, frameSeconds, boil / T.finish.boilFps, variant);
        // Dodge: the fighter turns toward the screen (looks narrower), slips behind everyone else and sits a touch higher, then turns back.
        e.group.pivot.set(torso.x, torso.y);
        e.group.position.set(torso.x, torso.y - T.dodge.visualRaise * e.vis + T.death.squashDrop * e.sq);
        e.group.scale.set(lerp(1, T.dodge.visualSquash, e.vis) * (1 + T.death.squashWide * e.sq), lerp(1, 0.97, e.vis) * (1 - T.death.squashFlat * e.sq));
      }
      app.render();
    },
  };
}
export type Renderer = Awaited<ReturnType<typeof createRenderer>>;

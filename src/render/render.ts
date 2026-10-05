import { Application, Assets, BlurFilter, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { eraById } from '../content/eras';
import { COLORS } from '../content/looks';
import type { Hat } from '../content/looks';
import { tuning as T } from '../content/tuning';
import type { Fighter, Part, Shape } from '../sim/fighter';
import type { SimEvent } from '../sim/types';
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
  const g = new Graphics(), r = headR * BIG, edge = { width: 0.025 * BIG, color: T.colors.outline };
  const dark = mix(tint, 0x000000, 0.3);
  if (hat === 'cap') { g.arc(0, -r * 0.2, r * 1.02, Math.PI, 0).fill(dark).stroke(edge); g.rect(-r * 0.2, -r * 0.35, r * 1.5, r * 0.28).fill(dark).stroke(edge); }
  else if (hat === 'tophat') { g.rect(-r * 1.2, -r * 0.95, r * 2.4, r * 0.3).fill(0x222222).stroke(edge); g.rect(-r * 0.7, -r * 2.2, r * 1.4, r * 1.3).fill(0x222222).stroke(edge); g.rect(-r * 0.7, -r * 1.2, r * 1.4, r * 0.25).fill(tint); }
  else if (hat === 'helmet') { g.arc(0, -r * 0.1, r * 1.1, Math.PI, 0).fill(0x8a929b).stroke(edge); g.rect(-r * 1.1, -r * 0.15, r * 2.2, r * 0.22).fill(0x6b727a).stroke(edge); }
  else if (hat === 'crown') { g.poly([-r * 0.9, -r * 0.8, -r * 0.9, -r * 1.8, -r * 0.45, -r * 1.2, 0, -r * 1.9, r * 0.45, -r * 1.2, r * 0.9, -r * 1.8, r * 0.9, -r * 0.8]).fill(0xf2c230).stroke(edge); }
  else if (hat === 'horns') { g.arc(0, -r * 0.1, r * 1.02, Math.PI, 0).fill(0x8a929b).stroke(edge); g.poly([-r * 0.9, -r * 0.5, -r * 1.7, -r * 1.7, -r * 0.5, -r * 0.9]).fill(0xeeeeee).stroke(edge); g.poly([r * 0.9, -r * 0.5, r * 1.7, -r * 1.7, r * 0.5, -r * 0.9]).fill(0xeeeeee).stroke(edge); }
  else if (hat === 'cowboy') { g.ellipse(0, -r * 0.75, r * 1.9, r * 0.35).fill(0x8a6a44).stroke(edge); g.rect(-r * 0.7, -r * 1.7, r * 1.4, r * 1.0).fill(0x8a6a44).stroke(edge); }
  else if (hat === 'beanie') { g.arc(0, -r * 0.2, r * 1.05, Math.PI, 0).fill(tint).stroke(edge); g.circle(0, -r * 1.3, r * 0.25).fill(0xffffff).stroke(edge); }
  g.scale.set(1 / BIG);
  return g;
}

function drawShape(s: Shape, color: number): Graphics {
  const g = new Graphics();
  if (s.k === 'ball') g.circle(0, 0, s.r * BIG);
  else g.roundRect(-s.r * BIG, -(s.hl + s.r) * BIG, s.r * 2 * BIG, (s.hl + s.r) * 2 * BIG, s.r * BIG);
  g.fill(color).stroke({ width: 0.025 * BIG, color: T.colors.outline });
  g.scale.set(1 / BIG);
  g.position.set(s.x, s.y);
  if (s.k === 'cap') g.rotation = s.rot;
  return g;
}

/** A small texture painted in code (used for the vignette): no asset files. */
function canvasTexture(size: number, paint: (ctx: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d')!);
  return Texture.from(c);
}

/** Optional painted background: drop public/art/test_bg.webp (or .png/.jpg) in and it appears; no file = flat sky colour. */
async function loadBackground(): Promise<Texture | null> {
  for (const ext of ['webp', 'png', 'jpg']) {
    try {
      const tex = await Assets.load<Texture>(`/art/test_bg.${ext}`);
      if (tex?.width > 16) return tex; // the dev server answers a missing file with index.html, which decodes to nothing useful
    } catch { /* try the next extension */ }
  }
  return null;
}

interface Entry {
  f: Fighter;
  group: Container; // everything of one fighter, so the dodge can shrink them about the torso
  c: Container[]; // one per part
  vis: number; // 0 = normal plane, 1 = background plane (smoothed)
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
  const A = sim.arena; // (only the view size is read from this one: it never changes)
  const sky = new Graphics(), platform = new Graphics(), walls = new Graphics();
  // Depth of field: the painted backdrop (sky + background art) is blurred so the fighters and the ground they stand on stay in focus.
  const backdrop = new Container(), backdropBlur = new BlurFilter({ strength: T.finish.style.blur, quality: 3 });
  backdrop.filters = [backdropBlur];
  backdrop.addChild(sky);
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
    sky.clear().rect(-2, -2, A.viewW + 4, A.viewH + 4).fill(era.sky); // a little oversize: the blur eats the edges
    const st = { ...T.finish.style, ...era.style }; // this era's painting style
    grain.alpha = st.grain;
    tintWash.clear().rect(0, 0, 1, 1).fill(st.tint);
    tintWash.alpha = st.tintAlpha;
    platform.clear();
    for (const g of A.ground.length ? A.ground : [{ x: A.platformX, w: A.platformW }]) platform.rect(g.x, A.platformTop, g.w, A.platformThickness).fill(era.platform).stroke({ width: 0.04, color: T.colors.platformEdge });
    for (const l of A.ledges) platform.rect(l.x, A.platformTop - l.up, l.w, 0.3).fill(era.platform).stroke({ width: 0.04, color: T.colors.platformEdge });
    walls.clear();
    for (const cx of [A.platformX - A.wallGap - A.wallThickness / 2, A.platformX + A.platformW + A.wallGap + A.wallThickness / 2]) {
      walls.rect(cx - A.wallThickness / 2, A.wallTop, A.wallThickness, A.killY + 2 - A.wallTop).fill(era.wall).stroke({ width: 0.04, color: T.colors.platformEdge });
    }
  };
  paintArena(sim.era);
  const paintLayer = new Container(), paintBlur = new BlurFilter({ strength: T.finish.paintBlur, quality: 2 }); // the paint is soaked into the picture: slightly soft
  paintLayer.filters = [paintBlur];
  const splatLayer = new Container(); // sharp effects (rings)
  const backLayer = new Container(); // a dodging fighter is drawn here, behind everyone else
  const fighterLayer = new Container();
  const propLayer = new Container(); // planks, logs and other loose objects
  view.addChild(backdrop, platform, walls, paintLayer, splatLayer, propLayer, backLayer, fighterLayer);

  const bgTex = await loadBackground();
  if (bgTex) {
    const bg = new Sprite(bgTex);
    bg.width = A.viewW;
    bg.height = A.viewH;
    bg.position.set(-0.3, -0.3); bg.width = A.viewW + 0.6; bg.height = A.viewH + 0.6; // oversize like the sky
    backdrop.addChild(bg);
  }

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
  const splatTex: Texture = app.renderer.generateTexture(new Graphics().circle(32, 32, 32).fill(0xffffff));
  const splats: Sprite[] = [];
  for (let i = 0; i < T.splat.max; i++) {
    const s = new Sprite(splatTex);
    s.anchor.set(0.5);
    s.visible = false;
    paintLayer.addChild(s);
    splats.push(s);
  }
  let nextSplat = 0, shownRound = sim.round;
  const growing: { s: Sprite; to: number; t: number; dur: number }[] = []; // splats that spread out over a moment
  const splat = (x: number, y: number, radiusPx: number, color: number, grow = 0) => {
    const s = splats[nextSplat++ % splats.length];
    s.position.set(x, y);
    s.scale.set((radiusPx / 100 * 2) / 64); // px at 1080p -> metres
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

  let scale = 1, shake = 0, builtVersion = -1;
  const entries: Entry[] = [];

  const propEntries: { p: Part; k: Container }[] = [];

  function rebuild() {
    for (const e of propEntries) e.k.destroy({ children: true });
    propEntries.length = 0;
    for (const p of sim.props) {
      const k = new Container();
      for (const s of p.shapes) k.addChild(drawShape(s, T.colors.stick));
      propLayer.addChild(k);
      propEntries.push({ p, k });
    }
    for (const e of entries) e.group.destroy({ children: true });
    fighterLayer.removeChildren();
    entries.length = 0;
    for (const f of sim.fighters) {
      const group = new Container();
      const base = fighterColor(f);
      group.sortableChildren = true;
      const c: Container[] = [];
      for (const p of f.parts as Part[]) {
        const k = new Container();
        k.zIndex = p.role === 'off' ? -2 : p.role === 'stick' ? -0.5 : p.role === 'thigh' || p.role === 'shin' ? -1 : 0; // the second arm is behind everything, then the legs; a held club is behind the hand and arm so it looks gripped
        const color = p.role === 'stick' ? T.colors.stick : base;
        const shade = p.role === 'off' ? mix(color, 0x000000, 0.32) : p.role === 'upper' || p.role === 'fore' || p.role === 'thigh' || p.role === 'shin' ? mix(color, 0x000000, 0.18) : color;
        for (const s of p.shapes) k.addChild(drawShape(s, shade));
        // The hat goes on the head: the head part once it has come off, otherwise the head ball on the torso.
        const hat = f.controlled ? sim.looks[f.index]?.hat : undefined;
        const onHead = p.role === 'head' || (p.role === 'torso' && !f.ragdolled);
        if (hat && onHead) {
          const h = drawHat(hat, color, T.fighter.headRadius);
          if (h) { h.position.set(0, p.role === 'torso' ? T.fighter.headY : 0); k.addChild(h); }
        }
        group.addChild(k);
        c.push(k);
      }
      fighterLayer.addChild(group);
      entries.push({ f, group, c, blur: new BlurFilter({ strength: 0, quality: 3 }), vis: 0, crushed: false, sq: 0 });
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
      grain.width = tintWash.width = app.screen.width;
      grain.height = tintWash.height = app.screen.height;
      backdropBlur.strength = ({ ...T.finish.style, ...eraById(paintedEra).style }).blur * px; // blur is in screen pixels: tuned at 1080p, so scale with the window
      paintBlur.strength = T.finish.paintBlur * px;
      if (sim.round !== shownRound) { // a new round: the picture is clean again (the paint lasts the whole round)
        shownRound = sim.round;
        for (const s of splats) s.visible = false;
        growing.length = 0;
      }
      for (let i = growing.length - 1; i >= 0; i--) { const g = growing[i]; g.t += frameSeconds; const k = Math.min(1, g.t / g.dur); g.s.scale.set(g.to * k * (2 - k)); if (k >= 1) growing.splice(i, 1); }
      if (paintedEra !== sim.era) paintArena(sim.era); // a new round in a new era
      if (builtVersion !== sim.version) rebuild();
      for (const { p, k } of propEntries) { k.position.set(lerp(p.px, p.cx, alpha), lerp(p.py, p.cy, alpha)); k.rotation = p.pa + wrap(p.ca - p.pa) * alpha; }
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
        let tint = mix(0xffffff, T.colors.damaged, 1 - Math.max(0, f.hp) / T.fighter.hp);
        tint = mix(tint, 0x55556a, e.vis * T.dodge.visualShade); // behind everyone: a little darker
        e.blur.strength = e.vis * T.dodge.visualBlur * px;
        e.group.filters = e.vis > 0.02 ? [e.blur] : null; // no filter cost unless they are dodging
        const layer = f.inBack ? backLayer : fighterLayer;
        if (e.group.parent !== layer) layer.addChild(e.group);
        f.parts.forEach((p, i) => {
          const k = c[i];
          k.position.set(lerp(p.px, p.cx, alpha), lerp(p.py, p.cy, alpha));
          k.rotation = p.pa + wrap(p.ca - p.pa) * alpha;
          k.tint = tint;
        });
        const torso = c[0];
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

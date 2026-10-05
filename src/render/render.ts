import { Application, Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
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

interface Pt { x: number; y: number }

interface Leg { a: number; w: number } // angle from straight down (+ = foot toward +x) and its angular speed

interface Entry {
  f: Fighter;
  group: Container; // everything of one fighter, so the dodge can shrink them about the torso
  c: Container[]; // one per part
  legs: Graphics[];
  phase: number; // run cycle
  leg: Leg[]; // the two legs' own swing physics
  prevVx: number;
  ax: number; // smoothed body acceleration
  vis: number; // 0 = normal plane, 1 = background plane (smoothed)
}

export async function createRenderer(sim: Sim, host: HTMLElement) {
  const app = new Application();
  await app.init({ resizeTo: window, background: T.colors.void, antialias: true, autoDensity: true, resolution: window.devicePixelRatio });
  host.appendChild(app.canvas);
  app.ticker.stop(); // main.ts owns the loop and calls draw()

  const view = new Container(); // metres -> pixels, letterboxed, shaken
  app.stage.addChild(view);
  const A = T.arena;
  const sky = new Graphics().rect(0, 0, A.viewW, A.viewH).fill(T.colors.sky);
  const platform = new Graphics()
    .rect(A.platformX, A.platformTop, A.platformW, A.platformThickness).fill(T.colors.platform)
    .stroke({ width: 0.04, color: T.colors.platformEdge });
  const walls = new Graphics();
  for (const cx of [A.platformX - A.wallGap - A.wallThickness / 2, A.platformX + A.platformW + A.wallGap + A.wallThickness / 2]) {
    walls.rect(cx - A.wallThickness / 2, A.wallTop, A.wallThickness, A.killY + 2 - A.wallTop).fill(T.colors.wall).stroke({ width: 0.04, color: T.colors.platformEdge });
  }
  const splatLayer = new Container();
  const backLayer = new Container(); // a dodging fighter is drawn here, behind everyone else
  const fighterLayer = new Container();
  view.addChild(sky, platform, walls, splatLayer, backLayer, fighterLayer);

  const bgTex = await loadBackground();
  if (bgTex) {
    const bg = new Sprite(bgTex);
    bg.width = A.viewW;
    bg.height = A.viewH;
    view.addChildAt(bg, 1); // above the flat sky, below the platform
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
  app.stage.addChild(vignette);

  // Splat decal pool (ring buffer: no allocation after start-up).
  const splatTex: Texture = app.renderer.generateTexture(new Graphics().circle(32, 32, 32).fill(0xffffff));
  const splats: Sprite[] = [];
  for (let i = 0; i < T.splat.max; i++) {
    const s = new Sprite(splatTex);
    s.anchor.set(0.5);
    s.visible = false;
    splatLayer.addChild(s);
    splats.push(s);
  }
  let nextSplat = 0;
  const splat = (x: number, y: number, radiusPx: number, color: number) => {
    const s = splats[nextSplat++ % splats.length];
    s.position.set(x, y);
    s.scale.set((radiusPx / 100 * 2) / 64); // px at 1080p -> metres
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
  const playerColor = (i: number) => T.colors.players[i % T.colors.players.length];
  const fighterColor = (f: Fighter) => (f.controlled ? playerColor(f.index) : T.colors.dummy); // the training dummy has its own colour

  let scale = 1, shake = 0, builtVersion = -1;
  const entries: Entry[] = [];

  function rebuild() {
    for (const e of entries) e.group.destroy({ children: true });
    fighterLayer.removeChildren();
    entries.length = 0;
    for (const f of sim.fighters) {
      const group = new Container();
      const base = fighterColor(f);
      const legs = [new Graphics(), new Graphics()];
      for (const g of legs) { g.scale.set(1 / BIG); group.addChild(g); }
      const c: Container[] = [];
      for (const p of f.parts as Part[]) {
        const k = new Container();
        const color = p.role === 'stick' ? T.colors.stick : base;
        const shade = p.role === 'upper' || p.role === 'fore' || p.role === 'leg' ? mix(color, 0x000000, 0.18) : color;
        for (const s of p.shapes) k.addChild(drawShape(s, shade));
        group.addChild(k);
        c.push(k);
      }
      fighterLayer.addChild(group);
      entries.push({ f, group, c, legs, phase: 0, leg: [{ a: -T.legs.stance, w: 0 }, { a: T.legs.stance, w: 0 }], prevVx: 0, ax: 0, vis: 0 });
    }
    builtVersion = sim.version;
  }

  /** Stick legs: two pendulums hanging from the hip with springy physics. They swing as you run, lag when you speed up, and flop in the air. */
  function drawLegs(e: Entry, torso: Container, vx: number, frameSeconds: number) {
    const f = e.f, L = T.legs;
    for (const g of e.legs) g.visible = !f.ragdolled; // the ragdoll has real legs
    if (f.ragdolled) return;
    const dt = Math.min(frameSeconds, 1 / 30);
    const rot = torso.rotation;
    const crouchAmt = f.crouch;
    const legLen = L.length;
    const hip = { x: torso.x - Math.sin(rot) * L.hipY, y: torso.y + Math.cos(rot) * L.hipY };
    const speed = Math.abs(vx);
    const dir = speed > 0.3 ? Math.sign(vx) : f.side;
    e.ax += ((vx - e.prevVx) / Math.max(dt, 1e-4) - e.ax) * 0.25; // smoothed: the sim steps in 1/60 s jumps
    e.prevVx = vx;
    e.phase += (f.grounded ? speed * L.runRate : 9) * dt;
    const dark = mix(fighterColor(f), 0x000000, 0.12);
    for (let i = 0; i < 2; i++) {
      const sgn = i === 0 ? -1 : 1, leg = e.leg[i];
      const cycle = Math.sin(e.phase + i * Math.PI);
      const target = f.grounded
        ? sgn * (L.stance + T.crouch.legSpread * crouchAmt) + dir * cycle * L.swing * Math.min(1, speed / 3) // run cycle (just a gentle target: the spring does the rest)
        : sgn * L.airSpread + L.airSwing * cycle - Math.max(-0.5, Math.min(0.5, vx * 0.05)); // spread, kick, trail behind the motion
      const kick = -e.ax * L.inertia; // speeding up swings the feet backward, braking swings them forward
      leg.w += (L.spring * (target - leg.a) - L.damping * leg.w + kick) * dt;
      leg.a = Math.max(-1.3, Math.min(1.3, leg.a + leg.w * dt));
      const foot: Pt = { x: hip.x + Math.sin(leg.a) * legLen, y: hip.y + Math.cos(leg.a) * legLen };
      if (f.grounded) foot.y = Math.min(foot.y, T.arena.platformTop); // never sink into the floor
      const g = e.legs[i], P = (p: Pt) => [p.x * BIG, p.y * BIG] as const;
      g.clear();
      g.moveTo(...P(hip)).lineTo(...P(foot)).stroke({ width: (L.width + 0.04) * BIG, color: T.colors.outline, cap: 'round' });
      g.moveTo(...P(hip)).lineTo(...P(foot)).stroke({ width: L.width * BIG, color: dark, cap: 'round' });
    }
  }

  return {
    /** Screen pixels -> world metres. */
    toWorld(px: number, py: number) { return { x: (px - view.x) / scale, y: (py - view.y) / scale }; },
    onEvent(e: SimEvent) {
      if (e.t === 'hit') {
        const boost = e.head ? 1.5 : 1;
        const big = e.v * boost - T.shake.minImpact; // only big hits shake the screen
        if (big > 0) shake = Math.min(T.shake.max, Math.max(shake, big * T.shake.perImpact));
        splat(e.x, e.y, Math.min(T.splat.radiusMax, T.splat.radiusMin + e.v * T.splat.radiusPerImpact) * boost, playerColor(e.owner));
        if (e.v * boost >= T.indicator.minImpact) ring(e.x, e.y, T.indicator.color);
      } else if (e.t === 'disarm') {
        ring(e.x, e.y, 0xffd24a); // a golden ring where a club is knocked loose
      }
    },
    draw(alpha: number, frameSeconds: number) {
      scale = Math.min(app.screen.width / A.viewW, app.screen.height / A.viewH);
      view.scale.set(scale);
      vignette.width = app.screen.width;
      vignette.height = app.screen.height;
      if (builtVersion !== sim.version) rebuild();
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
        let tint = mix(0xffffff, T.colors.damaged, 1 - Math.max(0, f.hp) / T.fighter.hp);
        tint = mix(tint, 0x55556a, e.vis * T.dodge.visualShade); // behind everyone: a little darker
        const layer = f.inBack ? backLayer : fighterLayer;
        if (e.group.parent !== layer) layer.addChild(e.group);
        f.parts.forEach((p, i) => {
          const k = c[i];
          k.position.set(lerp(p.px, p.cx, alpha), lerp(p.py, p.cy, alpha));
          k.rotation = p.pa + wrap(p.ca - p.pa) * alpha;
          k.tint = tint;
        });
        const torso = c[0];
        const vx = (f.torso.cx - f.torso.px) / T.sim.dt;
        drawLegs(e, torso, vx, frameSeconds);
        for (const g of e.legs) g.tint = tint;
        // Dodge: the fighter turns toward the screen (looks narrower), slips behind everyone else and sits a touch higher, then turns back.
        e.group.pivot.set(torso.x, torso.y);
        e.group.position.set(torso.x, torso.y - T.dodge.visualRaise * e.vis);
        e.group.scale.set(lerp(1, T.dodge.visualSquash, e.vis), lerp(1, 0.97, e.vis));
      }
      app.render();
    },
  };
}
export type Renderer = Awaited<ReturnType<typeof createRenderer>>;

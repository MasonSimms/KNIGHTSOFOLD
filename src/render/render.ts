import { Application, Assets, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
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

function drawShape(s: Shape, color: number): Graphics {
  const g = new Graphics();
  if (s.k === 'ball') g.circle(0, 0, s.r);
  else g.roundRect(-s.r, -s.hl - s.r, s.r * 2, (s.hl + s.r) * 2, s.r);
  g.fill(color).stroke({ width: 0.025, color: T.colors.outline });
  g.position.set(s.x, s.y);
  if (s.k === 'cap') g.rotation = s.rot;
  return g;
}

/** Style-test finish: a noise tile (canvas grain) and a radial gradient (vignette), both generated in code: no asset files. */
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
  const splatLayer = new Container();
  const fighterLayer = new Container();
  view.addChild(sky, platform, splatLayer, fighterLayer);

  const bgTex = await loadBackground();
  if (bgTex) {
    const bg = new Sprite(bgTex);
    bg.width = A.viewW;
    bg.height = A.viewH;
    view.addChildAt(bg, 1); // above the flat sky, below the platform
  }

  // Cheap global finish on top of everything (screen space).
  const FIN = T.finish;
  const grain = new TilingSprite({
    texture: canvasTexture(FIN.grainTile, (ctx) => {
      const img = ctx.createImageData(FIN.grainTile, FIN.grainTile);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() < 0.5 ? 0 : 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = Math.random() * 255;
      }
      ctx.putImageData(img, 0, 0);
    }),
    width: 1, height: 1, alpha: FIN.grainAlpha,
  });
  const vignette = new Sprite(canvasTexture(256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 182);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }));
  vignette.alpha = FIN.vignetteAlpha;
  app.stage.addChild(grain, vignette);

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

  let scale = 1, shake = 0, builtVersion = -1;
  const fighterContainers: { f: Fighter; c: Container[] }[] = [];

  function rebuild() {
    fighterLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    fighterContainers.length = 0;
    for (const f of sim.fighters) {
      const list: Container[] = [];
      for (const p of f.parts as Part[]) {
        const c = new Container();
        const color = p.role === 'stick' ? T.colors.stick : T.colors.players[f.index % T.colors.players.length];
        const shade = p.role === 'upper' || p.role === 'fore' ? mix(color, 0x000000, 0.18) : color;
        for (const s of p.shapes) c.addChild(drawShape(s, shade));
        fighterLayer.addChild(c);
        list.push(c);
      }
      fighterContainers.push({ f, c: list });
    }
    builtVersion = sim.version;
  }

  return {
    /** Screen pixels -> world metres. */
    toWorld(px: number, py: number) { return { x: (px - view.x) / scale, y: (py - view.y) / scale }; },
    onEvent(e: SimEvent) {
      if (e.t !== 'hit') return;
      shake = Math.min(T.shake.max, Math.max(shake, e.v * T.shake.perImpact));
      const s = splats[nextSplat++ % splats.length];
      const r = Math.min(T.splat.radiusMax, T.splat.radiusMin + e.v * T.splat.radiusPerImpact) / 100; // px at 1080p -> metres
      s.position.set(e.x, e.y);
      s.scale.set((r * 2) / 64);
      s.tint = T.colors.players[e.owner % T.colors.players.length];
      s.alpha = T.splat.alpha;
      s.visible = true;
    },
    draw(alpha: number, frameSeconds: number) {
      scale = Math.min(app.screen.width / A.viewW, app.screen.height / A.viewH);
      view.scale.set(scale);
      grain.width = vignette.width = app.screen.width;
      grain.height = vignette.height = app.screen.height;
      if (builtVersion !== sim.version) rebuild();
      shake *= Math.pow(T.shake.decayPerSecond, frameSeconds);
      const sx = (Math.random() - 0.5) * 2 * shake, sy = (Math.random() - 0.5) * 2 * shake;
      view.position.set((app.screen.width - A.viewW * scale) / 2 + sx, (app.screen.height - A.viewH * scale) / 2 + sy);
      for (const { f, c } of fighterContainers) {
        const tint = mix(0xffffff, T.colors.damaged, 1 - Math.max(0, f.hp) / T.fighter.hp);
        f.parts.forEach((p, i) => {
          const k = c[i];
          k.position.set(lerp(p.px, p.cx, alpha), lerp(p.py, p.cy, alpha));
          k.rotation = p.pa + wrap(p.ca - p.pa) * alpha;
          k.tint = tint;
        });
      }
      app.render();
    },
  };
}
export type Renderer = Awaited<ReturnType<typeof createRenderer>>;

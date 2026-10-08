import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { tuning as T } from '../content/tuning';
import type { Sim } from '../sim/world';

// Dynamic light (owner): the arena's fires and its hanging lanterns glow warm and flicker, and each fighter's shadow falls away from the
// nearest strong light (longer and darker close to it). A lantern that is put out (shot, smashed, knocked down) darkens the room: only
// the background, so light never hides anyone. No lights on a map: the plain soft shadow (the sun, below and to the right).

export interface Light { x: number; y: number; power: number }

const glowTexture = (): Texture => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!, g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return Texture.from(c);
};

/** The lights of the arena now (fires, and the lanterns still lit), with their flicker at `time` seconds. */
export function lightsOf(sim: Sim, time: number): Light[] {
  const L = T.light, A = sim.arena, out: Light[] = [];
  const flick = (ph: number) => 1 - L.flicker * (0.5 + 0.5 * Math.sin(time * 13 + ph) * Math.sin(time * 7.3 + ph * 2.1));
  A.fires.forEach((z, i) => out.push({ x: z.x + z.w / 2, y: A.platformTop - z.up - 0.45, power: flick(i) }));
  sim.props.forEach((p, i) => { if (p.weapon?.id === 'lantern') out.push({ x: p.cx, y: p.cy, power: 0.8 * flick(i + 5) }); else if (p.weapon?.id === 'chandelier' && p.links?.length) out.push({ x: p.cx, y: p.cy, power: 1.1 * flick(i + 9) }); }); // (a chandelier's candles go out when it falls)
  return out;
}

export function createLight(layer: Container) {
  const dark = new Graphics(), glows = new Container(), pool: Sprite[] = [];
  layer.addChild(dark, glows);
  let tex: Texture | null = null, lanterns = 0, lights: Light[] = [];
  return {
    /** A new round: how many lanterns this map starts with (all of them out = the darkest). */
    build(sim: Sim) { lanterns = sim.arena.scenery.filter((s) => s.kind === 'lantern').length; },
    /** Glows and darkness for this frame; the lights are kept for shadowOf. */
    draw(sim: Sim, time: number) {
      const L = T.light, A = sim.arena;
      lights = lightsOf(sim, time);
      const out = lanterns ? 1 - sim.props.filter((p) => p.weapon?.id === 'lantern').length / lanterns : 0;
      dark.clear();
      if (out > 0) dark.rect(-1, -1, A.viewW + 2, A.viewH + 2).fill({ color: 0x0a0604, alpha: L.dark * out });
      tex ??= glowTexture();
      lights.forEach((l, i) => {
        const s = pool[i] ?? (pool[i] = Object.assign(new Sprite(tex!), { blendMode: 'add' as const }));
        if (!s.parent) { s.anchor.set(0.5); glows.addChild(s); }
        s.visible = true; s.tint = L.warm; s.alpha = L.glowAlpha * l.power;
        s.position.set(l.x, l.y); s.width = s.height = L.glow * 2 * (0.9 + 0.1 * l.power);
      });
      for (let i = lights.length; i < pool.length; i++) pool[i].visible = false;
    },
    /** Where a fighter at (x, y) casts its shadow (offset from them) and how dark it is: away from the nearest strong light, or the sun's. */
    shadowOf(x: number, y: number, sun: { x: number; y: number }): { x: number; y: number; a: number } {
      const L = T.light;
      let best: Light | null = null, bw = 0;
      for (const l of lights) { const d = Math.hypot(x - l.x, y - l.y), w = l.power * Math.max(0, 1 - d / L.reach); if (w > bw) { bw = w; best = l; } }
      if (!best) return { x: sun.x, y: sun.y, a: 1 };
      const dx = x - best.x, dy = y - best.y, d = Math.hypot(dx, dy) || 1, len = L.shadowLen * (0.4 + 1.2 * bw);
      const k = Math.min(1, bw * 2); // (blend from the sun's shadow toward the light's as it gets closer)
      return { x: sun.x * (1 - k) + (dx / d) * len * k, y: sun.y * (1 - k) + (dy / d) * len * k, a: 0.75 + 0.35 * bw * best.power };
    },
  };
}

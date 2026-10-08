import { Container, Graphics, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { PROPS } from '../content/props';
import { tuning as T } from '../content/tuning';
import type { SimEvent } from '../sim/types';
import type { Sim } from '../sim/world';

// Gunfire on the screen (owner): bullets are moving white streaks with see-through trails that reach back past the shooter (and fade after);
// a muzzle flash and a puff of smoke for every shot; sparks off metal, splinters off wood, dust off the ground, a twirl when a gun runs dry.
// Pools made once (nothing is allocated while playing).

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
interface Trail { id: number; ox: number; oy: number; x: number; y: number; fade: number; drift: number; color: number; orb: number; dash: boolean } // fade: 1 while flying, falling to 0 after; drift: how far the wind has carried it (m); color, orb: its gun's look (props.ts); dash: sent back by a shield
interface Bit { g: Graphics; x: number; y: number; vx: number; vy: number; spin: number; life: number; max: number; fall: boolean }
interface Puff { s: Sprite; x: number; y: number; vy: number; life: number; max: number; size: number; a: number }

export function createFx(layer: Container, puffTex: Texture[]) {
  const trails = new Graphics(), flashes = new Graphics();
  layer.addChild(trails);
  const trailList: Trail[] = [];
  const bits: Bit[] = Array.from({ length: 80 }, () => { const g = new Graphics(); g.visible = false; layer.addChild(g); return { g, x: 0, y: 0, vx: 0, vy: 0, spin: 0, life: 0, max: 1, fall: false }; });
  const puffs: Puff[] = Array.from({ length: 40 }, (_, i) => { const s = new Sprite(puffTex[i % puffTex.length]); s.anchor.set(0.5); s.visible = false; layer.addChild(s); return { s, x: 0, y: 0, vy: 0, life: 0, max: 1, size: 1, a: 1 }; });
  layer.addChild(flashes);
  let nextBit = 0, nextPuff = 0;
  const flashList: { x: number; y: number; a: number; life: number }[] = [];
  const twirls = new Map<number, number>(); // fighter -> seconds into the twirl of an emptied gun
  const shotBy = new Map<number, string>(); // fighter -> the gun they fired last (online the bullets come without it)
  let simNow: Sim | undefined; // the world as last drawn (for what people are holding when an event comes)
  const METAL = new Set(['metal', 'shield', 'stone']);
  const holding = (i: number) => simNow?.fighters[i]?.stick?.weapon?.material ?? 'wood';

  /** A flying bit: a short line (a spark, a splinter) that flies, spins, fades. */
  const bit = (x: number, y: number, ang: number, speed: number, len: number, width: number, color: number, life: number, fall: boolean) => {
    const b = bits[nextBit++ % bits.length];
    b.g.clear().moveTo(-len / 2, 0).lineTo(len / 2, 0).stroke({ width, color, cap: 'round' });
    b.g.rotation = ang; b.g.alpha = 1; b.g.visible = true;
    Object.assign(b, { x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, spin: (Math.random() - 0.5) * (fall ? 18 : 0), life, max: life, fall });
  };
  /** Metal struck: yellow-white sparks flying back from the blow, and orange dots that fall. */
  const sparks = (x: number, y: number, ang: number) => {
    for (let i = 0; i < 7; i++) bit(x, y, ang + (Math.random() - 0.5) * 2.2, 4 + Math.random() * 5, 0.12 + Math.random() * 0.12, 0.025, i % 2 ? 0xffd27a : 0xfff6d0, 0.18, false);
    for (let i = 0; i < 4; i++) bit(x, y, ang + (Math.random() - 0.5) * 2.6, 2 + Math.random() * 3, 0.03, 0.05, 0xff8a3c, 0.4, true);
  };
  const puff = (x: number, y: number, size: number, color: number, alpha: number, life: number, rise: number) => {
    const p = puffs[nextPuff++ % puffs.length];
    Object.assign(p, { x, y, vy: -rise, life, max: life, size, a: alpha });
    p.s.tint = color; p.s.alpha = alpha; p.s.visible = true;
  };

  return {
    /** A puff of smoke or dust: size (m), colour, how see-through, seconds it lasts, how fast it rises (m/s). Also the dust of render/motion.ts. */
    puff,
    /** How far an emptied gun has turned in the twirl (radians, added to its picture), for fighter `i`. */
    twirl(i: number): number { const t = twirls.get(i); return t === undefined ? 0 : Math.PI * 2 * Math.min(1, t / T.finish.bullets.twirlSeconds) ** 0.6; },
    onEvent(e: SimEvent) {
      const B = T.finish.bullets;
      if (e.t === 'shot') { // the flash and the smoke
        shotBy.set(e.owner, e.w ?? '');
        flashList.push({ x: e.x, y: e.y, a: e.v, life: B.flashSeconds });
        const big = (PROPS[e.w ?? '']?.gun?.kick ?? 0) >= 20; // (the big guns: more smoke)
        for (let i = 0; i < (big ? 4 : 2); i++) puff(e.x + Math.cos(e.v) * 0.15 * i, e.y + Math.sin(e.v) * 0.15 * i, (big ? 0.5 : 0.3) + i * 0.08, 0xd8d2c4, big ? 0.7 : 0.5, 0.9, 0.35);
      } else if (e.t === 'empty') { // the dry click: a little puff, and the gun is twirled round
        puff(e.x, e.y, 0.22, 0xbdb6a8, 0.6, 0.6, 0.3);
        twirls.set(e.owner, 0);
      } else if (e.t === 'spark') { // metal: a burst of sparks back toward the shot (a shield: the bullet's trail now dashed, from where it turned back)
        sparks(e.x, e.y, e.v);
        if (e.victim >= 0 && holding(e.victim) === 'shield') { const q = trailList.find((t) => t.fade >= 1 && Math.hypot(t.x - e.x, t.y - e.y) < 0.6); if (q) { q.dash = true; q.ox = e.x; q.oy = e.y; } }
      } else if (e.t === 'parry') { // a swing blocked by a held weapon: sparks when both are metal, splinters when either is wood
        const a = holding(e.victim), b = holding(e.owner), ang = Math.atan2(e.y - (simNow?.fighters[e.victim]?.torso.cy ?? e.y), e.x - (simNow?.fighters[e.victim]?.torso.cx ?? e.x));
        if (METAL.has(a) && METAL.has(b)) sparks(e.x, e.y, ang);
        else for (let i = 0; i < 5; i++) bit(e.x, e.y, ang + (Math.random() - 0.5) * 2.5, 2 + Math.random() * 3, 0.05 + Math.random() * 0.08, 0.035, i % 2 ? 0x8c5a2f : 0xc9a26a, 0.6, true);
      } else if (e.t === 'boom') { // a grenade: a flash, a ring of smoke, dirt and bits flying
        flashList.push({ x: e.x, y: e.y, a: -Math.PI / 2, life: B.flashSeconds * 3 });
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; puff(e.x + Math.cos(a) * 0.4, e.y + Math.sin(a) * 0.3, 0.9 + Math.random() * 0.5, 0x6a6258, 0.8, 1.6, 0.6); }
        for (let i = 0; i < 18; i++) bit(e.x, e.y, Math.random() * Math.PI * 2, 4 + Math.random() * 7, 0.06 + Math.random() * 0.12, 0.04, i % 3 ? 0x3d2e22 : 0xffc46b, 0.9, true);
      } else if ((e.t === 'break' && e.w === 'pane') || e.t === 'shatter') { // a window or a mug: glass flying, glinting, falling
        for (let i = 0, n = e.t === 'shatter' ? 10 : 22; i < n; i++) bit(e.x, e.y + (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * Math.PI * 2, 2 + Math.random() * 5, 0.05 + Math.random() * 0.12, 0.03, i % 3 ? 0xd8eef4 : 0xffffff, 0.9, true);
      } else if (e.t === 'splinter' || e.t === 'snap' || e.t === 'break') { // wood: splinters flying, more when it gives way
        const n = e.t === 'splinter' ? 5 : e.t === 'snap' ? 10 : 16;
        for (let i = 0; i < n; i++) bit(e.x, e.y, -Math.PI / 2 + (Math.random() - 0.5) * 3, 2 + Math.random() * 4, 0.06 + Math.random() * 0.1, 0.035, i % 3 ? 0x8c5a2f : 0xc9a26a, 0.7, true);
        if (e.t !== 'splinter') puff(e.x, e.y, 0.45, 0xb8a27a, 0.5, 0.8, 0.2);
      } else if (e.t === 'impact') { // the ground or a wall: dust
        puff(e.x, e.y, 0.28, 0xb8a888, 0.55, 0.7, 0.15);
        for (let i = 0; i < 3; i++) bit(e.x, e.y, e.v + (Math.random() - 0.5) * 1.6, 2 + Math.random() * 2, 0.04, 0.03, 0x8a7a60, 0.4, true);
      }
    },
    /** Each frame: the bullets (between the last two frames), their trails, and every bit and puff. */
    draw(sim: Sim, alpha: number, seconds: number, wind = 0) {
      const B = T.finish.bullets;
      simNow = sim;
      // trails: one per bullet in flight; a bullet that is gone leaves its trail fading where it ended
      const live = new Set<number>();
      for (const u of sim.bullets) {
        live.add(u.id);
        const x = lerp(u.px, u.x, alpha), y = lerp(u.py, u.y, alpha);
        const t = trailList.find((q) => q.id === u.id);
        const look = t ? undefined : PROPS[u.gun || shotBy.get(u.owner) || '']?.gun?.look;
        if (t) { t.x = x; t.y = y; } else trailList.push({ id: u.id, ox: u.ox, oy: u.oy, x, y, fade: 1, drift: 0, color: look?.color ?? 0xffffff, orb: look?.orb ?? 0, dash: false });
      }
      trails.clear();
      for (let i = trailList.length - 1; i >= 0; i--) {
        const q = trailList[i];
        if (!live.has(q.id)) q.fade -= seconds / B.trailFadeSeconds;
        q.drift += wind * T.finish.wind.trail * seconds * 10; // the wind carries the trail off (its old end most)
        if (q.fade <= 0) { trailList.splice(i, 1); continue; }
        const dx = q.x - q.ox, dy = q.y - q.oy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
        const tx = q.ox - ux * B.tailBack, ty = q.oy - uy * B.tailBack, n = 8; // the trail reaches back past the shooter
        for (let k = q.dash ? 1 : 0; k < n; k += q.dash ? 2 : 1) { // fading in from the tail to the bullet (every other piece when it was sent back)
          const a0 = k / n, a1 = (k + 1) / n;
          trails.moveTo(lerp(tx, q.x, a0) + q.drift * (1 - a0), lerp(ty, q.y, a0)).lineTo(lerp(tx, q.x, a1) + q.drift * (1 - a1), lerp(ty, q.y, a1)).stroke({ width: B.trailWidth, color: q.color, alpha: B.trailAlpha * a1 * q.fade, cap: 'butt' });
        }
        if (live.has(q.id) && q.orb) { // a glowing ball (plasma, a beanbag): a soft halo, the ball, a bright core
          trails.circle(q.x, q.y, q.orb * 1.8).fill({ color: q.color, alpha: 0.2 }).circle(q.x, q.y, q.orb).fill({ color: q.color, alpha: 0.9 }).circle(q.x, q.y, q.orb * 0.45).fill({ color: 0xffffff, alpha: 0.9 });
        } else if (live.has(q.id)) { // the bullet itself: a bright white streak with a soft glow
          const s = Math.min(B.streak, d);
          trails.moveTo(q.x - ux * s, q.y - uy * s).lineTo(q.x, q.y).stroke({ width: B.streakWidth * 3, color: 0xffffff, alpha: 0.22, cap: 'round' });
          trails.moveTo(q.x - ux * s, q.y - uy * s).lineTo(q.x, q.y).stroke({ width: B.streakWidth, color: 0xffffff, alpha: 1, cap: 'round' });
        }
      }
      // muzzle flashes: a short star of light along the barrel
      flashes.clear();
      for (let i = flashList.length - 1; i >= 0; i--) {
        const f = flashList[i];
        f.life -= seconds;
        if (f.life <= 0) { flashList.splice(i, 1); continue; }
        const k = f.life / B.flashSeconds, c = Math.cos(f.a), s = Math.sin(f.a), L = 0.35 * (0.6 + 0.4 * k);
        flashes.poly([f.x - s * 0.07, f.y + c * 0.07, f.x + c * L, f.y + s * L, f.x + s * 0.07, f.y - c * 0.07]).fill({ color: 0xfff1b0, alpha: k });
        flashes.circle(f.x, f.y, 0.1 * k + 0.04).fill({ color: 0xffd27a, alpha: 0.8 * k });
      }
      for (const b of bits) {
        if (!b.g.visible) continue;
        b.life -= seconds;
        if (b.life <= 0) { b.g.visible = false; continue; }
        if (b.fall) b.vy += T.sim.gravity * seconds;
        b.x += b.vx * seconds; b.y += b.vy * seconds;
        b.g.position.set(b.x, b.y); b.g.rotation += b.spin * seconds; b.g.alpha = Math.min(1, (b.life / b.max) * 2);
      }
      for (const p of puffs) {
        if (!p.s.visible) continue;
        p.life -= seconds;
        if (p.life <= 0) { p.s.visible = false; continue; }
        const k = 1 - p.life / p.max;
        p.y += p.vy * seconds;
        p.x += wind * T.finish.wind.smoke * seconds * 10; // smoke blows away downwind
        p.s.position.set(p.x, p.y);
        p.s.scale.set((p.size * (0.6 + k)) / 100);
        p.s.alpha = (1 - k) * p.a;
      }
      for (const [i, t] of twirls) { if (t > T.finish.bullets.twirlSeconds) twirls.delete(i); else twirls.set(i, t + seconds); }
    },
    /** A new round: nothing carries over. */
    clear() { trailList.length = 0; flashList.length = 0; twirls.clear(); for (const b of bits) b.g.visible = false; for (const p of puffs) p.s.visible = false; },
  };
}

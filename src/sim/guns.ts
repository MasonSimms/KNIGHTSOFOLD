import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { Collider } from '@dimforge/rapier2d-deterministic-compat';
import { PROPS } from '../content/props';
import { tuning as T } from '../content/tuning';
import { damageFor } from './combat';
import { createProp, dropToWorld, shove, takeIn } from './fighter';
import type { Fighter, Part } from './fighter';
import { surfaceY } from './water';
import { leak } from './tower';
import type { Sim } from './world';
import type { SimEvent } from './types';

// Guns and bullets (owner). A loaded gun fires one shot a click (fighter.ts sets fireRequest); a bullet is a fast, real shot that flies
// through the world (a ray each frame, so it never skips through anything) and stops at the first thing it meets:
//  - a fighter: a hit like a club's (more to the head), a shove, and the hidden health goes down;
//  - a weapon in someone's hand, by what it is made of: metal stops it with a spark; wood cracks and, shot enough, snaps in two (the handle
//    stays in the hand); light things are knocked out of the hand; a shield (later eras) sends it back, and then it can hit anyone;
//  - loose things are knocked about; a bridge plank is shot loose; breakable scenery (barrels, crates) splits into pieces;
//  - the ground or a wall stops it; the sea slows it to a stop.
// Your own bullet never hits you, unless something sent it back. Leaving the picture, it cracks the painting's frame (the renderer).
// Everything that changes the bodies is an event the online copies replay ('shot', 'empty', 'snap', 'break'), deterministic.

export interface Bullet {
  id: number; x: number; y: number; px: number; py: number; vx: number; vy: number;
  ox: number; oy: number; // where it was fired from (its trail starts there)
  owner: number; gun: string; calibre: number; impact: number; push: number;
  age: number; bounced: boolean; wet: boolean;
}

const ray = new RAPIER.Ray({ x: 0, y: 0 }, { x: 1, y: 0 });
const lenOf = (p: Part) => p.weapon?.length ?? 1;

/** Fire `f`'s gun (they pulled the trigger with it loaded): the bullet leaves the muzzle along the barrel, the gun kicks back. */
export function fire(sim: Sim, f: Fighter): void {
  const p = f.stick, G = p?.weapon?.gun;
  if (!p || !G || !f.grip || (p.ammo ?? 0) <= 0 || p.flipped) return;
  const b = p.body, t = b.translation(), g = b.rotation(), half = lenOf(p) / 2;
  const mx = t.x + Math.cos(g) * half, my = t.y + Math.sin(g) * half; // the muzzle: the far end of the gun
  // ...and the shot goes to exactly the point you aim at (the cursor), or along the aim if there is no point (a stick, or the cursor
  // right on top of the gun)
  const ft = f.torso.body.translation(), tx = ft.x + Math.cos(f.aim) * f.reach, ty = ft.y + Math.sin(f.aim) * f.reach;
  const toPoint = Math.atan2(ty - my, tx - mx), ok = f.reach > 0 && Math.hypot(tx - mx, ty - my) > 0.4 && Math.abs(Math.atan2(Math.sin(toPoint - f.aim), Math.cos(toPoint - f.aim))) < 0.6;
  const a = ok ? toPoint : f.aim, c = Math.cos(a), s = Math.sin(a);
  sim.bullets.push({ id: sim.nextBullet++, x: mx, y: my, px: mx, py: my, vx: c * G.speed, vy: s * G.speed, ox: mx, oy: my, owner: f.index, gun: p.weapon!.id, calibre: G.calibre, impact: G.impact, push: G.push, age: 0, bounced: false, wet: false });
  b.applyImpulse({ x: -c * G.recoil, y: -s * G.recoil }, true); // the gun (and the arm) kicks back...
  shove(f, -c * G.kick, -s * G.kick); // ...and the whole body is pushed back (bigger guns more)
  f.gunCool = G.cooldown;
  sim.events.push({ t: 'shot', x: mx, y: my, v: a, owner: f.index, victim: -1, w: p.weapon!.id });
  spendShot(f);
  if (p.flipped) sim.events.push({ t: 'empty', x: mx, y: my, v: 0, owner: f.index, victim: -1, w: p.weapon!.id }); // the last one: a dry click, a puff, the gun turned round
}

/**
 * Online prediction (the page's own fighter): the trigger pulled with a loaded gun shows at once: the gun kicks and the body is pushed back
 * here, and the flash and bang play. No bullet and no shot used: those are the server's (it says so a moment later).
 */
export function predictShot(f: Fighter): SimEvent | null {
  const p = f.stick, G = p?.weapon?.gun;
  if (!p || !G || !f.grip || (p.ammo ?? 0) <= 0 || p.flipped) return null;
  const b = p.body, t = b.translation(), g = b.rotation(), half = lenOf(p) / 2, c = Math.cos(f.aim), s = Math.sin(f.aim);
  b.applyImpulse({ x: -c * G.recoil, y: -s * G.recoil }, true);
  shove(f, -c * G.kick, -s * G.kick);
  f.gunCool = G.cooldown;
  return { t: 'shot', x: t.x + Math.cos(g) * half, y: t.y + Math.sin(g) * half, v: f.aim, owner: f.index, victim: -1, w: p.weapon!.id };
}

/** One shot used (the server's 'shot', or the online copy replaying it): the last one turns the gun round: an empty gun is a club. */
export function spendShot(f: Fighter): void {
  const p = f.stick;
  if (!p || p.ammo === undefined) return;
  p.ammo = Math.max(0, p.ammo - 1);
  if (p.ammo === 0) p.flipped = true;
}

/** Every bullet flies one frame: what it meets, it hits. */
export function moveBullets(sim: Sim): void {
  const dt = T.sim.dt, A = sim.arena, G = T.guns;
  for (let i = sim.bullets.length - 1; i >= 0; i--) {
    const u = sim.bullets[i];
    u.px = u.x; u.py = u.y; u.age++;
    if (A.sea && u.y > surfaceY(A, sim.frame, u.x)) { // into the sea: a splash, then it slows to a stop
      if (!u.wet) { u.wet = true; sim.events.push({ t: 'splash', x: u.x, y: u.y, v: Math.hypot(u.vx, u.vy), owner: u.owner, victim: -1 }); }
      u.vx *= G.waterSlow; u.vy *= G.waterSlow;
    }
    const sp = Math.hypot(u.vx, u.vy);
    if (sp < G.minSpeed || u.age > G.maxFrames) { sim.bullets.splice(i, 1); continue; }
    let travel = sp * dt, stopped = false;
    for (let bounce = 0; bounce < 3 && travel > 1e-4 && !stopped; bounce++) {
      ray.origin.x = u.x; ray.origin.y = u.y; ray.dir.x = u.vx / sp; ray.dir.y = u.vy / sp;
      const hit = sim.world.castRayAndGetNormal(ray, travel, true, undefined, undefined, undefined, undefined, (c) => meets(sim, u, c));
      if (!hit) { u.x += ray.dir.x * travel; u.y += ray.dir.y * travel; break; }
      u.x += ray.dir.x * hit.timeOfImpact; u.y += ray.dir.y * hit.timeOfImpact;
      travel -= hit.timeOfImpact;
      if (strike(sim, u, hit.collider, ray.dir.x, ray.dir.y, hit.normal.x, hit.normal.y) === 'stop') stopped = true;
    }
    if (stopped) { sim.bullets.splice(i, 1); continue; }
    if (u.x < 0 || u.x > A.viewW || u.y < 0 || u.y > A.viewH) { // out of the picture: it cracks the frame where it leaves
      const ex = Math.max(0, Math.min(A.viewW, u.x)), ey = Math.max(0, Math.min(A.viewH, u.y));
      sim.events.push({ t: 'exit', x: ex, y: ey, v: u.calibre, owner: u.owner, victim: -1 });
      sim.bullets.splice(i, 1);
    }
  }
}

/** Can this bullet meet this collider? Not its own shooter (unless sent back), not anyone dodging into the background. */
function meets(sim: Sim, u: Bullet, c: Collider): boolean {
  const body = c.parent();
  const part = body ? sim.partByBody.get(body.handle) : undefined;
  if (!part) return true; // the ground, a wall, the ship
  if (part.role === 'prop') return !part.back; // (a standing stone behind the fighters: the bullet passes in front of it)
  const f = sim.fighters[part.owner];
  if (!f) return true;
  if (part.owner === u.owner && !u.bounced) return false;
  return !f.inBack;
}

/** What happens where a bullet meets something. 'stop' ends it; 'on' = it carries on (sent back). */
function strike(sim: Sim, u: Bullet, c: Collider, dx: number, dy: number, nx: number, ny: number): 'stop' | 'on' {
  const G = T.guns, body = c.parent()!, part = sim.partByBody.get(body.handle), at = { x: u.x, y: u.y };
  const push = (k: number) => body.applyImpulseAtPoint({ x: dx * u.push * k, y: dy * u.push * k }, at, true);
  const ev = (t: 'spark' | 'splinter' | 'impact', victim = -1) => sim.events.push({ t, x: u.x, y: u.y, v: Math.atan2(ny, nx), owner: u.owner, victim });
  if (!part) { leak(sim, u.x, u.y, nx); ev('impact'); return 'stop'; } // the ground or a wall: a puff of dust (the water tower's tank: a leak)
  const holder = part.owner >= 0 && part.role !== 'prop' ? sim.fighters[part.owner] : undefined;
  if (part.role === 'flail') { push(G.blockPush); ev('spark', holder?.index ?? -1); return 'stop'; } // a flail's iron (or gold) head in someone's hand: it stops the bullet
  if (part.role === 'stick' && holder && holder.grip && holder.stick === part) { // a weapon in someone's hand
    const m = part.weapon?.material ?? 'wood';
    if (m === 'shield') { // sent back the way it came: now it can hit anyone, the shooter too
      const d = u.vx * nx + u.vy * ny; // (mirrored about the surface)
      u.vx -= 2 * d * nx; u.vy -= 2 * d * ny;
      u.bounced = true; u.x += nx * 0.02; u.y += ny * 0.02;
      push(G.blockPush); ev('spark', holder.index);
      return 'on';
    }
    if (m === 'metal' || m === 'stone') { push(G.blockPush); ev('spark', holder.index); return 'stop'; }
    if (m === 'light') { sim.disarmByShot(holder, dx * u.push, dy * u.push, u.owner); return 'stop'; } // knocked out of the hand
    push(G.blockPush); // wood: it takes the bullet, and cracks
    crack(sim, part, u, holder);
    return 'stop';
  }
  if (part.role === 'prop' || part.role === 'stick') { // loose things: knocked about; a bridge plank is shot loose; scenery and wood can break
    push(1);
    if (part.links?.length) sim.shootLoose(part, u.x, u.y, u.owner);
    if (part.hp !== undefined) {
      part.hp -= u.calibre * G.sceneryDamage;
      if (part.hp <= 0) { breakProp(sim, part); return 'stop'; }
      ev('splinter');
    } else if ((part.weapon?.material ?? 'wood') === 'wood') crack(sim, part, u, undefined);
    else ev('spark');
    return 'stop';
  }
  if (holder && !holder.limp) { // a fighter
    const head = c === holder.headCollider || part.role === 'head';
    const dmg = damageFor(u.impact, head ? T.combat.headMult : 1);
    holder.hp -= dmg;
    holder.stun = T.combat.stunFrames;
    shove(holder, dx * u.push, dy * u.push);
    sim.events.push({ t: 'hit', x: u.x, y: u.y, v: u.impact, owner: u.owner, victim: holder.index, head, how: 'shot', w: u.gun, d: dmg });
    sim.afterShot(holder, u.impact, dx);
    return 'stop';
  }
  push(1); // a body on the ground
  return 'stop';
}

/** A wooden thing takes a bullet: a crack, or, shot enough, it snaps in two. */
function crack(sim: Sim, part: Part, u: Bullet, holder: Fighter | undefined): void {
  part.cracks = (part.cracks ?? 0) + u.calibre;
  const tough = part.weapon?.toughness ?? T.guns.woodToughness;
  if (part.cracks < tough) { sim.events.push({ t: 'splinter', x: u.x, y: u.y, v: 0, owner: u.owner, victim: holder?.index ?? -1 }); return; }
  const t = part.body.translation(), a = part.body.rotation();
  const along = (u.x - t.x) * Math.cos(a) + (u.y - t.y) * Math.sin(a); // where along it the bullet hit
  const index = holder ? -1 : sim.props.indexOf(part);
  sim.events.push({ t: 'snap', x: u.x, y: u.y, v: along, owner: holder?.index ?? -1, victim: index });
  snapPart(sim, part, along, holder);
}

/**
 * Snap a stick-like thing in two at `along` (metres from its middle along its length). Held: the half with the handle stays in the hand
 * (a stubby club), the other half flies loose. Both halves are real objects anyone can pick up. Also used by the online copies ('snap').
 */
export function snapPart(sim: Sim, part: Part, along: number, holder: Fighter | undefined): void {
  const W = part.weapon, L = lenOf(part), min = T.guns.minPiece;
  if (!W || L < 2 * min) return;
  const s = Math.max(-L / 2 + min, Math.min(L / 2 - min, along));
  const b = part.body, t = b.translation(), a = b.rotation(), c = Math.cos(a), sn = Math.sin(a), v = b.linvel(), w = b.angvel();
  const pieces = [[-L / 2, s], [s, L / 2]].map(([from, to]) => {
    const mid = (from + to) / 2, len = to - from;
    const p = createProp(sim.world, t.x + c * mid, t.y + sn * mid, a, { kind: W.id, len, thick: W.thickness, mass: (W.mass * len) / L, factor: W.impactFactor, material: W.material, toughness: Math.max(1, Math.ceil((W.toughness ?? T.guns.woodToughness) / 2)) });
    p.body.setLinvel({ x: v.x - w * sn * mid, y: v.y + w * c * mid }, true);
    p.body.setAngvel(w, true);
    return p;
  });
  sim.removeBody(part, holder);
  for (const p of pieces) { sim.props.push(p); sim.partByBody.set(p.body.handle, p); }
  if (holder && !holder.armLost) { // the handle end (the first half: the hand holds near that end) goes back into the hand
    const keep = pieces[0];
    sim.props.splice(sim.props.indexOf(keep), 1);
    takeIn(sim.world, holder, keep);
  }
  pieces[1].body.applyImpulse({ x: -sn * T.guns.snapFling, y: c * T.guns.snapFling - T.guns.snapFling }, true); // the loose half flies off
  sim.version++;
}

/** Breakable scenery splits into its pieces (props.ts breaks), thrown apart a little. Also used by the online copies ('break'). */
export function breakProp(sim: Sim, part: Part, announce = true): void {
  const spec = PROPS[part.weapon?.id ?? ''];
  const into = spec?.breaks?.into ?? [];
  const t = part.body.translation(), a = part.body.rotation(), v = part.body.linvel();
  const index = sim.props.indexOf(part);
  if (index < 0) return;
  if (announce) sim.events.push({ t: 'break', x: t.x, y: t.y, v: 0, owner: -1, victim: index, w: part.weapon?.id }); // (w: what broke: glass shatters)
  sim.removeBody(part, undefined);
  into.forEach((kind, k) => {
    const off = (k - (into.length - 1) / 2) * 0.22, ps = PROPS[kind];
    const p = createProp(sim.world, t.x + Math.cos(a) * off, t.y + Math.sin(a) * off - 0.05 * k, a + k * 0.7, { kind, ...ps });
    p.body.setLinvel({ x: v.x + off * T.guns.breakSpread, y: v.y - T.guns.breakSpread * 0.4 }, true);
    p.body.setAngvel((k - 1) * 3, true);
    sim.props.push(p);
    sim.partByBody.set(p.body.handle, p);
  });
  sim.version++;
}

/** A beer mug (props.ts shatters) smashes: gone, from the hand holding it or from the floor. Also used by the online copies ('shatter'). */
export function shatter(sim: Sim, part: Part, holder: Fighter | undefined, announce = true): void {
  const t = part.body.translation(), index = holder ? -1 : sim.props.indexOf(part);
  if (!holder && index < 0) return;
  if (announce) sim.events.push({ t: 'shatter', x: t.x, y: t.y, v: 0, owner: holder?.index ?? -1, victim: index, w: part.weapon?.id });
  sim.removeBody(part, holder);
  sim.version++;
}

/** Destroy breakable scenery that took a hard hit (a club, a crash): the same as a bullet breaking it. */
export function damageScenery(sim: Sim, part: Part, impact: number): void {
  if (part.hp === undefined || impact < (PROPS[part.weapon?.id ?? '']?.breaks?.min ?? T.guns.sceneryMinImpact)) return;
  part.hp -= impact;
  if (part.hp <= 0) breakProp(sim, part);
}

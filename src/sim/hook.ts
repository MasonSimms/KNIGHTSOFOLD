import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { Collider, ImpulseJoint, RigidBody } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import type { Fighter, Part } from './fighter';
import type { Sim } from './world';

// The grappling hook (owner, 2026-10-07; the Pirates' boat hook, weapon field `hook`): click and the hook flies along your aim; it catches on
// the first thing it touches (up to tuning.hook.range). Caught on the scenery or a ship, you swing from it; on a fighter, they are yanked
// toward you; on a loose thing, it comes to you. Hold the click to reel in; let go of it to let go. The rope is a rope joint from the hook's
// end of the weapon to where it caught; a blade swung fast through it cuts it. Online the page draws it from the snapshot (Snapshot.hk)
// and your own fighter follows the server while you hang on it (snapshot.fighterState HOOKED).

export interface Hook {
  owner: number;
  x: number; y: number; // the hook: in flight, or where it caught (world)
  vx: number; vy: number;
  flown: number; // metres so far
  joint: ImpulseJoint | null; // caught: the rope
  body: RigidBody | null; // ...and what it caught on
  ax: number; ay: number; // where on it (that body's own frame)
  length: number; // the rope's length now (reeling shortens it)
  victim: number; // the fighter it caught (-1: none)
}

const ray = new RAPIER.Ray({ x: 0, y: 0 }, { x: 1, y: 0 });
/** The hook's end of the weapon (the far end), in the world. */
function tipOf(p: Part): { x: number; y: number } {
  const t = p.body.translation(), r = p.body.rotation(), h = (p.weapon?.length ?? 1) / 2;
  return { x: t.x + Math.cos(r) * h, y: t.y + Math.sin(r) * h };
}

/** Each frame, after everyone's controls and before the physics: throw, fly, catch, reel, let go, cut. */
export function moveHooks(sim: Sim): void {
  const H = T.hook, dt = T.sim.dt;
  for (const f of sim.fighters) {
    if (!f.hookRequest) continue;
    f.hookRequest = false;
    const p = f.stick;
    if (!p || !f.grip || !p.weapon?.hook || sim.hooks.some((h) => h.owner === f.index)) continue;
    const s = tipOf(p), ft = f.torso.body.translation(), tx = ft.x + Math.cos(f.aim) * f.reach, ty = ft.y + Math.sin(f.aim) * f.reach;
    const a = f.reach > 0 && Math.hypot(tx - s.x, ty - s.y) > 0.4 ? Math.atan2(ty - s.y, tx - s.x) : f.aim; // (at the point you aim at, as a gun is)
    sim.hooks.push({ owner: f.index, x: s.x, y: s.y, vx: Math.cos(a) * H.speed, vy: Math.sin(a) * H.speed, flown: 0, joint: null, body: null, ax: 0, ay: 0, length: 0, victim: -1 });
    sim.events.push({ t: 'hookThrow', x: s.x, y: s.y, v: a, owner: f.index, victim: -1 });
  }
  for (let i = sim.hooks.length - 1; i >= 0; i--) {
    const h = sim.hooks[i], f = sim.fighters[h.owner], p = f?.stick;
    if (!f || !p || !f.grip || !p.weapon?.hook || f.limp || (h.joint && !f.trigger) || (h.body && !sim.world.getRigidBody(h.body.handle))) { unhook(sim, i); continue; } // let go, lost the hook, down, or what it held is gone
    const s = tipOf(p);
    if (!h.joint) { // in flight
      const sp = Math.hypot(h.vx, h.vy), step = sp * dt;
      ray.origin.x = h.x; ray.origin.y = h.y; ray.dir.x = h.vx / sp; ray.dir.y = h.vy / sp;
      const hit = sim.world.castRay(ray, step, true, undefined, undefined, undefined, undefined, (c) => catches(sim, f, c));
      if (hit) { catchOn(sim, h, f, hit.collider, h.x + ray.dir.x * hit.timeOfImpact, h.y + ray.dir.y * hit.timeOfImpact, s); continue; }
      h.x += ray.dir.x * step; h.y += ray.dir.y * step; h.vy += T.sim.gravity * H.drop * dt; h.flown += step;
      if (h.flown > H.range) unhook(sim, i); // nothing in reach: it comes back
      continue;
    }
    const b = h.body!, t = b.translation(), r = b.rotation();
    h.x = t.x + Math.cos(r) * h.ax - Math.sin(r) * h.ay; h.y = t.y + Math.sin(r) * h.ax + Math.cos(r) * h.ay;
    if (f.trigger && h.length > H.minLength) { // reeling in: a shorter rope (made again: a rope's length is fixed once made)
      h.length = Math.max(H.minLength, Math.min(h.length, Math.hypot(h.x - s.x, h.y - s.y) + 0.05) - H.reel * dt);
      tie(sim, h, p);
    }
    // A blade swung fast through the rope cuts it.
    const dx = h.x - s.x, dy = h.y - s.y, d = Math.hypot(dx, dy);
    if (d > 0.3) {
      ray.origin.x = s.x; ray.origin.y = s.y; ray.dir.x = dx / d; ray.dir.y = dy / d;
      const cut = sim.world.castRay(ray, d - 0.1, true, undefined, undefined, undefined, undefined, (c) => cuts(sim, f, c));
      if (cut) { sim.events.push({ t: 'unhook', x: s.x + ray.dir.x * cut.timeOfImpact, y: s.y + ray.dir.y * cut.timeOfImpact, v: 1, owner: f.index, victim: -1 }); unhook(sim, i, false); }
    }
  }
  for (const f of sim.fighters) { f.hooked = false; f.hauled = false; }
  sim.hookLines = sim.hooks.flatMap((h) => { if (h.joint) { sim.fighters[h.owner].hooked = true; if (h.victim >= 0) sim.fighters[h.victim].hauled = true; } return [h.owner, Math.round(h.x * 1000) / 1000, Math.round(h.y * 1000) / 1000, h.joint ? 1 : 0]; });
}

/** Can the hook catch on this? Anything but the thrower and what is in the background. */
function catches(sim: Sim, f: Fighter, c: Collider): boolean {
  const body = c.parent(), part = body ? sim.partByBody.get(body.handle) : undefined;
  if (!part) return true; // the ground, a wall, a ledge, a ship
  if (part.back) return false;
  if (part.owner === f.index) return false;
  const g = part.owner >= 0 ? sim.fighters[part.owner] : undefined;
  return !g?.inBack;
}

/** A blade of someone else's, moving fast (a swing), across the rope. */
function cuts(sim: Sim, f: Fighter, c: Collider): boolean {
  const body = c.parent(), part = body ? sim.partByBody.get(body.handle) : undefined;
  if (!part || part.role !== 'stick' || part.owner === f.index || part.owner < 0) return false;
  const v = body!.linvel();
  return Math.hypot(v.x, v.y) > T.hook.cutSpeed;
}

function catchOn(sim: Sim, h: Hook, f: Fighter, c: Collider, x: number, y: number, s: { x: number; y: number }): void {
  const body = c.parent()!, t = body.translation(), r = body.rotation(), dx = x - t.x, dy = y - t.y;
  h.body = body; h.x = x; h.y = y;
  h.ax = Math.cos(r) * dx + Math.sin(r) * dy; h.ay = -Math.sin(r) * dx + Math.cos(r) * dy;
  h.length = Math.max(T.hook.minLength, Math.hypot(x - s.x, y - s.y));
  tie(sim, h, f.stick!);
  const part = sim.partByBody.get(body.handle), victim = part && part.role !== 'prop' && part.owner >= 0 ? sim.fighters[part.owner] : undefined;
  if (victim) { // a fighter: yanked off their feet toward you
    const ft = f.torso.body.translation(), vt = victim.torso.body.translation(), d = Math.hypot(ft.x - vt.x, ft.y - vt.y) || 1;
    victim.torso.body.applyImpulse({ x: ((ft.x - vt.x) / d) * T.hook.yank, y: ((ft.y - vt.y) / d) * T.hook.yank }, true);
    victim.stun = Math.max(victim.stun, T.hook.stun);
    h.victim = victim.index;
  }
  sim.events.push({ t: 'hook', x, y, v: 0, owner: f.index, victim: victim?.index ?? -1 });
}

/** (Re)make the rope at its present length, from the hook's end of the weapon to where it caught. */
function tie(sim: Sim, h: Hook, p: Part): void {
  if (h.joint && sim.world.getImpulseJoint(h.joint.handle)) sim.world.removeImpulseJoint(h.joint, true);
  h.joint = sim.world.createImpulseJoint(RAPIER.JointData.rope(h.length, { x: (p.weapon?.length ?? 1) / 2, y: 0 }, { x: h.ax, y: h.ay }), p.body, h.body!, true);
}

/** The hook comes back: the rope (if any) is gone. */
export function unhook(sim: Sim, i: number, announce = true): void {
  const h = sim.hooks[i];
  if (h.joint && sim.world.getImpulseJoint(h.joint.handle)) sim.world.removeImpulseJoint(h.joint, true);
  if (announce) sim.events.push({ t: 'unhook', x: h.x, y: h.y, v: 0, owner: h.owner, victim: -1 });
  sim.hooks.splice(i, 1);
}

import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { Collider, ImpulseJoint, RigidBody } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import { shove, fighterMass } from './fighter';
import type { Fighter, Part } from './fighter';
import { spendShot } from './guns';
import type { Sim } from './world';

// The grappling hook (owner, 2026-10-07; the Pirates' boat hook, weapon field `hook`): click and the hook flies along your aim; it catches on
// the first thing it touches (up to tuning.hook.range). Caught on the scenery or a ship, you swing from it; on a fighter, they are yanked
// toward you; on a loose thing, it comes to you. Hold the click to reel in; let go of it to let go. The rope is a rope joint from the hook's
// end of the weapon to where it caught; a blade swung fast through it cuts it. Online the page draws it from the snapshot (Snapshot.hk)
// and your own fighter follows the server while you hang on it (snapshot.fighterState HOOKED). The lasso (weapon `lasso`) is thrown the
// same way but only takes people and loose things (it flies past the scenery), and a lassoed fighter is held longer (tuning.lasso).

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
  held: number; // frames it has held what it caught
}

/** What throws a hook: a grappling hook, a lasso, a loaded tractor beam. */
const hooks = (p: Part) => !!p.weapon?.hook || (!!p.weapon?.gun?.beam && (p.ammo ?? 0) > 0 && !p.flipped);
/** Its numbers: a tractor beam's are its own (props.ts gun.beam) on tuning.tractor's. */
function specOf(p: Part) {
  const B = p.weapon?.gun?.beam;
  return B ? { ...T.tractor, range: B.range, reel: B.reel } : p.weapon?.lasso ? T.lasso : T.hook;
}
/** Only people and loose things: a lasso, a tractor beam (the scenery is passed by). */
const picky = (p: Part | null | undefined) => !!p?.weapon?.lasso || !!p?.weapon?.gun?.beam;

const ray = new RAPIER.Ray({ x: 0, y: 0 }, { x: 1, y: 0 });
/** The hook's end of the weapon (the far end), in the world. */
function tipOf(p: Part): { x: number; y: number } {
  const t = p.body.translation(), r = p.body.rotation(), h = (p.weapon?.length ?? 1) / 2;
  return { x: t.x + Math.cos(r) * h, y: t.y + Math.sin(r) * h };
}

/** Each frame, after everyone's controls and before the physics: throw, fly, catch, reel, let go, cut. */
export function moveHooks(sim: Sim): void {
  const dt = T.sim.dt;
  for (const f of sim.fighters) {
    if (!f.hookRequest) continue;
    f.hookRequest = false;
    const p = f.stick;
    if (!p || !f.grip || !hooks(p) || sim.hooks.some((h) => h.owner === f.index)) continue;
    const H = specOf(p);
    const s = tipOf(p), ft = f.torso.body.translation(), tx = ft.x + Math.cos(f.aim) * f.reach, ty = ft.y + Math.sin(f.aim) * f.reach;
    const a = f.reach > 0 && Math.hypot(tx - s.x, ty - s.y) > 0.4 ? Math.atan2(ty - s.y, tx - s.x) : f.aim; // (at the point you aim at, as a gun is)
    sim.hooks.push({ owner: f.index, x: s.x, y: s.y, vx: Math.cos(a) * H.speed, vy: Math.sin(a) * H.speed, flown: 0, joint: null, body: null, ax: 0, ay: 0, length: 0, victim: -1, held: 0 });
    if (p.weapon?.gun?.beam) { sim.events.push({ t: 'shot', x: s.x, y: s.y, v: a, owner: f.index, victim: -1, w: p.weapon.id }); spendShot(f); } // (a tractor beam: one catch, one shot)
    else sim.events.push({ t: 'hookThrow', x: s.x, y: s.y, v: a, owner: f.index, victim: -1 });
  }
  for (let i = sim.hooks.length - 1; i >= 0; i--) {
    const h = sim.hooks[i], f = sim.fighters[h.owner], p = f?.stick;
    const beam = p?.weapon?.gun?.beam;
    if (!f || !p || !f.grip || !(p.weapon?.hook || beam) || f.limp || (h.joint && !f.trigger) || (beam && h.held > beam.hold) || (h.body && !sim.world.getRigidBody(h.body.handle))) { // let go, lost the hook, down, or what it held is gone
      if (beam && h.joint && f && !f.limp && h.body && sim.world.getRigidBody(h.body.handle)) fling(sim, h, f, beam.fling); // (a tractor beam lets go with a fling)
      unhook(sim, i);
      continue;
    }
    if (h.joint) h.held++;
    const s = tipOf(p), H = specOf(p);
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
  if (!part) return !picky(f.stick); // the ground, a wall, a ledge, a ship (a lasso or a tractor beam passes them by)
  if (part.back) return false;
  if (picky(f.stick) && (part.links?.length || !body!.isDynamic())) return false; // (a lasso or a tractor beam takes only what is loose: not a rope's link, a bridge's plank, a hanging cage, the bamboo or a machine: reeled or flung, the joints holding one fought back and threw it at hundreds of m/s)
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
  const H = specOf(f.stick!);
  h.length = Math.max(H.minLength, Math.hypot(x - s.x, y - s.y));
  tie(sim, h, f.stick!);
  const part = sim.partByBody.get(body.handle), victim = part && part.role !== 'prop' && part.owner >= 0 ? sim.fighters[part.owner] : undefined;
  if (victim) { // a fighter: yanked off their feet toward you
    const ft = f.torso.body.translation(), vt = victim.torso.body.translation(), d = Math.hypot(ft.x - vt.x, ft.y - vt.y) || 1;
    victim.torso.body.applyImpulse({ x: ((ft.x - vt.x) / d) * H.yank, y: ((ft.y - vt.y) / d) * H.yank }, true);
    victim.stun = Math.max(victim.stun, H.stun);
    h.victim = victim.index;
  }
  sim.events.push({ t: 'hook', x, y, v: 0, owner: f.index, victim: victim?.index ?? -1 });
}

/** A tractor beam lets go: what it held is thrown along the aim. */
function fling(sim: Sim, h: Hook, f: Fighter, speed: number): void {
  const c = Math.cos(f.aim), s = Math.sin(f.aim), v = h.victim >= 0 ? sim.fighters[h.victim] : undefined;
  if (v) shove(v, c * speed * fighterMass(v), s * speed * fighterMass(v));
  else { const m = h.body!.mass(); h.body!.applyImpulse({ x: c * speed * m, y: s * speed * m }, true); }
  sim.events.push({ t: 'throw', x: h.x, y: h.y, v: speed, owner: f.index, victim: v?.index ?? -1 });
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

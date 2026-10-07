import type { Collider } from '@dimforge/rapier2d-deterministic-compat';
import type { GunSpec } from '../content/weapons';
import { tuning as T } from '../content/tuning';
import { attachedParts } from './fighter';
import type { Fighter, Part } from './fighter';
import { windAt } from './wind';
import type { Sim } from './world';

// The Space Age ray guns' effects (owner, the Gun Locker: props.ts gun.effect), on the fighter or loose thing a shot stops in:
//  - swap: the shooter and what they hit change places (and speeds);
//  - freeze: a block of ice for a while: no moving, the weapon dropped, the body one rigid thing that slides (slippery);
//  - bubble: floating up in a bubble, drifting with the wind, until any hurt pops it or it runs out.
// The server does all of it; online the copies are told who is frozen or in a bubble (snapshot FROZEN, BUBBLE) to draw them.

const ice = new WeakMap<Fighter, [Collider, number][]>(); // a frozen fighter's colliders and their own friction (put back when it thaws)
const popAt = new WeakMap<Fighter, number>(); // the hidden health a bubble was blown at: any hurt below it pops it

/** A black hole, open (a gun's `zone`): pulling everything in, then popping. */
export interface Zone { x: number; y: number; left: number; owner: number; radius: number; strength: number; pop: number }

/** A black hole shot stops (props.ts gun.zone): it opens where it is. */
export function openZone(sim: Sim, x: number, y: number, owner: number, z: NonNullable<GunSpec['zone']>): void {
  sim.zones.push({ x, y, left: z.frames, owner, radius: z.radius, strength: z.strength, pop: z.pop });
  sim.events.push({ t: 'zap', x, y, v: 0, owner, victim: -1, w: 'hole' });
}

/** Each frame: every open black hole pulls on every body near it (fighters, weapons, loose things); run out, it pops them outward. */
function moveZones(sim: Sim): void {
  const dt = T.sim.dt;
  for (let i = sim.zones.length - 1; i >= 0; i--) {
    const z = sim.zones[i];
    if (--z.left <= 0) {
      sim.zones.splice(i, 1);
      sim.events.push({ t: 'zap', x: z.x, y: z.y, v: 1, owner: z.owner, victim: -1, w: 'holepop' });
      sim.blast(z.x, z.y, z.owner, { radius: z.radius, push: z.pop, impact: 0 }, z.owner);
      continue;
    }
    const pull = (b: { translation(): { x: number; y: number }; mass(): number; isDynamic(): boolean; applyImpulse(i: { x: number; y: number }, w: boolean): void }) => {
      if (!b.isDynamic()) return;
      const t = b.translation(), dx = z.x - t.x, dy = z.y - t.y, d = Math.hypot(dx, dy);
      if (d > z.radius || d < 1e-3) return;
      const a = z.strength * Math.min(1, d / T.effects.holeCore) * b.mass() * dt; // (fading in its very middle, so things swirl rather than shake)
      b.applyImpulse({ x: (dx / d) * a, y: (dy / d) * a }, true);
    };
    for (const f of sim.fighters) for (const p of f.parts) pull(p.body);
    for (const p of sim.props) pull(p.body);
  }
}

/** A shot with an effect stopped in `part` (a fighter's body, or a loose thing). */
export function zap(sim: Sim, owner: number, part: Part, effect: NonNullable<GunSpec['effect']>, x: number, y: number): void {
  const shooter = sim.fighters[owner], f = part.role !== 'prop' && part.owner >= 0 && part.role !== 'stick' && part.role !== 'flail' ? sim.fighters[part.owner] : undefined;
  if (f?.limp) return;
  if (effect.kind === 'swap') {
    if (!shooter || shooter.limp || f === shooter) return;
    const a = shooter.torso.body.translation(), av = shooter.torso.body.linvel(), b = f ? f.torso.body.translation() : part.body.translation(), bv = f ? f.torso.body.linvel() : part.body.linvel();
    const ax = a.x, ay = a.y, avx = av.x, avy = av.y, bx = b.x, by = b.y, bvx = bv.x, bvy = bv.y;
    moveAll(attachedParts(shooter), bx - ax, by - ay, bvx, bvy);
    if (f) moveAll(attachedParts(f), ax - bx, ay - by, avx, avy);
    else moveAll(part.head ? [part, part.head] : [part], ax - bx, ay - by, avx, avy);
  } else if (f && effect.kind === 'freeze') {
    if (f.grip) sim.disarmByShot(f, 0, 0, owner); // (the weapon falls out of the frozen hand)
    if (!ice.has(f)) ice.set(f, attachedParts(f).flatMap((p) => p.colliders.map((c): [Collider, number] => [c, c.friction()])));
    for (const [c] of ice.get(f)!) c.setFriction(T.effects.iceFriction);
    f.frozen = effect.frames ?? 120;
  } else if (f && effect.kind === 'bubble') {
    f.bubble = effect.frames ?? 240;
    f.bubbleRise = effect.rise ?? 1;
    popAt.set(f, f.hp);
  } else return;
  sim.events.push({ t: 'zap', x, y, v: 0, owner, victim: f?.index ?? -1, w: effect.kind });
}

/** Move every part by (dx, dy) and set it moving at (vx, vy). */
function moveAll(parts: Part[], dx: number, dy: number, vx: number, vy: number): void {
  for (const p of parts) {
    const t = p.body.translation();
    p.body.setTranslation({ x: t.x + dx, y: t.y + dy }, true);
    p.body.setLinvel({ x: vx, y: vy }, true);
  }
}

/** Each frame, before the physics: the frozen move as one rigid block; the bubbled float up and drift; both run out (a hurt pops a bubble). */
export function moveEffects(sim: Sim): void {
  const E = T.effects;
  moveZones(sim);
  for (const f of sim.fighters) {
    if (f.frozen > 0) {
      if (--f.frozen === 0 || f.limp) thaw(f);
      else { // every part moves with the torso, as if it were one body (velocity of a point on a turning body: v + w x r)
        const t = f.torso.body.translation(), v = f.torso.body.linvel(), w = f.torso.body.angvel();
        for (const p of attachedParts(f)) {
          if (p === f.torso) continue;
          const q = p.body.translation(), rx = q.x - t.x, ry = q.y - t.y;
          p.body.setLinvel({ x: v.x - w * ry, y: v.y + w * rx }, true);
          p.body.setAngvel(w, true);
        }
      }
    }
    if (f.bubble > 0) {
      if (--f.bubble === 0 || f.limp || f.hp < (popAt.get(f) ?? f.hp) - E.popHurt) pop(sim, f);
      else {
        const drift = (windAt(sim.arena, sim.frame) / T.wind.full) * E.bubbleDrift;
        for (const p of attachedParts(f)) {
          const v = p.body.linvel();
          p.body.setLinvel({ x: v.x + (drift - v.x) * E.bubbleEase, y: v.y + (-f.bubbleRise - v.y) * E.bubbleEase }, true);
          p.body.applyImpulse({ x: 0, y: -T.sim.gravity * p.body.mass() * T.sim.dt }, true); // (weightless in the bubble)
        }
      }
    }
  }
}

function thaw(f: Fighter): void {
  f.frozen = 0;
  const was = ice.get(f);
  if (was) for (const [c, k] of was) if (c.isValid()) c.setFriction(k); // (not a limb cut off meanwhile: its body is gone)
  ice.delete(f);
}

function pop(sim: Sim, f: Fighter): void {
  f.bubble = 0;
  const t = f.torso.body.translation();
  sim.events.push({ t: 'zap', x: t.x, y: t.y, v: 1, owner: -1, victim: f.index, w: 'pop' });
}

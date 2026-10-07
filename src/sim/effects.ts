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
  if (was) for (const [c, k] of was) c.setFriction(k);
  ice.delete(f);
}

function pop(sim: Sim, f: Fighter): void {
  f.bubble = 0;
  const t = f.torso.body.translation();
  sim.events.push({ t: 'zap', x: t.x, y: t.y, v: 1, owner: -1, victim: f.index, w: 'pop' });
}

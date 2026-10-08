import { tuning as T } from '../content/tuning';
import type { Weapon } from '../content/weapons';

/** Impact = closing speed along the contact normal (m/s) x the weapon's own factor. Nothing else. */
export function impactValue(closingSpeed: number, weaponFactor: number): number {
  return closingSpeed <= 0 ? 0 : closingSpeed * weaponFactor;
}

/** Hidden-HP damage; zero below the impact threshold (`min`: a blade's edge or a point starts lower, tuning.combat.blade.min). */
export function damageFor(impact: number, multiplier = 1, min = T.combat.impactMin): number {
  if (impact <= min) return 0;
  return Math.min(Math.pow(impact - min, T.combat.damageExp) * T.combat.damageScale * multiplier, T.combat.damageMax);
}

export function knockbackFor(impact: number): number {
  return Math.min(impact * T.combat.knockbackScale, T.combat.knockbackMax);
}

export interface Cut { kind: 'point' | 'blade' | 'blunt'; mul: number; min: number; knock: number }
/**
 * What part of a weapon landed (owner, 2026-10-07): its point (the last tuning.combat.pointZone of its length, on a weapon with a point),
 * its edge (a blade) or something blunt; and so the damage multiplier, the impact it starts hurting from, and how hard it shoves. along:
 * where the contact is along the weapon from its middle toward the tip (m); flipped: an empty gun held by the barrel. Fists (no weapon),
 * and everything with combat.edges off, are as before.
 */
export function cutFor(W: Weapon | undefined, along: number, flipped = false): Cut {
  const C = T.combat;
  if (!C.edges || !W) return { kind: 'blunt', mul: 1, min: C.impactMin, knock: 1 };
  if (W.point && !flipped && along >= W.length / 2 - C.pointZone * W.length) return { kind: 'point', mul: C.pointMul, min: C.impactMin * C.blade.min, knock: C.blade.knock };
  if (W.edge === 'blade') return { kind: 'blade', mul: C.blade.mul, min: C.impactMin * C.blade.min, knock: C.blade.knock };
  return { kind: 'blunt', mul: 1, min: C.impactMin, knock: C.bluntKnock };
}

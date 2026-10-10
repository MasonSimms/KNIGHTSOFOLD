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

/**
 * Two held weapons meeting (owner, 2026-10-10; tuning.clash). sa, sb: each weapon's speed where they met (m/s); closing: how fast they
 * close there; fa, fb: the weapons' impact factors; handA, handB: the blow landed at that one's hand. Nothing (null) when it is no clash:
 * a slow touch, or one of them is not being swung (held still it is a block: tuning.parry). Otherwise how hard it was and who, if anyone,
 * loses their weapon: the clearly weaker swing, far more easily when the blow lands at its hand.
 */
export function clashOutcome(sa: number, sb: number, closing: number, fa: number, fb: number, handA: boolean, handB: boolean): { impact: number; loser: 'a' | 'b' | null } | null {
  const K = T.clash, D = T.disarm;
  if (!K.enabled || closing < K.minClosing || Math.min(sa, sb) < K.minSpeed) return null;
  const pa = sa * fa, pb = sb * fb, aWins = pa >= pb, atHand = aWins ? handB : handA; // how strong each swing is: its speed where they met, and the weapon's heft
  const impact = impactValue(closing, aWins ? fa : fb);
  const out = Math.max(pa, pb) >= Math.min(pa, pb) * (atHand ? K.handRatio : D.clashRatio) && impact >= (atHand ? D.handImpact : D.clashImpact);
  return { impact, loser: out ? (aWins ? 'b' : 'a') : null };
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

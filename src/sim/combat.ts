import { tuning as T } from '../content/tuning';

/** Impact = closing speed along the contact normal (m/s) x the weapon's own factor. Nothing else. */
export function impactValue(closingSpeed: number, weaponFactor: number): number {
  return closingSpeed <= 0 ? 0 : closingSpeed * weaponFactor;
}

/** Hidden-HP damage; zero below the impact threshold. */
export function damageFor(impact: number, multiplier = 1): number {
  if (impact <= T.combat.impactMin) return 0;
  return Math.min(Math.pow(impact - T.combat.impactMin, T.combat.damageExp) * T.combat.damageScale * multiplier, T.combat.damageMax);
}

export function knockbackFor(impact: number): number {
  return Math.min(impact * T.combat.knockbackScale, T.combat.knockbackMax);
}

export function hitStopFor(impact: number): number {
  const { hitStopMin, hitStopMax, hitStopFullImpact } = T.combat;
  return Math.round(hitStopMin + (hitStopMax - hitStopMin) * Math.min(impact / hitStopFullImpact, 1));
}

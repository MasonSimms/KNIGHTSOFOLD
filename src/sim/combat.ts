import { tuning as T } from '../content/tuning';

/** Impact = closing speed along the contact normal x reduced mass x weapon multiplier. */
export function impactValue(closingSpeed: number, massA: number, massB: number, mult: number): number {
  if (closingSpeed <= 0) return 0;
  return closingSpeed * ((massA * massB) / (massA + massB)) * mult;
}

/** Hidden-HP damage; zero below the impact threshold. */
export function damageFor(impact: number): number {
  if (impact <= T.combat.impactMin) return 0;
  return Math.min((impact - T.combat.impactMin) * T.combat.damageScale, T.combat.damageMax);
}

export function knockbackFor(impact: number): number {
  return Math.min(impact * T.combat.knockbackScale, T.combat.knockbackMax);
}

export function hitStopFor(impact: number): number {
  const { hitStopMin, hitStopMax, hitStopFullImpact } = T.combat;
  return Math.round(hitStopMin + (hitStopMax - hitStopMin) * Math.min(impact / hitStopFullImpact, 1));
}

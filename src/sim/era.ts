import { eraById, eras } from '../content/eras';
import type { Era } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { makeRng } from './rng';

/**
 * The era of a round, a pure function of the match seed and the round number (so the server and every client agree without being told).
 * A match is one pass through the normal eras in chronological order (the order of the eras list), one round each; after the last the
 * pass starts again. Now and then (T.eras.specialChance) a special era takes a slot's place.
 */
export function eraFor(seed: number, round: number): Era {
  const normal = eras.filter((e) => !e.special), special = eras.filter((e) => e.special);
  const n = normal.length, i = round - 1, slot = ((i % n) + n) % n, pass = Math.floor(i / n);
  const rng = makeRng((seed ^ 0x9e3779b9 ^ Math.imul(pass * 64 + slot + 1, 0x85ebca6b)) >>> 0);
  return special.length && rng() < T.eras.specialChance ? special[Math.floor(rng() * special.length)] : normal[slot];
}

/** Which map of the era this round uses: 0 = its usual arena, 1.. = its other maps (a pure function of the seed and round, like the era). */
export function mapFor(seed: number, round: number, eraId: string): number {
  const alts = eraById(eraId).alt?.length ?? 0;
  if (!alts) return 0;
  return Math.floor(makeRng(((seed * 131 + round) ^ 0xc2b2ae35) >>> 0)() * (alts + 1));
}

/** Which of the era's 4 outfits each fighter wears this round: a shuffle, so everyone differs (a pure function of seed and round). */
export function outfitsFor(seed: number, round: number): number[] {
  const rng = makeRng(((seed * 31 + round) ^ 0x85ebca6b) >>> 0);
  const o = [0, 1, 2, 3];
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}

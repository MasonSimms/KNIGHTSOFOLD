import { eraById, eras } from '../content/eras';
import type { Era } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { makeRng } from './rng';

/**
 * The era of a round, a pure function of the match seed and the round number (so the server and every client agree without being told).
 * Quick rounds (T.match.quickRounds): the match picks a few of the normal eras at random and plays them in chronological order (the order
 * of the eras list), roundsPerEra rounds each; tie-break rounds stay in the last. Otherwise a match is one pass through all the normal eras,
 * one round each; after the last the pass starts again. Now and then (T.eras.specialChance) a special era takes a slot's place.
 */
export function eraFor(seed: number, round: number): Era {
  const normal = eras.filter((e) => !e.special), special = eras.filter((e) => e.special);
  if (T.match.quickRounds) {
    const per = Math.max(1, T.match.roundsPerEra), count = Math.min(normal.length, Math.ceil(T.match.rounds / per)), slot = Math.min(Math.floor((round - 1) / per), count - 1);
    const picked = shuffled(normal.length, makeRng((seed ^ 0x2545f491) >>> 0)).slice(0, count).sort((a, b) => a - b);
    const rng = makeRng((seed ^ 0x9e3779b9 ^ Math.imul(slot + 1, 0x85ebca6b)) >>> 0);
    return special.length && rng() < T.eras.specialChance ? special[Math.floor(rng() * special.length)] : normal[picked[slot]];
  }
  const n = normal.length, i = round - 1, slot = ((i % n) + n) % n, pass = Math.floor(i / n);
  const rng = makeRng((seed ^ 0x9e3779b9 ^ Math.imul(pass * 64 + slot + 1, 0x85ebca6b)) >>> 0);
  return special.length && rng() < T.eras.specialChance ? special[Math.floor(rng() * special.length)] : normal[slot];
}

/** Which map of the era this round uses: 0 = its usual arena, 1.. = its other maps (a pure function of the seed and round, like the era).
 *  Quick rounds: the rounds of an era go through its maps in a shuffled order, so each round is on another one. */
export function mapFor(seed: number, round: number, eraId: string): number {
  const alts = eraById(eraId).alt?.length ?? 0;
  if (!alts) return 0;
  if (T.match.quickRounds) {
    const per = Math.max(1, T.match.roundsPerEra), slot = Math.min(Math.floor((round - 1) / per), Math.ceil(T.match.rounds / per) - 1); // (tie-break rounds: on through the last era's maps)
    const order = shuffled(alts + 1, makeRng(((seed * 131 + slot) ^ 0x27d4eb2f) >>> 0));
    return order[(round - 1 - slot * per) % order.length];
  }
  return Math.floor(makeRng(((seed * 131 + round) ^ 0xc2b2ae35) >>> 0)() * (alts + 1));
}

/** Which of the era's 4 outfits each fighter wears this round: a shuffle, so everyone differs (a pure function of seed and round). */
export function outfitsFor(seed: number, round: number): number[] {
  return shuffled(4, makeRng(((seed * 31 + round) ^ 0x85ebca6b) >>> 0));
}

/** 0..n-1 in a random order. */
function shuffled(n: number, rng: () => number): number[] {
  const o = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}

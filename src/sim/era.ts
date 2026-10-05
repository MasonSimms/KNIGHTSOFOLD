import { eras } from '../content/eras';
import type { Era } from '../content/eras';
import { tuning as T } from '../content/tuning';
import { makeRng } from './rng';

/**
 * The era of a round: a pure function of the match seed and the round number (so the server and every client agree without being told).
 * Usually the normal eras in a random order that never repeats the same era twice running; now and then (T.eras.specialChance) a special one.
 */
export function eraFor(seed: number, round: number): Era {
  const rng = makeRng((seed ^ 0x9e3779b9) >>> 0);
  const normal = eras.filter((e) => !e.special), special = eras.filter((e) => e.special);
  let prev = '', cur = normal[0];
  for (let r = 1; r <= round; r++) {
    const pool = (rng() < T.eras.specialChance ? special : normal).filter((e) => e.id !== prev);
    cur = pool[Math.floor(rng() * pool.length)];
    prev = cur.id;
  }
  return cur;
}

/** Which of the era's 4 outfits each fighter wears this round: a shuffle, so everyone differs (a pure function of seed and round). */
export function outfitsFor(seed: number, round: number): number[] {
  const rng = makeRng(((seed * 31 + round) ^ 0x85ebca6b) >>> 0);
  const o = [0, 1, 2, 3];
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}

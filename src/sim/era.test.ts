import { describe, expect, it } from 'vitest';
import { eras } from '../content/eras';
import { eraFor, outfitsFor } from './era';

describe('eras', () => {
  it('every era has 4 outfits and the data has the eras the owner named', () => {
    expect(eras.every((e) => e.outfits.length === 4 && new Set(e.outfits).size === 4)).toBe(true);
    for (const id of ['caveman', 'samurai', 'westerns', 'ww1', 'vietnam', 'modern', 'scifi', 'fantasy', 'mobsters']) expect(eras.some((e) => e.id === id), id).toBe(true);
    expect(eras.filter((e) => !e.special).length).toBeGreaterThanOrEqual(7);
  });

  it('the era of a round depends only on seed and round, never repeats back to back, uses every normal era, and specials are occasional', () => {
    expect(eraFor(77, 5).id).toBe(eraFor(77, 5).id);
    const seen = new Map<string, number>();
    let prev = '';
    const N = 1000;
    for (let r = 1; r <= N; r++) {
      const e = eraFor(5, r);
      expect(e.id).not.toBe(prev);
      prev = e.id;
      seen.set(e.id, (seen.get(e.id) ?? 0) + 1);
    }
    for (const e of eras.filter((x) => !x.special)) expect(seen.get(e.id) ?? 0, e.id).toBeGreaterThan(40);
    const specials = eras.filter((e) => e.special).reduce((n, e) => n + (seen.get(e.id) ?? 0), 0);
    expect(specials).toBeGreaterThan(N * 0.05);
    expect(specials).toBeLessThan(N * 0.3);
    expect(eraFor(5, 1).id !== eraFor(6, 1).id || eraFor(5, 2).id !== eraFor(6, 2).id || eraFor(5, 3).id !== eraFor(6, 3).id).toBe(true); // different matches differ
  });

  it('outfits are a shuffle of the era\'s 4, so no two players match, and they change from round to round', () => {
    const seen = new Set<string>();
    for (let r = 1; r <= 30; r++) {
      const o = outfitsFor(9, r);
      expect([...o].sort()).toEqual([0, 1, 2, 3]);
      expect(outfitsFor(9, r)).toEqual(o);
      seen.add(o.join());
    }
    expect(seen.size).toBeGreaterThan(5);
  });
});

import { describe, expect, it } from 'vitest';
import { eras } from '../content/eras';
import { eraFor, outfitsFor } from './era';

describe('eras', () => {
  it('every era has 4 outfits and the data has the eras the owner named', () => {
    expect(eras.every((e) => e.outfits.length === 4 && new Set(e.outfits).size === 4)).toBe(true);
    for (const id of ['caveman', 'egypt', 'gladiators', 'vikings', 'medieval', 'samurai', 'pirates', 'westerns', 'ww1', 'vietnam', 'modern', 'scifi', 'fantasy', 'mobsters']) expect(eras.some((e) => e.id === id), id).toBe(true);
    expect(eras.filter((e) => !e.special).length).toBe(12);
  });

  it('a match plays the normal eras in the list order (chronological), one per round, with specials swapping in occasionally', () => {
    expect(eraFor(77, 5).id).toBe(eraFor(77, 5).id);
    const normal = eras.filter((e) => !e.special).map((e) => e.id);
    expect(normal.length).toBe(12);
    let specials = 0;
    const N = 1200;
    for (let r = 1; r <= N; r++) {
      const e = eraFor(5, r);
      if (e.special) specials++; else expect(e.id).toBe(normal[(r - 1) % normal.length]);
    }
    expect(specials).toBeGreaterThan(N * 0.08);
    expect(specials).toBeLessThan(N * 0.25);
    const run = (seed: number) => Array.from({ length: 12 }, (_, i) => eraFor(seed, i + 1).special).join();
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(run)).size).toBeGreaterThan(1); // special slots differ between matches
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

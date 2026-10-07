import { describe, expect, it } from 'vitest';
import { COSTUMES } from './costumes';
import { eraById, eras } from './eras';

// The costume sheet (content/costumes.ts): every costume belongs to a real era, and every piece is drawn where the body is (the painter
// clips to the body, so a piece drawn somewhere else would silently vanish).
describe('era costumes', () => {
  it.each(Object.keys(COSTUMES))('%s: a real era, and every piece is on the body', (id) => {
    expect(eraById(id).id).toBe(id);
    for (const p of COSTUMES[id]) { // its outline overlaps the body's box (0.18 either side, from the shoulders at -0.48 to the hips at 0.04)
      const pts: [number, number][] = p.k === 'poly' ? p.pts : [[p.x - (p.k === 'ball' ? p.rx ?? p.r : p.r), p.y - p.r], [p.x + (p.k === 'ball' ? p.rx ?? p.r : p.r), p.y + p.r]];
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      expect(Math.min(...xs) < 0.18 && Math.max(...xs) > -0.18 && Math.min(...ys) < 0.04 && Math.max(...ys) > -0.48, `a piece of ${id} is off the body`).toBe(true);
    }
  });
  it('the showcase eras are dressed (Wild West, Cavemen, Pirates)', () => {
    for (const id of ['westerns', 'caveman', 'pirates']) expect(COSTUMES[id]?.length).toBeGreaterThan(0);
    expect(eras.length).toBeGreaterThan(0);
  });
});

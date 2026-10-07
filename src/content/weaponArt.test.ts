import { describe, expect, it } from 'vitest';
import { eras } from './eras';
import { gripOf, PROPS } from './props';
import { WEAPON_ART } from './weaponArt';
import { weapons } from './weapons';

// Every weapon in the game has a painted shape, and the hand holds it by the handle (not the blade).
describe('weapon art', () => {
  const all = [
    ...weapons.map((w) => ({ id: w.id, len: w.length, grip: w.gripFromEnd })),
    ...[...new Set(eras.flatMap((e) => e.pickups ?? []))].map((id) => ({ id, len: PROPS[id].len, grip: gripOf(PROPS[id]) })),
  ];
  it.each(all)('$id has art, gripped on its handle', ({ id, len, grip }) => {
    const art = WEAPON_ART[id];
    expect(art, `${id} has no picture in weaponArt.ts`).toBeDefined();
    const at = (grip / len) * art.len; // the hand, in the drawing's metres
    const held = art.pieces.some((p) => {
      if (p.k === 'rod' && p.grip) return at >= Math.min(p.a[0], p.b[0]) && at <= Math.max(p.a[0], p.b[0]);
      if (p.k === 'ball' && p.grip) return Math.abs(at - p.x) <= (p.rx ?? p.r);
      if (p.k === 'poly' && p.grip) return at >= Math.min(...p.pts.map((q) => q[0])) && at <= Math.max(...p.pts.map((q) => q[0]));
      return false;
    });
    expect(held, `${id}: the hand (${at.toFixed(3)} m from the back) is not on a piece marked grip`).toBe(true);
  });
});

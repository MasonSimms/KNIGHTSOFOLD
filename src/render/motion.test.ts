import { describe, expect, it } from 'vitest';
import { Container, Texture } from 'pixi.js';
import { tuning as T } from '../content/tuning';
import { arenaFor } from '../sim/world';
import { createMotion } from './motion';

// Owner, 2026-10-07: a hurt fighter's paint flies off them and lands on the arena's floor, leaving a mark there.
describe('a hurt fighter\'s paint', () => {
  const run = (arena: ReturnType<typeof arenaFor>) => {
    const marks = new Container(), m = createMotion(new Container(), () => {}, marks, [Texture.EMPTY]);
    m.hitPaint(arena.platformX + arena.platformW / 2, arena.platformTop - 0.8, 1, 0xd8402a, 60); // a hard hit at chest height in the middle
    for (let i = 0; i < 120; i++) m.draw(1 / 60, 'medieval', arena);
    return marks.children.filter((s) => s.visible);
  };
  it('lands on the floor as marks in their colour', () => {
    const A = arenaFor('medieval', 0), landed = run(A);
    expect(landed.length).toBeGreaterThanOrEqual(T.finish.motion.hitPaint.drops[0]);
    for (const s of landed) { expect(s.y).toBeCloseTo(A.platformTop - 0, 5); expect((s as unknown as { tint: number }).tint).toBe(0xd8402a); }
  });
  it('leaves no marks on a ship (a moving floor)', () => {
    T.eras.changeGameplay = true; // (the eras' own maps: tests run without them)
    try { expect(arenaFor('pirates', 0).boats.length).toBeGreaterThan(0); expect(run(arenaFor('pirates', 0)).length).toBe(0); } finally { T.eras.changeGameplay = false; }
  });
});

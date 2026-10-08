import { describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import { NEUTRAL } from './types';
import { Sim } from './world';

// Owner (2026-10-07, a screenshot): a lance showed straight through its owner's body. Your own club out of your hand used to pass through
// you for good; now, a moment after it leaves your hand and once it is clear of you, it is a solid thing to you too.
describe('your own club, out of your hand', () => {
  it('passes through you at first (a throw does not hit your arm), then is solid to you once it is clear of you', async () => {
    const sim = await Sim.create(5, 2, false), f = sim.fighters[0], club = f.stick!, me = 1 << (f.index + 1);
    const solid = () => (club.colliders[0].collisionGroups() & me) !== 0;
    for (let i = 0; i < 30; i++) sim.step([NEUTRAL, NEUTRAL]);
    expect(f.grip).toBeTruthy();
    sim.step([{ ...NEUTRAL, drop: true }, NEUTRAL]); // let go of it
    for (let i = 0; i < 3; i++) sim.step([NEUTRAL, NEUTRAL]);
    expect(f.grip).toBeFalsy();
    expect(solid()).toBe(false); // just let go: it still passes through you
    const t = f.torso.body.translation();
    club.body.setTranslation({ x: t.x + 2.5, y: t.y }, true); // well clear of you
    for (let i = 0; i < T.throw.selfGrace + 2; i++) sim.step([NEUTRAL, NEUTRAL]);
    expect(solid()).toBe(true);
    const u = f.torso.body.translation();
    club.body.setTranslation({ x: u.x, y: u.y }, true); club.body.setLinvel({ x: 0, y: 0 }, true); // somehow inside you: it passes through until it is clear again (no violent shove)
    sim.step([NEUTRAL, NEUTRAL]);
    expect(solid()).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { PlayerInput } from './types';
import { Sim } from './world';

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, drop: false, dodge: false, ...over });

async function settled(aim = 0) {
  const sim = await Sim.create(5);
  for (let i = 0; i < 40; i++) sim.step([idle({ aim })]);
  return sim;
}

describe('facing lock', () => {
  it('cannot turn around while charging or lunging, then turns once the attack is over', async () => {
    const sim = await settled(0);
    const f = () => sim.fighters[0];
    expect(f().side).toBe(1);
    const x0 = f().torso.body.translation().x;
    // hold the charge while swinging the cursor to the other side
    for (let i = 0; i < 25; i++) {
      sim.step([idle({ aim: Math.PI, attack: true })]);
      expect(f().side).toBe(1);
    }
    // release with the cursor still behind: the lunge still goes the way the fighter faces
    for (let i = 0; i < 12; i++) {
      sim.step([idle({ aim: Math.PI })]);
      expect(f().side).toBe(1);
    }
    expect(f().torso.body.translation().x).toBeGreaterThan(x0 + 0.5);
    // once the lunge is over the fighter can turn to face the cursor
    for (let i = 0; i < 40; i++) sim.step([idle({ aim: Math.PI })]);
    expect(f().side).toBe(-1);
  });
});

describe('right-click: drop and pick up', () => {
  it('a thrown club keeps the speed of the swing', async () => {
    const sim = await settled(-1.4);
    const f = () => sim.fighters[0];
    let fastest = 0;
    for (let i = 0; i < 16; i++) { // swing the cursor from up to level
      const aim = -1.4 + i * 0.1;
      sim.step([idle({ aim, drop: i === 12 })]);
      if (i >= 12) { const v = f().stick!.body.linvel(); fastest = Math.max(fastest, Math.hypot(v.x, v.y)); }
    }
    expect(f().grip).toBeNull(); // the club has left the hand
    expect(fastest).toBeGreaterThan(8); // and it left at the speed of the swing (plus the small push)
  });

  it('with empty hands right-click picks the club up, but only after a short delay and only within reach', async () => {
    const sim = await settled(Math.PI / 2);
    const f = () => sim.fighters[0];
    sim.step([idle({ aim: Math.PI / 2, drop: true })]);
    expect(f().grip).toBeNull();
    for (let i = 0; i < 4; i++) sim.step([idle({ aim: Math.PI / 2 })]);
    sim.step([idle({ aim: Math.PI / 2, drop: true })]); // too soon
    expect(f().grip).toBeNull();
    for (let i = 0; i < 60; i++) sim.step([idle({ aim: Math.PI / 2 })]);
    sim.step([idle({ aim: Math.PI / 2, drop: true })]); // now
    expect(f().grip).not.toBeNull();
  });

  it('cannot pick the club up from far away', async () => {
    const sim = await settled(0);
    const f = () => sim.fighters[0];
    sim.step([idle({ drop: true })]); // drop it flying forward
    for (let i = 0; i < 25; i++) sim.step([idle()]);
    for (let i = 0; i < 100; i++) sim.step([idle({ moveX: -1, aim: Math.PI })]); // walk away from it
    const far = Math.hypot(
      f().stick!.body.translation().x - f().torso.body.translation().x,
      f().stick!.body.translation().y - f().torso.body.translation().y,
    );
    if (far > 1.7) {
      sim.step([idle({ aim: Math.PI, drop: true })]);
      expect(f().grip).toBeNull();
    }
  });
});

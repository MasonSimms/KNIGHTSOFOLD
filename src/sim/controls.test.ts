import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import type { PlayerInput } from './types';
import { Sim } from './world';

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });

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
    expect(fastest).toBeGreaterThan(6); // and it left at the speed of the swing (plus the small push)
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

describe('charge, punch and throw (the newer controls)', () => {
  it('dodging cancels a charge, and a new charge needs a fresh press', async () => {
    const sim = await settled(0);
    const f = () => sim.fighters[0];
    for (let i = 0; i < 20; i++) sim.step([idle({ attack: true })]);
    expect(f().charge).toBe(20);
    sim.step([idle({ attack: true, dodge: true })]);
    expect(f().charge).toBe(0);
    for (let i = 0; i < 10; i++) sim.step([idle({ attack: true })]); // still holding the button
    expect(f().charge).toBe(0);
    sim.step([idle()]); // let go
    for (let i = 0; i < 5; i++) sim.step([idle({ attack: true })]); // pressing again straight away: still in the dodge, no attacking
    expect(f().charge).toBe(0);
    sim.step([idle()]);
    for (let i = 0; i < 60; i++) sim.step([idle()]); // dodge over
    for (let i = 0; i < 5; i++) sim.step([idle({ attack: true })]); // now a fresh press starts a new charge
    expect(f().charge).toBe(5);
  });

  /** Walk an unarmed fighter 0 up to the dummy and settle. */
  async function unarmedFace() {
    const sim = await Sim.create(11);
    const D = () => sim.fighters[1], P = () => sim.fighters[0];
    while (D().torso.body.translation().x - P().torso.body.translation().x > 1.3) sim.step([idle({ moveX: 1, aim: Math.PI / 2 })]);
    for (let i = 0; i < 40; i++) sim.step([idle()]);
    return { sim, D, P };
  }

  it('a tap throws a punch that damages', async () => {
    const T = (await import('../content/tuning')).tuning;
    const was = T.fighter.startArmed;
    T.fighter.startArmed = false;
    try {
      const { sim, D } = await unarmedFace();
      const hp0 = D().hp;
      for (let i = 0; i < 40; i++) sim.step([idle({ attack: i < 2, moveX: 0.5 })]);
      expect(hp0 - D().hp).toBeGreaterThan(0);
    } finally {
      T.fighter.startArmed = was;
    }
  });

  it('holding grabs the dummy, and letting go flings it', async () => {
    const T = (await import('../content/tuning')).tuning;
    const was = T.fighter.startArmed;
    T.fighter.startArmed = false;
    try {
      const { sim, D, P } = await unarmedFace();
      let held = false;
      for (let i = 0; i < 40 && !held; i++) { sim.step([idle({ attack: true, moveX: 0.5 })]); held = !!P().hold; }
      expect(held).toBe(true);
      expect(P().held).toBe(D());
      for (let i = 0; i < 20; i++) sim.step([idle({ attack: true, aim: -0.3 + i * 0.12, moveX: 0.5 })]); // swing it round
      expect(P().hold).not.toBeNull(); // still holding: there is no time limit
      sim.step([idle()]);
      expect(P().hold).toBeNull();
      expect(D().thrownBy).toBe(0);
    } finally {
      T.fighter.startArmed = was;
    }
  });

  it('a grab gives out after its time limit, and you must press again to regrab', async () => {
    const T = (await import('../content/tuning')).tuning;
    const was = T.fighter.startArmed;
    T.fighter.startArmed = false;
    try {
      const { sim, P } = await unarmedFace();
      let frames = 0, held = false;
      for (; frames < 400; frames++) {
        sim.step([idle({ attack: true, moveX: 0.5 })]);
        if (P().hold) held = true;
        else if (held) break; // it let go on its own while the button was still down
      }
      expect(held).toBe(true);
      expect(frames).toBeLessThan(T.grab.maxFrames + 80);
      expect(frames).toBeGreaterThan(T.grab.maxFrames - 20);
      for (let i = 0; i < 20; i++) sim.step([idle({ attack: true })]);
      expect(P().hold).toBeNull(); // still holding the button: no instant regrab
    } finally {
      T.fighter.startArmed = was;
    }
  });

  it('a hard hit on the grabber, even from a third fighter, breaks the hold', async () => {
    const T = (await import('../content/tuning')).tuning;
    const was = T.fighter.startArmed;
    T.fighter.startArmed = false;
    try {
      const sim = await Sim.create(11, 3);
      const P = () => sim.fighters[0], D = () => sim.fighters[1], X = () => sim.fighters[2];
      const step = (a: Partial<PlayerInput> = {}) => sim.step([idle(a), idle(), idle()]);
      for (let i = 0; i < 40; i++) step();
      const gap = D().torso.body.translation().x - P().torso.body.translation().x - 0.8; // stand the grabber right at arm's length from the dummy
      for (const p of P().parts) { const t = p.body.translation(); p.body.setTranslation({ x: t.x + gap, y: t.y }, true); }
      for (let i = 0; i < 30; i++) step();
      let held = false;
      for (let i = 0; i < 120 && !held; i++) { step({ attack: true, moveX: 0.5 }); held = !!P().hold; }
      expect(held).toBe(true);
      const fist = X().fore.body, pt = P().torso.body.translation(); // fighter 2's fist, thrown hard at the grabber's back
      fist.setTranslation({ x: pt.x - 0.6, y: pt.y - 0.1 }, true);
      fist.setLinvel({ x: 18, y: 0 }, true);
      for (let i = 0; i < 8; i++) step({ attack: true });
      expect(P().hp).toBeLessThan(T.fighter.hp);
      expect(P().hold).toBeNull();
    } finally {
      T.fighter.startArmed = was;
    }
  });

  it('right-click while holding the charge throws the club partway through the swing, forward', async () => {
    const sim = await settled(0);
    const f = () => sim.fighters[0];
    for (let i = 0; i < 20; i++) sim.step([idle({ attack: true })]);
    sim.step([idle({ attack: true, drop: true })]);
    let thrownAfter = -1, speed = 0, forward = 0;
    for (let i = 1; i < 30 && thrownAfter < 0; i++) {
      sim.step([idle({ attack: true })]);
      if (sim.events.some((e) => e.t === 'throw')) {
        thrownAfter = i;
        const v = f().stick!.body.linvel();
        speed = Math.hypot(v.x, v.y);
        forward = v.x;
      }
    }
    expect(thrownAfter).toBeGreaterThan(0); // it did get thrown, a few frames into the swing
    expect(thrownAfter).toBeLessThan(15);
    expect(f().grip).toBeNull();
    expect(forward).toBeGreaterThan(8); // and it went forward, fast
    expect(speed).toBeGreaterThan(8);
  });

  it('a jump pressed a little early still happens, and letting go early cuts it short', async () => {
    const full = await settled(0), tap = await settled(0);
    const rise = (sim: Sim, holdFrames: number) => {
      const y0 = sim.fighters[0].torso.body.translation().y;
      let top = 0;
      for (let i = 0; i < 80; i++) {
        sim.step([idle({ jump: i < holdFrames })]);
        top = Math.max(top, y0 - sim.fighters[0].torso.body.translation().y);
      }
      return top;
    };
    const high = rise(full, 40), hop = rise(tap, 3);
    expect(high).toBeGreaterThan(1.4);
    expect(hop).toBeGreaterThan(0.2);
    expect(hop).toBeLessThan(high * 0.7);
  });
});

describe('crouch and the dodge recovery', () => {
  it('holding down takes you all the way to lying on the floor, you can crawl, and letting go stands you back up', async () => {
    const sim = await settled(0);
    const f = () => sim.fighters[0];
    const head = () => f().torso.body.translation().y + Math.cos(f().torso.body.rotation()) * -0.55;
    const headStand = head();
    for (let i = 0; i < 60; i++) sim.step([idle({ crouch: true })]);
    expect(Math.abs(f().torso.body.rotation())).toBeGreaterThan(1.2); // lying on the floor, not sitting upright
    expect(head()).toBeGreaterThan(headStand + 0.5); // the head is far lower: swings at standing height pass over
    const x0 = f().torso.body.translation().x;
    for (let i = 0; i < 60; i++) sim.step([idle({ crouch: true, moveX: 1 })]);
    expect(f().torso.body.translation().x).toBeGreaterThan(x0 + 0.5); // crawling
    for (let i = 0; i < 40; i++) sim.step([idle()]);
    expect(Math.abs(f().torso.body.rotation())).toBeLessThan(0.15); // back on your feet
    expect(f().grounded).toBe(true);
  });

  it('a jump from a crouch goes higher', async () => {
    const rise = async (crouch: boolean) => {
      const sim = await settled(0);
      for (let i = 0; i < 8; i++) sim.step([idle({ crouch })]); // a short crouch, not lying down
      const y0 = sim.fighters[0].torso.body.translation().y;
      let top = 0;
      for (let i = 0; i < 70; i++) {
        sim.step([idle({ jump: i < 45 })]);
        top = Math.max(top, y0 - sim.fighters[0].torso.body.translation().y);
      }
      return top;
    };
    expect(await rise(true)).toBeGreaterThan(await rise(false) * 1.05);
  });

  it('after a dodge you can attack again almost at once, but not during it', async () => {
    const sim = await settled(0);
    const f = () => sim.fighters[0];
    sim.step([idle({ dodge: true })]);
    for (let i = 0; i < 20; i++) sim.step([idle()]);
    // still dodging: the attack button does nothing
    sim.step([idle()]);
    for (let i = 0; i < 5; i++) sim.step([idle({ attack: true })]);
    expect(f().charge).toBe(0);
    sim.step([idle()]);
    // wait until the dodge is over and the short recovery has passed
    for (let i = 0; i < 40; i++) sim.step([idle()]);
    for (let i = 0; i < 4; i++) sim.step([idle({ attack: true })]);
    expect(f().charge).toBe(4);
  });
});

describe('walls: slide and jump', () => {
  beforeAll(() => { T.arena.walls = true; }); // (the game has no side walls now: tuning.arena.walls)
  afterAll(() => { T.arena.walls = false; });
  async function fallIntoTheGap() {
    const sim = await settled(0);
    const f = () => sim.fighters[0];
    let n = 0;
    while (f().torso.body.translation().x > T.arena.platformX - 0.3 && n++ < 200) sim.step([idle({ moveX: -1 })]); // walk off the left end
    return { sim, f };
  }

  it('sliding down a wall you push toward is slow', async () => {
    const { sim, f } = await fallIntoTheGap();
    let touched = 0, fastest = 0;
    for (let i = 0; i < 60; i++) {
      sim.step([idle({ moveX: -1 })]);
      if (f().wall !== 0 && i > 12) { touched++; fastest = Math.max(fastest, f().torso.body.linvel().y); }
    }
    expect(touched).toBeGreaterThan(20);
    expect(fastest).toBeLessThan(2.2); // a free fall would be far faster
  });

  it('a wall jump kicks away from the wall and gets back onto the platform if you are quick', async () => {
    const { sim, f } = await fallIntoTheGap();
    let touching = 0, jumped = false, back = false;
    for (let i = 0; i < 200 && !back; i++) {
      if (f().wall !== 0) touching++;
      const jump = !jumped && touching >= 8;
      if (jump) jumped = true;
      sim.step([idle({ moveX: jumped ? 1 : -1, jump })]);
      if (jump) expect(f().torso.body.linvel().x).toBeGreaterThan(4); // kicked away from the wall
      if (jumped && f().grounded && f().torso.body.translation().x > T.arena.platformX + 0.1) back = true;
    }
    expect(jumped).toBe(true);
    expect(back).toBe(true);
    expect(f().limp).toBe(false);
  });
});

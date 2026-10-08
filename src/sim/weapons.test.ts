import { describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import type { PlayerInput } from './types';
import { Sim } from './world';

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });

/** Three fighters: 0 = player one (x 7), 1 = the dummy, 2 = a second armed fighter (x 5.5). */
async function three() {
  const sim = await Sim.create(5, 3);
  const step = (a: Partial<PlayerInput> = {}, c: Partial<PlayerInput> = {}) => sim.step([idle(a), idle(), idle(c)]);
  for (let i = 0; i < 40; i++) step();
  return { sim, step, P0: () => sim.fighters[0], P2: () => sim.fighters[2] };
}

describe('picking up and knocking out weapons', () => {
  it('a second fighter can pick up the club the first one dropped', async () => {
    const { sim, step, P0, P2 } = await three();
    const club = P0().stick!;
    // fighter 2 lets go of its own club and flings it far away, so the nearest loose club is the one fighter 1 is about to drop
    step({}, { drop: true });
    const own = P2().stick!.body;
    own.setTranslation({ x: 14.4, y: 6.5 }, true);
    own.setLinvel({ x: 0, y: 0 }, true);
    step({ aim: Math.PI / 2, drop: true }, {}); // fighter 1 drops its club straight down
    for (let i = 0; i < 70; i++) step({ aim: Math.PI / 2 }, { aim: 0 });
    expect(P0().grip).toBeNull();
    expect(P2().grip).toBeNull();
    const gap = () => Math.hypot(club.body.translation().x - P2().torso.body.translation().x, club.body.translation().y - P2().torso.body.translation().y);
    expect(gap()).toBeGreaterThan(T.drop.pickupRange); // too far to reach from where fighter 2 stands
    step({ aim: Math.PI / 2 }, { drop: true });
    expect(P2().grip).toBeNull(); // so right-click does nothing yet
    for (let i = 0; i < 90 && gap() > 1.2; i++) step({ aim: Math.PI / 2 }, { moveX: 1, aim: 0 }); // fighter 2 walks up to it
    step({ aim: Math.PI / 2 }, { drop: true });
    expect(P2().grip).not.toBeNull();
    expect(P2().stick).toBe(club); // it now holds fighter 1's old club
    expect(P0().stick).not.toBe(club); // and fighter 1 no longer has that club (it got fighter 2 loose one in exchange)
    expect(club.owner).toBe(2);
    sim.step([idle(), idle(), idle()]); // and the game keeps going
  });

  it("a fast club to the hand knocks the club out of an opponent's hand", async () => {
    const { sim, step, P0, P2 } = await three();
    step({}, { drop: true }); // fighter 2 lets go of its club
    const missile = P2().stick!.body;
    const ft = P0().fore.body.translation(), fa = P0().fore.body.rotation();
    const hx = ft.x + Math.cos(fa) * T.fighter.armLength / 2, hy = ft.y + Math.sin(fa) * T.fighter.armLength / 2;
    // straight at the knuckles, along the forearm (the club comes out of the side of the fist, so this way only the fist is in the way)
    missile.setTranslation({ x: hx + Math.cos(fa), y: hy + Math.sin(fa) }, true);
    missile.setRotation(fa - Math.PI / 2, true);
    missile.setLinvel({ x: -Math.cos(fa) * 30, y: -Math.sin(fa) * 30 }, true);
    let disarmed = false;
    for (let i = 0; i < 10; i++) {
      step({}, {});
      if (sim.events.some((e) => e.t === 'disarm' && e.victim === 0)) disarmed = true;
    }
    expect(disarmed).toBe(true);
    expect(P0().grip).toBeNull(); // the club is out of fighter 1's hand
  });

  it('the training dummy holds a club and can be disarmed', async () => {
    const { sim, step, P0, P2 } = await three();
    const dummy = () => sim.fighters[1];
    expect(dummy().grip).not.toBeNull();
    step({}, { drop: true }); // fighter 2 lets go of its club and flings it at the dummy's hand
    const missile = P2().stick!.body;
    const ft = dummy().fore.body.translation(), fa = dummy().fore.body.rotation();
    const hx = ft.x + Math.cos(fa) * T.fighter.armLength / 2, hy = ft.y + Math.sin(fa) * T.fighter.armLength / 2;
    missile.setTranslation({ x: hx - 1.0, y: hy + 0.05 }, true); // level from in front of the dummy (it faces left), at its raised fist, under the club
    missile.setRotation(0, true);
    missile.setLinvel({ x: 30, y: 0 }, true);
    for (let i = 0; i < 10; i++) step({}, {});
    expect(dummy().grip).toBeNull();
    expect(dummy().stick).not.toBeNull(); // the club lies loose, ready to be picked up
    expect(P0().hp).toBe(T.fighter.hp); // and the dummy's club never hurt anyone
  });

  it('a gentle tap does not disarm', async () => {
    const { sim, step, P0, P2 } = await three();
    step({}, { drop: true });
    const missile = P2().stick!.body;
    const ft = P0().fore.body.translation();
    missile.setTranslation({ x: ft.x + 1.2, y: ft.y }, true);
    missile.setRotation(0, true);
    missile.setLinvel({ x: -3, y: 0 }, true);
    for (let i = 0; i < 25; i++) {
      step({}, {});
      expect(sim.events.some((e) => e.t === 'disarm')).toBe(false);
    }
    expect(P0().grip).not.toBeNull();
  });
});

describe('arena weapon rules', () => {
  async function withRule(rule: 'start' | 'sky' | 'spots', run: (sim: Sim) => void | Promise<void>) {
    const was = T.arena.weaponRule;
    T.arena.weaponRule = rule;
    try {
      const sim = await Sim.create(5);
      await run(sim);
    } finally {
      T.arena.weaponRule = was;
    }
  }

  it("'spots': nobody starts armed, the clubs lie on the platform, and you can walk up and take one", async () => {
    await withRule('spots', async (sim) => {
      for (let i = 0; i < 60; i++) sim.step([idle()]);
      const f = sim.fighters[0];
      expect(f.grip).toBeNull();
      const club = f.stick!.body.translation();
      expect(club.y).toBeGreaterThan(T.arena.platformTop - 0.5);
      expect(club.y).toBeLessThan(T.arena.platformTop + 0.1);
      const dir = club.x > f.torso.body.translation().x ? 1 : -1;
      for (let i = 0; i < 120 && Math.abs(f.stick!.body.translation().x - f.torso.body.translation().x) > 1.0; i++) sim.step([idle({ moveX: dir, aim: dir > 0 ? 0 : Math.PI })]);
      sim.step([idle({ drop: true })]);
      expect(f.grip).not.toBeNull();
    });
  });

  it("'sky': clubs fall from above onto the platform", async () => {
    await withRule('sky', async (sim) => {
      const f = sim.fighters[0];
      expect(f.grip).toBeNull();
      expect(f.stick!.body.translation().y).toBeLessThan(0); // starts above the screen
      for (let i = 0; i < 200; i++) sim.step([idle()]);
      expect(f.stick!.body.translation().y).toBeGreaterThan(T.arena.platformTop - 0.5);
      expect(f.stick!.body.translation().y).toBeLessThan(T.arena.platformTop + 0.1);
    });
  });

  it('a club lost in the void comes back from the sky', async () => {
    const sim = await Sim.create(5);
    for (let i = 0; i < 40; i++) sim.step([idle()]);
    const f = sim.fighters[0];
    sim.step([idle({ aim: Math.PI / 2, drop: true })]);
    const b = f.stick!.body;
    b.setTranslation({ x: T.arena.platformX - 0.6, y: T.arena.killY + 1 }, true); // into the void
    b.setLinvel({ x: 0, y: 0 }, true);
    let backAt = -1;
    for (let i = 0; i < 400 && backAt < 0; i++) {
      sim.step([idle({ aim: Math.PI / 2 })]);
      if (b.translation().y < T.arena.killY - 2) backAt = i;
    }
    expect(backAt).toBeGreaterThan(T.arena.weaponReturnFrames - 10); // it waited, then came back
    expect(backAt).toBeLessThan(T.arena.weaponReturnFrames + 40);
    expect(b.translation().x).toBeGreaterThan(T.arena.platformX);
  });
});

describe('parry', () => {
  /** Fighter 2's club (let go, then flung) hits fighter 0's club, which is held still in guard. */
  async function swingAtGuard(speed: number) {
    const { sim, step: step0, P0, P2 } = await three();
    const step = (a: Partial<PlayerInput> = {}, c: Partial<PlayerInput> = {}) => step0({ aim: -Math.PI / 2 - T.longMelee.holdLead, ...a }, c); // the club stands upright, side-on to the swing
    for (let i = 0; i < 30; i++) step();
    step({}, { drop: true });
    const missile = P2().stick!.body;
    const g = P0().stick!.body.translation();
    missile.setTranslation({ x: g.x + 0.9, y: g.y }, true); // beside the held club, coming in
    missile.setRotation(Math.PI / 2, true);
    missile.setLinvel({ x: -speed, y: 0 }, true);
    let parried = false, disarmed = false;
    for (let i = 0; i < 12; i++) {
      step({}, {});
      if (sim.events.some((e) => e.t === 'parry')) parried = true;
      if (sim.events.some((e) => e.t === 'disarm')) disarmed = true;
    }
    return { sim, P0, P2, missile, parried, disarmed };
  }

  it('a fast club into a held-still club is thrown back, the blocker keeps their club and takes no damage', async () => {
    const { P0, missile, parried, disarmed } = await swingAtGuard(25);
    expect(parried).toBe(true);
    expect(disarmed).toBe(false);
    expect(missile.linvel().x).toBeGreaterThan(3); // it went back the way it came (it was moving left)
    expect(P0().grip).not.toBeNull();
    expect(P0().hp).toBe(T.fighter.hp);
  });

  it('a slow tap on a held club is not a parry', async () => {
    const { parried } = await swingAtGuard(2);
    expect(parried).toBe(false);
  });
});

// Owner, 2026-10-07: blades cut (they hurt from less speed, and more, and shove less), a point hurts most, blunt weapons shove more.
describe('blades, points and blunt weapons', () => {
  it('a katana edge cuts, its tip is the point, a club is blunt; with edges off everything is as before', async () => {
    const { cutFor, damageFor } = await import('./combat');
    const { weaponById } = await import('../content/weapons');
    const { tuning: TT } = await import('../content/tuning');
    const katana = weaponById('katana'), club = weaponById('bone-club'), C = TT.combat;
    const edge = cutFor(katana, 0), tip = cutFor(katana, katana.length / 2 - 0.02), blunt = cutFor(club, club.length / 2 - 0.02);
    expect(edge.kind).toBe('blade'); expect(tip.kind).toBe('point'); expect(blunt.kind).toBe('blunt');
    const slow = C.impactMin * 0.85; // a gentle hit: a blunt weapon does nothing, a blade cuts
    expect(damageFor(slow, blunt.mul, blunt.min)).toBe(0);
    expect(damageFor(slow, edge.mul, edge.min)).toBeGreaterThan(0);
    const hard = 30; // a solid hit: the point hurts more than the edge, the edge more than blunt
    expect(damageFor(hard, tip.mul, tip.min)).toBeGreaterThan(damageFor(hard, edge.mul, edge.min));
    expect(damageFor(hard, edge.mul, edge.min)).toBeGreaterThan(damageFor(hard, blunt.mul, blunt.min));
    expect(edge.knock).toBeLessThan(1); expect(blunt.knock).toBeGreaterThan(1);
    C.edges = false;
    try { expect(cutFor(katana, katana.length / 2 - 0.02)).toEqual({ kind: 'blunt', mul: 1, min: C.impactMin, knock: 1 }); } finally { C.edges = true; }
  });
});

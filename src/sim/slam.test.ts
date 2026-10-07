import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import type { Fighter } from './fighter';
import type { PlayerInput } from './types';
import { Sim } from './world';

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });

let wasArmed = true;
beforeAll(() => { wasArmed = T.fighter.startArmed; T.fighter.startArmed = false; }); // empty hands: a slam starts from a grab
afterAll(() => { T.fighter.startArmed = wasArmed; });

/** Fighter 0 walks up to the dummy and grabs it (`shift` moves where they both start, for trying the same move from several spots). */
async function grabbed(shift = 0) {
  const was = [...T.arena.spawnX];
  T.arena.spawnX = was.map((x) => x + shift);
  const sim = await Sim.create(11);
  T.arena.spawnX = was;
  const P = sim.fighters[0], D = sim.fighters[1];
  while (D.torso.body.translation().x - P.torso.body.translation().x > 1.3) sim.step([idle({ moveX: 1, aim: Math.PI / 2 })]);
  for (let i = 0; i < 40; i++) sim.step([idle()]);
  for (let i = 0; i < 40 && !P.hold; i++) sim.step([idle({ attack: true, moveX: 0.5 })]);
  expect(P.held).toBe(D);
  return { sim, P, D };
}

function lift(fs: Fighter[], dy: number) {
  for (const f of fs) for (const p of f.parts) { const t = p.body.translation(); p.body.setTranslation({ x: t.x, y: t.y - dy }, true); p.body.setLinvel({ x: 0, y: 0 }, true); }
}

/** Jump backwards (still holding the grab) and hold S until the slam lands; returns the damage done and whether a slam happened. */
function slam(sim: Sim, P: Fighter, D: Fighter, jump = true) {
  const hp0 = D.hp;
  let landed = false;
  sim.step([idle({ attack: true, jump, moveX: -1 })]);
  for (let i = 0; i < 2; i++) sim.step([idle({ attack: true, jump, moveX: -1 })]);
  for (let i = 0; i < 120 && !landed; i++) {
    sim.step([idle({ attack: true, crouch: true, jump: jump && i < 12, moveX: i < 12 ? -1 : 0 })]);
    if (sim.events.some((e) => e.t === 'hit' && e.victim === D.index)) landed = true;
  }
  return { landed, dmg: hp0 - D.hp, grip: !!P.hold };
}

// A slam is physics: where they land (head, shoulder, back) changes the damage a lot. So the rules are checked over several start spots.
const SPOTS = [-1.5, -0.7, 0, 0.6, 1.3];

describe('body slam', () => {
  it('holding someone, jump backwards and hold S: your arm heaves them over your head into the ground, a slam that hurts but does not kill', async () => {
    let landed = 0, behind = 0;
    for (const shift of SPOTS) {
      const { sim, P, D } = await grabbed(shift);
      const r = slam(sim, P, D);
      if (!r.landed) continue;
      landed++;
      expect(r.dmg).toBeGreaterThan(0);
      expect(D.hp).toBeGreaterThan(0); // a slam from a normal jump never kills
      expect(r.grip).toBe(false); // you let go of them as they hit
      if (D.torso.body.translation().x < P.torso.body.translation().x + 0.3) behind++; // over your head: they land behind you
    }
    expect(landed).toBeGreaterThanOrEqual(SPOTS.length - 1);
    expect(behind).toBeGreaterThanOrEqual(landed - 1);
  });

  it('from a height it does far more damage than from a jump', async () => { // (it kills only when they land on their head: damage is how hard they really hit)
    let jump = 0, high = 0;
    for (const shift of SPOTS) {
      { const { sim, P, D } = await grabbed(shift); jump += slam(sim, P, D).dmg; }
      const { sim, P, D } = await grabbed(shift);
      lift([P, D], 4.0);
      high += slam(sim, P, D, false).dmg;
    }
    expect(high).toBeGreaterThan(jump * 1.5);
  });

  /** Both fighters 1.2 m up and falling at speed, the held one turned by rot about their own middle (0 = upright, PI = upside down). */
  function driveDown(P: Fighter, D: Fighter, rot: number, speed: number) {
    lift([P, D], 1.2);
    const c = D.torso.body.translation(), hx = c.x, hy = c.y;
    for (const p of D.parts) {
      const t = p.body.translation(), rx = t.x - hx, ry = t.y - hy;
      p.body.setTranslation({ x: hx + rx * Math.cos(rot) - ry * Math.sin(rot), y: hy + rx * Math.sin(rot) + ry * Math.cos(rot) }, true);
      p.body.setRotation(p.body.rotation() + rot, true);
    }
    for (const f of [P, D]) for (const p of f.parts) p.body.setLinvel({ x: 0, y: speed }, true);
  }

  it('someone you fling into the ground headfirst is hurt, by the hardest moment of the landing', async () => {
    for (const shift of SPOTS) {
      const { sim, D } = await grabbed(shift);
      sim.step([idle()]); // let go: flung
      const hp0 = D.hp, c = D.torso.body.translation(), dx = 2.5, up = 1.5;
      for (const p of D.parts) { // out over open floor, upside down, coming down hard
        const t = p.body.translation(), rx = t.x - c.x, ry = t.y - c.y;
        p.body.setTranslation({ x: c.x + dx - rx, y: c.y - up - ry }, true);
        p.body.setRotation(p.body.rotation() + Math.PI, true);
        p.body.setLinvel({ x: 0, y: 11 }, true); p.body.setAngvel(0, true);
      }
      for (let i = 0; i < 30; i++) sim.step([idle()]);
      expect(D.hp).toBeLessThan(hp0 - 5);
    }
  });

  it('someone you hold, set down on their feet, is not hurt', async () => {
    const { sim, D } = await grabbed();
    const hp0 = D.hp;
    driveDown(sim.fighters[0], D, 0, 8);
    for (let i = 0; i < 30; i++) sim.step([idle({ attack: true })]);
    expect(D.hp).toBe(hp0);
  });

  it('without S it is just a carry: no slam', async () => {
    const { sim, D } = await grabbed();
    const hp0 = D.hp;
    sim.step([idle({ attack: true, jump: true })]);
    for (let i = 0; i < 60; i++) sim.step([idle({ attack: true })]);
    expect(D.hp).toBe(hp0);
  });
});

describe('holding S in the air', () => {
  it('keeps your momentum (without it, letting go of the direction slows you in the air)', async () => {
    const speedAfter = async (crouch: boolean) => {
      const sim = await Sim.create(11);
      const P = sim.fighters[0];
      for (let i = 0; i < 30; i++) sim.step([idle({ moveX: 1, aim: 0 })]); // run
      sim.step([idle({ moveX: 1, jump: true })]);
      const v0 = P.torso.body.linvel().x;
      for (let i = 0; i < 14; i++) sim.step([idle({ crouch })]); // in the air, no direction held
      return { v0, v: P.torso.body.linvel().x };
    };
    const held = await speedAfter(true), plain = await speedAfter(false);
    expect(held.v).toBeGreaterThan(held.v0 * 0.9);
    expect(plain.v).toBeLessThan(held.v - 0.5);
  });

  it('turns you flat in mid-air, never past flat, and you land lying down (owner, 2026-10-07: it used to keep you upright)', async () => {
    const sim = await Sim.create(11);
    const P = sim.fighters[0];
    for (let i = 0; i < 20; i++) sim.step([idle({ moveX: 1 })]); // a running jump, S held from the top of it until well after landing
    let tilt = 0, flat = 0, landed = -1;
    for (let i = 0; i < 90; i++) {
      sim.step([idle({ moveX: i < 20 ? 1 : 0, jump: i < 20, crouch: i >= 20 })]);
      if (landed < 0) { tilt = Math.max(tilt, Math.abs(P.torso.body.rotation())); if (Math.abs(P.torso.body.rotation()) > 1.3) flat++; }
      if (landed < 0 && i > 25 && P.grounded) landed = i;
    }
    expect(landed).toBeGreaterThan(0);
    expect(flat).toBeGreaterThan(5); // flat for a while before it lands...
    expect(tilt).toBeLessThan(1.9); // ...and never tipped on past flat (head down)
    expect(P.crouch).toBe(1); // and lying down once on the ground
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import type { Fighter } from './fighter';
import type { PlayerInput } from './types';
import { Sim } from './world';

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });

let wasArmed = true;
beforeAll(() => { wasArmed = T.fighter.startArmed; T.fighter.startArmed = false; }); // empty hands: a slam starts from a grab
afterAll(() => { T.fighter.startArmed = wasArmed; });

/** Fighter 0 walks up to the dummy and grabs it. */
async function grabbed() {
  const sim = await Sim.create(11);
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

/** Jump (still holding the grab), then hold S until the slam lands; returns the damage done and whether a slam happened. */
function slam(sim: Sim, P: Fighter, D: Fighter, jump = true) {
  const hp0 = D.hp;
  let landed = false;
  sim.step([idle({ attack: true, jump })]);
  for (let i = 0; i < 6; i++) sim.step([idle({ attack: true })]);
  for (let i = 0; i < 120 && !landed; i++) {
    sim.step([idle({ attack: true, crouch: true })]);
    if (sim.events.some((e) => e.t === 'hit' && e.victim === D.index)) landed = true;
  }
  return { landed, dmg: hp0 - D.hp, grip: !!P.hold };
}

describe('body slam', () => {
  it('holding someone, jump and hold S: their head is driven into the ground for good damage, but it does not kill', async () => {
    const { sim, P, D } = await grabbed();
    const r = slam(sim, P, D);
    expect(r.landed).toBe(true);
    expect(r.dmg).toBeGreaterThan(25);
    expect(r.dmg).toBeLessThan(80);
    expect(D.hp).toBeGreaterThan(0);
    expect(r.grip).toBe(false); // you let go of them as they hit
  });

  it('from a height it kills', async () => {
    const { sim, P, D } = await grabbed();
    lift([P, D], 4.0);
    const r = slam(sim, P, D, false);
    expect(r.landed).toBe(true);
    expect(D.hp).toBeLessThanOrEqual(0);
  });

  /** Both fighters 1.2 m up and falling at speed, the held one turned by rot about the gripping hand (as a hard downward swing leaves them). */
  function driveDown(P: Fighter, D: Fighter, rot: number, speed: number) {
    lift([P, D], 1.2);
    const ft = P.fore.body.translation(), fa = P.fore.body.rotation();
    const hx = ft.x + Math.cos(fa) * T.fighter.armLength / 2, hy = ft.y + Math.sin(fa) * T.fighter.armLength / 2;
    for (const p of D.parts) {
      const t = p.body.translation(), rx = t.x - hx, ry = t.y - hy;
      p.body.setTranslation({ x: hx + rx * Math.cos(rot) - ry * Math.sin(rot), y: hy + rx * Math.sin(rot) + ry * Math.cos(rot) }, true);
      p.body.setRotation(p.body.rotation() + rot, true);
    }
    for (const f of [P, D]) for (const p of f.parts) p.body.setLinvel({ x: 0, y: speed }, true);
  }

  it('someone you hold, swung down into the ground on their back, is hurt (a slam without the jump)', async () => {
    const { sim, D } = await grabbed();
    const hp0 = D.hp;
    driveDown(sim.fighters[0], D, Math.PI / 2, 11);
    for (let i = 0; i < 30; i++) sim.step([idle({ attack: true, aim: Math.PI / 2 })]);
    expect(D.hp).toBeLessThan(hp0 - 5);
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

  it('does not lie you down in mid-air: you land on your feet, and only then go down', async () => {
    const sim = await Sim.create(11);
    const P = sim.fighters[0];
    for (let i = 0; i < 20; i++) sim.step([idle({ moveX: 1 })]); // a running jump, S held from the top of it until well after landing
    let tilt = 0, landed = -1;
    for (let i = 0; i < 90; i++) {
      sim.step([idle({ moveX: i < 20 ? 1 : 0, jump: i < 20, crouch: i >= 20 })]);
      if (landed < 0) tilt = Math.max(tilt, Math.abs(P.torso.body.rotation()));
      if (landed < 0 && i > 25 && P.grounded) landed = i;
    }
    expect(landed).toBeGreaterThan(0);
    expect(tilt).toBeLessThan(0.6); // upright the whole way down (it used to tip onto its side and land sideways)
    expect(P.crouch).toBe(1); // and lying down once on the ground
  });
});

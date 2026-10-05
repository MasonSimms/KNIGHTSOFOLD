import { describe, expect, it } from 'vitest';
import type { PlayerInput } from './types';
import { Sim } from './world';
import type { Fighter } from './fighter';

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });

/** Move every part of a fighter by (dx, dy) and give it a speed. */
function place(f: Fighter, dx: number, dy: number, vx = 0, vy = 0) {
  for (const p of f.parts) {
    const t = p.body.translation();
    p.body.setTranslation({ x: t.x + dx, y: t.y + dy }, true);
    p.body.setLinvel({ x: vx, y: vy }, true);
    p.body.setAngvel(0, true);
  }
}

async function twoFighters() {
  const sim = await Sim.create(9);
  for (let i = 0; i < 40; i++) sim.step([idle()]);
  return sim;
}

describe('flip', () => {
  it('holding flip spins you forward in the air, and you are put right side up smoothly after landing', async () => {
    const sim = await twoFighters();
    const P = sim.fighters[0];
    sim.step([idle({ jump: true })]);
    let turned = 0, prev = P.torso.body.rotation();
    for (let i = 0; i < 40; i++) {
      sim.step([idle({ flip: true })]);
      const r = P.torso.body.rotation();
      turned += Math.atan2(Math.sin(r - prev), Math.cos(r - prev)); prev = r; // wrapped, so spins past half a turn count
    }
    expect(turned).toBeGreaterThan(5.5); // nearly a full turn, the way the fighter faces (right = positive)
    let maxStep = 0, last = P.torso.body.rotation();
    for (let i = 0; i < 120; i++) {
      sim.step([idle()]);
      maxStep = Math.max(maxStep, Math.abs(P.torso.body.angvel()));
      last = P.torso.body.rotation();
    }
    expect(Math.abs(((last % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI)).toBeLessThan(0.15); // upright again
    expect(P.grounded).toBe(true);
    expect(maxStep).toBeLessThan(12); // a smooth turn, not a snap
  });
});

describe('body collisions', () => {
  it('landing on someone from above hurts them and raises a stomp', async () => {
    const sim = await twoFighters();
    const P = sim.fighters[0], D = sim.fighters[1];
    const dt = D.torso.body.translation().x - P.torso.body.translation().x;
    place(P, dt - 0.05, -2.2); // directly above the dummy
    const hp0 = D.hp;
    let stomped = false;
    for (let i = 0; i < 60; i++) {
      sim.step([idle()]);
      if (sim.events.some((e) => e.t === 'stomp' && e.victim === 1)) stomped = true;
    }
    expect(stomped).toBe(true);
    expect(hp0 - D.hp).toBeGreaterThan(0);
  });

  it('two fighters walking into each other do not hurt', async () => {
    const sim = await twoFighters();
    const P = sim.fighters[0], D = sim.fighters[1];
    const hp0 = D.hp;
    for (let i = 0; i < 120; i++) sim.step([idle({ moveX: 1, aim: Math.PI / 2 })]);
    expect(P.torso.body.translation().x).toBeGreaterThan(9); // really walked into it
    expect(D.hp).toBe(hp0);
  });
});

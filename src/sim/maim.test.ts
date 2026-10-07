import { describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import type { PlayerInput } from './types';
import { Sim } from './world';
import type { Part } from './fighter';

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });
type Maimable = { maim(f: unknown, part: Part, nx: number, ny: number): void; kill(f: unknown, fell: boolean, impact: number): void };

async function setup(seed = 3) {
  const sim = await Sim.create(seed, 2, false);
  for (let i = 0; i < 40; i++) sim.step([idle(), idle()]);
  return sim;
}
const maim = (sim: Sim, i: number, part: Part) => (sim as unknown as Maimable).maim(sim.fighters[i], part, -1, 0);
const run = (sim: Sim, frames: number, a: Partial<PlayerInput> = {}) => { for (let i = 0; i < frames; i++) sim.step([idle(a), idle()]); };
const dist = (a: Part, b: Part) => { const p = a.body.translation(), q = b.body.translation(); return Math.hypot(p.x - q.x, p.y - q.y); };

describe('maiming: a huge hit to a limb takes it off and the fighter plays on', () => {
  it('a lost arm: the weapon falls, no attacking, no picking up, the arm is debris, and the fighter lives', async () => {
    const sim = await setup();
    const f = sim.fighters[0];
    maim(sim, 0, f.fore);
    expect(sim.events.map((e) => e.t)).toContain('dismember');
    expect(f.armLost).toBe(true);
    expect(f.limp).toBe(false);
    expect(f.grip).toBeNull();
    const events: string[] = [];
    for (let i = 0; i < 90; i++) { sim.step([idle({ attack: i < 60, moveX: 0.3, drop: i === 80 }), idle()]); events.push(...sim.events.map((e) => e.t)); }
    expect(f.charge).toBe(0);
    expect(f.grip).toBeNull(); // right-click did not pick the club back up
    expect(events).not.toContain('punch');
    expect(dist(f.upper, f.torso)).toBeGreaterThan(0.9); // the arm came off
    expect(f.limp).toBe(false);
  });

  it('a limb that has come off is debris: the sim no longer treats it as part of its fighter', async () => {
    const sim = await setup();
    const f = sim.fighters[0];
    const detached = (p: Part) => (sim as unknown as { detached(v: unknown, p: Part): boolean }).detached(f, p);
    expect(detached(f.upper)).toBe(false);
    maim(sim, 0, f.fore);
    maim(sim, 0, f.legs[1].shin);
    expect(detached(f.upper) && detached(f.fore)).toBe(true);
    expect(detached(f.legs[1].thigh) && detached(f.legs[1].shin)).toBe(true);
    expect(detached(f.legs[0].thigh) || detached(f.torso)).toBe(false);
  });

  it('one leg: a slow hobble and a low jump; no legs: crawling, no jump', async () => {
    const walk = async (lost: number) => {
      const sim = await setup();
      const f = sim.fighters[0];
      for (let i = 0; i < lost; i++) maim(sim, 0, f.legs[i].thigh);
      const x0 = f.torso.body.translation().x;
      run(sim, 90, { moveX: 1 });
      return { dx: f.torso.body.translation().x - x0, lost: f.legLost, rot: f.torso.body.rotation(), limp: f.limp };
    };
    const jump = async (lost: number) => {
      const sim = await setup();
      const f = sim.fighters[0];
      for (let i = 0; i < lost; i++) maim(sim, 0, f.legs[i].thigh);
      run(sim, 40);
      const y0 = f.torso.body.translation().y;
      let top = 0;
      for (let i = 0; i < 60; i++) { sim.step([idle({ jump: i < 30 }), idle()]); top = Math.max(top, y0 - f.torso.body.translation().y); }
      return top;
    };
    const whole = await walk(0), one = await walk(1), none = await walk(2);
    expect(one.lost).toEqual([true, false]);
    expect(one.dx).toBeLessThan(whole.dx * 0.75);
    expect(one.dx).toBeGreaterThan(1); // still gets about
    expect(Math.abs(none.rot)).toBeGreaterThan(1.1); // lying down, crawling
    expect(none.dx).toBeLessThan(one.dx);
    expect(none.dx).toBeGreaterThan(0.15);
    expect(none.limp).toBe(false);
    const [j0, j1, j2] = [await jump(0), await jump(1), await jump(2)];
    expect(j1).toBeLessThan(j0 * 0.8);
    expect(j2).toBeLessThan(0.3);
  }, 60000);

  it('a real huge club blow to a limb takes it off and leaves the victim alive with a few HP; the next round they are whole again', async () => {
    let tried = 0, maimed = 0;
    for (const dy of [-0.3, 0, 0.3, 0.45, 0.6, 0.75]) {
      const sim = await setup();
      const f = sim.fighters[0];
      const missile = sim.fighters[1].stick!.body;
      sim.step([idle(), idle({ drop: true })]);
      const t = f.torso.body.translation();
      missile.setTranslation({ x: t.x + 1.0, y: t.y + dy }, true);
      missile.setRotation(Math.PI / 2, true);
      missile.setLinvel({ x: -45, y: 0 }, true);
      for (let i = 0; i < 12; i++) sim.step([idle(), idle()]);
      tried++;
      if (!(f.armLost || f.legLost.some(Boolean))) continue;
      maimed++;
      expect(f.limp).toBe(false);
      expect(f.hp).toBeGreaterThan(0);
      expect(f.hp).toBeLessThan(T.fighter.hp - 20); // (it hurt; since the damage curve came down for 20 s rounds it no longer has to be held back to leave them alive)
      (sim as unknown as Maimable).kill(sim.fighters[1], true, 0); // end the round
      const round = sim.round;
      for (let i = 0; i < 300 && sim.round === round; i++) sim.step([idle(), idle()]);
      expect(sim.round).toBe(round + 1);
      expect(sim.fighters[0].armLost).toBe(false);
      expect(sim.fighters[0].legLost).toEqual([false, false]);
      expect(sim.fighters[0].hp).toBe(T.fighter.hp);
    }
    expect(maimed).toBeGreaterThan(0); // at some height the club did take a limb
    expect(tried).toBeGreaterThan(maimed - 1);
  }, 60000);
});

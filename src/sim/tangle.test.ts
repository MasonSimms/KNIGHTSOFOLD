import { describe, expect, it } from 'vitest';
import { takeSnapshot, TANGLED } from '../net/snapshot';
import { placeLoose } from './fighter';
import type { Fighter } from './fighter';
import type { PlayerInput } from './types';
import { Sim } from './world';

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });
type Internals = { acquire(f: Fighter, item: { kind: 'prop'; index: number }): void };

describe('net', () => {
  it('thrown, it tangles the first fighter it touches: no attack, no jump, a shuffle; then it falls off', async () => {
    const sim = await Sim.create(7, 2, false); // (two players: the second presses buttons too)
    for (let i = 0; i < 30; i++) sim.step([idle(), idle()]);
    const f = sim.fighters[0], g = sim.fighters[1], t = f.torso.body.translation();
    if (f.stick) placeLoose(sim.world, f, t.x - 3 * f.side, t.y, 0);
    sim.spawnItem('net', t.x, t.y - 1.5);
    (sim as unknown as Internals).acquire(f, { kind: 'prop', index: sim.props.length - 1 });
    for (let i = 0; i < 10; i++) sim.step([idle(), idle()]);
    // walk up to them, then throw it at them
    let caught = -1;
    for (let i = 0; i < 300 && caught < 0; i++) {
      const me = f.torso.body.translation(), them = g.torso.body.translation(), dx = them.x - me.x, near = Math.abs(dx) < 2.5;
      sim.step([idle({ moveX: near ? 0 : Math.sign(dx), aim: Math.atan2(them.y - me.y, dx), attack: near && i % 20 < 2 }), idle()]);
      if (sim.events.some((e) => e.t === 'tangle' && e.victim === 1)) caught = i;
      if (near && f.stick && !f.grip && !f.stick.netLive && caught < 0 && i % 20 === 19) break; // (missed: no point going on)
    }
    expect(caught).toBeGreaterThanOrEqual(0);
    expect(g.tangled).toBeGreaterThan(100);
    expect((takeSnapshot(sim, 1, []).f[1].st ?? 0) & TANGLED).toBe(TANGLED);
    // tangled: holding attack does not wind up, a jump does not leave the ground, walking is a shuffle
    const x0 = g.torso.body.translation().x;
    for (let i = 0; i < 40; i++) sim.step([idle(), idle({ attack: true, jump: i % 10 === 0, moveX: 1 })]);
    expect(g.charge).toBe(0);
    expect(Math.abs(g.torso.body.translation().x - x0)).toBeLessThan(1.2); // (free: about 3 m in this time)
    for (let i = 0; i < 120; i++) sim.step([idle(), idle()]);
    expect(g.tangled).toBe(0);
    expect(f.stick?.weapon?.net).toBe(true); // still the thrower's net, lying loose for anyone to take
    expect(f.grip).toBeNull();
  });
});

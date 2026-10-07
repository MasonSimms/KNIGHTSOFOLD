import { describe, expect, it } from 'vitest';
import { placeLoose } from './fighter';
import type { PlayerInput } from './types';
import { Sim } from './world';
import { takeSnapshot, HOOKED } from '../net/snapshot';

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });
type Internals = { acquire(f: unknown, item: { kind: 'prop'; index: number }): void };

/** Fighter 0 with the grappling hook in hand, standing; fighter 1 (the dummy) stands where the arena puts it. */
async function withHook(seed = 5, kind = 'boat-hook') {
  const sim = await Sim.create(seed);
  for (let i = 0; i < 30; i++) sim.step([idle()]);
  const f = sim.fighters[0], t = f.torso.body.translation();
  if (f.stick) placeLoose(sim.world, f, t.x - 3 * f.side, t.y, 0);
  sim.spawnItem(kind, t.x, t.y - 1.5);
  (sim as unknown as Internals).acquire(f, { kind: 'prop', index: sim.props.length - 1 });
  for (let i = 0; i < 20; i++) sim.step([idle()]);
  return { sim, f, dummy: sim.fighters[1] };
}

describe('lasso', () => {
  it('flies past the scenery (thrown at the floor it catches nothing), and lassoes a fighter, holding them longer than the hook', async () => {
    const { sim, f, dummy } = await withHook(5, 'lasso');
    expect(f.stick?.weapon?.lasso).toBe(true);
    const back = -f.side, aim = back > 0 ? 0.35 : Math.PI - 0.35;
    let caught = false;
    for (let i = 0; i < 40; i++) { sim.step([idle({ aim, attack: true, reach: 4 })]); caught ||= sim.events.some((e) => e.t === 'hook'); }
    expect(caught).toBe(false);
    for (let i = 0; i < 20; i++) sim.step([idle()]);
    const me = () => f.torso.body.translation(), them = () => dummy.torso.body.translation();
    let stun = 0;
    for (let i = 0; i < 40; i++) {
      sim.step([idle({ aim: Math.atan2(them().y - me().y, them().x - me().x), attack: true, reach: Math.hypot(them().x - me().x, them().y - me().y) })]);
      if (sim.events.some((e) => e.t === 'hook' && e.victim === 1)) stun = dummy.stun;
    }
    expect(stun).toBeGreaterThan(40); // (the hook: 25)
  });
});

describe('grappling hook', () => {
  it('thrown at the floor ahead it catches, and holding the click reels you in to it', async () => {
    const { sim, f } = await withHook();
    expect(f.stick?.weapon?.hook).toBe(true);
    const back = -f.side, x0 = f.torso.body.translation().x, aim = back > 0 ? 0.2 : Math.PI - 0.2; // a little down and behind (the dummy is ahead): the floor about 5 m away
    let caught = -1;
    for (let i = 0; i < 60; i++) {
      sim.step([idle({ aim, attack: true, reach: 7 })]);
      if (caught < 0 && sim.events.some((e) => e.t === 'hook')) caught = i;
    }
    expect(caught).toBeGreaterThanOrEqual(0);
    expect(caught).toBeLessThan(10); // it flies fast
    expect(f.hooked).toBe(true);
    expect(sim.hooks[0]?.victim).toBe(-1); // (the floor, not a fighter)
    expect((f.torso.body.translation().x - x0) * back).toBeGreaterThan(1.5); // hauled toward where it bit
    sim.step([idle({ aim })]); // let go of the click
    sim.step([idle({ aim })]);
    expect(sim.hooks.length).toBe(0);
    expect(f.hooked).toBe(false);
  });

  it('on a fighter it yanks them toward you, and reeling brings them in', async () => {
    const { sim, f, dummy } = await withHook();
    const me = () => f.torso.body.translation(), them = () => dummy.torso.body.translation();
    const gap0 = Math.abs(them().x - me().x);
    let caught = false;
    for (let i = 0; i < 50; i++) {
      const aim = Math.atan2(them().y - me().y, them().x - me().x);
      sim.step([idle({ aim, attack: true, reach: Math.hypot(them().x - me().x, them().y - me().y) })]);
      caught ||= sim.events.some((e) => e.t === 'hook' && e.victim === 1);
    }
    expect(caught).toBe(true);
    expect(Math.abs(them().x - me().x)).toBeLessThan(gap0 - 1.5);
  });

  it('thrown at nothing it flies its range and comes back; nothing is tied', async () => {
    const { sim, f } = await withHook();
    sim.step([idle({ aim: -Math.PI / 2, attack: true })]); // straight up, at the sky
    expect(sim.hooks.length).toBe(1);
    for (let i = 0; i < 40 && sim.hooks.length; i++) sim.step([idle({ aim: -Math.PI / 2, attack: true })]);
    expect(sim.hooks.length).toBe(0);
    expect(f.hooked).toBe(false);
  });

  it('online: the snapshot carries the rope for every page to draw, and says you are on it (the server swings you)', async () => {
    const { sim, f } = await withHook();
    const aim = f.side > 0 ? 0.55 : Math.PI - 0.55;
    for (let i = 0; i < 12; i++) sim.step([idle({ aim, attack: true, reach: 4 })]);
    const s = takeSnapshot(sim, 1, []);
    expect(s.hk?.length).toBe(4);
    expect(s.hk![0]).toBe(0);
    expect(s.hk![3]).toBe(1);
    expect((s.f[0].st ?? 0) & HOOKED).toBe(HOOKED);
  });
});

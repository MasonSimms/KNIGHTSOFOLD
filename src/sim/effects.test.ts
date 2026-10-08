import { describe, expect, it } from 'vitest';
import { PROPS } from '../content/props';
import { BUBBLE, FROZEN, takeSnapshot } from '../net/snapshot';
import { placeLoose } from './fighter';
import { NEUTRAL } from './types';
import type { PlayerInput } from './types';
import { Sim } from './world';

// The Space Age ray guns' effects (sim/effects.ts): swap places, an ice block, a bubble.
type Internals = { acquire(f: unknown, item: { kind: 'prop'; index: number }): void };
async function duel(seed: number) {
  const sim = await Sim.create(seed, 2, false);
  for (let i = 0; i < 30; i++) sim.step([NEUTRAL, NEUTRAL]);
  return sim;
}
function arm(sim: Sim, who: number, kind: string) {
  const f = sim.fighters[who], t = f.torso.body.translation();
  if (f.stick) placeLoose(sim.world, f, t.x - 3 * f.side, t.y, 0);
  sim.spawnItem(kind, t.x, t.y - 1.5);
  (sim as unknown as Internals).acquire(f, { kind: 'prop', index: sim.props.length - 1 });
}
/** Fighter 0 shoots fighter 1 in the chest (one click); `other` = what fighter 1 presses. Steps until `until` or 120 frames. */
function shoot(sim: Sim, until: () => boolean, other: PlayerInput = NEUTRAL): void {
  for (let i = 0; i < 120 && !until(); i++) {
    const a = sim.fighters[0].torso.body.translation(), b = sim.fighters[1].torso.body.translation();
    sim.step([{ ...NEUTRAL, aim: Math.atan2(b.y - 0.1 - a.y, b.x - a.x), reach: Math.hypot(b.y - a.y, b.x - a.x), attack: i === 20 }, other]);
  }
}

describe('ray gun effects', () => {
  it('the swap pistol: the shooter and the one hit change places', async () => {
    const sim = await duel(21);
    arm(sim, 0, 'swap-pistol');
    const a0 = sim.fighters[0].torso.body.translation().x, b0 = sim.fighters[1].torso.body.translation().x;
    shoot(sim, () => sim.events.some((e) => e.t === 'zap'));
    const a1 = sim.fighters[0].torso.body.translation().x, b1 = sim.fighters[1].torso.body.translation().x;
    expect(Math.abs(a1 - b0)).toBeLessThan(0.8);
    expect(Math.abs(b1 - a0)).toBeLessThan(0.8);
    expect(sim.fighters[0].stick?.weapon?.id).toBe('swap-pistol'); // (your gun comes with you)
  }, 30_000);

  it('the freeze ray: an ice block that drops its weapon, cannot walk, slides, then thaws with its grip back', async () => {
    const sim = await duel(22);
    arm(sim, 0, 'freeze-ray');
    const g = sim.fighters[1], friction = g.torso.colliders[0].friction();
    shoot(sim, () => g.frozen > 0);
    expect(g.frozen).toBeGreaterThan(0);
    expect(g.grip).toBeNull();
    expect((takeSnapshot(sim, 1, []).f[1].st ?? 0) & FROZEN).toBe(FROZEN);
    expect(g.torso.colliders[0].friction()).toBeLessThan(friction);
    const x0 = g.torso.body.translation().x;
    for (let i = 0; i < 40; i++) sim.step([NEUTRAL, { ...NEUTRAL, moveX: 1 }]); // (pressing to walk: nothing)
    expect(Math.abs(g.torso.body.translation().x - x0)).toBeLessThan(0.6);
    for (let i = 0; i < PROPS['freeze-ray'].gun!.effect!.frames!; i++) sim.step([NEUTRAL, NEUTRAL]);
    expect(g.frozen).toBe(0);
    expect(g.torso.colliders[0].friction()).toBe(friction);
  }, 30_000);

  it('the bubble blaster: the one hit floats up, and a punch pops it', async () => {
    const sim = await duel(23);
    arm(sim, 0, 'bubble-blaster');
    const g = sim.fighters[1];
    shoot(sim, () => g.bubble > 0);
    expect(g.bubble).toBeGreaterThan(0);
    expect((takeSnapshot(sim, 1, []).f[1].st ?? 0) & BUBBLE).toBe(BUBBLE);
    const y0 = g.torso.body.translation().y;
    for (let i = 0; i < 60; i++) sim.step([NEUTRAL, NEUTRAL]);
    expect(y0 - g.torso.body.translation().y, 'it rose').toBeGreaterThan(0.6);
    g.hp -= 5; // (a hit)
    sim.step([NEUTRAL, NEUTRAL]);
    expect(g.bubble).toBe(0);
    expect(sim.events.some((e) => e.t === 'zap' && e.w === 'pop')).toBe(true);
  }, 30_000);

  it('the black hole launcher: the orb stops, pulls everyone near into it for a while, then pops them away', async () => {
    const sim = await duel(24);
    arm(sim, 0, 'black-hole');
    const g = sim.fighters[1], Z = PROPS['black-hole'].gun!.zone!;
    shoot(sim, () => sim.zones.length > 0);
    expect(sim.zones.length).toBe(1);
    expect(takeSnapshot(sim, 1, []).zn?.length).toBe(3); // (online: where it is, to draw it)
    const z = sim.zones[0], d0 = Math.hypot(g.torso.body.translation().x - z.x, g.torso.body.translation().y - z.y);
    let closest = d0, popped = false;
    for (let i = 0; i < Z.frames + 5; i++) {
      sim.step([NEUTRAL, NEUTRAL]);
      const t = g.torso.body.translation();
      closest = Math.min(closest, Math.hypot(t.x - z.x, t.y - z.y));
      popped ||= sim.events.some((e) => e.t === 'zap' && e.w === 'holepop');
    }
    expect(d0, 'it opened near them').toBeLessThan(Z.radius);
    expect(closest, 'pulled in').toBeLessThan(d0 - 0.5);
    expect(popped).toBe(true);
    expect(sim.zones.length).toBe(0);
  }, 30_000);

  it('the tractor beam: hold to catch someone at range and reel them in; let go and they are flung along the aim; one catch, one shot', async () => {
    const sim = await duel(25);
    arm(sim, 0, 'tractor-beam');
    const me = sim.fighters[0], g = sim.fighters[1], gun = me.stick!, ammo = gun.ammo!;
    const t0 = g.torso.body.translation();
    const placeAt = me.torso.body.translation().x + 4.5 * me.side;
    for (const p of g.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + placeAt - t0.x, y: q.y }, true); p.body.setLinvel({ x: 0, y: 0 }, true); }
    for (let i = 0; i < 20; i++) sim.step([NEUTRAL, NEUTRAL]);
    const aim = () => { const a = me.torso.body.translation(), b = g.torso.body.translation(); return { aim: Math.atan2(b.y - a.y, b.x - a.x), reach: Math.hypot(b.y - a.y, b.x - a.x) }; };
    let caught = false;
    for (let i = 0; i < 30 && !caught; i++) { sim.step([{ ...NEUTRAL, ...aim(), attack: true }, NEUTRAL]); caught = sim.events.some((e) => e.t === 'hook' && e.victim === 1); }
    expect(caught).toBe(true);
    expect(gun.ammo).toBe(ammo - 1);
    const d0 = Math.abs(g.torso.body.translation().x - me.torso.body.translation().x);
    for (let i = 0; i < 40; i++) sim.step([{ ...NEUTRAL, ...aim(), attack: true }, NEUTRAL]);
    expect(Math.abs(g.torso.body.translation().x - me.torso.body.translation().x), 'reeled in').toBeLessThan(d0 - 1);
    sim.step([{ ...NEUTRAL, aim: -Math.PI / 2, attack: false }, NEUTRAL]); // (let go, aiming straight up)
    let up = 0;
    for (let i = 0; i < 10; i++) { up = Math.min(up, g.torso.body.linvel().y); sim.step([{ ...NEUTRAL, aim: -Math.PI / 2 }, NEUTRAL]); }
    expect(up, 'flung up').toBeLessThan(-6);
    expect(sim.hooks.length).toBe(0);
  }, 30_000);
});

describe('the swap pistol and what it hits', () => {
  it('shot at the weapon in someone hand, it swaps you with them (the weapon, torn from the hand, flew at 200 m/s)', async () => {
    const sim = await duel(21);
    arm(sim, 0, 'swap-pistol');
    const a0 = sim.fighters[0].torso.body.translation().x, b0 = sim.fighters[1].torso.body.translation().x, held = sim.fighters[1].stick!;
    let most = 0;
    for (let i = 0; i < 120 && !sim.events.some((e) => e.t === 'zap'); i++) {
      const a = sim.fighters[0].torso.body.translation(), b = held.body.translation();
      sim.step([{ ...NEUTRAL, aim: Math.atan2(b.y - a.y, b.x - a.x), reach: Math.hypot(b.y - a.y, b.x - a.x), attack: i === 20 }, NEUTRAL]);
    }
    for (let i = 0; i < 30; i++) { sim.step([NEUTRAL, NEUTRAL]); most = Math.max(most, Math.hypot(held.body.linvel().x, held.body.linvel().y)); }
    expect(Math.abs(sim.fighters[0].torso.body.translation().x - b0)).toBeLessThan(0.8);
    expect(Math.abs(sim.fighters[1].torso.body.translation().x - a0)).toBeLessThan(0.8);
    expect(most).toBeLessThan(30);
  }, 30_000);
});

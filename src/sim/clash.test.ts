import { afterEach, describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import { clashOutcome, cutFor, damageFor, impactValue } from './combat';
import { weaponById } from '../content/weapons';
import type { PlayerInput } from './types';
import { Sim } from './world';

// Owner, 2026-10-10: more of the fight is the weapons themselves. Two swings meeting are a clash (both thrown back a little, nobody hit);
// a clearly stronger swing knocks the weaker weapon out, the more easily at the hand; a slow touch is nothing; held still is a block.
describe('two weapons meeting: the rule', () => {
  const K = T.clash, D = T.disarm, f = 2.3; // (f: an ordinary weapon's impact factor)
  const was = K.enabled;
  afterEach(() => { K.enabled = was; });

  it('a slow touch is nothing, and neither is a swing into a weapon that is not being swung (that is the block)', () => {
    expect(clashOutcome(2, 2, K.minClosing - 1, f, f, false, false)).toBeNull();
    expect(clashOutcome(20, K.minSpeed - 0.5, 20, f, f, false, false)).toBeNull();
    expect(clashOutcome(K.minSpeed - 0.5, 20, 20, f, f, true, true)).toBeNull();
  });

  it('two swings of about the same strength clash and both keep their weapons, even at the hand', () => {
    expect(clashOutcome(12, 11, 23, f, f, false, false)).toEqual({ impact: impactValue(23, f), loser: null });
    expect(clashOutcome(12, 11.5, 23, f, f, true, true)?.loser).toBeNull();
  });

  it('a clearly stronger swing knocks the weaker weapon out, whichever side it is on', () => {
    const closing = D.clashImpact / f + 1; // (hard enough to disarm away from the hand)
    expect(clashOutcome(18, 18 / D.clashRatio - 1, closing, f, f, false, false)?.loser).toBe('b');
    expect(clashOutcome(18 / D.clashRatio - 1, 18, closing, f, f, false, false)?.loser).toBe('a');
    expect(clashOutcome(18, 18 / D.clashRatio + 1, closing, f, f, false, false)?.loser).toBeNull(); // not clearly stronger
  });

  it('at the weaker one\'s hand it takes far less: a little stronger and a lighter blow are enough', () => {
    const closing = D.handImpact / f + 0.5; // (too light to disarm anywhere else)
    expect(impactValue(closing, f)).toBeLessThan(D.clashImpact);
    const sb = 10, sa = sb * K.handRatio + 0.5; // (a is only a little the stronger)
    expect(sa).toBeLessThan(sb * D.clashRatio);
    expect(clashOutcome(sa, sb, closing, f, f, false, true)?.loser).toBe('b'); // at b's hand: out
    expect(clashOutcome(sa, sb, closing, f, f, true, false)?.loser).toBeNull(); // at a's own hand: a is the stronger, nobody loses it
    expect(clashOutcome(sa, sb, closing, f, f, false, false)?.loser).toBeNull(); // away from the hand: a plain clash
  });

  it('a heavier weapon wins at the same speed, and with the rule off nothing clashes', () => {
    expect(clashOutcome(12, 12, 25, 2.6 * D.clashRatio, 2.6 / 1.01, false, false)?.loser).toBe('b');
    K.enabled = false;
    expect(clashOutcome(12, 11, 23, f, f, false, false)).toBeNull();
  });
});

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });

describe('two weapons meeting: in a fight', () => {
  /** Fighters 0 and 2 (the dummy is 1) face each other `gap` m apart, charge for ca and cb frames and let go together. */
  async function exchange(ca: number, cb: number, gap: number) {
    const sim = await Sim.create(5, 3);
    const step = (a: Partial<PlayerInput> = {}, c: Partial<PlayerInput> = {}) => sim.step([idle({ aim: Math.PI, ...a }), idle(), idle({ aim: 0, ...c })]);
    const dx = () => Math.abs(sim.fighters[0].torso.body.translation().x - sim.fighters[2].torso.body.translation().x);
    for (let i = 0; i < 40; i++) step();
    for (let i = 0; i < 200 && dx() > gap; i++) step({ moveX: -0.5 }, { moveX: 0.5 });
    for (let i = 0; i < 20; i++) step();
    const n = Math.max(ca, cb), clashes: { hits: number; locked: boolean }[] = [];
    for (let i = 0; i < n + 40; i++) {
      step({ attack: i >= n - ca && i < n }, { attack: i >= n - cb && i < n });
      if (sim.events.some((e) => e.t === 'clash')) clashes.push({
        hits: sim.events.filter((e) => e.t === 'hit' && (e.how === 'club' || e.how === 'blade' || e.how === 'point' || e.how === 'fist')).length,
        locked: sim.fighters[0].attackLock > 0 && sim.fighters[2].attackLock > 0,
      });
    }
    return clashes;
  }

  it('swings that meet clash: in that instant neither weapon nor fist lands a blow, and both must wait a moment to swing again', async () => {
    const seen = (await Promise.all([[30, 30, 1.5], [30, 30, 1.9], [30, 18, 1.7]].map(([a, b, g]) => exchange(a, b, g)))).flat();
    expect(seen.length).toBeGreaterThan(0); // (these exchanges clash with the numbers of 2026-10-10: if none does any more, stage new ones)
    for (const c of seen) { expect(c.hits).toBe(0); expect(c.locked).toBe(true); } // (two bodies lunging into each other can still bump: that is the bodies, not the weapons)
  });

  it('with the rule off the same exchanges never clash', async () => {
    const was = T.clash.enabled;
    T.clash.enabled = false;
    try { expect((await exchange(30, 18, 1.7)).length).toBe(0); } finally { T.clash.enabled = was; }
  });
});

// Owner, 2026-10-10: "The blades should be very lethal at anything above low speeds so blocking and maneuvering are critical."
describe('blades are deadly', () => {
  it('a sword edge only nicks at a slow touch, takes about half at a light swing and kills at a real one; a club is as it was', () => {
    const sword = weaponById('longsword'), club = weaponById('bone-club');
    const edge = cutFor(sword, 0), blunt = cutFor(club, 0);
    const dmg = (speed: number, w = sword, c = edge) => damageFor(impactValue(speed, w.impactFactor), c.mul, c.min);
    expect(edge.kind).toBe('blade');
    expect(dmg(2)).toBe(0); // resting on you, or walked into: nothing
    expect(dmg(4)).toBeLessThan(10);
    expect(dmg(9)).toBeGreaterThan(35); expect(dmg(9)).toBeLessThan(70);
    expect(dmg(13)).toBe(T.fighter.hp); // dead
    expect(damageFor(impactValue(13, club.impactFactor), blunt.mul, blunt.min)).toBeLessThan(20); // the same swing with a club
  });
});

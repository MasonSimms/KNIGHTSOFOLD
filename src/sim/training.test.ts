import { describe, expect, it } from 'vitest';
import { botLook } from '../content/looks';
import { ITEMS } from '../content/props';
import type { PlayerInput } from './types';
import { Sim } from './world';

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });

describe('training settings', () => {
  it('the training partner can be a bot: it fights back, and practice still has no rounds', async () => {
    const sim = await Sim.create(3);
    sim.training = { foe: 'bot', foeArmed: true };
    sim.looks[1] = botLook();
    sim.reset();
    const B = sim.fighters[1], x0 = B.torso.body.translation().x;
    expect(sim.practising).toBe(true);
    expect(B.controlled).toBe(true);
    let attacked = false;
    for (let i = 0; i < 600; i++) {
      sim.step([idle()]);
      if (sim.events.some((e) => e.owner === 1 && (e.t === 'hit' || e.t === 'punch' || e.t === 'grab' || e.t === 'throw'))) attacked = true;
    }
    expect(Math.abs(sim.fighters[1].torso.body.translation().x - x0)).toBeGreaterThan(1); // it walked over to you
    expect(attacked).toBe(true);
    expect(sim.matchActive).toBe(false); // no rounds: whoever dies stands up again
  });

  it('the dummy can stand there empty-handed', async () => {
    const sim = await Sim.create(3);
    sim.training = { foe: 'dummy', foeArmed: false };
    sim.reset();
    expect(sim.fighters[1].controlled).toBe(false);
    expect(sim.fighters[1].grip).toBeNull();
  });

  it('any weapon can be dropped in, picked up, and cleared away', async () => {
    const sim = await Sim.create(3);
    for (let i = 0; i < 30; i++) sim.step([idle()]);
    const P = sim.fighters[0], t = P.torso.body.translation(), n0 = sim.props.length;
    for (const it of ITEMS) sim.spawnItem(it.id, 12, 2); // every one of them
    expect(sim.props.filter((p) => !p.chainOf).length).toBe(n0 + ITEMS.length); // (a chain weapon's head is a loose thing of its own)
    sim.clearLoose();
    expect(sim.props.length).toBe(0);
    sim.spawnItem('katana', t.x + 0.5, t.y - 1.5); // one at your feet
    for (let i = 0; i < 60; i++) sim.step([idle({ drop: i === 0 })]); // let go of your own club
    for (let i = 0; i < 40 && P.stick?.weapon?.id !== 'katana'; i++) sim.step([idle({ drop: i % 10 === 0, aim: Math.PI / 2 })]);
    expect(P.stick?.weapon?.id).toBe('katana');
    for (let i = 0; i < 30; i++) sim.step([idle()]); // and the game goes on
  });
});

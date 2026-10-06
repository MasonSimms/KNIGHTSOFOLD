import { describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import type { PlayerInput } from './types';
import { eraFor, mapFor } from './era';
import { Sim } from './world';

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });
const stepAll = (sim: Sim, n = 1) => { for (let i = 0; i < n; i++) sim.step([idle(), idle(), idle(), idle()]); };
const knockOff = (sim: Sim, who: number) => { // move the whole fighter (every part, or the joints drag the body back) into the void
  for (const p of sim.fighters[who].parts) p.body.setTranslation({ x: 9, y: T.arena.killY + 2 }, true);
};

describe('a fight of 2-4 players', () => {
  it('has real players (no dummy), each armed, spread across the platform', async () => {
    const sim = await Sim.create(7, 4, false);
    expect(sim.matchActive).toBe(true);
    expect(sim.fighters.length).toBe(4);
    expect(sim.fighters.every((f) => f.controlled && f.grip)).toBe(true);
    const xs = sim.fighters.map((f) => f.torso.body.translation().x);
    expect(new Set(xs.map((x) => x.toFixed(1))).size).toBe(4); // four different spots
  });

  it('playing alone is the training mode: a dummy, no rounds, and a dead fighter respawns', async () => {
    const sim = await Sim.create(7);
    expect(sim.matchActive).toBe(false);
    expect(sim.fighters[1].controlled).toBe(false);
    knockOff(sim, 1);
    stepAll(sim, 2);
    expect(sim.fighters[1].limp).toBe(true);
    stepAll(sim, T.respawn.frames + 5);
    expect(sim.fighters[1].limp).toBe(false); // it came back
    expect(sim.roundOver).toBe(false);
  });

  it('the last fighter standing wins the round and scores; the next round starts after a pause, with the scores kept', async () => {
    const sim = await Sim.create(7, 3, false);
    stepAll(sim, 30);
    knockOff(sim, 1);
    stepAll(sim, 5);
    expect(sim.roundOver).toBe(false); // two are still alive
    knockOff(sim, 2);
    stepAll(sim, 5);
    expect(sim.roundOver).toBe(true);
    expect(sim.roundWinner).toBe(0);
    expect(sim.scores).toEqual([1, 0, 0, 0]);
    expect(sim.fighters[1].limp && sim.fighters[2].limp).toBe(true); // the dead stay down during the result
    stepAll(sim, T.match.resultFrames + 10);
    expect(sim.roundOver).toBe(false);
    expect(sim.round).toBe(2);
    expect(sim.scores).toEqual([1, 0, 0, 0]); // kept
    expect(sim.fighters.every((f) => !f.limp && f.grip)).toBe(true); // everyone is back, armed
  });

  it('a draw scores nobody a point', async () => {
    const sim = await Sim.create(7, 2, false);
    stepAll(sim, 30);
    knockOff(sim, 0);
    knockOff(sim, 1);
    stepAll(sim, 5);
    expect(sim.roundOver).toBe(true);
    expect(sim.roundWinner).toBe(-1);
    expect(sim.scores).toEqual([0, 0, 0, 0]);
  });

  it('setPlayers switches between training and a fight', async () => {
    const sim = await Sim.create(7);
    sim.setPlayers(3);
    expect(sim.matchActive).toBe(true);
    expect(sim.fighters.length).toBe(3);
    sim.setPlayers(1);
    expect(sim.matchActive).toBe(false);
    expect(sim.fighters[1].controlled).toBe(false); // the dummy is back
  });
});

describe('the charged throw at full charge', () => {
  it('right-click starts the throw even after holding well past a full charge', async () => {
    const sim = await Sim.create(7);
    for (let i = 0; i < 40; i++) sim.step([idle()]);
    const f = sim.fighters[0];
    for (let i = 0; i < 60; i++) sim.step([idle({ attack: true })]); // held far past the 30-frame full charge
    expect(f.charge).toBe(T.charge.maxFrames);
    sim.step([idle({ attack: true, drop: true })]);
    expect(f.throwPending).toBe(true);
    let thrown = false;
    for (let i = 0; i < 20 && !thrown; i++) { sim.step([idle({ attack: true })]); thrown = sim.events.some((e) => e.t === 'throw'); }
    expect(thrown).toBe(true);
    expect(f.grip).toBeNull();
  });
});

describe('a match (12 rounds, then the crown)', () => {
  /** Everyone but `who` falls into the void; step until the next round starts (or the match is over). */
  const winRound = (sim: Sim, who: number) => {
    sim.fighters.forEach((f, i) => { if (i !== who && !f.limp) knockOff(sim, i); });
    for (let i = 0; i < T.match.resultFrames + 20; i++) { stepAll(sim); if (sim.events.some((e) => e.t === 'newround' || e.t === 'match')) return; }
  };

  it('after the last round the leader takes the crown, and no more rounds start', async () => {
    const sim = await Sim.create(5, 3, false);
    for (let r = 1; r <= T.match.rounds; r++) winRound(sim, r <= 7 ? 0 : 1); // 7 rounds to fighter 0, 5 to fighter 1
    expect(sim.round).toBe(T.match.rounds);
    expect(sim.matchOver).toBe(true);
    expect(sim.matchWinner).toBe(0);
    stepAll(sim, T.match.crownFrames);
    expect(sim.round).toBe(T.match.rounds); // nothing more happens until the players go on
    expect(sim.matchFrames).toBeGreaterThanOrEqual(T.match.crownFrames);
  }, 60_000);

  it('a tie at the top plays extra rounds until someone leads', async () => {
    const sim = await Sim.create(6, 2, false);
    for (let r = 1; r <= T.match.rounds; r++) winRound(sim, r % 2); // 6 each
    expect(sim.matchOver).toBe(false);
    expect(sim.round).toBe(T.match.rounds + 1);
    expect(sim.tieBreak).toBe(true);
    winRound(sim, 1);
    expect(sim.matchOver).toBe(true);
    expect(sim.matchWinner).toBe(1);
  }, 60_000);

  it('a new match (a new seed) starts at round 1 with no scores, in another order of maps', async () => {
    const sim = await Sim.create(5, 2, false);
    winRound(sim, 0);
    const before = Array.from({ length: 12 }, (_, i) => i + 1).map((r) => `${eraFor(sim.matchSeed, r).id}/${mapFor(sim.matchSeed, r, eraFor(sim.matchSeed, r).id)}`).join();
    sim.reseed(987654);
    expect(sim.round).toBe(1);
    expect(sim.scores).toEqual([0, 0, 0, 0]);
    expect(sim.matchSeed).toBe(987654);
    const after = Array.from({ length: 12 }, (_, i) => i + 1).map((r) => `${eraFor(987654, r).id}/${mapFor(987654, r, eraFor(987654, r).id)}`).join();
    expect(after).not.toBe(before); // (the specials and the maps fall differently)
  });
});

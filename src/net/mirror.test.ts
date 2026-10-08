import { describe, expect, it } from 'vitest';
import { Mirror } from './snapshot';
import { Room } from './room';
import { NEUTRAL } from '../sim/types';
import { Sim } from '../sim/world';

// A page's copy that has gone wrong must recover, not break (found on the live server, 2026-10-07: a friend's page could not make a
// pickup of a thing its copy did not have, threw, and threw again on every message after it for the rest of the match).
describe('the online copy', () => {
  it('an event it cannot make is counted as gone wrong (so the page asks for the whole fight again), and the copy carries on', async () => {
    const server = await Sim.create(41, 2, false), client = await Sim.create(41, 2, false);
    const room = new Room(server), mirror = new Mirror(client, 0);
    let last = 0;
    for (let i = 0; i < 30; i++) { const s = room.tick(); if (s) { mirror.push(JSON.parse(JSON.stringify(s)), i * 16); mirror.show(i * 16); last = s.frame; } }
    const bad = room.tick()!;
    bad.ev.push({ t: 'pickup', x: 0, y: 0, v: 100 + 999, owner: 0, victim: -1 }); // (a pickup of a prop this copy does not have)
    expect(() => { mirror.push(JSON.parse(JSON.stringify(bad)), 31 * 16); mirror.show(40 * 16); }).not.toThrow();
    expect(mirror.desyncs).toBeGreaterThan(0);
    let threw = false;
    for (let i = 0; i < 30; i++) { room.setInput(0, NEUTRAL); const s = room.tick(); if (s) try { mirror.push(JSON.parse(JSON.stringify(s)), (32 + i) * 16); mirror.show((40 + i) * 16); } catch { threw = true; } }
    expect(threw, 'it does not try the bad event again').toBe(false);
    expect(last).toBeGreaterThan(0);
  });
});

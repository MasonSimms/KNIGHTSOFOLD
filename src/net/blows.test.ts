import { expect, it } from 'vitest';
import { NEUTRAL } from '../sim/types';
import type { PlayerInput, SimEvent } from '../sim/types';
import { Sim } from '../sim/world';
import { Predictor } from './predict';
import { Mirror } from './snapshot';
import type { Snapshot } from './snapshot';
import { Room } from './room';

// Your own blow online (owner, 2026-10-09): its spark, sound and shake show the moment it lands on your screen, a round trip before the
// server's report of it would; the server's report is then skipped, so nothing shows twice.
const LAG = 6; // ticks each way (100 ms)
it('your own blow shows at once on your screen, a round trip before the server says, and is not shown twice', async () => {
  const server = await Sim.create(4, 2, false), client = await Sim.create(4, 2, false);
  const room = new Room(server), mirror = new Mirror(client), pred = new Predictor(mirror, 0);
  const up: { at: number; i: PlayerInput; n: number }[] = [], down: { at: number; s: Snapshot }[] = [];
  let tick = 0, n = 0;
  const local: number[] = [], fromServer: { tick: number; e: SimEvent }[] = [];
  const step = (input: PlayerInput) => {
    tick++; n++;
    up.push({ at: tick + LAG, i: input, n });
    while (up.length && up[0].at <= tick) { const x = up.shift()!; room.setInput(0, x.i, x.n); }
    const s = room.tick();
    if (s) down.push({ at: tick + LAG, s: JSON.parse(JSON.stringify(s)) });
    while (down.length && down[0].at <= tick) { const x = down.shift()!.s; mirror.push(x); pred.reconcile(x); }
    const shown = mirror.show(Math.max(0, tick - 2 * LAG - 3));
    for (const e of shown.events) if (e.t === 'hit' && e.owner === 0) fromServer.push({ tick, e });
    for (const e of pred.tick(input, n, shown.alpha)) if (e.t === 'hit' && e.owner === 0) local.push(tick);
  };
  for (let i = 0; i < 60; i++) step(NEUTRAL);
  const me = server.fighters[0].torso.body.translation(), them = server.fighters[1], t = them.torso.body.translation(); // (the other one, just in front of you on the server: the page sees it a moment later)
  for (const p of them.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + me.x + 1.3 - t.x, y: q.y }, true); p.body.setLinvel({ x: 0, y: 0 }, true); }
  for (let i = 0; i < 60; i++) step(NEUTRAL);
  expect(pred.active).toBe(true);
  for (let i = 0; i < 30; i++) step({ ...NEUTRAL, aim: 0, attack: true }); // wind up toward them...
  for (let i = 0; i < 45; i++) step({ ...NEUTRAL, aim: 0 }); // ...and let go: the swing
  expect(server.fighters[1].hp).toBeLessThan(100); // the server: it landed
  expect(local.length).toBeGreaterThan(0); // this page showed it...
  expect(fromServer.length).toBeGreaterThan(0);
  expect(fromServer[0].tick - local[0]).toBeGreaterThanOrEqual(2 * LAG); // ...a round trip before the server's report came
  expect(fromServer.map((x) => pred.claim(x.e))[0]).toBe(true); // and that report is skipped (main.ts)
}, 60_000);

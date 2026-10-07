import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eras } from '../content/eras';
import { botLook } from '../content/looks';
import { tuning as T } from '../content/tuning';
import { fuzzer } from '../sim/fuzz';
import { Sim } from '../sim/world';
import { Mirror } from './snapshot';
import type { Snapshot } from './snapshot';
import { Room } from './room';

// Every map online: 10 seconds of a 4-player fight (two button-mashers, two bots) through the room server, with a client copy fed what
// crosses the network. The copy must keep the same parts as the server (breaking, shattering, snapping, leaking, burning all replayed)
// and show every body where the server has it.
beforeAll(() => { T.eras.changeGameplay = true; T.spawn.enabled = true; T.props.lying = true; });
afterAll(() => { T.eras.changeGameplay = false; T.spawn.enabled = false; T.props.lying = false; });
const wire = (s: Snapshot): Snapshot => JSON.parse(JSON.stringify(s));
const maps = eras.flatMap((e) => Array.from({ length: 1 + (e.alt?.length ?? 0) }, (_, map) => [e.id, map] as const));

describe('every map online', () => {
  it.each(maps)('%s map %i: the client copy stays in step with the server', async (era, map) => {
    const server = await Sim.create(41, 4, false), client = await Sim.create(41, 4, false);
    for (const s of [server, client]) { s.looks[2] = botLook(); s.looks[3] = botLook(); s.forceEra = era; s.forceMap = map; s.reset(); }
    const room = new Room(server), mirror = new Mirror(client), inputs = fuzzer(17);
    let worst = 0;
    for (let i = 0; i < 600; i++) {
      for (let k = 0; k < 4; k++) room.setInput(k, inputs(4)[k]);
      const s = room.tick();
      if (!s) continue;
      mirror.push(wire(s));
      mirror.show(s.frame);
      if (server.round !== client.round) continue;
      server.fighters.forEach((f, n) => f.parts.forEach((p, j) => { const q = client.fighters[n].parts[j], t = p.body.translation(); if (q) worst = Math.max(worst, Math.abs(t.x - q.cx), Math.abs(t.y - q.cy)); }));
      expect(client.props.length, `frame ${i}: loose things`).toBe(server.props.length);
    }
    expect(mirror.desyncs).toBe(0);
    expect(worst).toBeLessThan(0.01);
  }, 60_000);
});

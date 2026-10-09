import { afterEach, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import { NEUTRAL } from '../sim/types';
import { Sim } from '../sim/world';
import { Mirror } from './snapshot';
import type { Snapshot } from './snapshot';
import { Room } from './room';

// The others online (owner, 2026-10-09): when snapshots stall the page carries their motion on; when the real ones come and they had
// were flung the other way meanwhile (a hit), the difference slides away instead of a jump back.
const smoothWas = T.net.smoothBack;
afterEach(() => { T.net.smoothBack = smoothWas; });

/** The biggest step the other fighter is drawn taking in one frame once its snapshots come again (m). */
async function biggestJump(): Promise<number> {
  const server = await Sim.create(3, 2, false), client = await Sim.create(3, 2, false), room = new Room(server), mirror = new Mirror(client);
  const held: Snapshot[] = [];
  let last: { x: number; y: number } | null = null, worst = 0;
  for (let k = 0; k < 160; k++) {
    room.setInput(1, { ...NEUTRAL, moveX: 1 }); // the other one runs right...
    if (k === 82) for (const p of server.fighters[1].parts) p.body.setLinvel({ x: -9, y: -3 }, true); // ...and is flung back (a hit)...
    held.push(JSON.parse(JSON.stringify(room.tick()!)));
    if (k < 80 || k >= 96) while (held.length) mirror.push(held.shift()!, (k * 1000) / 60); // ...while its snapshots stall (ticks 80 to 95): this page carries its run on
    const { alpha } = mirror.update(1 / 60), f = client.fighters[1].torso, x = f.px + (f.cx - f.px) * alpha, y = f.py + (f.cy - f.py) * alpha;
    if (last && k >= 96 && k < 120) worst = Math.max(worst, Math.hypot(x - last.x, y - last.y));
    last = { x, y };
  }
  return worst;
}

it('the others, flung back while their snapshots stalled, slide back to where they are instead of jumping', async () => {
  T.net.smoothBack = 0;
  const jump = await biggestJump();
  T.net.smoothBack = smoothWas;
  const slide = await biggestJump();
  console.log(`biggest jump in a frame: ${(jump * 100).toFixed(0)} cm without the slide, ${(slide * 100).toFixed(0)} cm with it`);
  expect(jump).toBeGreaterThan(0.2); // (the test makes a real jump back)
  expect(slide).toBeLessThan(jump * 0.6);
}, 60_000);

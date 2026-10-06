import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import { setBackPlane } from './fighter';
import type { Fighter } from './fighter';
import { NEUTRAL } from './types';
import type { PlayerInput, SimEvent } from './types';
import { Sim } from './world';

// Tar and fire (owner): tar slows you, lets you kick only weakly and swallows you if you stay; fire burns while you stand in it and
// keeps burning a while after; wooden clubs catch fire and set alight whoever they touch.
beforeAll(() => { T.eras.changeGameplay = true; });
afterAll(() => { T.eras.changeGameplay = false; });

async function onMap(map: number) {
  const sim = await Sim.create(5, 2, false);
  sim.forceEra = 'caveman'; sim.forceMap = map; sim.reset();
  setBackPlane(sim.fighters[1], true); sim.fighters[1].dodge = 1e9; // (the other one stays out of the way)
  return sim;
}
const moveTo = (f: Fighter, x: number, dy = 0) => { const t = f.torso.body.translation(); for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + x - t.x, y: q.y + dy }, true); p.body.setLinvel({ x: 0, y: 0 }, true); } };
function run(sim: Sim, frames: number, input: (n: number) => PlayerInput = () => NEUTRAL): SimEvent[] {
  const out: SimEvent[] = [];
  for (let n = 0; n < frames; n++) { sim.step([input(n), NEUTRAL]); out.push(...sim.events.map((e) => ({ ...e }))); }
  return out;
}
const TAR_PIT = 3, CAMPFIRE = 2;

describe('tar', () => {
  it('in the tar you paddle slowly, and staying in it swallows you (a knock-off)', async () => {
    const sim = await onMap(TAR_PIT), f = sim.fighters[0];
    moveTo(f, 11.2, -0.5);
    run(sim, 40);
    expect(f.tar).toBe(true);
    const x0 = f.torso.body.translation().x;
    run(sim, 30, () => ({ ...NEUTRAL, moveX: 1 }));
    expect(f.torso.body.translation().x - x0).toBeLessThan(T.motion.moveSpeed * 0.5 * 0.5); // half a second of paddling: well under half a walk
    const events = run(sim, T.tar.frames + 120);
    expect(f.sinking).toBe(true);
    expect(events.some((e) => e.t === 'fall' && e.victim === 0)).toBe(true);
  });

  it('kicking hard toward the edge gets you out in time', async () => {
    const sim = await onMap(TAR_PIT), f = sim.fighters[0];
    moveTo(f, 11.0, -0.5);
    run(sim, 30);
    run(sim, 120, (n) => ({ ...NEUTRAL, moveX: -1, jump: n % 20 < 10 }));
    expect(f.limp).toBe(false);
    expect(f.torso.body.translation().x).toBeLessThan(10.5); // up on the grass
  });

  it('a log thrown in sinks slowly', async () => {
    const sim = await onMap(TAR_PIT);
    sim.spawnItem('log', 12, sim.arena.platformTop - 1);
    const log = sim.props.at(-1)!, surf = sim.arena.platformTop + sim.arena.tar[0].level;
    run(sim, 60);
    const y1 = log.body.translation().y;
    expect(y1).toBeGreaterThan(surf - 0.1);
    run(sim, 60);
    expect(log.body.translation().y).toBeGreaterThan(y1);
    expect(log.body.translation().y - y1).toBeLessThan(1.5);
  });
});

describe('fire', () => {
  it('standing in the campfire burns you; out of it you go on burning a while, then it stops', async () => {
    const sim = await onMap(CAMPFIRE), f = sim.fighters[0], fire = sim.arena.fires[0];
    moveTo(f, fire.x + fire.w / 2);
    const hp0 = f.hp, events = run(sim, 30);
    expect(events.some((e) => e.t === 'ignite' && e.victim === 0)).toBe(true);
    expect(f.hp).toBeLessThan(hp0);
    moveTo(f, 7);
    const hp1 = f.hp;
    run(sim, 60);
    expect(f.burning).toBeGreaterThan(0);
    expect(f.hp).toBeLessThan(hp1); // still burning after getting out
    run(sim, T.fire.burnFrames);
    const hp2 = f.hp;
    run(sim, 60);
    expect(f.burning).toBe(0);
    expect(f.hp).toBe(hp2); // and then it stops
  });

  it('wood in the fire catches, and sets alight whoever it touches', async () => {
    const sim = await onMap(CAMPFIRE), v = sim.fighters[1], fire = sim.arena.fires[0];
    setBackPlane(v, false); v.dodge = 0;
    sim.spawnItem('log', fire.x + fire.w / 2, sim.arena.platformTop - 0.3);
    const club = sim.props.at(-1)!;
    run(sim, 2);
    expect(club.burning).toBeGreaterThan(0);
    expect(v.burning).toBe(0);
    const t = v.torso.body.translation();
    club.body.setTranslation({ x: t.x, y: t.y }, true); // pressed against them
    const events = run(sim, 3);
    expect(v.burning).toBeGreaterThan(0);
    expect(events.some((e) => e.t === 'ignite' && e.victim === 1)).toBe(true);
  });
});

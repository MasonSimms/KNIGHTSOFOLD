import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mapNamed } from '../content/eras';
import { PROPS, PROP_KINDS } from '../content/props';
import { tuning as T } from '../content/tuning';
import { setBackPlane } from './fighter';
import type { Fighter } from './fighter';
import { NEUTRAL } from './types';
import type { PlayerInput, SimEvent } from './types';
import { damageScenery } from './guns';
import { floorAt, Sim } from './world';

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
const TAR_PIT = mapNamed('caveman', 'Tar Pit'), CAMPFIRE = mapNamed('caveman', 'Campfire Clearing');

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
// Lava and falling rocks (Volcano Rim), and the Sandstorm Temple's pillars (owner asked for the lava, sand and ice maps, 2026-10-07).
describe('lava, rocks and pillars', () => {
  const VOLCANO = mapNamed('caveman', 'Volcano Rim');
  it('lava sets you burning at once and has you in a blink (a knock-off); a log thrown in catches fire', async () => {
    const sim = await onMap(VOLCANO), f = sim.fighters[0];
    moveTo(f, 12.0, -0.5);
    let n = 0;
    while (n++ < 60 && f.burning === 0) run(sim, 1);
    expect(f.tar).toBe(true);
    expect(f.burning, 'alight within a second').toBeGreaterThan(0);
    expect(f.limp).toBe(false);
    const events = run(sim, 60);
    expect(f.limp).toBe(true);
    expect(events.some((e) => e.t === 'fall' && e.victim === 0)).toBe(true);
    sim.spawnItem('log', 12, sim.arena.platformTop - 1);
    const log = sim.props.at(-1)!;
    run(sim, 40);
    expect(log.burning ?? 0).toBeGreaterThan(0);
  });
  it('rocks fall from the rim on the timetable, announced for the online copies', async () => {
    const sim = await onMap(VOLCANO), R = sim.arena.rocks!, before = sim.props.length;
    const events = run(sim, Math.round(R.first * 60) + 2);
    expect(events.filter((e) => e.t === 'spawn' && e.v === PROP_KINDS.indexOf(R.kind)).length).toBe(1);
    expect(sim.props.length).toBe(before + 1);
    run(sim, Math.round(R.every * 60));
    expect(sim.props.length).toBe(before + 2);
  });
  it('the temple pillars are too heavy to lift, and enough blows break one into rubble', async () => {
    const sim = await Sim.create(5, 2, false);
    sim.forceEra = 'egypt'; sim.forceMap = mapNamed('egypt', 'Sandstorm Temple'); sim.reset();
    const pillars = sim.props.filter((p) => p.weapon?.id === 'pillar');
    expect(pillars.length).toBe(2);
    expect(PROPS.pillar.mass).toBeGreaterThan(T.props.maxLift);
    expect(sim.arena.wind?.gust ?? 0).toBeGreaterThan(0);
    damageScenery(sim, pillars[0], PROPS.pillar.breaks!.hp + 1);
    expect(sim.props.filter((p) => p.weapon?.id === 'pillar').length).toBe(1);
    expect(sim.props.filter((p) => p.weapon?.id === 'rubble').length).toBe(3);
  });
});

describe('Waterfall Torii (streams)', () => {
  async function torii() {
    const sim = await Sim.create(5, 2, false);
    sim.forceEra = 'samurai'; sim.forceMap = mapNamed('samurai', 'Waterfall Torii'); sim.reset();
    setBackPlane(sim.fighters[1], true); sim.fighters[1].dodge = 1e9; // (the other one stays out of the way)
    return sim;
  }
  const put = (sim: Sim, f: Fighter, x: number) => moveTo(f, x, floorAt(sim.arena, x) - T.stand.height - f.torso.body.translation().y);
  const x = (f: Fighter) => f.torso.body.translation().x;

  it('standing in the stream you are carried to the waterfall and over it (a knock-off); on the rocks you stay put', async () => {
    const sim = await torii(), f = sim.fighters[0], s = sim.arena.streams[0];
    put(sim, f, s.x + 1.0);
    run(sim, 20);
    const x0 = x(f);
    run(sim, 60);
    expect(x(f) - x0).toBeGreaterThan(s.speed * 0.6); // a second: carried most of the stream's speed
    for (let i = 0; i < 300 && !f.limp; i++) run(sim, 1);
    expect(f.limp).toBe(true); // over the edge
    const dry = await torii(), g = dry.fighters[0];
    put(dry, g, 3.0);
    run(dry, 20);
    const x1 = x(g);
    run(dry, 120);
    expect(Math.abs(x(g) - x1)).toBeLessThan(0.3);
  });

  it('walking against the stream still gets you somewhere, slower than on dry rock', async () => {
    const sim = await torii(), f = sim.fighters[0], s = sim.arena.streams[0];
    put(sim, f, s.x + s.w - 1.0);
    run(sim, 20);
    const x0 = x(f);
    run(sim, 60, () => ({ ...NEUTRAL, moveX: -1 }));
    expect(x0 - x(f)).toBeGreaterThan(1.0); // upstream, a metre or more in a second
    expect(x0 - x(f)).toBeLessThan(T.motion.moveSpeed * 0.9);
  });

  it('a loose thing in the stream drifts down to the waterfall', async () => {
    const sim = await torii(), s = sim.arena.streams[1]; // (the right-hand one: it runs left)
    sim.spawnItem('plank', s.x + s.w - 0.8, floorAt(sim.arena, s.x + 1) - 0.3);
    const p = sim.props[sim.props.length - 1], x0 = p.body.translation().x;
    run(sim, 120);
    expect(x0 - p.body.translation().x).toBeGreaterThan(2);
  });
});

describe('Bamboo Grove', () => {
  async function grove() {
    const sim = await Sim.create(5, 2, false);
    sim.forceEra = 'samurai'; sim.forceMap = mapNamed('samurai', 'Bamboo Grove'); sim.reset();
    setBackPlane(sim.fighters[1], true); sim.fighters[1].dodge = 1e9;
    return sim;
  }
  const stalks = (sim: Sim) => sim.props.filter((p) => p.weapon?.id === 'bamboo').sort((a, b) => a.body.translation().x - b.body.translation().x);
  const lean = (p: { body: { rotation(): number } }) => Math.abs(Math.atan2(Math.sin(p.body.rotation() + Math.PI / 2), Math.cos(p.body.rotation() + Math.PI / 2)));
  type Items = { itemOf(p: unknown): unknown };

  it('the bamboo stands up out of the floor, rooted: nobody picks up a standing stalk', async () => {
    const sim = await grove(), all = stalks(sim);
    expect(all.length).toBe(7);
    run(sim, 300);
    for (const p of all) expect(lean(p)).toBeLessThan(0.05);
    expect((sim as unknown as Items).itemOf(all[0])).toBeNull();
  });

  it('you walk between the stalks; a thing flung into one whips it over, and it springs back up', async () => {
    const sim = await grove(), f = sim.fighters[0], p = stalks(sim)[3], px = p.body.translation().x;
    moveTo(f, px - 1.2);
    run(sim, 20);
    run(sim, 90, () => ({ ...NEUTRAL, moveX: 1 }));
    expect(f.torso.body.translation().x).toBeGreaterThan(px + 0.5); // straight past it
    expect(lean(p)).toBeLessThan(0.6); // (your sword may brush it as you pass)
    sim.spawnItem('log', px - 1.5, sim.arena.platformTop - 1.6);
    sim.props[sim.props.length - 1].body.setLinvel({ x: 9, y: 0 }, true);
    let most = 0;
    for (let i = 0; i < 40; i++) { run(sim, 1); most = Math.max(most, lean(p)); }
    expect(most).toBeGreaterThan(0.3);
    run(sim, 240);
    expect(lean(p)).toBeLessThan(0.15); // back up
  });

  it('a hard blow cuts a stalk free: then it is a long pole to pick up and stab with', async () => {
    const sim = await grove(), p = stalks(sim)[3];
    sim.shootLoose(p, p.body.translation().x, p.body.translation().y, 0);
    run(sim, 90);
    expect(p.links?.length ?? 0).toBe(0);
    expect((sim as unknown as Items).itemOf(p)).not.toBeNull();
    expect(p.weapon?.thrust).toBe(true);
  });
});

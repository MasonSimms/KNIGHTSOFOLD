import { expect, it } from 'vitest';
import { eras } from '../content/eras';
import { PROPS } from '../content/props';
import { Bot } from '../sim/bot';
import { placeLoose } from '../sim/fighter';
import { Sim } from '../sim/world';

// npm run chaos: 4 bots fight with every special weapon (guns, hooks, nets, chains, grenades, shields...) across the eras' maps, 30 s
// each, everyone holding the same one. It looks for what breaks: a crash in the physics, a number that is not a number, a body thrown
// impossibly fast, a frame that takes too long. (It found the crash of shooting a thrown club, 2026-10-07.) Run it before a playtest.

type Internals = { acquire(f: unknown, item: { kind: 'prop'; index: number }): void };
const SPECIAL = Object.keys(PROPS).filter((k) => { const p = PROPS[k]; return p.gun || p.hook || p.net || p.chain || p.fuse || p.spear || p.pull || p.material === 'shield'; });

it('chaos: every special weapon in a 4-bot brawl, on every era', async () => {
  const problems: string[] = [];
  const t0 = performance.now();
  for (let w = 0; w < SPECIAL.length; w++) {
    const kind = SPECIAL[w], era = eras[w % eras.length];
    const sim = await Sim.create(500 + w, 4, false);
    sim.forceEra = era.id; sim.forceMap = w % 3; sim.give = kind; sim.reset();
    for (const f of sim.fighters.slice(1)) { // (fighter 1 gets it from `give`; the others too)
      const t = f.torso.body.translation();
      if (f.stick && f.grip) placeLoose(sim.world, f, t.x - 2 * f.side, t.y, 0);
      sim.spawnItem(kind, t.x, t.y - 1.5);
      (sim as unknown as Internals).acquire(f, { kind: 'prop', index: sim.props.length - 1 });
    }
    const bots = sim.fighters.map((_, i) => new Bot(900 + i * 13 + w));
    let deaths = 0, shots = 0, worst = 0;
    try {
      for (let i = 0; i < 1800; i++) {
        const t1 = performance.now();
        sim.step(sim.fighters.map((f, k) => bots[k].think(sim, f)));
        if (i > 60) worst = Math.max(worst, performance.now() - t1); // (not while it warms up)
        for (const e of sim.events) { if (e.t === 'die') deaths++; if (e.t === 'shot') shots++; }
        const bad = sim.fighters.flatMap((f) => f.parts.map((p) => ({ f, p }))).find(({ f, p }) => {
          const t = p.body.translation(), v = p.body.linvel();
          return ![t.x, t.y, v.x, v.y, f.hp].every(Number.isFinite) || (!f.limp && Math.hypot(v.x, v.y) > 150);
        });
        if (bad) { problems.push(`${kind} in ${era.id}: fighter ${bad.f.index}'s ${bad.p.role} broke at frame ${i}`); break; }
      }
    } catch (e) { problems.push(`${kind} in ${era.id} (map ${w % 3}): threw ${(e as Error).stack?.split('\n').filter((l) => !l.includes('wasm://')).slice(0, 5).join(' | ')}`); }
    if (worst > 50) problems.push(`${kind} in ${era.id}: a frame took ${worst.toFixed(0)} ms`);
    console.log(`${kind.padEnd(16)} ${era.id.padEnd(11)} map ${w % 3}: ${deaths} deaths, ${shots} shots, slowest frame ${worst.toFixed(1)} ms`);
  }
  console.log(`chaos: ${SPECIAL.length} weapons in ${((performance.now() - t0) / 1000).toFixed(0)} s; problems: ${problems.length ? '\n' + problems.join('\n') : 'none'}`);
  expect(problems).toEqual([]);
});

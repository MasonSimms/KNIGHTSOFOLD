import { describe, expect, it } from 'vitest';
import { Mirror, takeSnapshot } from '../net/snapshot';
import type { Snapshot } from '../net/snapshot';
import { PROP_KINDS } from '../content/props';
import { placeLoose } from './fighter';
import type { Fighter, Part } from './fighter';
import type { PlayerInput, SimEvent } from './types';
import { Sim } from './world';

// Chain weapons (owner, weapons batch two step 3): the Golden Flail and the Chain Mace are a handle and a head on a real chain.
const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });
type Internals = { acquire(f: Fighter, item: { kind: 'prop'; index: number }): void; addProp(kind: string, x: number, y: number): void };
const tipOf = (p: Part) => { const t = p.body.translation(), r = p.body.rotation(), h = (p.weapon?.length ?? 1) / 2; return { x: t.x + Math.cos(r) * h, y: t.y + Math.sin(r) * h }; };

async function armed(kind: string, seed = 5) {
  const sim = await Sim.create(seed);
  for (let i = 0; i < 30; i++) sim.step([idle()]);
  const f = sim.fighters[0], t = f.torso.body.translation();
  if (f.stick) placeLoose(sim.world, f, t.x - 3 * f.side, t.y, 0);
  sim.spawnItem(kind, t.x, t.y - 1.5);
  (sim as unknown as Internals).acquire(f, { kind: 'prop', index: sim.props.findIndex((p) => p.weapon?.id === kind && !p.chainOf) });
  for (let i = 0; i < 20; i++) sim.step([idle()]);
  return { sim, f };
}

describe('chain weapons', () => {
  it.each(['flail', 'chain-mace'])('%s: lying loose, its head hangs on its chain; in a hand, the head is part of the fighter and swings', async (kind) => {
    const sim = await Sim.create(5);
    sim.spawnItem(kind, 8, 5);
    for (let i = 0; i < 90; i++) sim.step([idle()]);
    const handle = sim.props.find((p) => p.weapon?.id === kind && !p.chainOf)!, head = handle.head!;
    expect(head.chainOf).toBe(handle);
    expect(sim.props.indexOf(head)).toBe(sim.props.indexOf(handle) + 1);
    const tip = tipOf(handle), h = head.body.translation();
    expect(Math.hypot(h.x - tip.x, h.y - tip.y)).toBeLessThan(0.5); // (within its chain)
    const { sim: s2, f } = await armed(kind);
    const st = f.stick!;
    expect(st.weapon?.id).toBe(kind);
    expect(f.parts.includes(st.head!)).toBe(true);
    expect(st.head!.role).toBe('flail');
    expect(s2.props.includes(st.head!)).toBe(false);
    const y0 = st.head!.body.translation().y;
    for (let i = 0; i < 20; i++) s2.step([idle({ aim: i % 10 < 5 ? -1.5 : 1.5 })]); // the arm whips up and down: the head flies about
    expect(Math.abs(st.head!.body.translation().y - y0)).toBeGreaterThan(0.05);
  });

  it('the head is what hits: a swing lands a hit from it, in the weapon\'s name', async () => {
    const { sim, f } = await armed('flail');
    const dummy = sim.fighters[1];
    const hits: SimEvent[] = [];
    for (let i = 0; i < 400 && !hits.length; i++) {
      const me = f.torso.body.translation(), them = dummy.torso.body.translation(), dx = them.x - me.x;
      const close = Math.abs(dx) < 1.3, aim = Math.atan2(them.y - me.y, dx);
      sim.step([idle({ moveX: close ? 0 : Math.sign(dx), aim: close ? aim + (i % 16 < 8 ? -1.6 : 1.2) : aim, attack: close && i % 30 < 20 })]);
      hits.push(...sim.events.filter((e) => e.t === 'hit' && e.victim === 1).map((e) => ({ ...e })));
    }
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].w).toBe('flail');
  });

  it('dropped for something else, the flail lies down whole: handle and head both loose things again', async () => {
    const { sim, f } = await armed('chain-mace');
    const st = f.stick!, t = f.torso.body.translation();
    sim.spawnItem('plank', t.x, t.y - 1.5);
    (sim as unknown as Internals).acquire(f, { kind: 'prop', index: sim.props.length - 1 });
    expect(f.stick?.weapon?.id).toBe('plank');
    expect(sim.props.includes(st)).toBe(true);
    expect(sim.props.includes(st.head!)).toBe(true);
    expect(f.parts.includes(st.head!)).toBe(false);
    expect(st.head!.role).toBe('prop');
    for (let i = 0; i < 60; i++) sim.step([idle()]);
    expect(Number.isFinite(st.head!.body.translation().x)).toBe(true);
  });

  it('online: a flail that arrives, is picked up and swung stays in step on the page (the head is part of both copies)', async () => {
    const server = await Sim.create(9, 2, false), client = await Sim.create(9, 2, false);
    const mirror = new Mirror(client), wire = (s: Snapshot): Snapshot => JSON.parse(JSON.stringify(s));
    let frame = 0;
    const tick = (input: PlayerInput, extra: SimEvent[] = []) => { server.step([input, idle()]); frame++; mirror.push(wire(takeSnapshot(server, frame, [...extra, ...server.events.map((e) => ({ ...e }))]))); mirror.show(frame); };
    for (let i = 0; i < 30; i++) tick(idle());
    const f = server.fighters[0], t = f.torso.body.translation();
    (server as unknown as Internals).addProp('flail', t.x + 0.6 * f.side, t.y - 0.3); // (as the spawner does, with its event)
    tick(idle(), [{ t: 'spawn', x: t.x + 0.6 * f.side, y: t.y - 0.3, v: PROP_KINDS.indexOf('flail'), owner: -1, victim: -1 }]);
    expect(client.props.length).toBe(server.props.length);
    tick(idle({ drop: true })); // let go of what you hold...
    for (let i = 0; i < 20; i++) tick(idle());
    for (let i = 0; i < 30 && f.stick?.weapon?.id !== 'flail'; i++) tick(idle({ drop: i % 2 === 0, aim: f.side > 0 ? 0.6 : Math.PI - 0.6 })); // ...and take the flail
    expect(f.stick?.weapon?.id).toBe('flail');
    for (let i = 0; i < 60; i++) tick(idle({ aim: i % 10 < 5 ? -1.5 : 1.5 }));
    expect(mirror.desyncs).toBe(0);
    expect(client.fighters[0].parts.length).toBe(f.parts.length);
    expect(client.props.length).toBe(server.props.length);
  });
});

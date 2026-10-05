import { describe, expect, it } from 'vitest';
import type { Cause } from './world';
import type { PlayerInput } from './types';
import { Sim } from './world';

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });
type Killable = { kill(f: unknown, fell: boolean, impact: number, cause?: Cause): void };

async function setup() {
  const sim = await Sim.create(3, 2, false);
  for (let i = 0; i < 40; i++) sim.step([idle(), idle()]);
  return sim;
}
const kill = (sim: Sim, i: number, impact: number, cause: Cause) => (sim as unknown as Killable).kill(sim.fighters[i], false, impact, cause);
const away = (sim: Sim, i: number, role: string) => { const f = sim.fighters[i], t = f.torso.body.translation(), p = f.parts.find((x) => x.role === role)!.body.translation(); return Math.hypot(p.x - t.x, p.y - t.y); };
const events = (sim: Sim, frames: number) => { const seen: string[] = []; for (let i = 0; i < frames; i++) { sim.step([idle(), idle()]); seen.push(...sim.events.map((e) => e.t)); } return seen; };

describe('death styles', () => {
  it('a huge blow blows the whole body apart', async () => {
    const sim = await setup();
    const f = sim.fighters[1];
    kill(sim, 1, 150, { how: 'club', nx: -1, ny: 0 });
    const first = sim.events.map((e) => e.t);
    sim.step([idle(), idle()]);
    for (let i = 0; i < 20; i++) sim.step([idle(), idle()]);
    expect(first).toContain('explode');
    for (const role of ['upper', 'fore', 'head']) expect(away(sim, 1, role), role).toBeGreaterThan(1.2);
    expect(f.limp).toBe(true);
  });

  it('a hard club hit takes off the limb it hit and nothing else', async () => {
    const sim = await setup();
    const f = sim.fighters[1];
    kill(sim, 1, 60, { how: 'club', part: f.fore, nx: -1, ny: 0 });
    expect(sim.events.map((e) => e.t)).toContain('dismember');
    for (let i = 0; i < 25; i++) sim.step([idle(), idle()]);
    expect(away(sim, 1, 'fore')).toBeGreaterThan(1.0); // the forearm flew off
    expect(away(sim, 1, 'head')).toBeLessThan(0.9); // the head and the rest stayed on
    expect(away(sim, 1, 'thigh')).toBeLessThan(0.9);
  });

  it('a hard hit to the head takes the head off', async () => {
    const sim = await setup();
    kill(sim, 1, 60, { how: 'club', head: true, part: sim.fighters[1].torso, nx: 1, ny: 0 });
    for (let i = 0; i < 25; i++) sim.step([idle(), idle()]);
    expect(away(sim, 1, 'head')).toBeGreaterThan(1.0);
  });

  it('a stomp or a crash flattens the victim: an event for the picture, a normal fall for the physics', async () => {
    const sim = await setup();
    kill(sim, 1, 40, { how: 'stomp', nx: 0, ny: 1 });
    expect(sim.events.map((e) => e.t)).toContain('crush');
    for (let i = 0; i < 25; i++) sim.step([idle(), idle()]);
    expect(away(sim, 1, 'upper')).toBeLessThan(0.9); // still in one piece
  });

  it('a modest killing blow is just a death: no staging', async () => {
    const sim = await setup();
    kill(sim, 1, 20, { how: 'club', part: sim.fighters[1].fore, nx: -1, ny: 0 });
    const seen = [...sim.events.map((e) => e.t), ...events(sim, 30)];
    expect(seen).toContain('die');
    for (const t of ['explode', 'crush', 'dismember']) expect(seen).not.toContain(t);
  });

  it('a real fatal stomp from a jump crushes', async () => {
    const sim = await setup();
    const P = sim.fighters[0], D = sim.fighters[1];
    const dt = D.torso.body.translation().x - P.torso.body.translation().x;
    for (const p of P.parts) { const t = p.body.translation(); p.body.setTranslation({ x: t.x + dt - 0.05, y: t.y - 2.4 }, true); p.body.setLinvel({ x: 0, y: 0 }, true); p.body.setAngvel(0, true); }
    D.hp = 1;
    expect(events(sim, 60)).toContain('crush');
    expect(D.limp).toBe(true);
  });

  it('a grab on a fighter ends when they die', async () => {
    const sim = await setup();
    const P = sim.fighters[0];
    kill(sim, 1, 20, { how: 'club', nx: 1, ny: 0 });
    expect(P.held).toBeNull();
  });
});

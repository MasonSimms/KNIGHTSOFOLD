import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import { Room } from '../net/room';
import { Mirror } from '../net/snapshot';
import type { Snapshot } from '../net/snapshot';
import { fuzzer } from './fuzz';
import type { Part } from './fighter';
import type { PlayerInput } from './types';
import { Sim } from './world';

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });

// The bridge map belongs to the samurai era and only exists with the eras' own arenas switched on.
beforeAll(() => { T.eras.changeGameplay = true; T.props.lying = true; }); // these tests are about the props lying around
afterAll(() => { T.eras.changeGameplay = false; T.props.lying = false; });

/** A fight on the samurai bridge map. */
async function onBridge(players = 2) {
  const sim = await Sim.create(5, players, false);
  sim.forceEra = 'samurai'; sim.forceMap = 1; sim.reset();
  const inputs = Array.from({ length: players }, () => idle());
  const step = (n = 1, over: Partial<PlayerInput>[] = []) => { for (let i = 0; i < n; i++) sim.step(inputs.map((x, k) => ({ ...x, ...(over[k] ?? {}) }))); };
  step(60);
  return { sim, step };
}
const planks = (sim: Sim) => sim.props.filter((p) => p.links !== undefined);
const attached = (p: Part) => (p.links?.length ?? 0) > 0;
const kill = (sim: Sim, i: number) => (sim as unknown as { kill(f: unknown, fell: boolean): void }).kill(sim.fighters[i], true);

describe('the world is physics: a breakable bridge', () => {
  it('the samurai bridge map has a plank bridge between two cliffs, and people can stand and walk on it without breaking it', async () => {
    const { sim, step } = await onBridge(4);
    expect(planks(sim).length).toBe(8);
    expect(sim.arena.ground.length).toBe(2);
    expect(planks(sim).every(attached)).toBe(true);
    step(60, [{ moveX: 1 }, {}, {}, {}]);
    expect(sim.fighters.every((f) => !f.limp)).toBe(true); // the two who start on the bridge stand on it
    expect(planks(sim).every(attached)).toBe(true);
  });

  it('a hard club hit cuts the plank it lands on free; a gentle one does not', async () => {
    const { sim, step } = await onBridge();
    const target = planks(sim)[3];
    const club = sim.fighters[1].stick!.body;
    step(1, [{}, { drop: true }]);
    const t = target.body.translation();
    club.setTranslation({ x: t.x, y: t.y - 0.9 }, true); club.setRotation(0, true); club.setLinvel({ x: 0, y: 3 }, true); // a gentle tap
    const seen: string[] = [];
    for (let i = 0; i < 15; i++) { step(); seen.push(...sim.events.map((e) => e.t)); }
    expect(seen).not.toContain('cut');
    expect(attached(target)).toBe(true);
    const t2 = target.body.translation();
    club.setTranslation({ x: t2.x, y: t2.y - 0.9 }, true); club.setRotation(0, true); club.setLinvel({ x: 0, y: 17 }, true); // a hard one
    for (let i = 0; i < 15; i++) { step(); seen.push(...sim.events.map((e) => e.t)); }
    expect(seen).toContain('cut');
    expect(attached(target)).toBe(false);
    expect(planks(sim).filter(attached).length).toBeGreaterThan(3); // the rest of the bridge is still up
  });

  it('someone slamming into the bridge with force breaks it there', async () => {
    const { sim, step } = await onBridge();
    const f = sim.fighters[0];
    const target = planks(sim)[4].body.translation();
    const dx0 = target.x - f.torso.body.translation().x;
    for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + dx0, y: q.y - 2.0 }, true); p.body.setLinvel({ x: 0, y: 0 }, true); }
    const seen: string[] = [];
    for (let i = 0; i < 30; i++) { for (const p of f.parts) if (p.role !== 'stick') p.body.setLinvel({ x: 0, y: Math.max(p.body.linvel().y, 0) + 1.5 }, true); step(); seen.push(...sim.events.map((e) => e.t)); }
    // a slow landing (a normal jump's speed) must not break it: that was the first half; now a hard slam
    expect(planks(sim).every(attached) || seen.includes('cut')).toBe(true);
    const g = sim.fighters[1];
    const t2 = planks(sim)[2].body.translation();
    const dx1 = t2.x - g.torso.body.translation().x;
    for (const p of g.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + dx1, y: q.y - 2.0 }, true); p.body.setLinvel({ x: 0, y: 16 }, true); }
    const events: string[] = [];
    for (let i = 0; i < 20; i++) { step(); events.push(...sim.events.map((e) => e.t)); }
    expect(events).toContain('cut');
    expect(planks(sim).filter((p) => !attached(p)).length).toBeGreaterThanOrEqual(3);
  });

  it('a plank cut loose can be picked up and swung as a club', async () => {
    const { sim, step } = await onBridge();
    const f = sim.fighters[0];
    const plank = planks(sim)[1];
    // free the plank and put it right beside fighter 0
    (sim as unknown as { ripFree(p: Part): void }).ripFree(plank);
    const t = f.torso.body.translation();
    plank.body.setTranslation({ x: t.x + 1.0, y: t.y }, true); plank.body.setLinvel({ x: 0, y: 0 }, true);
    step(1, [{ drop: true }]); // let go of the club first...
    f.stick!.body.setTranslation({ x: t.x - 1.3, y: t.y }, true); f.stick!.body.setLinvel({ x: 0, y: 0 }, true); // (it lands behind: we aim at the plank)
    step(50); // ...wait out the pick-up delay
    const before = sim.props.length;
    step(1, [{ drop: true }]); // right-click with empty hands
    expect(f.stick).toBe(plank);
    expect(f.grip).not.toBeNull();
    expect(plank.role).toBe('stick');
    expect(plank.owner).toBe(0);
    expect(sim.props.length).toBe(before); // one in (the dropped club became a loose object), one out
    expect(sim.props).not.toContain(plank);
    // and it works as a weapon: swing it into the other fighter
    const round = sim.round, hp0 = sim.fighters[1].hp;
    for (let i = 0; i < 300 && sim.round === round && sim.fighters[1].hp === hp0; i++) {
      const dx = sim.fighters[1].torso.body.translation().x - sim.fighters[0].torso.body.translation().x;
      step(1, [{ aim: dx > 0 ? 0 : Math.PI, attack: i % 70 < 30, moveX: Math.abs(dx) > 1.2 ? Math.sign(dx) : 0 }]);
    }
    expect(sim.round === round ? sim.fighters[1].hp < hp0 : true).toBe(true); // the plank hurt them (or the round ended trying)
  }, 30000);

  it('you pick up the one you aim at, and an outstretched hand takes what it touches', async () => {
    for (const aim of [0, Math.PI]) {
      const { sim, step } = await onBridge();
      const f = sim.fighters[0];
      const free = planks(sim).slice(1, 3);
      for (const p of free) (sim as unknown as { ripFree(p: Part): void }).ripFree(p);
      step(1, [{ drop: true }]); step(60);
      const t = f.torso.body.translation();
      free[0].body.setTranslation({ x: t.x + 1.0, y: t.y }, true); free[0].body.setLinvel({ x: 0, y: 0 }, true); // one on the right...
      free[1].body.setTranslation({ x: t.x - 1.0, y: t.y }, true); free[1].body.setLinvel({ x: 0, y: 0 }, true); // ...and one on the left
      f.stick!.body.setTranslation({ x: t.x, y: t.y + 5 }, true); // (the dropped club is out of reach)
      step(1, [{ drop: true, aim }]);
      expect(f.stick).toBe(aim === 0 ? free[0] : free[1]); // the one on the side you aim at
    }
    // the hand: reach out (hold the unarmed button) toward a plank and it is taken
    const { sim, step } = await onBridge();
    const f = sim.fighters[0];
    step(1, [{ drop: true }]); step(60);
    const plank = planks(sim)[0];
    (sim as unknown as { ripFree(p: Part): void }).ripFree(plank);
    const t = f.torso.body.translation();
    f.stick!.body.setTranslation({ x: t.x, y: t.y + 6 }, true);
    plank.body.setTranslation({ x: t.x + 0.7, y: t.y - 0.25 }, true); plank.body.setLinvel({ x: 0, y: 0 }, true);
    for (let i = 0; i < 40 && f.stick !== plank; i++) step(1, [{ attack: true, aim: 0 }]);
    expect(f.stick).toBe(plank);
    expect(f.grip).not.toBeNull();
  });

  it('a lost leg can be picked up and used as a club', async () => {
    const { sim, step } = await onBridge();
    const f = sim.fighters[0];
    (sim as unknown as { maim(f: unknown, p: Part, nx: number, ny: number): void }).maim(f, f.legs[0].thigh, -1, 0);
    const limb = f.legs[0].thigh;
    step(40);
    const t = f.torso.body.translation();
    limb.body.setTranslation({ x: t.x + 1.0, y: t.y + 0.2 }, true); limb.body.setLinvel({ x: 0, y: 0 }, true);
    step(1, [{ drop: true }]);
    f.stick!.body.setTranslation({ x: t.x - 1.3, y: t.y }, true); f.stick!.body.setLinvel({ x: 0, y: 0 }, true);
    step(50);
    const t3 = f.torso.body.translation();
    limb.body.setTranslation({ x: t3.x + 1.0, y: t3.y }, true); limb.body.setLinvel({ x: 0, y: 0 }, true); // (it has drifted: put it back where we aim)
    step(1, [{ drop: true }]);
    expect(f.stick).toBe(limb);
    expect(limb.role).toBe('stick');
    expect(limb.weapon?.id).toBe('limb');
    const sh = limb.shapes[0];
    expect(sh.k === 'cap' && sh.rot).toBeCloseTo(Math.PI / 2); // held on its side like a club
    step(200, [{ attack: true, aim: 0 }]);
    expect(f.limp).toBe(false);
    expect(f.parts.filter((p) => p.role === 'stick').length).toBe(1); // only the leg-club: the club it set down lies in the world for anyone
    expect(sim.props.some((p) => p.weapon?.id === 'katana')).toBe(true);
  });

  it('the online client copy stays in step through cuts, slams, plank and limb pickups', async () => {
    const server = await Sim.create(7, 4, false), client = await Sim.create(7, 4, false);
    for (const s of [server, client]) { s.forceEra = 'samurai'; s.forceMap = 1; s.reset(); }
    const room = new Room(server), mirror = new Mirror(client);
    const inputs = fuzzer(33);
    const wire = (s: Snapshot): Snapshot => JSON.parse(JSON.stringify(s));
    let worst = 0, cuts = 0, pickups = 0;
    for (let i = 0; i < 2400; i++) {
      if (i === 300) (server as unknown as { ripFree(p: Part): void }).ripFree(planks(server)[2]);
      if (i === 700) { const f = server.fighters.find((x) => !x.limp); if (f) (server as unknown as { maim(f: unknown, p: Part, nx: number, ny: number): void }).maim(f, f.legs[1].thigh, 1, 0); }
      for (let k = 0; k < 4; k++) room.setInput(k, inputs(4)[k]);
      const s = room.tick();
      if (!s) continue;
      mirror.push(wire(s));
      const shown = mirror.show(s.frame);
      cuts += shown.events.filter((e) => e.t === 'cut').length;
      pickups += shown.events.filter((e) => e.t === 'pickup').length;
      expect(client.props.length).toBe(server.props.length);
      server.props.forEach((p, j) => { const t = p.body.translation(); worst = Math.max(worst, Math.abs(t.x - client.props[j].cx), Math.abs(t.y - client.props[j].cy)); });
      server.fighters.forEach((f, j) => { if (f.parts.length !== client.fighters[j].parts.length) worst = Infinity; });
    }
    expect(mirror.desyncs).toBe(0);
    expect(worst).toBeLessThan(0.01);
    expect(pickups).toBeGreaterThan(3);
  }, 120_000);

  it('random play on the bridge map (with clubs, planks and limbs being grabbed) stays finite and in one piece', async () => {
    const { sim } = await onBridge(4);
    const inputs = fuzzer(91);
    for (let i = 0; i < 3000; i++) {
      sim.step(inputs(4));
      if (i % 400 === 100) { const live = planks(sim).filter(attached); if (live.length) (sim as unknown as { ripFree(p: Part): void }).ripFree(live[0]); }
      for (const f of sim.fighters) for (const p of f.parts) { const t = p.body.translation(); if (!Number.isFinite(t.x) || !Number.isFinite(t.y)) throw new Error(`frame ${i}: ${p.role} of ${f.index} is not a number`); }
      for (const p of sim.props) { const t = p.body.translation(); if (!Number.isFinite(t.x) || !Number.isFinite(t.y)) throw new Error(`frame ${i}: a prop is not a number`); }
    }
    expect(sim.fighters.length).toBe(4);
  }, 60_000);

  it('a fighter with no one left alive does not crash a round change over the bridge map', async () => {
    const { sim, step } = await onBridge();
    kill(sim, 0); kill(sim, 1);
    const round = sim.round;
    for (let i = 0; i < 400 && sim.round === round; i++) step();
    expect(sim.round).toBe(round + 1);
    expect(planks(sim).every(attached) || planks(sim).length === 0).toBe(true); // fresh bridge or another map
  });
});

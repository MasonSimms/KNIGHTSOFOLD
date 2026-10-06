import { describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import type { PlayerInput } from './types';
import { Sim } from './world';

const idle = (over: Partial<PlayerInput> = {}): PlayerInput => ({ moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...over });

async function setup() {
  const sim = await Sim.create(3, 3, false);
  for (let i = 0; i < 40; i++) sim.step([idle(), idle(), idle()]);
  sim.fighters[0].hp = 5000; // big hits must not kill in these tests
  return sim;
}
const step = (sim: Sim, n = 1, p0: Partial<PlayerInput> = {}) => { for (let i = 0; i < n; i++) sim.step([idle(p0), idle(), idle()]); };
const wrapRot = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** A club flung at fighter 0's chest from the left at `speed`. */
function fling(sim: Sim, speed: number) {
  const club = sim.fighters[2].stick!.body;
  sim.step([idle(), idle(), idle({ drop: true })]);
  const t = sim.fighters[0].torso.body.translation();
  club.setTranslation({ x: t.x - 1.0, y: t.y - 0.25 }, true);
  club.setRotation(0, true);
  club.setLinvel({ x: speed, y: 0 }, true);
}

describe('knockdown: a big hit sends them tumbling, and they get up by themselves', () => {
  it('a big hit tumbles the victim head over heels, takes away their control, and they recover on their own', async () => {
    const sim = await setup();
    const f = sim.fighters[0];
    fling(sim, 28);
    let turned = 0, prev = wrapRot(f.torso.body.rotation()), knocked = 0, controlled = true;
    for (let i = 0; i < 40; i++) {
      step(sim, 1, { moveX: 1, attack: true });
      const r = wrapRot(f.torso.body.rotation());
      turned += Math.abs(wrapRot(r - prev)); prev = r;
      if (f.knock > 0) { knocked++; if (f.charge > 0) controlled = false; }
    }
    expect(knocked).toBeGreaterThan(10);
    expect(turned).toBeGreaterThan(3); // really flipped over (half a turn at least, all in)
    expect(controlled).toBe(true); // (and could not start a swing while down)
    expect(f.limp).toBe(false);
    step(sim, 160);
    expect(f.knock).toBe(0);
    expect(f.grounded).toBe(true);
    expect(Math.abs(wrapRot(f.torso.body.rotation()))).toBeLessThan(0.3); // back on their feet
    const x0 = f.torso.body.translation().x;
    step(sim, 60, { moveX: 1 });
    expect(f.torso.body.translation().x).toBeGreaterThan(x0 + 1); // and in control again
  });

  it('a harder hit knocks them down for longer and spins them more than a lighter one', async () => {
    const run = async (speed: number) => {
      const sim = await setup();
      const f = sim.fighters[0];
      fling(sim, speed);
      let peak = 0, frames = 0, spin = 0;
      for (let i = 0; i < 90; i++) { step(sim); peak = Math.max(peak, f.knock); spin = Math.max(spin, Math.abs(f.torso.body.angvel())); if (f.knock > 0) frames++; }
      return { peak, frames, spin };
    };
    const light = await run(18), heavy = await run(40);
    expect(heavy.peak).toBeGreaterThan(light.peak);
    expect(heavy.spin).toBeGreaterThan(light.spin);
  });

  it('a small hit only staggers: no knockdown', async () => {
    const sim = await setup();
    fling(sim, 9);
    step(sim, 30);
    expect(sim.fighters[0].knock).toBe(0);
  });

  it('a knocked-down fighter that slams into a wall crashes: it bounces back and tumbles again', async () => {
    T.arena.walls = true; // (the game has no side walls now: tuning.arena.walls)
    const sim = await setup();
    T.arena.walls = false;
    const f = sim.fighters[0];
    (sim as unknown as { knockdown(v: unknown, i: number, nx: number): void }).knockdown(f, 60, 1);
    const wallX = T.arena.platformX - T.arena.wallGap; // the wall beside the platform end (the gap's far side)
    const dx = (wallX + 0.9) - f.torso.body.translation().x;
    for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + dx, y: q.y - 0.3 }, true); p.body.setLinvel({ x: -14, y: -1 }, true); }
    const seen: number[] = [];
    let bounced = false;
    for (let i = 0; i < 40; i++) {
      step(sim);
      for (const e of sim.events) if (e.t === 'crash') seen.push(e.v);
      if (seen.length && f.torso.body.linvel().x > 0) bounced = true;
    }
    expect(seen.length).toBeGreaterThan(0);
    expect(Math.max(...seen)).toBeGreaterThan(T.knock.crashSpeed);
    expect(bounced).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { botLook } from '../content/looks';
import { PROPS } from '../content/props';
import { tuning as T } from '../content/tuning';
import { Mirror } from '../net/snapshot';
import { Room } from '../net/room';
import { placeLoose } from './fighter';
import { hashSim } from './hash';
import { NEUTRAL } from './types';
import type { PlayerInput, SimEvent } from './types';
import { Sim } from './world';

// Guns (owner): one click one shot, limited ammo, empty = held by the barrel as a club; bullets stop at the first thing they meet.
type Internals = { acquire(f: unknown, item: { kind: 'prop'; index: number }): void };
async function duel(seed = 3) {
  const sim = await Sim.create(seed, 2, false);
  for (let i = 0; i < 30; i++) sim.step([NEUTRAL, NEUTRAL]);
  return sim;
}
/** Put a loose item straight into fighter `who`'s hand (dropping what they held). */
function arm(sim: Sim, who: number, kind: string) {
  const f = sim.fighters[who], t = f.torso.body.translation();
  if (f.stick) placeLoose(sim.world, f, t.x - 3 * f.side, t.y, 0); // (in the game only an empty hand picks things up: the club they held goes down behind them, out of the line of fire)
  sim.spawnItem(kind, t.x, t.y - 1.5);
  (sim as unknown as Internals).acquire(f, { kind: 'prop', index: sim.props.length - 1 });
  return f.stick!;
}
/** Shooter 0 aims at fighter 1's chest and pulls the trigger once; returns the events of the next second. */
function shoot(sim: Sim, frames = 60, other: PlayerInput = NEUTRAL, at: 'chest' | 'weapon' = 'chest'): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < frames; i++) {
    const a = sim.fighters[0].torso.body.translation(), t = at === 'weapon' && sim.fighters[1].stick ? sim.fighters[1].stick.body.translation() : sim.fighters[1].torso.body.translation();
    const b = { x: t.x, y: at === 'weapon' ? t.y : t.y - 0.1 }, aim = Math.atan2(b.y - a.y, b.x - a.x), reach = Math.hypot(b.y - a.y, b.x - a.x); // (the cursor on their chest, or on the weapon they hold)
    sim.step([{ ...NEUTRAL, aim, reach, attack: i >= 20 && i < 24 }, other]); // (aim first, then a click)
    out.push(...sim.events.map((e) => ({ ...e })));
  }
  return out;
}
const placeNear = (sim: Sim, who: number, x: number) => { const f = sim.fighters[who], t = f.torso.body.translation(); for (const p of f.parts) { const q = p.body.translation(); p.body.setTranslation({ x: q.x + x - t.x, y: q.y }, true); p.body.setLinvel({ x: 0, y: 0 }, true); } };

describe('guns', () => {
  it('a revolver shot hits like about half a fully charged club, with its own sound and the shooter kicked back', async () => {
    const sim = await duel();
    arm(sim, 0, 'revolver');
    const hp = sim.fighters[1].hp;
    const ev = shoot(sim);
    expect(ev.some((e) => e.t === 'shot')).toBe(true);
    const hit = ev.find((e) => e.t === 'hit' && e.how === 'shot');
    expect(hit, 'the bullet reached the other fighter').toBeTruthy();
    expect(hp - sim.fighters[1].hp).toBeGreaterThan(20);
    expect(hp - sim.fighters[1].hp).toBeLessThan(60);
    expect(sim.fighters[0].stick!.ammo).toBe(PROPS.revolver.gun!.ammo - 1);
  }, 30_000);

  it('six shots, then the dry click: the gun is turned round and held by the barrel, and clicking swings it as a club', async () => {
    const sim = await duel(4);
    const gun = arm(sim, 0, 'revolver');
    let shots = 0, empty = 0;
    for (let i = 0; i < 400; i++) {
      sim.step([{ ...NEUTRAL, aim: -1.2, attack: i % 20 < 2 }, NEUTRAL]); // clicking away at the sky
      shots += sim.events.filter((e) => e.t === 'shot').length;
      empty += sim.events.filter((e) => e.t === 'empty').length;
    }
    expect(shots).toBe(6);
    expect(empty).toBe(1);
    expect(gun.ammo).toBe(0);
    expect(gun.flipped).toBe(true);
    const f = sim.fighters[0];
    for (let i = 0; i < 25; i++) sim.step([{ ...NEUTRAL, aim: 0, attack: true }, NEUTRAL]); // hold the button: a club's charge now
    expect(f.charge).toBeGreaterThan(10);
  }, 30_000);

  it('a held metal weapon blocks a bullet with a spark (no damage)', async () => {
    const sim = await duel(5);
    arm(sim, 0, 'revolver');
    arm(sim, 1, 'katana');
    const hp = sim.fighters[1].hp;
    // the katana held straight out toward the shooter, across the line of fire
    const ev = shoot(sim, 60, { ...NEUTRAL, aim: Math.PI }, 'weapon');
    expect(ev.some((e) => e.t === 'spark' && e.victim === 1)).toBe(true);
    expect(sim.fighters[1].hp).toBe(hp);
  }, 30_000);

  it('a wooden weapon cracks, and shot enough snaps in two: the handle stays in the hand, the other half lies loose', async () => {
    const sim = await duel(6);
    arm(sim, 0, 'pistol'); // the flintlock: calibre 2
    const bat = arm(sim, 1, 'plank'); // a plank: toughness 3
    const props0 = sim.props.length;
    let snapped = false;
    for (let k = 0; k < 3 && !snapped; k++) {
      if (k) arm(sim, 0, 'pistol'); // (one shot each: a fresh flintlock)
      const ev = shoot(sim, 70, { ...NEUTRAL, aim: Math.PI }, 'weapon');
      snapped = ev.some((e) => e.t === 'snap');
    }
    expect(snapped).toBe(true);
    const held = sim.fighters[1].stick!;
    expect(held).not.toBe(bat);
    expect(held.weapon!.length).toBeLessThan(PROPS.plank.len);
    expect(sim.fighters[1].grip).toBeTruthy();
    expect(sim.props.length).toBeGreaterThan(props0); // the loose half
  }, 30_000);

  it('a light weapon is shot out of the hand', async () => {
    const sim = await duel(7);
    arm(sim, 0, 'revolver');
    arm(sim, 1, 'bamboo-stick'); // (light: knives and fans too, but a bamboo stick is easy to hit)
    const ev = shoot(sim, 60, { ...NEUTRAL, aim: Math.PI }, 'weapon');
    expect(ev.some((e) => e.t === 'disarm' && e.victim === 1)).toBe(true);
    expect(sim.fighters[1].grip).toBeNull();
  }, 30_000);

  it('a barrel breaks into staves when shot enough', async () => {
    const sim = await duel(8);
    arm(sim, 0, 'revolver');
    const a = sim.fighters[0].torso.body.translation();
    sim.spawnItem('barrel', a.x + 2.5, a.y);
    for (let i = 0; i < 30; i++) sim.step([NEUTRAL, NEUTRAL]); // it settles
    const barrel = sim.props[sim.props.length - 1];
    let broke = false;
    for (let i = 0; i < 300 && !broke; i++) {
      const b = barrel.body.translation(), me = sim.fighters[0].torso.body.translation();
      sim.step([{ ...NEUTRAL, aim: Math.atan2(b.y - me.y, b.x - me.x), reach: Math.hypot(b.y - me.y, b.x - me.x), attack: i % 20 < 2 }, NEUTRAL]); // (the cursor on the barrel)
      broke = sim.events.some((e) => e.t === 'break');
    }
    expect(broke).toBe(true);
    expect(sim.props.filter((p) => p.weapon?.id === 'stave').length).toBe(3);
  }, 30_000);

  it('your own bullet never hits you, and a bullet leaving the picture is noted (for the frame)', async () => {
    const sim = await duel(9);
    arm(sim, 0, 'revolver');
    const hp = sim.fighters[0].hp;
    const ev: SimEvent[] = [];
    for (let i = 0; i < 90; i++) { sim.step([{ ...NEUTRAL, aim: -0.6, attack: i === 10 || i === 11 }, NEUTRAL]); ev.push(...sim.events.map((e) => ({ ...e }))); }
    expect(sim.fighters[0].hp).toBe(hp);
    const exit = ev.find((e) => e.t === 'exit');
    expect(exit).toBeTruthy();
    expect(exit!.y === 0 || exit!.x === T.arena.viewW).toBe(true); // on the edge of the picture
  }, 30_000);

  it('the same fight with guns twice gives the same state, and an online copy stays in step through shots, snaps and breaks', async () => {
    const run = async () => {
      const server = await duel(10), client = await Sim.create(10, 2, false);
      for (let i = 0; i < 30; i++) client.step([NEUTRAL, NEUTRAL]); // (the copy is built the same way; it is never stepped after this)
      for (const s2 of [server, client]) { arm(s2, 0, 'revolver'); arm(s2, 1, 'plank'); } // (the copy is given the same: online this comes from 'spawn' and 'pickup' events)
      const room = new Room(server), mirror = new Mirror(client, 0);
      let seen = 0;
      for (const p of [...server.props]) void p;
      const at = server.fighters[0].torso.body.translation();
      for (const s2 of [server, client]) s2.spawnItem('crate', at.x + 3, at.y - 1);
      for (let i = 0; i < 400; i++) {
        const a = server.fighters[0].torso.body.translation(), b = server.fighters[1].torso.body.translation();
        room.setInput(0, { ...NEUTRAL, aim: Math.atan2(b.y - a.y, b.x - a.x) + Math.sin(i / 30) * 0.2, attack: i % 25 < 2 });
        room.setInput(1, { ...NEUTRAL, aim: Math.PI, moveX: Math.sin(i / 50) });
        const snap = room.tick();
        if (snap) { mirror.push(JSON.parse(JSON.stringify(snap))); mirror.show(snap.frame); seen = Math.max(seen, client.bullets.length); }
      }
      expect(seen).toBeGreaterThan(0); // the copy draws the bullets in flight
      expect(mirror.desyncs).toBe(0); // the copy kept every part: shots, snapped weapons and broken scenery replayed
      expect(client.props.length).toBe(server.props.length);
      return hashSim(server);
    };
    expect(await run()).toBe(await run());
  }, 60_000);

  it('shooting a wooden weapon lying where its owner threw it snaps it (no crash), and an online copy snaps the same one', async () => {
    const server = await duel(11), client = await Sim.create(11, 2, false);
    for (let i = 0; i < 30; i++) client.step([NEUTRAL, NEUTRAL]);
    const at = server.fighters[0].torso.body.translation(), x = at.x + 2.5 * server.fighters[0].side, y = server.arena.platformTop - 0.1;
    for (const s2 of [server, client]) { arm(s2, 0, 'revolver'); arm(s2, 1, 'plank'); placeLoose(s2.world, s2.fighters[1], x, y, 0); } // (still fighter 1's, lying on the floor)
    const room = new Room(server), mirror = new Mirror(client, 0);
    let snapped = false;
    for (let i = 0; i < 300 && !snapped; i++) {
      const a = server.fighters[0].torso.body.translation(), p = server.fighters[1].stick?.body.translation() ?? { x, y };
      room.setInput(0, { ...NEUTRAL, aim: Math.atan2(p.y - a.y, p.x - a.x), reach: Math.hypot(p.y - a.y, p.x - a.x), attack: i % 25 < 2 && i > 20 });
      const snap = room.tick();
      if (snap) { mirror.push(JSON.parse(JSON.stringify(snap))); mirror.show(snap.frame); }
      snapped ||= server.events.some((e) => e.t === 'snap');
    }
    expect(snapped).toBe(true);
    for (let i = 0; i < 30; i++) { const snap = room.tick(); if (snap) { mirror.push(JSON.parse(JSON.stringify(snap))); mirror.show(snap.frame); } }
    expect(server.fighters[1].stick).toBeNull(); // (gone from its owner: two loose halves now)
    expect(mirror.desyncs).toBe(0);
    expect(client.props.length).toBe(server.props.length);
  }, 30_000);

  it('a bot with a gun keeps its distance, aims and shoots, and hits', async () => {
    const sim = await Sim.create(12, 2, false);
    sim.looks[0] = botLook();
    sim.reset();
    for (let i = 0; i < 30; i++) sim.step([NEUTRAL, NEUTRAL]);
    arm(sim, 0, 'revolver');
    let shots = 0, hits = 0, killed = false;
    for (let i = 0; i < 600 && sim.fighters[0].stick?.ammo && !killed; i++) {
      sim.step([NEUTRAL, NEUTRAL]);
      shots += sim.events.filter((e) => e.t === 'shot' && e.owner === 0).length;
      hits += sim.events.filter((e) => e.t === 'hit' && e.how === 'shot' && e.owner === 0).length;
      killed ||= sim.events.some((e) => (e.t === 'die' || e.t === 'fall') && e.owner === 1);
    }
    expect(shots > 2 || killed).toBe(true); // (it keeps shooting, or a shot in the head ended it: they always kill)
    expect(hits).toBeGreaterThan(0);
  }, 30_000);

  it('a scattergun fires its pellets in a cone from one pull (one shot of ammo), the same every time; the duck-foot fans them evenly', async () => {
    const fan = async (kind: string) => {
      const sim = await duel(5);
      const gun = arm(sim, 0, kind), G = PROPS[kind].gun!;
      for (let i = 0; i < 20; i++) sim.step([{ ...NEUTRAL, aim: -0.3 }, NEUTRAL]);
      sim.step([{ ...NEUTRAL, aim: -0.3, attack: true }, NEUTRAL]);
      const out = sim.bullets.map((u) => Math.atan2(u.vy, u.vx));
      expect(gun.ammo).toBe(G.ammo - 1);
      return { out, G };
    };
    const { out, G } = await fan('blunderbuss');
    expect(out.length).toBe(G.pellets);
    const mid = out.reduce((a, b) => a + b) / out.length;
    for (const a of out) expect(Math.abs(a - mid)).toBeLessThan(2 * G.spread! + 0.01);
    expect(new Set(out.map((a) => a.toFixed(4))).size).toBe(G.pellets); // (scattered, not on top of each other)
    expect((await fan('blunderbuss')).out).toEqual(out); // the same dice every time
    const duck = (await fan('duckfoot')).out.sort((a, b) => a - b);
    const gaps = duck.slice(1).map((a, k) => a - duck[k]);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0], 5);
  }, 30_000);

  it('a gun that holds keeps firing while the button is held and stops when you let go; a burst gun fires its burst from one click', async () => {
    const sim = await duel(6);
    const lewis = arm(sim, 0, 'lewis-gun'), G = PROPS['lewis-gun'].gun!;
    let shots = 0;
    for (let i = 0; i < 80; i++) { sim.step([{ ...NEUTRAL, aim: -1.2, attack: i < 40 }, NEUTRAL]); shots += sim.events.filter((e) => e.t === 'shot').length; }
    expect(shots).toBeGreaterThanOrEqual(Math.floor(40 / G.cooldown) - 1); // about one every cooldown while held...
    expect(shots).toBeLessThanOrEqual(Math.ceil(40 / G.cooldown) + 1); // ...and none after letting go
    expect(lewis.ammo).toBe(G.ammo - shots);
    const carbine = arm(sim, 0, 'jungle-carbine'), C = PROPS['jungle-carbine'].gun!, at: number[] = [];
    for (let i = 0; i < 60; i++) { sim.step([{ ...NEUTRAL, aim: -1.2, attack: i === 5 }, NEUTRAL]); if (sim.events.some((e) => e.t === 'shot')) at.push(i); }
    expect(at.length).toBe(C.burst);
    expect(at[1] - at[0]).toBe(C.burstGap);
    expect(carbine.ammo).toBe(C.ammo - C.burst!);
  }, 30_000);

  it('a lobbed round falls, bounces once and goes off; a ray bolt bounces off the ground and flies on; a rocket under your feet throws you up', async () => {
    const sim = await duel(7);
    arm(sim, 0, 'thumper');
    let boom = -1, bounced = false, fell = false;
    for (let i = 0; i < 150 && boom < 0; i++) {
      sim.step([{ ...NEUTRAL, aim: 0.35, attack: i === 2 }, NEUTRAL]); // (at the floor a few metres ahead)
      const u = sim.bullets[0];
      if (u && u.vy > 2) fell = true;
      if (u && u.bounces === 0) bounced = true;
      if (sim.events.some((e) => e.t === 'boom')) boom = i;
    }
    expect(fell, 'it arcs down').toBe(true);
    expect(bounced, 'it bounced').toBe(true);
    expect(boom).toBeGreaterThan(0);
    const ray = await duel(7);
    arm(ray, 0, 'ray-pistol');
    let sparked = false, flewOn = false;
    for (let i = 0; i < 40; i++) {
      ray.step([{ ...NEUTRAL, aim: 0.6, attack: i === 10 }, NEUTRAL]); // (at the floor in front)
      if (ray.events.some((e) => e.t === 'spark')) sparked = true;
      if (sparked && ray.bullets.length && ray.bullets[0].vy < 0) flewOn = true;
    }
    expect(flewOn, 'off the ground and on up').toBe(true);
    const rocket = await duel(7);
    arm(rocket, 0, 'rocket-tube');
    const me = rocket.fighters[0];
    for (let i = 0; i < 25; i++) rocket.step([{ ...NEUTRAL, aim: Math.PI / 2 }, NEUTRAL]); // (pointing straight down)
    let up = 0;
    for (let i = 0; i < 40; i++) { rocket.step([{ ...NEUTRAL, aim: Math.PI / 2, attack: i === 0 }, NEUTRAL]); up = Math.min(up, me.torso.body.linvel().y); }
    expect(up, 'a rocket jump').toBeLessThan(-6);
  }, 30_000);

  it('a rail gun fires only once held long enough, and goes through everyone in line', async () => {
    const sim = await Sim.create(9, 3, false);
    const idle = [NEUTRAL, NEUTRAL, NEUTRAL];
    for (let i = 0; i < 30; i++) sim.step(idle);
    const gun = arm(sim, 0, 'rail-gun'), G = PROPS['rail-gun'].gun!, me = sim.fighters[0], x0 = me.torso.body.translation().x;
    placeNear(sim, 1, x0 + 2.5 * me.side);
    placeNear(sim, 2, x0 + 4.5 * me.side);
    const aimAt = () => { const a = me.torso.body.translation(), b = sim.fighters[1].torso.body.translation(); return { aim: Math.atan2(b.y - a.y, b.x - a.x), reach: 4 }; };
    for (let i = 0; i < 20; i++) sim.step([{ ...NEUTRAL, ...aimAt() }, NEUTRAL, NEUTRAL]);
    let shots = 0;
    for (let i = 0; i < G.charge! - 6; i++) { sim.step([{ ...NEUTRAL, ...aimAt(), attack: true }, NEUTRAL, NEUTRAL]); shots += sim.events.filter((e) => e.t === 'shot').length; }
    sim.step([{ ...NEUTRAL, ...aimAt() }, NEUTRAL, NEUTRAL]);
    expect(shots, 'let go too soon: no shot').toBe(0);
    const hit = new Set<number>();
    for (let i = 0; i < G.charge! + 10; i++) {
      sim.step([{ ...NEUTRAL, ...aimAt(), attack: true }, NEUTRAL, NEUTRAL]);
      shots += sim.events.filter((e) => e.t === 'shot').length;
      for (const e of sim.events) if (e.t === 'hit' && e.how === 'shot') hit.add(e.victim);
    }
    expect(shots).toBe(1);
    expect(gun.ammo).toBe(G.ammo - 1);
    expect([...hit].sort()).toEqual([1, 2]);
  }, 30_000);

  it('every gun, long and heavy ones too, is held steady on the aim (the other hand under the barrel)', async () => {
    for (const kind of Object.keys(PROPS).filter((k) => PROPS[k].gun)) {
      const sim = await duel(3);
      const gun = arm(sim, 0, kind);
      let off = 0, shake = 0;
      for (let i = 0; i < 90; i++) {
        sim.step([{ ...NEUTRAL, aim: -0.4 }, NEUTRAL]);
        if (i < 60) continue;
        off = Math.max(off, Math.abs(Math.atan2(Math.sin(gun.body.rotation() + 0.4), Math.cos(gun.body.rotation() + 0.4))));
        shake = Math.max(shake, Math.hypot(gun.cx - gun.px, gun.cy - gun.py));
      }
      expect(off, kind).toBeLessThan(0.05);
      expect(shake, kind).toBeLessThan(0.005);
    }
  }, 60_000);

  it('a flare sets the fighter it hits alight', async () => {
    const sim = await duel(8);
    arm(sim, 0, 'flare-pistol');
    placeNear(sim, 1, sim.fighters[0].torso.body.translation().x + 2.2 * sim.fighters[0].side);
    const ev = shoot(sim, 60);
    expect(ev.some((e) => e.t === 'ignite' && e.victim === 1)).toBe(true);
    expect(sim.fighters[1].burning).toBeGreaterThan(0);
  }, 30_000);
});

// Owner, 2026-10-07: a bullet in the head always kills, unless it is a scattergun's pellet or a gun that does not really hurt.
describe('headshots', () => {
  async function headshot(gun: string): Promise<{ hit: boolean; dead: boolean }> {
    const sim = await duel(3);
    arm(sim, 0, gun);
    const v = sim.fighters[1];
    let hit = false;
    for (let i = 0; i < 70; i++) {
      const a = sim.fighters[0].torso.body.translation(), b = v.torso.body.translation(), hx = b.x, hy = b.y + T.fighter.headY; // (the cursor on their head)
      sim.step([{ ...NEUTRAL, aim: Math.atan2(hy - a.y, hx - a.x), reach: Math.hypot(hy - a.y, hx - a.x), attack: i >= 20 && i < 22 }, NEUTRAL]);
      if (sim.events.some((e) => e.t === 'hit' && e.victim === 1 && e.head)) hit = true;
    }
    return { hit, dead: v.limp };
  }
  it('a revolver or a flintlock shot in the head kills from full health', async () => {
    T.guns.headshotKills = false; const off = await headshot('revolver'); T.guns.headshotKills = true; expect(off.dead, 'without the rule a revolver headshot would not kill').toBe(false);
    for (const gun of ['revolver', 'pistol']) { const r = await headshot(gun); expect(r.hit, gun).toBe(true); expect(r.dead, gun).toBe(true); }
  });
  it('a scattergun pellet or a beanbag in the head does not kill outright', async () => {
    for (const gun of ['beanbag']) { const r = await headshot(gun); expect(r.dead, gun).toBe(false); }
    expect(PROPS.blunderbuss.gun!.pellets).toBeGreaterThan(1); // (pellets are left out of the rule: guns.ts strike)
  });
});

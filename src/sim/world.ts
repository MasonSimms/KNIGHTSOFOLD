import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { World } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import { damageFor, impactValue, knockbackFor } from './combat';
import { buildFighter, controlFighter, createProp, cutJoint, dropToWorld, isWeapon, isWorld, takeIn, fighterMass, giveStick, grabJoint, letGo, placeLoose, ragdoll, ropeGroups, setBackPlane, shove, syncStickGroups, terrainGroups } from './fighter';
import type { Attacker, Fighter, Part } from './fighter';
import { eraById } from '../content/eras';
import { ITEMS, PROPS, PROP_KINDS } from '../content/props';
import { weaponById } from '../content/weapons';
import type { Weapon } from '../content/weapons';
import { eraFor, mapFor, outfitsFor } from './era';
import { Bot } from './bot';
import { makeRng } from './rng';
import { applyWater, buildBoat, surfaceY } from './water';
import { applyFire } from './fire';
import { buildChase, loopFloor, stepChase } from './chase';
import type { Chase } from './chase';
import { buildTrain, stepTrain } from './train';
import { buildDoors, stepDoors } from './trapdoor';
import { buildChariot, stepChariot } from './chariot';
import type { Chariot } from './chariot';
import type { Trapdoor } from './trapdoor';
import type { Passing } from './train';
import { applyJets } from './tower';
import { applyFalls } from './falls';
import { crackFloes } from './floe';
import { applyWind } from './wind';
import { aimSpears, fuses, goneOff, stickSpears } from './special';
import { moveHooks } from './hook';
import { moveNets } from './tangle';
import { moveEffects } from './effects';
import type { Zone } from './effects';
import type { Hook } from './hook';
import type { Jet } from './tower';
import { breakProp, damageScenery, fire, moveBullets, predictShot, shatter, snapPart, spendShot } from './guns';
import type { Bullet } from './guns';
import type { Boat } from './water';
import type { Look } from '../content/looks';
import { NEUTRAL } from './types';
import type { PlayerInput, SimEvent } from './types';

// Pure game logic: no DOM, no Pixi, no Math.random, no clocks.

let ready: Promise<void> | null = null;
const initRapier = () => (ready ??= RAPIER.init());

/** The training dummy never gets real input: it holds its club in a low guard, facing the player (to its left). */
const DUMMY_INPUT: PlayerInput = { ...NEUTRAL, aim: Math.PI + 1.4 }; // the training dummy holds its club raised (up and toward the left), leaving its chest open to practise on

export type Arena = typeof T.arena;

/** The arena of an era's map: the standard one, or the era's own layout (a pure function, so anyone can ask without building anything). */
export function arenaFor(eraId: string, map: number): Arena {
  const era = eraById(eraId);
  const over: Partial<Arena> = T.eras.changeGameplay ? (map > 0 && era.alt ? era.alt[map - 1] : era.arena) as Partial<Arena> : {};
  return { ...T.arena, ...over } as Arena;
}

/** The top of the floor under x (a slab can stand higher or lower than the main platform: rooftops, a water tower). */
export function floorAt(A: Arena, x: number): number {
  const g = A.ground.find((s) => x >= s.x && x <= s.x + s.w);
  return A.platformTop - (g?.up ?? 0);
}

/** The arena's side walls (see tuning.arena.walls): left edge x and top y of each. Every wall reaches down below the void. */
export const wallsOf = (A: Arena) => A.walls.map((w) => ({ x: w.side < 0 ? A.platformX - w.gap - A.wallThickness : A.platformX + A.platformW + w.gap, top: A.platformTop - w.up }));

/** Something a fighter can pick up. */
type Item = { kind: 'stick'; from: number } | { kind: 'prop'; index: number } | { kind: 'limb'; from: number; k: number };
const itemCode = (i: Item): number => (i.kind === 'stick' ? -1 : i.kind === 'prop' ? 100 + i.index : 1000 + i.from * 10 + i.k); // how a 'pickup' event says what was taken
const decodeItem = (e: { v: number; victim: number }): Item => (e.v < 0 ? { kind: 'stick', from: e.victim } : e.v < 1000 ? { kind: 'prop', index: e.v - 100 } : { kind: 'limb', from: Math.floor((e.v - 1000) / 10), k: (e.v - 1000) % 10 });

/** What killed a fighter, so the death can be staged to fit (crushed, blown apart, a limb lost). */
/** A training change at frame f: an item dropped in at (x, y), or (no item) the loose things cleared away. */
export interface Edit { f: number; item?: string; x?: number; y?: number }
export interface Cause { how: 'club' | 'fist' | 'stomp' | 'body' | 'slam' | 'shot' | 'crush' | 'fire' | 'blast' | 'time'; part?: Part; head?: boolean; nx: number; ny: number }

export class Sim {
  frame = 0;
  version = 0; // bumps whenever bodies are rebuilt, so the renderer knows to rebuild its sprites
  lastImpact = 0;
  events: SimEvent[] = [];
  /** Changes made from outside the fight this round (training drops and clears), with the frame: a replay makes them again. */
  edits: Edit[] = [];
  fighters: Fighter[] = [];
  world!: World;
  private rng: () => number;
  readonly partByBody = new Map<number, Part>(); // (guns.ts reads it too)
  bullets: Bullet[] = []; // bullets in flight (sim/guns.ts)
  hooks: Hook[] = []; // grappling hooks out (sim/hook.ts)
  hookLines: number[] = []; // ...as they are drawn: owner, x, y, caught (1/0) for each (an online copy has these from the snapshot only)
  zones: Zone[] = []; // black holes open (sim/effects.ts; an online copy has where they are from the snapshot, to draw them)
  nextBullet = 0;
  private seed: number;
  private tmpV = { x: 0, y: 0 };
  private tmpN = { x: 0, y: 0 };
  private tmpP = { x: 0, y: 0 };

  scores = [0, 0, 0, 0]; // points per player this match
  era = 'caveman'; // the era of this round (picks the arena look and the outfits)
  outfits = [0, 1, 2, 3]; // which of the era's 4 outfits each fighter wears this round
  forceEra: string | null = null; // testing: ?era=samurai keeps every round in one era
  forceMap: number | null = null; // testing: ?map=1 keeps every round on the era's second map
  give: string | null = null; // testing: ?give=boat-hook puts that item (props.ts) in fighter 1's hand at the start of every round
  // Training (practising alone): who the second fighter is. A standing dummy (with a club, or empty-handed), or a bot that fights back.
  // Either way there are no rounds: whoever dies stands up again. (The bot also needs its look to say bot: the training menu does both.)
  training = { foe: 'dummy' as 'dummy' | 'bot', foeArmed: true };
  map = 0; // which of the era's maps this round is on
  props: Part[] = []; // loose objects in the world (planks, logs...): anyone can pick them up
  bridge: Part[] = []; // the planks of this round's bridge, in order
  bridgeHome: { x: number; y: number }[] = []; // ...and where each one was built (the aqueduct's water pours through where one has gone: falls.ts)
  boats: Boat[] = []; // this round's ships, on a map with them (see water.ts)
  private ropes: Part[][] = []; // the links of each rope, in order (arena.ropes)
  private ropeEnds: { body: RAPIER.RigidBody; ship: Boat; x: number; y: number }[] = []; // rope ends tied on a ship: where on it (see buildRope)
  chase: Chase | null = null; // this round's treadmill and mammoth, on the Mammoth Chase (see chase.ts)
  passing: Passing[] = []; // the signs and tunnels coming past the train (see train.ts)
  doors: Trapdoor[] = []; // the trapdoors in the floor (see trapdoor.ts)
  chariot: Chariot | null = null; // the runaway chariot (see chariot.ts)
  jets: Jet[] = []; // water leaking from the water tower's tank (see tower.ts)
  private cutLinks = new Set<unknown>(); // bridge joints already removed
  private eraOverride: string | null = null; // (a client rebuilding the round the server is in)
  weapon: Weapon = { id: 'club', name: 'Club', ...T.stick }; // what everyone fights with this round (the era's weapon)
  private arenaCache: { key: string; arena: Arena } | null = null;
  private brains: (Bot | null)[] = [null, null, null, null]; // the computer players (a seat whose look says bot), made when first needed
  looks: Look[] = [0, 1, 2, 3].map((color) => ({ color, hat: 'none' as const, eyes: 'round' as const })); // each player's colour, hat and eyes (looks only: nothing in the physics reads them)
  gone = [false, false, false, false]; // players who left (online): dead this round, and parked out of sight in later rounds
  round = 1;
  roundOver = false;
  roundWinner = -1; // index of the winner of the round just finished, or -1 for a draw
  private roundOverAt = 0;
  extraRoundPause = 0; // frames added to the pause between rounds (online: the server waits while everyone watches the round's replay)
  matchOver = false; // the last round is done and someone leads: the crown (tuning.match)
  matchWinner = -1;
  private matchOverAt = 0;
  private nextSpawn = 0; // the frame the next pickup weapon spawns
  private preV = [0, 0, 0, 0, 0, 0, 0, 0]; // each fighter's body velocity (x, y) just before the physics step

  private constructor(seed: number, private count: number, private dummy: boolean) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.reset();
  }

  /**
   * `count` fighters. With `dummy` (the default) fighter 1 is the training dummy and 2+ are extra armed fighters (the ?stress test);
   * without it all `count` fighters are real players in a fight.
   */
  static async create(seed: number, count = 2, dummy = true): Promise<Sim> {
    await initRapier();
    return new Sim(seed, count, dummy);
  }

  /** Playing alone: you and the training dummy. 2-4 players: a real fight with a score. */
  setPlayers(n: number): void {
    if (n <= 1) { this.count = 2; this.dummy = true; }
    else { this.count = Math.min(4, n); this.dummy = false; }
    this.reset();
  }

  /** The arena of the current round: the standard one, or the era's own layout (a pure function of the era, so a client can ask without building anything). */
  get arena(): Arena {
    const guns = this.gunRound(), key = `${this.era}|${this.map}|${T.eras.changeGameplay}|${guns}`;
    if (this.arenaCache?.key !== key) this.arenaCache = { key, arena: guns ? { ...arenaFor(this.era, this.map), gunsOnly: true } : arenaFor(this.era, this.map) };
    return this.arenaCache.arena;
  }

  /** Is this round a gun round (owner, 2026-10-07: more gun arenas)? An era's gunRounds share of its rounds is played guns-only on whatever
   *  map comes up (not a fists-only map), picked from the match seed and the round, so the server and every page agree. */
  private gunRound(): boolean {
    const c = T.eras.changeGameplay && T.eras.gunRounds ? eraById(this.era).gunRounds ?? 0 : 0;
    return c > 0 && !arenaFor(this.era, this.map).noWeapons && makeRng(((this.seed * 31 + this.round) ^ 0x5bd1e995) >>> 0)() < c;
  }

  /** The era and arena of the next round (so the renderer can paint its backdrop ahead of time). */
  upcoming(): { era: string; arena: Arena } {
    const era = this.forceEra ?? eraFor(this.seed, this.round + 1).id;
    return { era, arena: arenaFor(era, this.forceMap ?? mapFor(this.seed, this.round + 1, era)) };
  }

  /** Online client: build the round the server is in (its round number and era), instead of round 1. */
  buildRound(round: number, era: string): void {
    this.round = round;
    this.eraOverride = era;
    this.build();
    this.eraOverride = null;
  }

  /** The seed the match was made with (replays need it). */
  get matchSeed(): number { return this.seed; }

  /** A new match: a new seed (so a new order of maps and weapon drops), round 1, no scores. */
  reseed(seed: number): void {
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed);
    this.reset();
  }

  /** How long the crown has been showing (0 until the match is over). */
  get matchFrames(): number { return this.matchOver ? this.frame - this.matchOverAt : 0; }

  /** Frames since the round was won (0 while it is being fought). */
  get roundFrames(): number { return this.roundOver ? this.frame - this.roundOverAt : 0; }

  /** The round just won ends the match (the last round, and one player leads): no next era, the podium. */
  get endsMatch(): boolean {
    if (!this.roundOver || !this.matchActive) return false;
    const scores = this.scores.slice(0, this.count), top = Math.max(...scores);
    return this.round >= T.match.rounds && scores.filter((s) => s === top).length === 1;
  }

  /** The pause after a round is over now (on this computer the museum between eras took its time): the next step starts the next round. */
  finishRoundPause(): void { if (this.roundOver) this.roundOverAt = this.frame - T.match.resultFrames - this.extraRoundPause; }

  /** The tie-break rounds after the last round of the match (the top score was shared). */
  get tieBreak(): boolean { return this.round > T.match.rounds; }

  /** Practising alone (with the training dummy or a training bot): no rounds. */
  get practising(): boolean { return this.dummy; }

  get matchActive(): boolean { return !this.dummy && this.count >= 2; }

  /** Rebuild everything from the current tuning values and start the scores again. */
  reset(): void {
    this.matchOver = false;
    this.matchWinner = -1;
    this.scores = [0, 0, 0, 0];
    this.round = 1;
    this.roundOver = false;
    this.roundWinner = -1;
    this.build();
  }

  /** Build a fresh arena and fighters (the scores are kept). */
  private build(): void {
    this.world?.free();
    this.era = this.eraOverride ?? this.forceEra ?? eraFor(this.seed, this.round).id;
    this.map = this.forceMap ?? mapFor(this.seed, this.round, this.era);
    this.props = [];
    this.bridge = [];
    this.bridgeHome = [];
    this.ropes = [];
    this.ropeEnds = [];
    this.cutLinks.clear();
    this.brains = [null, null, null, null]; // bots start each round fresh (so a round can be replayed from its own start: see src/replay)
    this.weapon = T.eras.changeGameplay ? weaponById(this.arena.weapon || eraById(this.era).weapon) : { id: 'club', name: 'Club', ...T.stick };
    this.outfits = outfitsFor(this.seed, this.round);
    this.rng = makeRng(this.seed);
    this.frame = 0;
    this.nextSpawn = this.arena.gunsOnly ? T.spawn.gunsFirst : T.spawn.firstGap;
    this.lastImpact = 0;
    this.events.length = 0;
    this.edits = []; // (a new list: last round's recording keeps the old one)
    this.bullets = [];
    this.hooks = [];
    this.hookLines = [];
    this.zones = [];
    this.nextBullet = 0;
    this.partByBody.clear();

    const A = this.arena;
    this.world = new RAPIER.World({ x: 0, y: T.sim.gravity });
    this.world.timestep = T.sim.dt;
    this.world.numSolverIterations = T.sim.solverIterations;
    this.world.numInternalPgsIterations = T.sim.pgsIterations;
    const slabs = A.chase ? [] : A.ground.length ? A.ground : A.boats.length ? [] : [{ x: A.platformX, w: A.platformW }]; // (on a ship the deck is the floor, unless the map has ground of its own as well: a pier; on a treadmill, its moving sections)
    this.boats = A.sea ? A.boats.map((b) => buildBoat(this.world, A, b)) : [];
    const grounds = slabs.map((g: Arena['ground'][number]) => {
      const th = g.thick ?? A.platformThickness, body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(g.x + g.w / 2, A.platformTop - (g.up ?? 0) + th / 2));
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(g.w / 2, th / 2).setFriction(A.friction).setCollisionGroups(terrainGroups), body);
      return { ...g, body };
    });
    if (A.bridge) this.buildBridge(A.bridge, grounds, A);
    for (const r of A.ropes) this.ropes.push(this.buildRope(r, A));
    this.chase = A.chase ? buildChase(this) : null;
    this.passing = A.train ? buildTrain(this) : [];
    this.doors = A.trapdoors.length ? buildDoors(this) : [];
    this.chariot = A.chariot ? buildChariot(this) : null;
    this.jets = [];

    // The map's side walls (if any): a backstop at an end, or a wall across a gap you can fall into and wall-jump out of.
    for (const w of wallsOf(A)) {
      const wallH = (A.killY + 2 - w.top) / 2;
      const wall = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(w.x + A.wallThickness / 2, w.top + wallH));
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(A.wallThickness / 2, wallH).setFriction(0.05).setCollisionGroups(terrainGroups), wall);
    }

    // Where each fighter starts, kept in the same place along the platform whatever the era's layout (the standard arena maps to itself).
    const along = (x: number) => A.platformX + ((x - T.arena.platformX) / T.arena.platformW) * A.platformW;
    for (const l of A.ledges) { // floating platforms
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(l.x + l.w / 2, A.platformTop - l.up + A.ledgeThick / 2));
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(l.w / 2, A.ledgeThick / 2).setFriction(A.friction).setCollisionGroups(terrainGroups), body);
    }
    const xs = (this.dummy ? A.spawnX : A.fightSpawnX).map(along);
    for (const sc of A.scenery) { // the map's breakable scenery: always there
      const spec = PROPS[sc.kind] ?? PROPS.crate;
      const p = createProp(this.world, sc.x, A.platformTop - sc.up - spec.thick / 2 - 0.01, 0, { kind: sc.kind, ...spec });
      if (spec.hangs) { // a lantern: on a rope from a fixed point above it (it swings; cut, it falls)
        const top = p.body.translation().y - spec.thick / 2 - spec.hangs, anchor = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(sc.x, top));
        p.links = [this.world.createImpulseJoint(RAPIER.JointData.revolute({ x: 0, y: 0 }, { x: 0, y: -spec.thick / 2 - spec.hangs }), anchor, p.body, true)];
        p.hang = { x: sc.x, y: top };
      }
      this.props.push(p);
      this.partByBody.set(p.body.handle, p);
    }
    for (const pr of T.props.lying && !A.noWeapons ? A.props : []) { // loose objects lying on the arena
      const spec = PROPS[pr.kind] ?? PROPS.plank;
      const p = createProp(this.world, pr.x, A.platformTop - pr.up - spec.thick / 2 - 0.01, 0, { kind: pr.kind, ...spec });
      this.props.push(p);
      this.partByBody.set(p.body.handle, p);
      if (p.head) { this.props.push(p.head); this.partByBody.set(p.head.body.handle, p.head); }
    }
    this.fighters = Array.from({ length: this.count }, (_, i) => this.spawn(i, xs[i], !(this.dummy && i === 1 && this.training.foe === 'dummy')));
    this.fighters.forEach((f) => { if (this.gone[f.index]) this.park(f); });
    // Arena weapon rule: with 'spots' or 'sky' nobody starts armed; the clubs lie at fixed spots or fall from above.
    const rule = T.eras.changeGameplay && T.eras.mixStarts ? this.startRule() : A.weaponRule;
    if (rule !== 'start') {
      this.fighters.forEach((f, i) => {
        if (!f.controlled || !f.stick) return;
        const x = A.platformX + A.platformW * A.weaponSpots[i % A.weaponSpots.length];
        if (rule === 'spots') placeLoose(this.world, f, x, A.platformTop - 0.1, 0);
        else placeLoose(this.world, f, x, -1.5 - 2.5 * i, 0.4 * i);
      });
    }
    const f0 = this.fighters[0];
    if (this.give && PROPS[this.give] && f0) { // (testing a weapon: in your hand from the start)
      const t = f0.torso.body.translation();
      if (f0.stick && f0.grip) placeLoose(this.world, f0, t.x - 2 * f0.side, A.platformTop - 0.1, 0);
      this.addProp(this.give, t.x, t.y - 1.5);
      this.acquire(f0, { kind: 'prop', index: this.props.length - 1 });
    }
    this.version++;
  }

  /** A chain of planks across a gap, each joined to the next and the end ones to the ground. */
  private buildBridge(b: { x0: number; x1: number; planks: number; kind?: string }, grounds: { x: number; w: number; up?: number; thick?: number; body: RAPIER.RigidBody }[], A: Arena): void {
    const B = T.bridge, n = b.planks, len = (b.x1 - b.x0) / n, spec = b.kind ? PROPS[b.kind] : undefined, thick = spec?.thick ?? B.plankThick, r = thick / 2; // (planks, or the aqueduct's stone blocks)
    const left = grounds.find((g) => Math.abs(g.x + g.w - b.x0) < 1e-6), right = grounds.find((g) => Math.abs(g.x - b.x1) < 1e-6);
    const y = A.platformTop - (left?.up ?? right?.up ?? 0) + r; // (level with the ground it joins: a raised pier's planks are raised too)
    const joint = (a: RAPIER.RigidBody, ax: number, ay: number, c: RAPIER.RigidBody, cx: number, cy: number) => {
      const j = this.world.createImpulseJoint(RAPIER.JointData.revolute({ x: ax, y: ay }, { x: cx, y: cy }), a, c, true) as RAPIER.RevoluteImpulseJoint;
      j.setLimits(-B.linkLimit, B.linkLimit);
      return j;
    };
    const links: RAPIER.ImpulseJoint[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      const p = createProp(this.world, b.x0 + (i + 0.5) * len, y, 0, { ...spec, kind: b.kind ?? 'plank', len, thick, mass: spec?.mass ?? B.plankMass });
      this.bridgeHome.push({ x: b.x0 + (i + 0.5) * len, y });
      p.body.setAngularDamping(2);
      p.links = links[i];
      this.props.push(p);
      this.bridge.push(p);
      this.partByBody.set(p.body.handle, p);
    }
    for (let i = 0; i + 1 < n; i++) {
      const j = joint(this.bridge[i].body, len / 2, 0, this.bridge[i + 1].body, -len / 2, 0);
      links[i].push(j); links[i + 1].push(j);
    }
    const slabY = (g: { up?: number; thick?: number }) => A.platformTop - (g.up ?? 0) + (g.thick ?? A.platformThickness) / 2; // where a ground body is centred
    if (left) links[0].push(joint(left.body, b.x0 - (left.x + left.w / 2), y - slabY(left), this.bridge[0].body, -len / 2, 0));
    if (right) links[n - 1].push(joint(right.body, b.x1 - (right.x + right.w / 2), y - slabY(right), this.bridge[n - 1].body, len / 2, 0));
  }

  /**
   * A rope from (x0, up0) to (x1, up1): a chain of short links hanging in a sag (tuning.rope.slack longer than the straight line), each end
   * tied to the ship under it (or, with no ship there, to a fixed point). Its links are loose things like the bridge's planks: a club or a
   * bullet cuts one free (hitProp, shootLoose).
   */
  private buildRope(r: { x0: number; up0: number; x1: number; up1: number }, A: Arena): Part[] {
    const R = T.rope, n = R.links, x0 = r.x0, y0 = A.platformTop - r.up0, x1 = r.x1, y1 = A.platformTop - r.up1;
    const want = Math.hypot(x1 - x0, y1 - y0) * R.slack, at = (t: number, sag: number) => ({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t + 4 * sag * t * (1 - t) });
    const curve = (sag: number) => { const pts = Array.from({ length: 65 }, (_, i) => at(i / 64, sag)), len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)); return { pts, len }; };
    let lo = 0, hi = want; // the sag that makes the curve as long as the rope
    for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (curve(mid).len[64] < want) lo = mid; else hi = mid; }
    const { pts, len } = curve(lo), total = len[64];
    const along = (d: number) => { let i = 1; while (i < 64 && len[i] < d) i++; const t = (d - len[i - 1]) / (len[i] - len[i - 1] || 1); return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; };
    const knots = Array.from({ length: n + 1 }, (_, i) => along((total * i) / n));
    const rope: Part[] = [], links: RAPIER.ImpulseJoint[][] = Array.from({ length: n }, () => []);
    const tie = (a: RAPIER.RigidBody, ax: number, ay: number, c: RAPIER.RigidBody, cx: number, cy: number) => this.world.createImpulseJoint(RAPIER.JointData.revolute({ x: ax, y: ay }, { x: cx, y: cy }), a, c, true);
    for (let i = 0; i < n; i++) {
      const a = knots[i], b = knots[i + 1], l = Math.hypot(b.x - a.x, b.y - a.y);
      const p = createProp(this.world, (a.x + b.x) / 2, (a.y + b.y) / 2, Math.atan2(b.y - a.y, b.x - a.x), { kind: 'rope', len: l, thick: R.thick, mass: R.linkMass });
      for (const c of p.colliders) c.setCollisionGroups(ropeGroups);
      p.links = links[i];
      rope.push(p);
      this.props.push(p);
      this.partByBody.set(p.body.handle, p);
    }
    for (let i = 0; i + 1 < n; i++) {
      const la = rope[i].shapes[0], lb = rope[i + 1].shapes[0], ha = la.k === 'cap' ? la.hl + la.r : 0, hb = lb.k === 'cap' ? lb.hl + lb.r : 0;
      const j = tie(rope[i].body, ha, 0, rope[i + 1].body, -hb, 0);
      links[i].push(j); links[i + 1].push(j);
    }
    // each end: tied to the ship under it, or to a fixed point
    // Each end is tied to a point carried along with the ship under it (moveRopeEnds), not to the ship itself: a rope tied high in the
    // rigging went taut as the two ships rocked apart and levered them over into a V, so a rope follows its ships but never pulls them.
    const end = (pt: { x: number; y: number }, link: Part, sign: number) => {
      const sh = link.shapes[0], h = sh.k === 'cap' ? sh.hl + sh.r : 0;
      const ship = this.boats.find((s) => Math.abs(pt.x - s.homeX) <= s.w / 2);
      const body = this.world.createRigidBody((ship ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.fixed()).setTranslation(pt.x, pt.y));
      if (ship) { const c = ship.body.translation(); this.ropeEnds.push({ body, ship, x: pt.x - c.x, y: pt.y - c.y }); }
      return tie(body, 0, 0, link.body, sign * h, 0);
    };
    links[0].push(end(knots[0], rope[0], -1));
    links[n - 1].push(end(knots[n], rope[n - 1], 1));
    return rope;
  }

  /** Before the physics: each rope end moves to where its tie point on the ship is now. */
  private moveRopeEnds(): void {
    for (const e of this.ropeEnds) {
      const t = e.ship.body.translation(), a = e.ship.body.rotation(), c = Math.cos(a), s = Math.sin(a);
      e.body.setNextKinematicTranslation({ x: t.x + e.x * c - e.y * s, y: t.y + e.x * s + e.y * c });
    }
  }

  /** Once every rope is cut, the ships it held drift apart (each toward its own side, tuning.boat.apart at most). */
  private driftApart(): void {
    if (!this.ropes.length || !this.ropes.every((r) => r.some((p) => !p.links?.length))) return;
    const B = T.boat;
    for (const b of this.boats) {
      b.away = Math.min(B.apart, b.away + B.apartSpeed * T.sim.dt);
      b.homeX = b.home0 + b.dir * b.away;
    }
  }

  /** Free a bridge plank: every joint holding it is removed (once). */
  private ripFree(p: Part): void {
    for (const j of p.links ?? []) if (!this.cutLinks.has(j)) { this.world.removeImpulseJoint(j as never, true); this.cutLinks.add(j); }
    p.links = [];
  }

  /** A club that hits a plank hard enough cuts it loose; a hard enough hit (club or fist) damages breakable scenery. */
  private hitProp(att: Attacker, plank: Part, pt: { x: number; y: number }, n: { x: number; y: number }): void {
    if (plank.hp !== undefined) { const c0 = this.contact(att.part, plank, pt, n); damageScenery(this, plank, impactValue(c0.closing, att.kind === 'stick' ? (att.part.weapon ?? T.stick).impactFactor : T.fist.impactFactor)); return; }
    if (att.kind !== 'stick' || !plank.links?.length) return;
    const c = this.contact(att.part, plank, pt, n);
    const impact = impactValue(c.closing, (att.part.weapon ?? T.stick).impactFactor);
    if (impact < T.bridge.cutImpact || PROPS[plank.weapon?.id ?? '']?.slam) return; // (a block of stone or ice only comes out to a slam: props.ts slam)
    this.ripFree(plank);
    this.events.push({ t: 'cut', x: pt.x, y: pt.y, v: impact, owner: att.part.owner, victim: -1 });
  }

  // ---- for guns.ts ----
  /** Take a part out of the world for good (a snapped weapon, broken scenery): from the hand holding it, or from the loose things. */
  removeBody(part: Part, holder: Fighter | undefined): void {
    holder ??= this.fighters.find((g) => g.stick === part); // (a weapon lying where it was thrown or dropped is still its owner's part)
    if (holder && holder.stick === part) {
      if (holder.grip) { this.world.removeImpulseJoint(holder.grip, true); holder.grip = null; }
      dropToWorld(holder);
    } else {
      const i = this.props.indexOf(part);
      if (i >= 0) this.props.splice(i, 1);
    }
    this.partByBody.delete(part.body.handle);
    this.world.removeRigidBody(part.body);
    const h = part.head;
    if (h) { const k = this.props.indexOf(h); if (k >= 0) this.props.splice(k, 1); this.partByBody.delete(h.body.handle); this.world.removeRigidBody(h.body); }
  }
  /** A light weapon shot out of the hand: it flies off with the bullet. */
  disarmByShot(f: Fighter, ix: number, iy: number, owner: number): void {
    if (!f.grip || !f.stick) return;
    this.world.removeImpulseJoint(f.grip, true);
    f.grip = null;
    f.charge = 0; f.release = 0; f.throwPending = false;
    f.dropCooldown = T.drop.pickupDelay;
    f.stick.body.applyImpulse({ x: ix, y: iy }, true);
    const t = f.stick.body.translation();
    this.events.push({ t: 'disarm', x: t.x, y: t.y, v: Math.hypot(ix, iy), owner, victim: f.index });
  }
  /** A bridge plank (or anything held by joints) shot loose. */
  shootLoose(part: Part, x: number, y: number, owner: number): void {
    this.ripFree(part);
    this.events.push({ t: 'cut', x, y, v: 0, owner, victim: -1 });
  }
  /** A grenade goes off (special.ts): everything near is thrown outward (harder the nearer), fighters are hurt by how near they were, and
   *  breakable scenery breaks. `by`: who threw it. */
  /** A blast at (x, y) (a grenade; a gun's `blast`, props.ts): everything near is thrown outward and hurt, less further out. `spare`: the one
   *  it throws but never hurts (who fired it). */
  blast(x: number, y: number, by: number, o: { radius: number; push: number; impact: number; hurt?: number } = { radius: T.special.blastRadius, push: T.special.blastPush, impact: T.special.blastImpact }, spare = -1): void {
    const B = T.special, R = o.radius;
    const push = (b: RAPIER.RigidBody): number => {
      const t = b.translation(), dx = t.x - x, dy = t.y - y, d = Math.hypot(dx, dy);
      if (d > R || !b.isDynamic()) return d;
      const k = 1 - d / R, s = d || 1;
      b.applyImpulse({ x: (dx / s) * o.push * k * b.mass(), y: ((dy / s) * o.push - B.blastLift) * k * b.mass() }, true);
      return d;
    };
    for (const f of this.fighters) {
      let near = Infinity;
      for (const p of f.parts) near = Math.min(near, push(p.body));
      if (f.limp || near > R || f.index === spare) continue;
      const impact = o.impact * (1 - near / R), t = f.torso.body.translation();
      this.wound(f, damageFor(impact) * (o.hurt ?? 1), impact, t.x, t.y, by, false, true, { how: 'blast', nx: Math.sign(t.x - x) || 1, ny: -0.5 });
    }
    for (const p of [...this.props]) { const d = push(p.body); if (d < R && p.hp !== undefined && this.props.includes(p)) damageScenery(this, p, o.impact * B.blastScenery * (1 - d / R)); }
  }

  /** Run down by the chariot (chariot.ts): hurt as a hit of `impact` from the side it came (`nx`); it has already flung them. */
  trampled(f: Fighter, impact: number, nx: number): void {
    if (f.limp) return;
    const t = f.torso.body.translation();
    this.wound(f, damageFor(impact), impact, t.x, t.y, -1, false, true, { how: 'blast', nx, ny: -0.5 });
    this.events.push({ t: 'trample', x: t.x, y: t.y, v: 1, owner: -1, victim: f.index });
  }

  /** Fire's damage (fire.ts): a little hidden health at a time, no stagger; it can finish you. */
  scorch(f: Fighter, dmg: number, how: Cause['how'] = 'fire'): void {
    if (f.limp) return;
    f.hp -= dmg;
    if (f.hp <= 0) this.kill(f, false, 0, { how, nx: 0, ny: 0 });
  }
  /** After a bullet hit a fighter: a hold breaks on a big one, a knockdown, or the end. */
  afterShot(v: Fighter, impact: number, dx: number): void {
    this.lastImpact = impact;
    if (v.hold && impact >= T.grab.breakImpact) letGo(this.world, v, false, this.events);
    if (v.hp <= 0) this.kill(v, false, impact, { how: 'shot', nx: dx, ny: 0 });
    else this.knockdown(v, impact, dx);
  }

  /** Someone slamming into the bridge hard enough breaks it there (the planks around the impact come free). */
  private resolveBridge(): void {
    const B = T.bridge;
    this.bridge.forEach((plank, i) => {
      if (!plank.links?.length) return;
      this.world.contactPairsWith(plank.colliders[0], (other) => {
        if (!plank.links?.length) return;
        const vb = other.parent();
        const part = vb && this.partByBody.get(vb.handle);
        if (!part || part.owner < 0 || part.role === 'off' || isWeapon(part) || part.role === 'upper' || part.role === 'fore') return; // a body slam: not a swinging arm or weapon (their tips move far faster than any fall; a weapon cuts by hitProp's rule)
        this.world.contactPair(plank.colliders[0], other, (m) => {
          if (!plank.links?.length || m.numSolverContacts() === 0) return;
          const pt = m.solverContactPoint(0, this.tmpP) ?? this.tmpP;
          const c = this.contact(part, plank, pt, m.normal(this.tmpN));
          const slam = PROPS[plank.weapon?.id ?? '']?.slam, span = slam ? 0 : B.breakSpan; // (a block of stone or ice: that one alone, at its own speed)
          if (c.closing < (slam ?? B.slamSpeed)) return;
          for (let k = Math.max(0, i - span); k <= Math.min(this.bridge.length - 1, i + span); k++) this.ripFree(this.bridge[k]);
          this.events.push({ t: 'cut', x: pt.x, y: pt.y, v: c.closing, owner: part.owner, victim: -1 });
        });
      });
    });
  }

  /** A player who has left: kill their fighter and drop the whole body far below the stage, so it never appears again and never counts as alive. */
  private park(f: Fighter): void {
    if (!f.limp) this.kill(f, true);
    for (const p of f.parts) {
      const t = p.body.translation();
      p.body.setTranslation({ x: t.x, y: t.y + 60 }, true);
      p.px = p.cx = t.x; p.py = p.cy = t.y + 60;
    }
  }

  /** Online: a player is back (or new): they join in at the start of the next round. A new player starts on 0 points. */
  restorePlayer(i: number, fresh: boolean): void {
    if (!this.gone[i]) return;
    this.gone[i] = false;
    if (fresh) this.scores[i] = 0;
    this.events.push({ t: 'back', x: 0, y: 0, v: 0, owner: i, victim: -1 });
  }

  /** Online: a player left. They die now (if alive) and are out of every later round. */
  removePlayer(i: number): void {
    const f = this.fighters[i];
    if (!f || this.gone[i]) return;
    this.gone[i] = true;
    if (!f.limp) this.kill(f, true);
    this.events.push({ t: 'gone', x: 0, y: 0, v: 0, owner: i, victim: -1 });
  }

  private spawn(index: number, x: number, player: boolean): Fighter {
    const y = floorAt(this.arena, x) - T.stand.height - 0.02; // the hips at standing height
    const foe = this.dummy && index === 1; // the training partner: armed or not as the training menu says
    const f = buildFighter(this.world, index, x, y, player, !this.arena.noWeapons && !this.arena.gunsOnly && (foe ? this.training.foeArmed : T.fighter.startArmed), this.weapon, player && x > this.arena.viewW / 2 ? -1 : 1); // (facing the middle; the dummy never aims: it faces right, the way its controls point)
    for (const p of f.parts) this.partByBody.set(p.body.handle, p);
    f.slip = this.arena.ice; // (an icy floor: your feet barely grip)
    return f;
  }

  private respawn(f: Fighter): void {
    for (const g of this.fighters) if (g.held === f) { g.hold = null; g.held = null; } // removing the bodies removes the grab joint too
    letGo(this.world, f, false, this.events);
    for (const p of f.parts) {
      this.partByBody.delete(p.body.handle);
      this.world.removeRigidBody(p.body);
    }
    this.fighters[f.index] = this.spawn(f.index, f.spawnX, f.controlled);
    this.version++;
  }

  step(inputs: PlayerInput[]): void {
    this.events.length = 0;
    this.frame++;
    applyWater(this.arena, this.frame, this.fighters, this.props, this.boats);
    this.driftApart();

    for (const f of this.fighters) {
      if (f.held) {
        if (f.held.inBack) letGo(this.world, f, false, this.events); // a dodge slips out of a grab
        else { f.held.stun = Math.max(f.held.stun, 2); f.held.carried = 2; } // being held: no walking, weak balance, not standing on your own feet (so you can be lifted and swung)
      }
    }
    for (const f of this.fighters) {
      const bot = f.controlled && this.looks[f.index]?.bot ? (this.brains[f.index] ??= new Bot(this.seed * 7919 + f.index * 104729 + this.round * 7 + 1)) : null; // a computer player presses its own buttons
      controlFighter(this.world, f, bot ? bot.think(this, f) : f.controlled ? (inputs[f.index] ?? NEUTRAL) : DUMMY_INPUT, this.events, this.threatened(f));
      syncStickGroups(f);
      for (const p of f.parts) {
        let v = p.body.linvel(this.tmpV);
        if (v.y > T.sim.maxFallSpeed) { p.body.setLinvel({ x: v.x, y: T.sim.maxFallSpeed }, true); v = p.body.linvel(this.tmpV); }
        p.vx = v.x; p.vy = v.y; p.w = p.body.angvel();
      }
    }

    if (T.grab.throwDisarms) for (const e of this.events) if (e.t === 'throw' && e.victim >= 0 && this.fighters[e.victim]?.grip) this.disarmByShot(this.fighters[e.victim], 0, 0, e.owner); // flung out of someone's hands: what they held flies on by itself
    for (const f of this.fighters) if (f.fireRequest) { f.fireRequest = false; if (!f.limp) fire(this, f); } // triggers pulled with a loaded gun
    for (const p of this.props) { const v = p.body.linvel(this.tmpV); p.vx = v.x; p.vy = v.y; p.w = p.body.angvel(); }
    this.spawnPickups();
    this.resolvePickups();
    this.keepWeaponsInPlay();
    for (const f of this.fighters) { const v = f.torso.body.linvel(this.tmpV); this.preV[2 * f.index] = v.x; this.preV[2 * f.index + 1] = v.y; }
    if (this.passing.length) stepTrain(this, this.passing);
    if (this.doors.length) stepDoors(this, this.doors);
    if (this.chariot) stepChariot(this, this.chariot);
    applyWind(this);
    moveHooks(this);
    moveNets(this);
    moveEffects(this);
    aimSpears(this);
    this.moveRopeEnds();
    this.world.step();
    if (this.chase) stepChase(this, this.chase);
    this.capSpeeds();
    this.absorbLandings();
    this.settlePlanes();
    this.resolveGrabs();
    this.resolveHits();
    this.resolveBodyHits();
    this.resolveBridge();
    crackFloes(this);
    this.resolveCrashes();
    this.resolveSlams();
    this.resolveBodySlams();
    this.resolveCrushes();
    this.shatterMugs();
    stickSpears(this);
    fuses(this);
    moveBullets(this);
    applyJets(this);
    applyFalls(this);
    applyFire(this);
    const SD = T.match.suddenDeath, late = (this.frame - SD.after) * T.sim.dt; // sudden death: a round still going this late drains everyone left, faster and faster (none runs for ever)
    if (late > 0 && !this.dummy && !this.roundOver) for (const f of this.fighters) if (f.controlled && !f.limp) this.scorch(f, SD.rate * late * T.sim.dt, 'time');
    this.checkDeaths();
    this.snapshot();
  }

  /**
   * Online client, prediction only (net/predict.ts): move fighter `slot` by its own buttons for one tick, without waiting for the server.
   * Everything else must already be set to follow the server (kinematic). Nothing is decided here (hits, deaths, pickups, rounds): the
   * server does that and says so; this only moves the body, so your own fighter answers your keys at once.
   */
  predictStep(slot: number, input: PlayerInput): SimEvent[] {
    const f = this.fighters[slot];
    if (!f || f.limp) return [];
    applyWater(this.arena, this.frame, [f], [], []);
    controlFighter(this.world, f, input, this.predictEvents, 0);
    this.predictEvents.length = 0; // (no sounds or paint from a guess: the server's events bring those)
    const shown: SimEvent[] = []; // ...except a shot of your own: its flash, bang and kick are at once (owner: instant feel)
    if (f.fireRequest) { f.fireRequest = false; const e = predictShot(f); if (e) shown.push(e); }
    syncStickGroups(f);
    for (const p of f.parts) {
      const v = p.body.linvel(this.tmpV);
      if (v.y > T.sim.maxFallSpeed) p.body.setLinvel({ x: v.x, y: T.sim.maxFallSpeed }, true);
    }
    const tv = f.torso.body.linvel(this.tmpV);
    this.preV[2 * f.index] = tv.x; this.preV[2 * f.index + 1] = tv.y;
    this.world.step();
    if (this.chase) loopFloor(this.chase);
    this.absorbLandings([f]);
    for (const p of f.parts) {
      const v = p.body.linvel(this.tmpV), s = Math.hypot(v.x, v.y), M = T.sim.maxPartSpeed;
      if (s > M) p.body.setLinvel({ x: (v.x / s) * M, y: (v.y / s) * M }, true);
    }
    return shown;
  }
  private predictEvents: SimEvent[] = [];

  /**
   * Online client: copy a structural change the server announced (the client never steps the physics, so this is all it needs to keep
   * its fighters' part lists identical to the server's; the poses are written in separately).
   */
  mirrorEvent(e: SimEvent): void {
    const f = this.fighters[e.owner];
    if (e.t === 'die' || e.t === 'fall') { if (f && !f.limp) this.kill(f, e.t === 'fall', e.v); }
    else if (e.t === 'pickup') { if (f) this.acquire(f, decodeItem(e)); }
    else if (e.t === 'cut') { /* only an effect: the bridge's own joints are the server's business */ }
    else if (e.t === 'respawn') { if (f) this.respawn(f); }
    else if (e.t === 'back') this.gone[e.owner] = false;
    else if (e.t === 'gone') { this.gone[e.owner] = true; if (f && !f.limp) this.kill(f, true); }
    else if (e.t === 'spawn') this.addProp(PROP_KINDS[e.v], e.x, e.y);
    else if (e.t === 'newround') { this.round++; this.build(); }
    else if (e.t === 'shot') { if (f) spendShot(f); }
    else if (e.t === 'snap') { const h = e.owner >= 0 ? this.fighters[e.owner] : undefined, p = h ? h.stick : this.props[e.victim]; if (p) snapPart(this, p, e.v, e.how === 'loose' ? undefined : h); } // ('loose': their weapon, lying where it was thrown)
    else if (e.t === 'break') { const p = this.props[e.victim]; if (p) breakProp(this, p, false); }
    else if (e.t === 'boom') { const h = e.owner >= 0 ? this.fighters[e.owner] : undefined, p = h ? h.stick : this.props[e.victim]; if (p) goneOff(this, p, h); }
    else if (e.t === 'shatter') { const h = e.owner >= 0 ? this.fighters[e.owner] : undefined, p = h ? h.stick : this.props[e.victim]; if (p) shatter(this, p, h, false); }
  }

  /** How this round begins (a pure function of the seed and round): armed, clubs at fixed spots, or clubs from the sky. */
  private startRule(): 'start' | 'spots' | 'sky' {
    const W = T.spawn.startRules, r = makeRng(((this.seed * 17 + this.round) ^ 0x27d4eb2f) >>> 0)() * (W.start + W.spots + W.sky);
    return r < W.start ? 'start' : r < W.start + W.spots ? 'spots' : 'sky';
  }

  private addProp(kind: string, x: number, y: number): void {
    const p = createProp(this.world, x, y, 0, { kind, ...(PROPS[kind] ?? ITEMS.find((it) => it.id === kind)?.spec ?? PROPS.plank) });
    this.props.push(p);
    this.partByBody.set(p.body.handle, p);
    if (p.head) { this.props.push(p.head); this.partByBody.set(p.head.body.handle, p.head); } // (a chain weapon's head: a loose thing of its own, right after its handle)
    this.version++;
  }

  /** Training: drop a weapon or pickup (an id from content/props.ts ITEMS) in at a point. */
  spawnItem(kind: string, x: number, y: number): void { this.edits.push({ f: this.frame, item: kind, x, y }); this.addProp(kind, x, y); }

  /** Training: take every loose weapon and object off the map (a bridge keeps its planks, ropes their links, the Mammoth Chase its rocks and logs; clubs dropped by fighters stay). */
  clearLoose(): void {
    this.edits.push({ f: this.frame });
    const kept = (q: Part) => this.bridge.includes(q) || this.ropes.some((r) => r.includes(q)) || !!this.chase?.obstacles.includes(q); // (the map's own machinery stays: the chase moves its rocks and logs every step)
    for (const p of this.props.filter((q) => !kept(q))) {
      this.partByBody.delete(p.body.handle);
      this.world.removeRigidBody(p.body);
    }
    this.props = this.props.filter(kept);
    this.version++;
  }

  /** Better weapons drop in during the round, faster and stronger as it goes on, at fixed spots or from the sky. */
  private spawnPickups(): void {
    const S = T.spawn, pickups = eraById(this.era).pickups;
    if (!T.eras.changeGameplay || !T.spawn.enabled || !pickups?.length || this.arena.noWeapons || this.frame < this.nextSpawn) return;
    this.nextSpawn = this.frame + (this.arena.gunsOnly ? S.gunsGap : Math.round(S.firstGap + (S.minGap - S.firstGap) * Math.min(1, this.frame / S.rampFrames)));
    if (this.props.filter((p) => !p.chainOf && pickups.includes(p.weapon?.id ?? '')).length >= S.maxLoose) return; // (a flail's head is not a second flail)
    const n = Math.min(eraById(this.era).strong ?? 1, pickups.length - 1), strongOnes = pickups.slice(pickups.length - n);
    const pool = this.arena.gunsOnly ? pickups.filter((k) => PROPS[k]?.gun) : pickups; // (a guns-only arena: only the era's guns)
    const common = pool.filter((k) => !strongOnes.includes(k)), rare = pool.filter((k) => strongOnes.includes(k));
    if (!pool.length) return;
    const strong = rare.length > 0 && (!common.length || (this.frame >= S.strongAfterFrames && this.rng() < S.strongChance));
    const from = strong ? rare : common; // (the common ones, or later the strong ones: one of them at random)
    const kind = from.length > 1 ? from[Math.floor(this.rng() * from.length)] : from[0], A = this.arena;
    const sky = this.rng() < S.airdropChance, x = sky ? A.platformX + 0.8 + this.rng() * (A.platformW - 1.6) : A.platformX + A.platformW * (A.spawnSpots ?? S.spots)[Math.floor(this.rng() * (A.spawnSpots ?? S.spots).length)]; // (a map's own spots: Main Street's are in the street, not inside the shops)
    const y = sky ? -1.5 : A.platformTop - 0.4;
    this.addProp(kind, x, y);
    this.events.push({ t: 'spawn', x, y, v: PROP_KINDS.indexOf(kind), owner: -1, victim: -1 });
  }

  /** Safety cap: no body part ever moves faster than sim.maxPartSpeed. Real play stays far below it; a rare solver blow-up (stiff joints and
   *  overlapping bodies can launch a limb) is stopped here before it feeds on itself. */
  private capSpeeds(): void {
    const M = T.sim.maxPartSpeed;
    for (const f of this.fighters) for (const p of f.parts) {
      const v = p.body.linvel(this.tmpV), s = Math.hypot(v.x, v.y);
      if (s > M) p.body.setLinvel({ x: (v.x / s) * M, y: (v.y / s) * M }, true);
    }
  }

  /** Someone close is winding up a weapon, lunging, punching or grabbing at this fighter (they brace with their free arm and lean away):
   * the side they are on (+1 = toward +x, -1 = toward -x), or 0 for nobody. */
  private threatened(f: Fighter): number {
    const t = f.torso.body.translation(), R = T.offArm.braceRange;
    const g = this.fighters.find((g) => {
      if (g === f || g.limp || g.inBack || !(g.charge > 8 || g.release > 0 || g.punch > 0 || g.reaching)) return false;
      const u = g.torso.body.translation();
      return Math.abs(u.x - t.x) < R && Math.abs(u.y - t.y) < 1.5 && Math.sign(t.x - u.x) === g.side; // close, and facing this way
    });
    return g ? -g.side : 0;
  }

  /** A body that runs into something fast (the floor, a wall) does not spring back off it (see tuning.land). */
  private absorbLandings(fighters = this.fighters): void {
    const L = T.land;
    for (const f of fighters) {
      if (f.knock > 0 || f.hold || f.carried > 0) continue; // a knocked-down body may bounce about; grabs move bodies on purpose
      // Sideways (walls) and up-down (floors) separately: a fast movement that the impact turned round is let back by at most maxRebound.
      const tv = f.torso.body.linvel(this.tmpV), cut = [0, 1].map((a) => {
        const before = this.preV[2 * f.index + a], after = a ? tv.y : tv.x;
        if (Math.abs(before) < L.fallSpeed || after * Math.sign(before) >= -L.maxRebound) return 0;
        const c = -after - Math.sign(before) * L.maxRebound;
        return Math.sign(c) * Math.min(Math.abs(c), L.maxCut); // (a bigger jump than any rebound is something else: leave it to the physics)
      });
      if (!cut[0] && !cut[1]) continue;
      for (const p of f.parts) {
        // only what is still attached to the body (not a dropped club or a lost limb lying elsewhere)
        if ((isWeapon(p) && !f.grip) || (f.armLost && (p.role === 'upper' || p.role === 'fore')) || (f.legLost.some(Boolean) && (p.role === 'thigh' || p.role === 'shin'))) continue;
        const v = p.body.linvel(this.tmpV); p.body.setLinvel({ x: v.x + cut[0], y: v.y + cut[1] }, true);
      }
    }
  }

  /** Right-click with empty hands: pick up the nearest loose weapon in reach, anyone's. */
  private resolvePickups(): void {
    for (const f of this.fighters) {
      if (!f.pickupRequest) continue;
      f.pickupRequest = false;
      if (f.limp || f.grip || f.armLost) continue;
      const bt = f.torso.body.translation();
      let best: { item: Item; part: Part } | null = null, bestD = Infinity;
      const R = T.drop.pickupRange, ax = bt.x + Math.cos(f.pickupAim) * R * T.drop.aimReach, ay = bt.y + Math.sin(f.pickupAim) * R * T.drop.aimReach;
      const consider = (item: Item, part: Part) => { // within reach, and the one nearest where you are aiming
        const t = part.body.translation();
        if (Math.hypot(t.x - bt.x, t.y - bt.y) > R) return;
        const d = Math.hypot(t.x - ax, t.y - ay);
        if (d < bestD) { bestD = d; best = { item, part }; }
      };
      for (const g of this.fighters) {
        if (g.stick && !g.grip && g.dropCooldown <= 0) consider({ kind: 'stick', from: g.index }, g.stick); // a loose club, and not just dropped
        if (g.armLost && g.upper.role === 'upper') consider({ kind: 'limb', from: g.index, k: 0 }, g.upper); // a lost arm (not one somebody already took)
        g.legs.forEach((l, i) => { if (g.legLost[i] && l.thigh.role === 'thigh') consider({ kind: 'limb', from: g.index, k: 1 + i }, l.thigh); }); // a lost leg
      }
      for (const p of this.props) { const it = this.itemOf(p); if (it) consider(it, p); } // only what a hand can take (not a plank still in the bridge, not a standing stone)
      if (!best) continue;
      this.acquire(f, (best as { item: Item }).item);
      this.events.push({ t: 'pickup', x: bt.x, y: bt.y, v: itemCode((best as { item: Item }).item), owner: f.index, victim: (best as { item: Item }).item.kind === 'prop' ? -1 : ((best as { item: Item }).item as { from: number }).from });
    }
  }

  /** Put something into a fighter's hand: a loose club, a prop lying around, or a limb that has come off. (Clients replay this from the 'pickup' event.) */
  private acquire(f: Fighter, item: Item): void {
    if (item.kind === 'stick') {
      const g = this.fighters[item.from];
      giveStick(this.world, g, f);
      if (g !== f) this.version++;
      return;
    }
    let part: Part;
    if (item.kind === 'prop') {
      part = this.props.splice(item.index, 1)[0];
      this.ripFree(part);
      if (part.head) this.props.splice(this.props.indexOf(part.head), 1);
    } else {
      const g = this.fighters[item.from];
      part = item.k === 0 ? g.upper : g.legs[item.k - 1].thigh;
      g.parts.splice(g.parts.indexOf(part), 1);
      cutJoint(this.world, g, item.k === 0 ? g.elbow : g.legs[item.k - 1].knee); // the rest of the limb stays behind: only the thigh (or upper arm) is taken
      this.dropCut(g, item.k);
    }
    if (f.stick) { const d = dropToWorld(f, this.world); this.props.push(d); if (d.head) this.props.push(d.head); } // your own club, lying loose, is left behind for anyone
    takeIn(this.world, f, part);
    this.version++;
  }

  /** The lost limb that was just picked up must not be offered (or counted as a body part) again. */
  private dropCut(g: Fighter, k: number): void {
    if (k === 0) g.armLost = true; else g.legLost[k - 1] = true;
  }

  /** An outstretched empty hand locks onto the first part of another fighter it touches (not a club, not the floppy second arm). */
  /** What an object is, if a hand can take it: a prop, a club nobody is holding, or a limb that has come off. */
  private itemOf(part: Part): Item | null {
    if (part.chainOf) return this.itemOf(part.chainOf); // (a chain weapon's head: you take it by the handle)
    if (part.role === 'prop') { const i = this.props.indexOf(part); return i >= 0 && (part.body.isDynamic() || !!part.weapon?.spear) && !part.links?.length && part.body.mass() <= T.props.maxLift ? { kind: 'prop', index: i } : null; } // (a standing stone is too heavy to lift)
    const g = this.fighters[part.owner];
    if (!g) return null;
    if (part.role === 'stick') return g.stick === part && !g.grip && g.dropCooldown <= 0 ? { kind: 'stick', from: g.index } : null;
    if (part.role === 'upper') return g.armLost ? { kind: 'limb', from: g.index, k: 0 } : null;
    if (part.role === 'thigh') { const i = g.legs.findIndex((l) => l.thigh === part); return i >= 0 && g.legLost[i] ? { kind: 'limb', from: g.index, k: 1 + i } : null; }
    return null;
  }

  private resolveGrabs(): void {
    const take: [Fighter, Item, { x: number; y: number }][] = []; // objects to take in hand once the contact scan is over (the world must not change during it)
    for (const f of this.fighters) {
      if (!f.reaching || f.hold || f.limp) continue;
      const fist = f.fore.colliders[1];
      this.world.contactPairsWith(fist, (other) => {
        if (f.hold || take.some((t) => t[0] === f)) return;
        const vb = other.parent();
        const part = vb && this.partByBody.get(vb.handle);
        if (!part || part.role === 'off') return;
        const item = this.itemOf(part);
        if (item) { take.push([f, item, other.parent()!.translation()]); return; } // an outstretched hand takes the object it touches: aim at the one you want
        if (part.owner === f.index || isWeapon(part) || part.owner < 0) return;
        const victim = this.fighters[part.owner];
        if (!victim || victim.inBack || victim.limp || victim.held === f) return; // no grabbing the dead (a limp ragdoll under the strong grabbing arm blows up)
        this.world.contactPair(fist, other, (m) => {
          const p = !f.hold && m.numSolverContacts() > 0 && m.solverContactPoint(0, this.tmpP);
          if (!p) return;
          if (Math.hypot(f.fore.vx - part.vx, f.fore.vy - part.vy) > T.grab.maxCatchSpeed) return; // too fast to catch (a joint snapping them together would tear the bodies apart)
          f.hold = grabJoint(this.world, f, part, p);
          f.held = victim;
          f.holdFrames = 0;
          this.events.push({ t: 'grab', x: p.x, y: p.y, v: 0, owner: f.index, victim: victim.index });
        });
      });
    }
    for (const [f, item, pt] of take) {
      if (f.stick && f.grip) continue;
      this.acquire(f, item);
      f.chargeLocked = true; // let go of the button and press again to swing what you have taken
      this.events.push({ t: 'pickup', x: pt.x, y: pt.y, v: itemCode(item), owner: f.index, victim: item.kind === 'prop' ? -1 : item.from });
    }
  }

  /**
   * Body collisions: a fighter moving much faster than the one they run into hurts them. Landing on top of someone from above is a
   * stomp (bigger damage, and a 'stomp' event so a special animation can be hooked in later).
   */
  private resolveBodyHits(): void {
    const B = T.body;
    for (const f of this.fighters) {
      if (f.limp || f.inBack || f.thrown > 0 || f.knock > 0 || this.frame < f.bodyHitAt) continue; // a flung fighter's crashes are the slam rules instead; a knocked-down one tumbling is not attacking anyone (one launched by a squeeze into the floor killed the one who had just slammed them)
      for (const p of f.parts) {
        if (p.role !== 'torso' && p.role !== 'thigh' && p.role !== 'shin') continue;
        if (this.detached(f, p)) continue;
        for (const col of p.colliders) {
          this.world.contactPairsWith(col, (other) => {
            if (this.frame < f.bodyHitAt) return;
            const vb = other.parent();
            const vp = vb && this.partByBody.get(vb.handle);
            if (!vp || vp.owner === f.index || (vp.role !== 'torso' && vp.role !== 'thigh' && vp.role !== 'shin')) return;
            const victim = this.fighters[vp.owner];
            if (!victim || victim.limp || victim.inBack || this.detached(victim, vp)) return;
            if (f.held === victim || victim.held === f) return; // a holder and the one they hold bump about: not an attack (slamming them into things is)
            this.world.contactPair(col, other, (m) => {
              if (this.frame < f.bodyHitAt || m.numSolverContacts() === 0) return;
              const pt = m.solverContactPoint(0, this.tmpP) ?? this.tmpP;
              const c = this.contact(p, vp, pt, m.normal(this.tmpN));
              if (c.closing <= 0 || c.sa < c.sb * B.ratio) return; // only a much faster fighter hurts
              const vt = victim.torso.body.translation();
              const fromAbove = c.ny > 1 - B.stompAngle && pt.y < vt.y; // contact along the vertical, with the attacker higher up and coming down
              const stomp = fromAbove && p.vy > 0;
              if (c.sa < (stomp ? B.stompMinSpeed : B.minSpeed)) return;
              const impact = impactValue(c.closing, stomp ? B.stompFactor : B.factor);
              const dmg = damageFor(impact);
              if (dmg <= 0) return;
              f.bodyHitAt = this.frame + B.cooldown;
              const head = !!victim.headCollider && other.handle === victim.headCollider.handle;
              const k = knockbackFor(impact) * B.knockbackMul;
              shove(victim, c.nx * k, c.ny * k);
              if (stomp) this.events.push({ t: 'stomp', x: pt.x, y: pt.y, v: impact, owner: f.index, victim: victim.index, head, how: 'stomp', d: dmg * (head ? T.combat.headMult : 1) }); // an ordinary slam is announced as a 'hit' by wound()
              this.wound(victim, dmg * (head ? T.combat.headMult : 1), impact, pt.x, pt.y, f.index, head, !stomp, { how: stomp ? 'stomp' : 'body', nx: c.nx, ny: c.ny });
            });
          });
        }
      }
    }
  }

  /** A flung fighter crashing hard into the floor, a wall or a third fighter gets hurt (and so does that third fighter). */
  private resolveSlams(): void {
    const G = T.grab, glass: [Fighter, Part, number][] = [];
    for (const v of this.fighters) {
      // Flung, or still held and swung into something (owner: swinging someone into the ground or a wall is a body slam too). A jump
      // slam (resolveBodySlams) is scored there instead.
      const holder = this.fighters.find((g) => g.held === v);
      if (holder) v.thrownBy = holder.index;
      if ((v.thrown <= 0 && !holder) || v.slamBy >= 0) continue;
      if (v.thrown > 0) v.thrown--;
      if (v.slamWait > 0) v.slamWait--; else v.crashPeak = 0;
      if (v.limp) continue;
      for (const p of v.parts) {
        if (p.role === 'off' || (isWeapon(p) && !v.grip)) continue;
        if (holder && v.thrown <= 0 && Math.cos(v.torso.body.rotation()) > 0.55 && (p.role === 'thigh' || p.role === 'shin')) continue; // held and set down on your feet is not a slam
        for (const col of p.colliders) {
          this.world.contactPairsWith(col, (other) => {
            const ob = other.parent();
            const op = ob ? this.partByBody.get(ob.handle) : undefined;
            const third = op && op.owner !== v.index && op.owner !== v.thrownBy ? this.fighters[op.owner] : undefined;
            if (!ob || (!this.solid(ob) && !third)) return;
            this.world.contactPair(col, other, (m) => {
              if (m.numSolverContacts() === 0) return;
              const n = m.normal(this.tmpN), pt = m.solverContactPoint(0, this.tmpP) ?? p.body.translation(), c = p.body.translation();
              // the speed of the spot that hits (a limb swung round comes down faster than its middle)
              const crash = Math.abs((p.vx - p.w * (pt.y - c.y) - (op?.vx ?? 0)) * n.x + (p.vy + p.w * (pt.x - c.x) - (op?.vy ?? 0)) * n.y);
              const impact = impactValue(crash, G.slamFactor);
              if (op?.hp !== undefined && op.body.isFixed()) glass.push([v, op, impact]); // a shop window: it may give way (after the scan)
              if (impact <= v.crashPeak) return; // (a body lands a limb at a time: only a harder moment of the same crash adds anything)
              const dmg = damageFor(impact) - damageFor(v.crashPeak); // the hardest moment counts: a harder hit in the wait tops the damage up to it
              if (dmg <= 0) return;
              v.crashPeak = impact;
              v.slamWait = G.slamCooldown;
              const cause: Cause = { how: 'slam', nx: n.x, ny: n.y };
              this.wound(v, dmg, impact, pt.x, pt.y, v.thrownBy, false, true, cause);
              if (third && !third.limp) this.wound(third, dmg, impact, pt.x, pt.y, v.thrownBy, false, true, cause);
            });
          });
        }
      }
    }
    for (const [v, pane, impact] of glass) { // thrown through a window: it breaks, and they carry on through (a little slower)
      if (this.props.indexOf(pane) < 0) continue;
      damageScenery(this, pane, impact);
      if (this.props.indexOf(pane) < 0) for (const q of v.parts) q.body.setLinvel({ x: q.vx * T.props.throughGlass, y: q.vy * T.props.throughGlass }, true);
    }
  }

  /**
   * A body slam lands (see tuning.slam): the held fighter's head or body hits the ground. The damage grows with how hard it hits; a head
   * that hits first counts as a head hit (the paint and sound of one).
   */
  private resolveBodySlams(): void {
    const S = T.slam;
    for (const v of this.fighters) {
      if (v.slamBy < 0) continue;
      const g = this.fighters[v.slamBy];
      const going = !!g && g.held === v && g.slamming && !v.limp;
      if (!going && v.slamWindow === 0) { v.slamBy = -1; continue; }
      if (going) for (const part of v.parts) for (const col of part.colliders) { // any part of them: in an arc it is often a shoulder or an arm that lands first
        if (part.role === 'off' || (isWeapon(part) && !v.grip)) continue;
        if (Math.cos(v.torso.body.rotation()) > 0.55 && (part.role === 'thigh' || part.role === 'shin')) continue; // landing them on their feet is not a slam
        const head = col === v.headCollider || part.role === 'head';
        this.world.contactPairsWith(col, (other) => {
          const ob = other.parent();
          if (v.slamBy < 0 || !ob || !this.solid(ob)) return;
          this.world.contactPair(col, other, (m) => {
            if (v.slamBy < 0 || m.numSolverContacts() === 0) return;
            const n = m.normal(this.tmpN), pt = m.solverContactPoint(0, this.tmpP) ?? part.body.translation(), c = part.body.translation();
            // the speed of the spot that hits (a head swung over in an arc comes down much faster than the middle of the body)
            const speed = Math.abs((part.vx - part.w * (pt.y - c.y)) * n.x + (part.vy + part.w * (pt.x - c.x)) * n.y);
            if (speed < S.minSpeed) return;
            if (v.slamWindow === 0) v.slamWindow = S.scoreFrames; // touched down: the landing is scored over the next few frames
            if (speed > (v.slamHit?.speed ?? 0)) v.slamHit = { speed, head, x: pt.x, y: pt.y, nx: n.x, ny: n.y };
          });
        });
      }
      if (v.slamWindow > 0 && --v.slamWindow === 0 && v.slamHit) { // the landing is over: its hardest moment counts
        const h = v.slamHit;
        const dmg = damageFor(impactValue(h.speed, T.grab.slamFactor)) * S.bonus * (h.head ? T.combat.headMult : 1); // as hard as they really hit, like a throw, plus a little for doing it on purpose (and landed on their head: a head hit)
        v.slamBy = -1;
        v.slamHit = null;
        if (g) {
          g.slamming = false;
          if (g.held === v) letGo(this.world, g, false, this.events);
          g.bodyHitAt = this.frame + T.body.cooldown * 2; // landing on them straight after is not a second hit
        }
        if (!v.limp) this.wound(v, dmg, h.speed * S.impactFactor, h.x, h.y, g?.index ?? -1, h.head, true, { how: 'slam', nx: h.nx, ny: h.ny });
      }
    }
  }

  /** A mug (props.ts shatters) whose speed changed hard this frame hit something: it smashes (thrown at a wall, or broken over a head:
   *  the hit itself was scored first). */
  private shatterMugs(): void {
    const list: [Part, Fighter | undefined][] = this.props.map((p) => [p, undefined]);
    for (const g of this.fighters) if (g.stick) list.push([g.stick, g]);
    for (const [p, g] of list) {
      if (!PROPS[p.weapon?.id ?? '']?.shatters) continue;
      const v = p.body.linvel(this.tmpV);
      if (Math.hypot(v.x - p.vx, v.y - p.vy) > T.props.shatterSpeed) shatter(this, p, g);
    }
  }

  /** A heavy loose thing (a standing stone's capstone, a block knocked off a ledge) coming hard into a fighter crushes them: faster = worse. */
  private resolveCrushes(): void {
    const P = T.props;
    for (const p of this.props) {
      if (p.body.mass() < P.crushMass || (p.crushAt ?? 0) > this.frame || Math.hypot(p.vx, p.vy) + Math.abs(p.w) * (p.weapon?.length ?? 1) / 2 < P.crushSpeed) continue; // (a tipping stone's end comes down faster than its middle)
      for (const col of p.colliders) this.world.contactPairsWith(col, (other) => {
        const vb = other.parent(), vp = vb && this.partByBody.get(vb.handle);
        const v = vp && vp.role !== 'prop' && !isWeapon(vp) ? this.fighters[vp.owner] : undefined;
        if (!vp || !v || v.limp || v.inBack || this.detached(v, vp) || (p.crushAt ?? 0) > this.frame) return;
        this.world.contactPair(col, other, (m) => {
          if (m.numSolverContacts() === 0) return;
          const pt = m.solverContactPoint(0, this.tmpP) ?? this.tmpP, c = this.contact(p, vp, pt, m.normal(this.tmpN));
          if (c.closing < P.crushSpeed) return;
          const impact = impactValue(c.closing, P.crushFactor);
          p.crushAt = this.frame + P.crushCooldown;
          shove(v, c.nx * knockbackFor(impact), c.ny * knockbackFor(impact));
          this.wound(v, damageFor(impact), impact, pt.x, pt.y, -1, vp.role === 'head', true, { how: 'crush', nx: c.nx, ny: c.ny });
        });
      });
    }
  }

  /** The ground, a wall, or a ship's deck: what a body can be slammed into. */
  private solid(b: RAPIER.RigidBody): boolean { return b.isFixed() || b.isKinematic() || this.boats.some((s) => s.body === b); } // (a sign or tunnel passing the train is a wall)

  /** A big hit knocks the fighter down: they tumble (spin in proportion to the blow, head swinging back from it) and lose control for a while. */
  private knockdown(v: Fighter, impact: number, nx: number): void {
    const K = T.knock;
    if (impact < K.minImpact || v.limp) return;
    v.knock = Math.max(v.knock, Math.min(K.maxFrames, Math.round(K.frames + (impact - K.minImpact) * K.perImpact)));
    v.knockAge = 0;
    v.stun = Math.max(v.stun, v.knock);
    if (v.hold) letGo(this.world, v, false, this.events);
    v.charge = 0; v.release = 0; v.throwPending = false; v.reaching = false;
    const dir = -(Math.sign(nx) || (this.rng() < 0.5 ? -1 : 1));
    const spin = impact * K.spin * (1 + (this.rng() - 0.5) * 2 * K.spinJitter);
    v.torso.body.setAngvel(v.torso.body.angvel() + dir * spin, true);
    shove(v, 0, -impact * K.lift * fighterMass(v)); // launched up a little: air to tumble in
  }

  /** A knocked-down fighter slamming into a wall, the floor or a ledge bounces off it and tumbles again: a crash. */
  private resolveCrashes(): void {
    const K = T.knock;
    for (const f of this.fighters) {
      if (f.limp || f.knock <= 0 || f.crashWait > 0) continue;
      for (const part of f.parts) {
        if (isWeapon(part) || part.role === 'off') continue;
        const tp = part.body.translation();
        for (const col of part.colliders) this.world.contactPairsWith(col, (other) => {
          if (f.crashWait > 0 || !isWorld(other)) return;
          this.world.contactPair(col, other, (m) => {
            if (f.crashWait > 0 || m.numSolverContacts() === 0) return;
            const pt = m.solverContactPoint(0, this.tmpP) ?? this.tmpP;
            const dx = pt.x - tp.x, dy = pt.y - tp.y, d = Math.hypot(dx, dy) || 1;
            const closing = (part.vx * dx + part.vy * dy) / d; // how fast that part was heading into what it hit
            if (closing < K.crashSpeed) return;
            f.crashWait = K.crashCooldown;
            shove(f, (-dx / d) * closing * K.crashBounce * fighterMass(f), (-dy / d) * closing * K.crashBounce * fighterMass(f));
            f.torso.body.setAngvel(f.torso.body.angvel() + (this.rng() < 0.5 ? -1 : 1) * K.crashSpin, true);
            f.knock = Math.max(f.knock, K.frames / 2); // a crash keeps them down a moment longer
            this.events.push({ t: 'crash', x: pt.x, y: pt.y, v: closing, owner: f.index, victim: f.index });
          });
        });
      }
    }
  }

  /** A limb that has come off is just debris: it cannot be hit (or hit anyone) as if it were still part of its fighter. */
  private detached(v: Fighter, part: Part): boolean {
    if (part.role === 'upper' || part.role === 'fore') return v.armLost;
    if (part.role === 'thigh' || part.role === 'shin') return v.legs.some((l, i) => v.legLost[i] && (l.thigh === part || l.shin === part));
    return false;
  }

  /** Take hidden HP off a fighter and stagger them; they die at zero. */
  private wound(victim: Fighter, dmg: number, impact: number, x: number, y: number, owner: number, head = false, announce = true, cause?: Cause): void {
    this.lastImpact = impact;
    victim.hp -= dmg;
    victim.stun = T.combat.stunFrames;
    if (victim.hold && impact >= T.grab.breakImpact) letGo(this.world, victim, false, this.events); // a good hit makes a grabber let go
    if (announce) this.events.push({ t: 'hit', x, y, v: impact, owner, victim: victim.index, head, how: cause?.how, d: dmg });
    if (victim.hp <= 0) this.kill(victim, false, impact, cause);
    else if (cause) this.knockdown(victim, impact, cause.nx);
  }

  /** A club lost in the void comes back from the sky after a while, so there are always weapons in play. */
  private keepWeaponsInPlay(): void {
    const A = this.arena;
    for (const g of this.fighters) {
      if (!g.stick || g.grip) continue;
      if (g.stick.body.translation().y > A.killY) g.lostFrames++;
      else g.lostFrames = 0;
      if (g.lostFrames > A.weaponReturnFrames) {
        placeLoose(this.world, g, A.platformX + 0.8 + this.rng() * (A.platformW - 1.6), -1.5, this.rng() * 3);
      }
    }
  }

  /** A dodging fighter returns to the normal plane only when nobody is standing inside them (otherwise the physics would fling them apart). */
  private settlePlanes(): void {
    for (const f of this.fighters) {
      if (!f.inBack || f.dodge > 0) continue;
      const a = f.torso.body.translation();
      const crowded = this.fighters.some((o) => {
        if (o === f || o.limp || o.inBack) return false;
        const b = o.torso.body.translation();
        return Math.abs(a.x - b.x) < 0.6 && Math.abs(a.y - b.y) < 1.1;
      });
      if (crowded) f.dodge = 1;
      else {
        setBackPlane(f, false);
        f.attackLock = T.dodge.recoveryFrames; // a very short pause before you can attack again
      }
    }
  }

  private snapshot(): void {
    for (const b of this.boats) { const t = b.body.translation(); b.px = b.cx; b.py = b.cy; b.pa = b.ca; b.cx = t.x; b.cy = t.y; b.ca = b.body.rotation(); }
    for (const p of this.props) { const t = p.body.translation(); p.px = p.cx; p.py = p.cy; p.pa = p.ca; p.cx = t.x; p.cy = t.y; p.ca = p.body.rotation(); }
    for (const f of this.fighters) {
      for (const p of f.parts) {
        const t = p.body.translation();
        p.px = p.cx; p.py = p.cy; p.pa = p.ca;
        p.cx = t.x; p.cy = t.y; p.ca = p.body.rotation();
      }
    }
  }

  private resolveHits(): void {
    for (const f of this.fighters) {
      if (f.inBack || !f.controlled) continue; // on the background plane you cannot hit anyone, and the dummy's club is only a target
      for (const att of f.attackers) {
        if (this.frame < att.nextHit) continue;
        if ((f.limp || f.armLost) && att.kind === 'fist') continue; // a dead fighter's floppy fists hurt nobody (a club they threw still does)
        if (f.knock > 0 && att.kind === 'fist') continue; // ...nor do a knocked-down one's: a fist flailing past is not a punch (one flung past at 25 m/s 'punched' for 60); a club is a club, swung or not
        // Clubs first: a parry throws this swing back, so it must cancel the hits it would otherwise land on the body in the same frame.
        for (const clubsOnly of [true, false]) {
          if (this.frame < att.nextHit) break;
          this.world.contactPairsWith(att.collider, (other) => {
            const vb = other.parent();
            const victimPart = vb && this.partByBody.get(vb.handle);
            if (!victimPart || victimPart.owner === f.index || isWeapon(victimPart) !== clubsOnly) return;
            this.world.contactPair(att.collider, other, (m) => {
              if (m.numSolverContacts() === 0 || this.frame < att.nextHit) return; // (a hit earlier in this very frame already used up the swing)
              if (victimPart.role === 'prop') { this.hitProp(att, victimPart, m.solverContactPoint(0, this.tmpP) ?? this.tmpP, m.normal(this.tmpN)); return; } // a plank or a log
            if (isWeapon(victimPart)) { // a club (or a flail's head) hit by a club or fist: no damage, but a great clash can knock it out of a hand
                const holder = this.fighters[victimPart.owner];
                if (holder && holder.stick === victimPart && holder.grip) this.clash(f, att, holder, victimPart, m.solverContactPoint(0, this.tmpP) ?? this.tmpP, m.normal(this.tmpN));
                return;
              }
              const victim = this.fighters[victimPart.owner];
              if (att.kind === 'fist' && f.held === victim) return; // the hand holding someone is not punching them
              const head = !!victim && !!victim.headCollider && other.handle === victim.headCollider.handle;
              this.hit(f, att, victim, victimPart, m.solverContactPoint(0, this.tmpP) ?? this.tmpP, m.normal(this.tmpN), head);
            });
          });
        }
      }
    }
  }

  /** Closing speed at a contact point (from the speeds just before the physics step), the normal pointing attacker -> victim, and each side's own speed there. */
  private contact(ap: Part, vp: Part, pt: { x: number; y: number }, n: { x: number; y: number }) {
    const at = ap.body.translation();
    const vt = vp.body.translation();
    const sign = (vt.x - at.x) * n.x + (vt.y - at.y) * n.y < 0 ? -1 : 1; // orient the normal from attacker to victim
    const nx = n.x * sign, ny = n.y * sign;
    const rax = pt.x - at.x, ray = pt.y - at.y, rvx = pt.x - vt.x, rvy = pt.y - vt.y;
    const avx = ap.vx - ap.w * ray, avy = ap.vy + ap.w * rax;
    const bvx = vp.vx - vp.w * rvy, bvy = vp.vy + vp.w * rvx;
    return { nx, ny, closing: (avx - bvx) * nx + (avy - bvy) * ny, sa: Math.hypot(avx, avy), sb: Math.hypot(bvx, bvy) };
  }

  /** A club hit by a club or a fist: no damage, but a great clash can knock it out of the holder's hand. */
  private clash(f: Fighter, att: Attacker, holder: Fighter, vp: Part, pt: { x: number; y: number }, n: { x: number; y: number }): void {
    const c = this.contact(att.part, vp, pt, n);
    if (att.kind === 'stick' && this.parry(f, att, holder, c, pt)) return;
    if (vp.weapon?.material === 'shield') return; // a shield takes the blow: it is not knocked out of the hand
    const impact = impactValue(c.closing, (att.kind === 'stick' ? att.part.weapon ?? T.stick : T.fist).impactFactor);
    this.tryDisarm(f, holder, vp, pt, impact, c.nx, c.ny, c.sa, c.sb);
  }

  /** Is this point within the weak spot around the fighter's hand? */
  private nearHand(f: Fighter, pt: { x: number; y: number }): boolean {
    const ft = f.fore.body.translation(), fa = f.fore.body.rotation();
    const hx = ft.x + Math.cos(fa) * T.fighter.armLength / 2, hy = ft.y + Math.sin(fa) * T.fighter.armLength / 2;
    return Math.hypot(pt.x - hx, pt.y - hy) < T.disarm.handRadius;
  }

  /**
   * Parry: a fast swing that runs into a club that is held still (or nearly) is thrown back the way it came, the swinger is pushed back a
   * little and staggers, and the blocker is unmoved. A club that is itself swinging fast does not parry (that is a clash), nor does a hit at the hand.
   */
  private parry(f: Fighter, att: Attacker, holder: Fighter, c: { nx: number; ny: number; closing: number; sa: number; sb: number }, pt: { x: number; y: number }): boolean {
    const P = T.parry;
    if (c.closing <= 0 || c.sa < P.minSpeed || c.sb > P.maxSpeed || c.sa < c.sb * P.ratio) return false;
    if (this.nearHand(holder, pt)) return false; // the grip end is the weak spot: a hit there can disarm instead
    att.nextHit = this.frame + P.cooldown;
    // The weapon goes back the opposite way, fast: its own speed reversed (and at least a minimum), and its spin reversed.
    const wb = att.part.body, v = wb.linvel(this.tmpV), sp = Math.hypot(v.x, v.y) || 1;
    const out = Math.max(P.bounceMin, sp * P.bounce);
    wb.setLinvel({ x: (-v.x / sp) * out, y: (-v.y / sp) * out }, true);
    wb.setAngvel(-wb.angvel() * P.bounce, true);
    // The swinger: a small push back from the blocker, a stagger, and a short pause before the next swing.
    shove(f, -c.nx * P.knock * fighterMass(f), -c.ny * P.knock * fighterMass(f));
    f.stun = Math.max(f.stun, P.stun);
    f.attackLock = Math.max(f.attackLock, P.lockFrames);
    f.charge = 0; f.release = 0; f.throwPending = false;
    this.events.push({ t: 'parry', x: pt.x, y: pt.y, v: c.sa, owner: holder.index, victim: f.index });
    return true;
  }

  /**
   * Where a hit lands decides whether it disarms. The hand (and the grip end of the club) is the weak spot; elsewhere on the arm
   * needs a much bigger hit; in a club-on-club clash only a clearly faster club wins.
   */
  private tryDisarm(f: Fighter, victim: Fighter, vp: Part, pt: { x: number; y: number }, impact: number, nx: number, ny: number, sa = 0, sb = 0): void {
    const D = T.disarm;
    if (!victim.grip || !victim.stick || impact < Math.min(D.handImpact, D.armImpact, D.clashImpact)) return;
    const nearHand = this.nearHand(victim, pt);
    let ok = false;
    if (nearHand) ok = impact >= D.handImpact;
    else if (vp.role === 'fore' || vp.role === 'upper') ok = impact >= D.armImpact;
    else if (vp.role === 'stick') ok = impact >= D.clashImpact && sa > sb * D.clashRatio;
    if (!ok) return;
    this.world.removeImpulseJoint(victim.grip, true);
    victim.grip = null;
    victim.charge = 0;
    victim.release = 0;
    victim.throwPending = false;
    victim.stun = Math.max(victim.stun, 10);
    victim.dropCooldown = D.pickupDelay;
    const sbody = victim.stick.body, v = sbody.linvel(this.tmpV);
    sbody.setLinvel({ x: v.x + nx * D.kick, y: v.y + ny * D.kick - D.kickUp }, true);
    sbody.setAngvel((this.rng() - 0.5) * 2 * D.spin, true);
    this.events.push({ t: 'disarm', x: pt.x, y: pt.y, v: impact, owner: f.index, victim: victim.index });
  }

  private hit(f: Fighter, att: Attacker, victim: Fighter | undefined, vp: Part, pt: { x: number; y: number }, n: { x: number; y: number }, head: boolean): void {
    if (!victim || victim.limp || this.detached(victim, vp)) return;
    const { nx, ny, closing, sa, sb } = this.contact(att.part, vp, pt, n);
    const W = att.kind === 'stick' ? att.part.weapon ?? T.stick : T.fist, own = att.kind === 'stick' ? att.part.weapon : undefined;
    const impact = impactValue(closing, W.impactFactor) * (own?.spear && !f.grip ? T.special.spearThrown : 1); // (a spear thrown point-first)
    this.tryDisarm(f, victim, vp, pt, impact, nx, ny, sa, sb); // a great hit on the hand or arm can knock the club out
    const punch = att.kind === 'fist' && f.punch > 0 && !f.grip; // a quick punch (owner: it knocks a rival away more than it hurts)
    let dmg = damageFor(impact, head ? T.combat.headMult : 1) * (punch ? (this.arena.noWeapons ? T.punch.fistsOnlyHurt : T.punch.hurt) : 1);
    if (dmg <= 0) return;
    // A huge club blow to a limb takes the limb, not the life: the victim is left with a few HP (unless they were already nearly dead).
    const maiming = att.kind === 'stick' && impact >= T.maim.impact && !head && ['upper', 'fore', 'thigh', 'shin'].includes(vp.role);
    if (maiming && victim.hp > T.maim.leaveHp) dmg = Math.min(dmg, victim.hp - T.maim.leaveHp);

    att.nextHit = this.frame + (maiming ? T.maim.swingCooldown : T.combat.hitCooldown); // the swing that takes a limb does not also finish them off
    this.lastImpact = impact;
    victim.hp -= dmg;
    victim.stun = T.combat.stunFrames;
    if (victim.hold && impact >= T.grab.breakImpact) letGo(this.world, victim, false, this.events); // a good hit on a grabber, from the one they hold or anyone else, breaks the hold
    const killing = victim.hp <= 0;
    const k = knockbackFor(impact) * (att.kind === 'fist' ? T.fist.knockbackMul : 1) * (own?.push ?? 1), pull = own?.pull ? -1 : 1; // punches shove much less than a club; a shield shoves more; the gravity hammer pulls
    shove(victim, pull * nx * k, pull * ny * k - impact * T.combat.knockbackUp);
    if (punch) { const m = fighterMass(victim); shove(victim, (Math.sign(nx) || f.side) * T.punch.knock * m, -T.punch.lift * m); } // ...back, and a little off their feet
    if (punch && T.punch.disarmsGuns && victim.grip && victim.stick?.weapon?.gun && !killing) { // ...and their gun flies out of their hand (owner: like Stick Fight)
      const m = victim.stick.body.mass();
      this.disarmByShot(victim, (Math.sign(nx) || f.side) * T.punch.gunFling * m, -T.punch.gunFling * 0.5 * m, f.index);
    }
    if (!killing) this.knockdown(victim, impact, nx);
    // A hit tips the victim backward (head swings away from the blow) a little: smooth and funny, not a random flip.
    victim.torso.body.applyTorqueImpulse(-Math.sign(nx || 1) * impact * T.combat.spinScale * (0.8 + 0.4 * this.rng()), true);
    this.events.push({ t: 'hit', x: pt.x, y: pt.y, v: impact, owner: f.index, victim: victim.index, head, how: att.kind === 'stick' ? 'club' : 'fist', w: att.kind === 'stick' ? att.part.weapon?.id : undefined, d: dmg });
    if (maiming && !killing) this.maim(victim, vp, nx, ny);
    if (killing) this.kill(victim, false, impact, { how: att.kind === 'stick' ? 'club' : 'fist', part: vp, head, nx, ny });
  }

  private kill(f: Fighter, fell: boolean, impact = 0, cause?: Cause): void {
    f.limp = true;
    f.deadAt = this.frame;
    f.dropCooldown = 0; // the club they were holding can be taken straight away
    for (const g of this.fighters) if (g.held === f) letGo(this.world, g, false, this.events); // nobody keeps hold of a falling ragdoll
    if (f.hold) letGo(this.world, f, false, this.events); // and the dead let go of whoever they were holding
    if (f.inBack) setBackPlane(f, false);
    if (f.grip) { this.world.removeImpulseJoint(f.grip, true); f.grip = null; }
    for (const p of ragdoll(this.world, f, this.rng)) this.partByBody.set(p.body.handle, p);
    this.version++; // the ragdoll added parts, so the renderer must rebuild its sprites
    const t = f.torso.body.translation();
    this.events.push({ t: fell ? 'fall' : 'die', x: t.x, y: t.y, v: impact, owner: f.index, victim: f.index });
    if (!fell && cause) this.stageDeath(f, impact, cause);
  }

  /**
   * How a death looks (cartoon, not gory), decided by what killed them. A huge blow blows the body apart; a stomp or a crash flattens it;
   * a hard club hit takes off whatever it hit. Only the server runs the physics of this; clients see the pieces move and get the event for the effect.
   */
  private stageDeath(f: Fighter, impact: number, c: Cause): void {
    const D = T.death, t = f.torso.body.translation();
    if (impact >= D.explodeImpact) {
      for (const j of [f.shoulder, f.elbow, f.neck, f.offShoulder, f.offElbow, ...f.legs.flatMap((l) => [l.hip, l.knee])]) cutJoint(this.world, f, j);
      for (const p of f.parts) {
        if (isWeapon(p)) continue;
        const q = p.body.translation(), dx = q.x - t.x, dy = q.y - t.y, d = Math.hypot(dx, dy) || 1;
        const v = p.body.linvel(this.tmpV), s = D.explodeSpeed * (0.7 + 0.6 * this.rng());
        p.body.setLinvel({ x: v.x + (dx / d) * s, y: v.y + (dy / d) * s - D.explodeLift }, true);
        p.body.setAngvel((this.rng() - 0.5) * 2 * D.explodeSpin, true);
      }
      this.events.push({ t: 'explode', x: t.x, y: t.y, v: impact, owner: f.index, victim: f.index });
    } else if ((c.how === 'stomp' || c.how === 'slam' || c.how === 'crush') && impact >= D.crushImpact) {
      this.events.push({ t: 'crush', x: t.x, y: t.y, v: impact, owner: f.index, victim: f.index });
    } else if (c.how === 'club' && c.head && impact >= T.maim.impact) {
      const head = f.parts.find((p) => p.role === 'head'); // a huge killing blow to the head takes it off
      cutJoint(this.world, f, f.neck);
      if (head) { this.flingPart(head, c.nx, c.ny); this.events.push({ t: 'dismember', x: head.body.translation().x, y: head.body.translation().y, v: impact, owner: f.index, victim: f.index }); }
    }
  }

  private flingPart(p: Part, nx: number, ny: number): void {
    const M = T.maim, v = p.body.linvel(this.tmpV);
    p.body.setLinvel({ x: v.x + nx * M.kick, y: v.y + ny * M.kick - M.lift }, true);
    p.body.setAngvel((this.rng() - 0.5) * 2 * M.spin, true);
  }

  /**
   * A huge hit to a limb takes the limb off, and the fighter plays on with the consequence until the round ends (every round is a fresh body):
   * no arm = no attacking, grabbing or weapon; one leg = a slow hobble and a low jump; no legs = crawling.
   */
  private maim(v: Fighter, part: Part, nx: number, ny: number): void {
    let limb: Part | null = null;
    if ((part.role === 'upper' || part.role === 'fore') && !v.armLost) {
      cutJoint(this.world, v, v.shoulder);
      limb = v.upper;
      if (v.grip) { this.world.removeImpulseJoint(v.grip, true); v.grip = null; v.dropCooldown = T.drop.pickupDelay; } // the weapon falls from the missing hand
      letGo(this.world, v, false, this.events);
      v.charge = 0; v.release = 0; v.punch = 0; v.reaching = false; v.throwPending = false;
    } else if (part.role === 'thigh' || part.role === 'shin') {
      const i = v.legs.findIndex((l) => l.thigh === part || l.shin === part);
      if (i < 0 || v.legLost[i]) return;
      cutJoint(this.world, v, v.legs[i].hip);
      limb = v.legs[i].thigh;
    }
    if (!limb) return;
    this.flingPart(limb, nx, ny);
    v.stun = Math.max(v.stun, T.maim.stunFrames);
    const q = limb.body.translation();
    this.events.push({ t: 'dismember', x: q.x, y: q.y, v: 0, owner: v.index, victim: v.index });
  }

  private checkDeaths(): void {
    const A = this.arena;
    for (const f of this.fighters.slice()) {
      const t = f.torso.body.translation();
      if (!f.limp && (t.y > A.killY || t.x < -A.killXMargin || t.x > A.viewW + A.killXMargin)) this.kill(f, true);
      else if (!f.limp && f.sinking && (t.y > surfaceY(A, this.frame, t.x) + (f.tar ? T.tar : T.swim).drownDepth || (f.tar && f.wetFrames >= T.tar.frames + T.tar.swallow))) this.kill(f, true); // went under (or the tar has them, clinging to its edge or not): a knock-off
      if (!this.matchActive && f.limp && this.frame - f.deadAt >= T.respawn.frames) { this.respawn(f); this.events.push({ t: 'respawn', x: f.spawnX, y: f.spawnY, v: 0, owner: f.index, victim: -1 }); } // alone, you respawn; in a fight you stay down
    }
    if (this.matchActive) this.updateRound();
  }

  /** The last fighter standing wins the round and scores a point; after a short pause the next round starts. */
  private updateRound(): void {
    if (this.matchOver) return;
    if (this.roundOver) {
      if (this.frame - this.roundOverAt >= T.match.resultFrames + this.extraRoundPause) {
        if (this.endsMatch) { // the last round, and one leads: the match is theirs
          const scores = this.scores.slice(0, this.count), top = Math.max(...scores);
          this.matchOver = true;
          this.matchWinner = scores.indexOf(top);
          this.matchOverAt = this.frame;
          this.events.push({ t: 'match', x: 0, y: 0, v: top, owner: this.matchWinner, victim: -1 });
          return;
        }
        this.round++;
        this.roundOver = false;
        this.roundWinner = -1;
        this.build();
        this.events.push({ t: 'newround', x: 0, y: 0, v: 0, owner: -1, victim: -1 });
      }
      return;
    }
    if (this.fighters.filter((f) => f.controlled && !this.gone[f.index]).length < 2) return; // nobody to fight (the rest left): the round waits, so the one who stayed cannot farm points
    const alive = this.fighters.filter((f) => f.controlled && !f.limp);
    if (alive.length > 1) return;
    this.roundOver = true;
    this.roundOverAt = this.frame;
    this.roundWinner = alive.length === 1 ? alive[0].index : -1;
    if (this.roundWinner >= 0) this.scores[this.roundWinner]++;
    this.events.push({ t: 'round', x: 0, y: 0, v: 0, owner: this.roundWinner, victim: -1 });
  }
}

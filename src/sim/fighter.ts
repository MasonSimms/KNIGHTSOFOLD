import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { Collider, ImpulseJoint, RevoluteImpulseJoint, RigidBody, World } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import type { Weapon } from '../content/weapons';
import type { PlayerInput, SimEvent } from './types';

export type Shape =
  | { k: 'ball'; r: number; x: number; y: number }
  | { k: 'cap'; hl: number; r: number; x: number; y: number; rot: number }; // capsule long axis = local Y before rot

export interface Part {
  body: RigidBody;
  shapes: Shape[]; // what the renderer draws (the same as the colliders)
  colliders: Collider[];
  role: 'torso' | 'upper' | 'fore' | 'stick' | 'head' | 'thigh' | 'shin' | 'off' | 'prop'; // 'off' = the floppy second arm; 'prop' = a loose object in the world (a plank, a log...)
  links?: ImpulseJoint[]; // a prop that is part of a structure (a bridge plank): the joints holding it
  weapon?: Weapon; // a club's own stats (so it keeps them when someone else picks it up)
  owner: number;
  // interpolation poses (previous / current sim step) for the renderer
  px: number; py: number; pa: number; cx: number; cy: number; ca: number;
  // velocity captured just before the physics step (used for impact maths)
  vx: number; vy: number; w: number;
}

export interface Attacker {
  collider: Collider;
  part: Part;
  kind: 'fist' | 'stick';
  nextHit: number; // earliest frame this weapon may hit again
}

export interface Fighter {
  index: number;
  controlled: boolean; // false = training dummy (balances, never moves on its own)
  parts: Part[];
  torso: Part;
  upper: Part;
  fore: Part;
  stick: Part | null;
  shoulder: RevoluteImpulseJoint;
  elbow: RevoluteImpulseJoint;
  grip: ImpulseJoint | null; // the hand-to-club joint; null = unarmed
  headCollider: Collider | null; // hits on this one count as head shots (null once the head has come off in the ragdoll)
  attackers: Attacker[];
  hp: number;
  limp: boolean; // dead: arms go floppy
  ragdolled: boolean; // dead: the head has come off onto a floppy neck and the legs are limp
  grounded: boolean;
  groundDist: number; // how far below the hips the floor is (Infinity = nothing in reach)
  groundBody: RigidBody | null; // what the floor below the hips is (a loose object or plank gets pushed back down by the stand spring)
  legs: { thigh: Part; shin: Part; hip: RevoluteImpulseJoint; knee: RevoluteImpulseJoint }[];
  cutJoints: Set<unknown>; // joints that have been removed (a lost limb, a blown-apart body): never touch them again
  armLost: boolean; // the fighting arm is gone: no attacking, grabbing or holding a weapon this round
  legLost: [boolean, boolean]; // a leg is gone (slower, lower jump; both gone = crawling)
  neck: RevoluteImpulseJoint | null; // once the head has come off onto a floppy neck (death)
  offShoulder: RevoluteImpulseJoint; // the second arm: only for show
  offElbow: RevoluteImpulseJoint;
  bodyHitAt: number; // earliest frame this fighter may body-slam again
  gait: number; // walk cycle phase
  kneeSide: number; // which way the knees currently fold (follows the facing)
  wall: number; // -1 / 0 / 1: touching a wall on the left / none / the right (in the air only)
  wallDir: number; // the last wall touched
  wallCoyote: number; // frames left in which a wall jump still works
  wallLock: number; // frames of switched-off steering after a wall jump
  tuck: number; // frames left of holding the club raised over the head after a wall jump (so it clears the platform edge)
  dodge: number; // frames left in the background plane (0 = none)
  dodgeCooldown: number; // frames until another dodge is allowed
  inBack: boolean; // currently on the background plane (collisions with fighters and weapons are off)
  prevDodge: boolean;
  stun: number;
  carried: number; // frames left of being held by someone (the holder renews it): you do not hold yourself up on your feet
  slamming: boolean; // holding someone, came off the ground and holding S: landing them hard is a slam (see tuning.slam)
  slamBy: number; // being slammed by this fighter (-1 = not)
  slamArc: number; // while slamming: where the grabbing arm is sweeping to (radians, as if facing right: 0 = forward, -PI/2 = up)
  deadAt: number;
  charge: number; // frames the attack button has been held (armed)
  punch: number; // 0 = not punching, otherwise frames since the punch started (unarmed)
  side: number; // 1 = facing right, -1 = facing left (from the aim, with hysteresis)
  prevAim: number; // last frame's aim angle, to know how fast the mouse is turning
  release: number; // frames left of the post-release burst
  releaseMul: number; // size of that burst (depends on charge)
  prevJump: boolean;
  chargeLocked: boolean; // after a dodge cancels a charge: let go of the button and press again to start a new one
  throwPending: boolean; // a charged throw is under way: the club is let go partway through the swing
  throwPower: number; // strength (0..1) of that throw
  poseE: number; // smoothed elbow target (so poses glide)
  poseW: number; // smoothed wrist target
  crouch: number; // 0 standing .. 1 all the way down (lying)
  attackLock: number; // frames left before an attack can start (just after a dodge)
  punchPower: number; // strength (0..1) of the punch being thrown
  reaching: boolean; // unarmed, attack held: the hand is out, grabbing whatever fighter it touches
  hold: ImpulseJoint | null; // the hand-to-someone joint while holding a fighter
  held: Fighter | null; // who is being held
  holdFrames: number; // how long the current grab has lasted
  thrownBy: number; // who flung this fighter (-1 = nobody)
  thrown: number; // frames left in which a hard crash hurts
  slamWait: number; // frames before another crash can hurt (unless it is harder than the one that started the wait: see crashPeak)
  crashPeak: number; // the impact of the crash being waited out: a harder one in the wait tops the damage up to it
  slamWindow: number; // frames left in which a slam that has touched down is still landing (its hardest moment counts)
  slamHit: { speed: number; head: boolean; x: number; y: number; nx: number; ny: number } | null; // the hardest moment of that landing so far
  jumpBuffer: number; // frames a jump press is remembered (so pressing a touch early still jumps)
  coyote: number; // frames after leaving a ledge during which a jump still works
  leanNow: number; // the lean the body is easing toward its wanted lean (radians; see tuning.lean.ease)
  landDip: number; // knees giving after a landing, in crouch units (0..1; see tuning.landDip)
  fallVy: number; // how fast you were falling on the last frame in the air (m/s, + = down): how hard the landing is
  still: number; // frames spent off the ground going nowhere (held up by something that is not a floor: see motion.stuckFrames)
  stillX: number; stillY: number; // the spot it has not got away from
  prevDrop: boolean;
  pickupRequest: boolean; // right-click with empty hands: the world looks for a loose weapon in reach
  knock: number; // frames left of being knocked down by a big hit: limp, tumbling, no control (0 = not)
  knockAge: number; // frames since the knockdown began
  crashWait: number; // frames before another crash into the world can bounce them
  pickupAim: number; // where the cursor pointed when they asked: the thing they aim at is the thing they pick up
  lostFrames: number; // how long this fighter's club has been lost in the void
  dropCooldown: number; // frames until a dropped club can be picked up again
  spawnX: number;
  spawnY: number;
}

export const GROUP_WORLD = 1; // loose things in the world: bridge planks, props, dropped weapons
/** The fixed scenery: the ground, ledges and walls. A weapon in a hand passes through it (owner: platforms must never block a swing, as in
 * Stick Fight and SpiderHeck; a held club also used to hook a ledge and leave you hanging from it). */
const GROUP_TERRAIN = 0x2000;
/** Rapier groups: high 16 bits = membership, low 16 = filter. Fighters ignore their own parts, hit everything else. */
export function ownerGroups(owner: number): number {
  const mem = 1 << (owner + 1);
  return ((mem << 16) | (0xffff & ~mem)) >>> 0;
}
export const worldGroups = ((GROUP_WORLD << 16) | 0xffff) >>> 0;
export const terrainGroups = ((GROUP_TERRAIN << 16) | 0xffff) >>> 0;
/** The background plane: touches the ground and loose things only, so it passes through every fighter and weapon. */
const backGroups = ((0x8000 << 16) | GROUP_WORLD | GROUP_TERRAIN) >>> 0;
/** The floppy second arm: touches the floor and walls only, never a fighter or a weapon. */
const offGroups = ((0x4000 << 16) | GROUP_WORLD | GROUP_TERRAIN) >>> 0;

/** A weapon in a hand passes through the scenery; a loose one (dropped, knocked out of a hand) lands on it like anything else. Every frame. */
export function syncStickGroups(f: Fighter): void {
  if (!f.stick) return;
  const g = ((f.inBack ? backGroups : ownerGroups(f.index)) & ~(f.grip ? GROUP_TERRAIN : 0)) >>> 0;
  for (const c of f.stick.colliders) if (c.collisionGroups() !== g) c.setCollisionGroups(g);
}

/** Move a whole fighter (body, arm, club) between the normal plane and the background plane. */
export function setBackPlane(f: Fighter, back: boolean): void {
  f.inBack = back;
  const g = back ? backGroups : ownerGroups(f.index);
  for (const p of f.parts) if (p.role !== 'off') for (const c of p.colliders) c.setCollisionGroups(g);
}

interface ShapeDef { s: Shape; mass: number; attacker?: 'fist' | 'stick' }

function addPart(
  world: World, owner: number, role: Part['role'], x: number, y: number, angle: number,
  defs: ShapeDef[], attackers: Attacker[] | null, damping = { lin: 0, ang: 0 },
): Part {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y).setRotation(angle)
      .setLinearDamping(damping.lin).setAngularDamping(damping.ang).setCcdEnabled(role !== 'torso'),
  );
  const part: Part = {
    body, shapes: defs.map((d) => d.s), colliders: [], role, owner,
    px: x, py: y, pa: angle, cx: x, cy: y, ca: angle, vx: 0, vy: 0, w: 0,
  };
  for (const d of defs) {
    const desc = d.s.k === 'ball' ? RAPIER.ColliderDesc.ball(d.s.r) : RAPIER.ColliderDesc.capsule(d.s.hl, d.s.r).setRotation(d.s.rot);
    desc.setTranslation(d.s.x, d.s.y).setMass(d.mass).setFriction(T.fighter.friction)
      .setRestitution(T.fighter.restitution).setCollisionGroups(ownerGroups(owner));
    const collider = world.createCollider(desc, body);
    part.colliders.push(collider);
    if (d.attacker && attackers) attackers.push({ collider, part, kind: d.attacker, nextHit: 0 });
  }
  return part;
}

function revolute(world: World, a: RigidBody, ax: number, ay: number, b: RigidBody, bx: number, by: number): RevoluteImpulseJoint {
  const j = world.createImpulseJoint(RAPIER.JointData.revolute({ x: ax, y: ay }, { x: bx, y: by }), a, b, true) as RevoluteImpulseJoint;
  j.configureMotorModel(RAPIER.MotorModel.ForceBased); // stiffness in N*m per radian (the default model is far too weak)
  return j;
}

export function buildFighter(world: World, index: number, x: number, y: number, controlled: boolean, armed: boolean, weapon: Weapon): Fighter {
  const F = T.fighter;
  const L = F.armLength;
  const armHl = L / 2 - F.armRadius;
  const damp = { lin: F.armLinearDamping, ang: F.armAngularDamping };
  const attackers: Attacker[] = [];

  // The body's centre is the hips; the chest capsule sits above them and the head above that. Real legs hang from the hips.
  const LG = T.legs;
  const torso = addPart(world, index, 'torso', x, y, 0, [
    { s: { k: 'cap', hl: LG.torsoHalf, r: F.torsoRadius, x: 0, y: LG.torsoY, rot: 0 }, mass: F.torsoMass },
    { s: { k: 'ball', r: F.headRadius, x: 0, y: F.headY }, mass: F.headMass },
  ], null);
  // Extra resistance to turning: without it the arm's own motor twists the light chest around faster than balance can hold it.
  torso.body.setAdditionalMassProperties(0, { x: 0, y: LG.torsoY }, F.torsoInertia, true);
  const legs = [-1, 1].map((side) => {
    const seg = (role: 'thigh' | 'shin', len: number, cy: number) => {
      const p = addPart(world, index, role, x + side * 0.02, cy, 0, [
        { s: { k: 'cap', hl: len / 2 - LG.radius, r: LG.radius, x: 0, y: 0, rot: 0 }, mass: LG.mass },
      ], null, { lin: 0, ang: 0.5 });
      for (const c of p.colliders) c.setFriction(LG.friction);
      return p;
    };
    const thigh = seg('thigh', LG.thigh, y + LG.thigh / 2);
    const shin = seg('shin', LG.shin, y + LG.thigh + LG.shin / 2);
    const hip = revolute(world, torso.body, side * 0.02, 0, thigh.body, 0, -LG.thigh / 2);
    hip.setLimits(-LG.hipLimit, LG.hipLimit);
    const knee = revolute(world, thigh.body, 0, LG.thigh / 2, shin.body, 0, -LG.shin / 2);
    knee.setLimits(0, LG.kneeLimit);
    return { thigh, shin, hip, knee };
  });

  // One arm per fighter. It starts pointing right (angle 0); the shoulder motor swings it to its pose.
  const sx = x, sy = y + F.shoulderY;
  const arm = (() => {
    const upper = addPart(world, index, 'upper', sx + L / 2, sy, 0, [
      { s: { k: 'cap', hl: armHl, r: F.armRadius, x: 0, y: 0, rot: Math.PI / 2 }, mass: F.upperMass },
    ], null, damp);
    const fore = addPart(world, index, 'fore', sx + 1.5 * L, sy, 0, [
      { s: { k: 'cap', hl: armHl, r: F.armRadius, x: 0, y: 0, rot: Math.PI / 2 }, mass: F.foreMass },
      { s: { k: 'ball', r: F.fistRadius, x: L / 2, y: 0 }, mass: F.fistMass, attacker: controlled ? 'fist' : undefined },
    ], attackers, damp);
    const shoulder = revolute(world, torso.body, 0, F.shoulderY, upper.body, -L / 2, 0);
    const elbow = revolute(world, upper.body, L / 2, 0, fore.body, -L / 2, 0);
    elbow.setLimits(-T.arm.elbowLimit, T.arm.elbowLimit);
    return { upper, fore, shoulder, elbow };
  })();

  // The second arm: decoration that flops along with the body (no motors, only joint friction; touches only the floor and walls).
  const off = [0.5, 1.5].map((k, i) => addPart(world, index, 'off', sx + k * L, sy, 0, [
    { s: { k: 'cap', hl: armHl, r: F.armRadius, x: 0, y: 0, rot: Math.PI / 2 }, mass: T.offArm.mass },
    ...(i === 1 ? [{ s: { k: 'ball' as const, r: F.fistRadius, x: L / 2, y: 0 }, mass: 0.05 }] : []),
  ], null, damp));
  for (const p of off) for (const c of p.colliders) c.setCollisionGroups(offGroups);
  const offShoulder = revolute(world, torso.body, 0, F.shoulderY, off[0].body, -L / 2, 0);
  const offElbow = revolute(world, off[0].body, L / 2, 0, off[1].body, -L / 2, 0);
  offElbow.setLimits(-T.arm.elbowLimit, T.arm.elbowLimit);
  for (const j of [offShoulder, offElbow]) j.configureMotorPosition(0, 0, T.offArm.damping);

  const parts = [torso, ...off, ...legs.flatMap((l) => [l.thigh, l.shin]), arm.upper, arm.fore];
  const f: Fighter = {
    index, controlled, parts, torso, upper: arm.upper, fore: arm.fore, stick: null,
    shoulder: arm.shoulder, elbow: arm.elbow,
    grip: null, headCollider: torso.colliders[1], attackers, hp: F.hp, limp: false, ragdolled: false, grounded: false, groundDist: Infinity, groundBody: null, legs, cutJoints: new Set(), armLost: false, legLost: [false, false], neck: null, offShoulder, offElbow, bodyHitAt: 0, gait: 0, kneeSide: 1, wall: 0, wallDir: 0, wallCoyote: 0, wallLock: 0, tuck: 0, carried: 0, slamming: false, slamBy: -1, slamArc: 0,
    dodge: 0, dodgeCooldown: 0, inBack: false, prevDodge: false,
    stun: 0, deadAt: 0,
    charge: 0, punch: 0, side: 1, prevAim: 0, release: 0, releaseMul: 1, prevJump: false, chargeLocked: false, throwPending: false, throwPower: 0, poseE: 0, poseW: 0, crouch: 0, attackLock: 0, punchPower: 0, reaching: false, hold: null, held: null, holdFrames: 0, thrownBy: -1, thrown: 0, slamWait: 0, crashPeak: 0, slamWindow: 0, slamHit: null, jumpBuffer: 0, coyote: 0, still: 0, stillX: 0, stillY: 0, leanNow: 0, landDip: 0, fallVy: 0, prevDrop: false, pickupRequest: false, pickupAim: 0, knock: 0, knockAge: 0, crashWait: 0, lostFrames: 0, dropCooldown: 0,
    spawnX: x, spawnY: y,
  };

  if (armed) {
    const S = weapon;
    const grip = S.length / 2 - S.gripFromEnd; // grip point sits this far behind the stick centre
    const stick = addPart(world, index, 'stick', sx + 2 * L + grip, sy, 0, [
      { s: { k: 'cap', hl: S.length / 2 - S.thickness / 2, r: S.thickness / 2, x: 0, y: 0, rot: Math.PI / 2 }, mass: S.mass, attacker: 'stick' },
    ], attackers, { lin: 0, ang: 0.2 });
    stick.weapon = weapon;
    f.stick = stick;
    parts.push(stick);
    attachStick(world, f);
  }
  return f;
}

const tmp = { x: 0, y: 0 };

/** Put the club into the hand (used once, when the fighter is built). */
function attachStick(world: World, f: Fighter): void {
  const stick = f.stick!;
  const L = T.fighter.armLength;
  const W = stick.weapon ?? T.stick;
  const grip = W.length / 2 - W.gripFromEnd;
  // Snap the stick into the hand, in line with the forearm, so the joint starts relaxed.
  const fore = f.fore.body;
  const a = fore.rotation();
  const c = Math.cos(a), s = Math.sin(a);
  const ft = fore.translation();
  stick.body.setTranslation({ x: ft.x + c * (L / 2 + grip), y: ft.y + s * (L / 2 + grip) }, true);
  stick.body.setRotation(a, true);
  stick.body.setLinvel({ x: 0, y: 0 }, true);
  stick.body.setAngvel(0, true);
  const j = revolute(world, fore, L / 2, 0, stick.body, -grip, 0);
  j.setLimits(-T.longMelee.wristLimit, T.longMelee.wristLimit);
  f.grip = j;
  const pose = (p: Part) => { const t = p.body.translation(); p.px = p.cx = t.x; p.py = p.cy = t.y; p.pa = p.ca = p.body.rotation(); };
  pose(stick);
}

/** Remove a joint (a limb comes off), once. Everything that works the joints must skip the ones in `cutJoints`, or the physics engine panics. */
export function cutJoint(world: World, f: Fighter, j: ImpulseJoint | null): void {
  if (!j || f.cutJoints.has(j)) return;
  world.removeImpulseJoint(j, true);
  f.cutJoints.add(j);
  if (j === f.shoulder || j === f.elbow) f.armLost = true;
  f.legs.forEach((l, i) => { if (j === l.hip || j === l.knee) f.legLost[i] = true; });
}

/** A loose object in the world: a plank, a log, a bone. A capsule on its side; it can be picked up and used as a club. */
export function createProp(world: World, x: number, y: number, angle: number, spec: { kind: string; len: number; thick: number; mass: number; factor?: number }): Part {
  const r = spec.thick / 2, hl = Math.max(0.01, spec.len / 2 - r);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y).setRotation(angle).setLinearDamping(0.05).setAngularDamping(0.5).setCcdEnabled(true));
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(hl, r).setRotation(Math.PI / 2).setMass(spec.mass).setFriction(0.8).setRestitution(0.05).setCollisionGroups(worldGroups), body);
  return {
    body, shapes: [{ k: 'cap', hl, r, x: 0, y: 0, rot: Math.PI / 2 }], colliders: [collider], role: 'prop', owner: -1,
    px: x, py: y, pa: angle, cx: x, cy: y, ca: angle, vx: 0, vy: 0, w: 0,
    weapon: { id: spec.kind, name: spec.kind, length: spec.len, thickness: spec.thick, mass: spec.mass, gripFromEnd: Math.min(0.2, spec.len * 0.25), impactFactor: spec.factor ?? T.props.factor },
  };
}

/**
 * Put an object (a loose prop, or a limb that has come off) into a fighter's hand as their club. The caller has already taken it out of
 * wherever it was. A vertical capsule (a leg) is turned on its side so it is held like a club.
 */
export function takeIn(world: World, f: Fighter, part: Part): void {
  const sh = part.shapes[0];
  if (sh.k === 'cap' && sh.rot === 0) { part.colliders[0].setRotationWrtParent(Math.PI / 2); part.shapes[0] = { ...sh, rot: Math.PI / 2 }; }
  if (!part.weapon && sh.k === 'cap') {
    part.weapon = { id: 'limb', name: 'limb', length: 2 * (sh.hl + sh.r), thickness: 2 * sh.r, mass: part.body.mass(), gripFromEnd: 0.06, impactFactor: T.props.limbFactor };
  }
  part.role = 'stick';
  part.owner = f.index;
  for (const c of part.colliders) c.setCollisionGroups(f.inBack ? backGroups : ownerGroups(f.index));
  f.attackers.push({ collider: part.colliders[0], part, kind: 'stick', nextHit: 0 });
  f.parts.push(part);
  f.stick = part;
  attachStick(world, f);
}

/** A fighter's loose club (lying where they dropped it) becomes a plain object in the world that anyone can pick up. */
export function dropToWorld(f: Fighter): Part {
  const part = f.stick!;
  f.parts.splice(f.parts.indexOf(part), 1);
  const i = f.attackers.findIndex((a) => a.part === part);
  if (i >= 0) f.attackers.splice(i, 1);
  part.role = 'prop';
  part.owner = -1;
  for (const c of part.colliders) c.setCollisionGroups(worldGroups);
  f.stick = null;
  return part;
}

/** Make `part` (a club) belong to `to`: its owner, its parts list, its damage credit and its collision group. */
function reassign(part: Part, from: Fighter, to: Fighter): void {
  from.parts.splice(from.parts.indexOf(part), 1);
  const att = from.attackers.splice(from.attackers.findIndex((a) => a.part === part), 1)[0];
  att.nextHit = 0;
  to.attackers.push(att);
  part.owner = to.index;
  for (const c of part.colliders) c.setCollisionGroups(to.inBack ? backGroups : ownerGroups(to.index));
  to.stick = part;
  to.parts.push(part);
}

/**
 * Take a loose club from `from` and put it in `to`'s hand (`from` may be `to`: picking up your own club).
 * If `to` has a club of their own lying loose, the two loose clubs trade owners (otherwise that club would be orphaned and never come back).
 */
export function giveStick(world: World, from: Fighter, to: Fighter): void {
  if (from !== to) {
    const take = from.stick!, mine = to.stick;
    from.stick = null;
    to.stick = null;
    reassign(take, from, to);
    if (mine) reassign(mine, to, from);
  }
  attachStick(world, to);
}

/** Grab: lock the fist of `f` onto `part` (some other fighter's body part) at the world point `pt`. */
export function grabJoint(world: World, f: Fighter, part: Part, pt: { x: number; y: number }): ImpulseJoint {
  const b = part.body, t = b.translation(), a = b.rotation(), c = Math.cos(a), s = Math.sin(a);
  const dx = pt.x - t.x, dy = pt.y - t.y;
  const j = revolute(world, f.fore.body, T.fighter.armLength / 2, 0, b, dx * c + dy * s, -dx * s + dy * c);
  j.setContactsEnabled(false); // the hand and what it holds do not push each other apart
  return j;
}

/** Let go of whoever `f` is holding. Flung: they keep the speed of the swing (boosted), and a hard crash soon after hurts. */
export function letGo(world: World, f: Fighter, fling: boolean, events: SimEvent[]): void {
  const v = f.held;
  if (!f.hold || !v) return;
  world.removeImpulseJoint(f.hold, true);
  f.hold = null;
  f.held = null;
  if (!fling) { f.chargeLocked = true; return; } // let go of the button and press again to grab again
  const G = T.grab;
  for (const p of v.parts) {
    if (p.role === 'stick' && !v.grip) continue;
    const lv = p.body.linvel(tmp);
    const k = Math.min(G.fling, G.maxFling / Math.max(1e-6, Math.hypot(lv.x, lv.y))); // boosted, but never past the speed cap
    p.body.setLinvel({ x: lv.x * k, y: lv.y * k }, true);
  }
  v.thrownBy = f.index;
  v.thrown = G.thrownFrames;
  v.slamWait = 0;
  const t = v.torso.body.translation(), lv = v.torso.body.linvel(tmp);
  events.push({ t: 'throw', x: t.x, y: t.y, v: Math.hypot(lv.x, lv.y), owner: f.index, victim: v.index });
}

/** Lay a fighter's club somewhere in the world, out of the hand and at rest (arena weapon rules, and a lost club coming back). */
export function placeLoose(world: World, f: Fighter, x: number, y: number, angle: number): void {
  if (f.grip) { world.removeImpulseJoint(f.grip, true); f.grip = null; }
  const b = f.stick!.body;
  b.setTranslation({ x, y }, true);
  b.setRotation(angle, true);
  b.setLinvel({ x: 0, y: 0 }, true);
  b.setAngvel(0, true);
  const p = f.stick!;
  p.px = p.cx = x; p.py = p.cy = y; p.pa = p.ca = angle;
  f.dropCooldown = 0;
  f.lostFrames = 0;
}

/**
 * Death ragdoll: the head comes off the torso onto a floppy neck (carrying the torso's speed) and the legs go limp. Returns the new parts.
 */
export function ragdoll(world: World, f: Fighter, rng: () => number): Part[] {
  if (f.ragdolled) return [];
  const F = T.fighter, R = T.ragdoll;
  f.ragdolled = true;
  const tb = f.torso.body;
  const t = tb.translation(), a = tb.rotation(), v = tb.linvel(), w = tb.angvel();
  const c = Math.cos(a), s = Math.sin(a);
  const at = (lx: number, ly: number) => ({ x: t.x + lx * c - ly * s, y: t.y + lx * s + ly * c });
  const launch = (p: Part, lx: number, ly: number, spin: number) => { // give a new part the speed of the spot it came from
    const rx = lx * c - ly * s, ry = lx * s + ly * c;
    p.body.setLinvel({ x: v.x - w * ry, y: v.y + w * rx }, true);
    p.body.setAngvel(w + spin, true);
  };
  const out: Part[] = [];

  // Head onto a floppy neck.
  if (f.headCollider) {
    world.removeCollider(f.headCollider, true);
    f.headCollider = null;
    f.torso.colliders.splice(1, 1);
    f.torso.shapes = f.torso.shapes.filter((sh) => sh.k !== 'ball');
    const hp = at(0, F.headY);
    const head = addPart(world, f.index, 'head', hp.x, hp.y, a, [{ s: { k: 'ball', r: F.headRadius, x: 0, y: 0 }, mass: F.headMass }], null, { lin: 0, ang: 0.1 });
    const neck = revolute(world, tb, 0, F.headY + F.headRadius, head.body, 0, F.headRadius);
    neck.setLimits(-R.neckLimit, R.neckLimit);
    neck.configureMotorPosition(0, R.neckStiffness, R.neckDamping);
    f.neck = neck;
    launch(head, 0, F.headY, (rng() - 0.5) * R.spin);
    out.push(head);
  }

  // The legs are already real: they just go limp.
  for (const l of f.legs) for (const j of [l.hip, l.knee]) { if (f.cutJoints.has(j)) continue; j.configureMotorPosition(0, R.legStiffness, R.legDamping); j.setMotorMaxForce(1e6); }
  f.parts.push(...out);
  return out;
}

/** Total mass of every part of a fighter. */
export function fighterMass(f: Fighter): number {
  let m = 0;
  for (const p of f.parts) if (p.role !== 'stick' || f.grip) m += p.body.mass(); // a dropped club is not part of the body
  return m;
}

/** Push a whole fighter: every part gets the same change of speed, so the arm and club are not left behind and the body does not stretch. */
export function shove(f: Fighter, ix: number, iy: number): void {
  const M = fighterMass(f);
  for (const p of f.parts) {
    if (p.role === 'stick' && !f.grip) continue;
    const k = p.body.mass() / M;
    p.body.applyImpulse({ x: ix * k, y: iy * k }, true);
  }
}

export function wrapAngle(a: number): number {
  return a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
}

const tmpC = { x: 0, y: 0 };
const ray = new RAPIER.Ray({ x: 0, y: 0 }, { x: 0, y: 1 });
/** Part of the world (the ground, a wall, a bridge plank, a loose log): what you can stand on or slide down. Fighters and the clubs they hold are not. */
export const isWorld = (c: Collider) => ((c.collisionGroups() >>> 16) & (GROUP_WORLD | GROUP_TERRAIN)) !== 0;

/**
 * What the body is touching. The floor: a ray straight down from the hips (it also feeds the stand spring), or a foot on it.
 * A wall: the body or head touching something beside it.
 */
function senseContacts(world: World, f: Fighter): void {
  const bt = f.torso.body.translation();
  ray.origin.x = bt.x; ray.origin.y = bt.y;
  const hit = world.castRay(ray, T.stand.height + T.stand.reach, true, undefined, undefined, undefined, undefined, isWorld);
  f.groundDist = hit ? hit.timeOfImpact : Infinity;
  f.groundBody = hit ? hit.collider.parent() : null;
  let ground = f.groundDist < T.stand.height + 0.12, wall = 0;
  for (const col of f.torso.colliders) { // the body capsule and the head: a leaning body touches a wall with its head first
    world.contactPairsWith(col, (other) => {
      if (!isWorld(other)) return;
      world.contactPair(col, other, (m) => {
        if (m.numSolverContacts() === 0) return;
        const p = m.solverContactPoint(0, tmpC);
        if (!p) return;
        const dx = p.x - bt.x, dy = p.y - bt.y;
        if (Math.abs(dx) > 0.12 && Math.abs(dy) < 0.8) wall = dx > 0 ? 1 : -1; // beside it
      });
    });
  }
  f.legs.forEach((l, i) => { // a foot (or shin) resting on something below the hips
    if (f.legLost[i]) return;
    world.contactPairsWith(l.shin.colliders[0], (other) => {
      if (ground || !isWorld(other)) return;
      world.contactPair(l.shin.colliders[0], other, (m) => {
        const p = m.numSolverContacts() > 0 && m.solverContactPoint(0, tmpC);
        if (p && p.y - bt.y > 0.15) ground = true;
      });
    });
  });
  f.grounded = ground;
  f.wall = ground ? 0 : wall;
}

const clamp = (x: number, lim: number) => Math.max(-lim, Math.min(lim, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const FLIP = 0.25; // the cursor has to get this far past straight up (or down) before the fighter turns to face the other way
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * The stand spring holds the hips at the wanted height above the floor (lower the more you crouch), and the leg motors reach for a
 * walking pose. Crouching softens the motors, so the legs fold however they happen to be bent: nothing is a canned animation.
 */
function standAndLegs(f: Fighter, grounded: boolean, vx: number, s: number, tip: number): void {
  const S = T.stand, CR = T.crouch, LG = T.legs, dt = T.sim.dt;
  const low = Math.max(f.crouch, f.landDip); // crouching, or the knees giving after a landing
  const want = lerp(S.height, CR.lowHeight, low);
  if (f.carried > 0) f.carried--;
  if (f.knock === 0 && f.carried === 0 && f.groundDist < want + S.reach) { // (a knocked-down fighter, or one being held, is not held up)
    const vy = f.torso.body.linvel(tmp).y; // + = falling
    const up = Math.max(0, Math.min(S.maxAccel, S.stiffness * (want - f.groundDist) + S.damping * vy + T.sim.gravity)); // only ever pushes up
    const onFeet = smooth(S.uprightNone, S.uprightFull, Math.cos(f.torso.body.rotation())); // not while lying, tumbling or upside down
    if (onFeet > 0) {
      const push = up * onFeet * fighterMass(f) * dt;
      shove(f, 0, -push);
      // ...and what you stand on is pushed down just as hard (owner rule: the world is physics). Without this a loose weapon caught
      // between your legs held you up while your legs carried it: the two floated up forever.
      const gb = f.groundBody, t = f.torso.body.translation();
      if (gb?.isDynamic()) gb.applyImpulseAtPoint({ x: 0, y: push }, { x: t.x, y: t.y + f.groundDist }, true);
    }
  }

  if (f.kneeSide !== s) { // knees fold toward where you face
    for (const l of f.legs) if (!f.cutJoints.has(l.knee)) l.knee.setLimits(s > 0 ? 0 : -LG.kneeLimit, s > 0 ? LG.kneeLimit : 0);
    f.kneeSide = s;
  }
  const speed = Math.abs(vx), run = Math.min(1, speed / 3), dir = speed > 0.3 ? Math.sign(vx) : s;
  f.gait += (grounded ? speed * LG.runRate : 9) * dt;
  const soft = (1 - CR.legSoften * f.crouch) * (f.knock > 0 ? 1 - T.knock.legSoft : 1);
  if (tip > 0) { // at the bottom, a gentle push over the way you already lean (or forward, if you are dead upright), so you lie down
    const r = wrapAngle(f.torso.body.rotation());
    if (Math.abs(r) < 1.4) f.torso.body.applyTorqueImpulse((Math.abs(r) > 0.05 ? Math.sign(r) : s) * CR.tipTorque * tip * dt, true);
  }
  f.legs.forEach((l, i) => {
    if (f.legLost[i]) return; // that leg is gone
    const sgn = i === 0 ? -1 : 1, ph = f.gait + i * Math.PI;
    // u: where the foot points (radians from straight down, + = toward +x); k: knee bend
    let u: number, k: number;
    if (grounded) {
      u = sgn * LG.stance + dir * Math.sin(ph) * LG.swing * run;
      k = LG.standKnee + LG.runKnee * run * Math.max(0, Math.cos(ph));
    } else {
      u = sgn * LG.airSpread - clamp(vx * 0.05, 0.5);
      k = LG.airKnee;
    }
    k += CR.kneeFold * low;
    // Relative to the body (balance keeps the body upright). Aiming at the world's "down" instead makes a planted foot twist the body over.
    l.hip.configureMotorPosition(-u, LG.hipStiffness * soft, LG.hipDamping);
    const limp = f.knock > 0 ? 1 - T.knock.legSoft : 1; // a knocked-down fighter's legs offer almost no resistance, so the tumble is free
    l.hip.setMotorMaxForce(LG.hipMaxTorque * limp);
    l.knee.configureMotorPosition(s * Math.min(k, LG.kneeLimit), LG.kneeStiffness * soft, LG.kneeDamping);
    l.knee.setMotorMaxForce(LG.kneeMaxTorque * limp);
  });
}

/** Direction of a lunge: along the aim, but only within `max` of horizontal, and always the way the fighter faces (never backward). */
function lungeAngle(side: number, aim: number, max: number): number {
  const flat = side > 0 ? 0 : Math.PI;
  const rel = wrapAngle(aim - flat);
  return flat + (Math.abs(rel) > Math.PI / 2 ? 0 : clamp(rel, max));
}

/** One frame of control for one fighter: lean and balance, movement, arm pose, attacks. Runs before the physics step. */
/** `threat`: the side (+1 / -1) of someone close winding up or swinging at this fighter, 0 for nobody (the free arm comes up to brace, the body
 * leans away a little). */
export function controlFighter(world: World, f: Fighter, input: PlayerInput, events: SimEvent[], threat = 0): void {
  const dt = T.sim.dt;
  const A = T.arm;
  const body = f.torso.body;

  if (f.stun > 0) f.stun--;
  if (f.crashWait > 0) f.crashWait--;
  if (f.knock > 0) { // knocked down: tumbling and limp until it passes, or until they are calm and on the ground (then they get up at once)
    const K = T.knock;
    f.knockAge++;
    f.knock--;
    f.stun = Math.max(f.stun, f.knock);
    if (f.knockAge >= K.minAge && f.grounded && Math.abs(body.angvel()) < K.calmSpin && Math.hypot(body.linvel(tmp).x, body.linvel(tmp).y) < K.calmSpeed) { f.knock = 0; f.stun = Math.min(f.stun, K.recoverStun); }
  }

  // Dead: arms go floppy (the head and legs of the ragdoll have their own loose joints).
  if (f.limp) {
    letGo(world, f, false, events);
    for (const j of [f.shoulder, f.elbow]) if (!f.cutJoints.has(j)) j.configureMotorPosition(0, 0, A.limpDamping);
    return;
  }

  // ---- dodge: slip into the background plane for a moment; a long cooldown ----
  if (f.dodgeCooldown > 0) f.dodgeCooldown--;
  if (f.attackLock > 0) f.attackLock--;
  if (f.dodge > 0) f.dodge--; // the world keeps you back there while someone is still standing inside you
  if (f.controlled && input.dodge && !f.prevDodge && f.dodge === 0 && f.dodgeCooldown === 0 && !f.inBack) {
    f.dodge = T.dodge.frames;
    f.dodgeCooldown = T.dodge.cooldownFrames;
    setBackPlane(f, true);
    // Dodging cancels whatever you were charging: let go of the button and press it again for a new charge.
    f.charge = 0; f.release = 0; f.punch = 0; f.chargeLocked = true;
    letGo(world, f, false, events);
    events.push({ t: 'dodge', x: body.translation().x, y: body.translation().y, v: 0, owner: f.index, victim: -1 });
  }
  f.prevDodge = input.dodge;
  if (f.chargeLocked && !input.attack) f.chargeLocked = false;
  let attack = input.attack && !f.chargeLocked && !f.inBack && f.attackLock === 0 && !f.armLost && f.knock === 0; // no attacking from the background plane, or without an arm

  // ---- right-click: with a club in your hand it lets go (the club keeps the speed of your swing plus a small push, so swing first,
  // then drop it to throw it); with empty hands it picks your club up again if it is within reach ----
  if (f.dropCooldown > 0) f.dropCooldown--;
  if (f.controlled && input.drop && !f.prevDrop) {
    if (f.grip && f.stick && attack && !f.throwPending) {
      // Right-click while holding the charge: a charged throw. The swing starts as usual (with a smaller lunge) and the club is
      // let go partway through it, along the aim, with a boost that grows with how long you held.
      const power = Math.max(T.throw.minPower, f.charge / T.charge.maxFrames);
      f.throwPending = true;
      f.throwPower = power;
      f.charge = 0;
      f.chargeLocked = true; // let go of the button and press again for the next one
      f.release = T.charge.releaseFrames;
      f.releaseMul = 1 + (T.charge.torqueMul - 1) * power;
      const la = lungeAngle(f.side, input.aim, T.charge.lungeMaxAngle);
      shove(f, Math.cos(la) * T.charge.lungeImpulse * power * T.throw.lungeShare, Math.sin(la) * T.charge.lungeImpulse * power * T.throw.lungeShare);
    } else if (f.grip && f.stick) {
      // Right-click with a club: let go. It keeps the speed of your swing plus a small push, so swing first, then drop it to throw it.
      const st = f.stick.body.translation();
      world.removeImpulseJoint(f.grip, true);
      f.grip = null;
      f.throwPending = false;
      f.charge = 0;
      f.release = 0;
      const sv = f.stick.body.linvel(tmp);
      f.stick.body.setLinvel({ x: sv.x + Math.cos(input.aim) * T.drop.push, y: sv.y + Math.sin(input.aim) * T.drop.push }, true);
      f.dropCooldown = T.drop.pickupDelay;
      events.push({ t: 'drop', x: st.x, y: st.y, v: 0, owner: f.index, victim: -1 });
    } else if (f.hold && f.held) {
      // Right-click while holding someone (owner): a short toss along your aim, on top of whatever your swing gave them. Let go of the
      // button and press again to grab again.
      const v = f.held, m = fighterMass(v);
      shove(v, Math.cos(input.aim) * T.grab.toss * m, Math.sin(input.aim) * T.grab.toss * m);
      letGo(world, f, true, events);
      f.chargeLocked = true; attack = false; f.charge = 0; // (this frame too: no grabbing them straight back)
    } else if (!f.grip) {
      f.pickupRequest = !f.armLost; // right-click with empty hands: the world picks up what you are aiming at, within reach (needs an arm)
      f.pickupAim = input.aim;
    }
  }
  f.prevDrop = input.drop;

  const C = T.charge, K = T.punch, LN = T.lean;
  const armed = !!f.grip;
  const aimX = Math.cos(input.aim), aimY = Math.sin(input.aim);
  // Facing follows the aim, but is locked for a whole attack (a charge and its lunge, or a punch) so the swing cannot turn around.
  const facingLocked = f.controlled && (attack || f.charge > 0 || f.release > 0 || f.punch > 0);
  if (!facingLocked) {
    if (aimX > FLIP) f.side = 1;
    else if (aimX < -FLIP) f.side = -1;
  }
  const s = f.side;

  // ---- attack state ----
  const charging = f.controlled && armed && attack && !f.throwPending; // hold to charge a club
  let punchPhase: 'none' | 'strike' | 'recover' = 'none';
  let strikeStart = false;
  const G = T.grab;
  f.reaching = false;
  if (f.controlled && !armed && f.punch === 0) {
    // Unarmed: a tap throws a punch on release; holding past holdFrames reaches out to grab instead.
    if (attack) {
      f.charge++;
      f.reaching = f.charge >= G.holdFrames && !f.hold;
    } else {
      if (f.charge > 0 && f.charge < G.holdFrames) {
        f.punchPower = K.power;
        f.punch = 1;
        events.push({ t: 'punch', x: body.translation().x, y: body.translation().y, v: f.punchPower, owner: f.index, victim: -1 });
      }
      f.charge = 0;
    }
  }
  if (f.hold) {
    f.holdFrames++;
    if (f.holdFrames > G.maxFrames) letGo(world, f, false, events); // the grip gives out: they drop out of your hands
  }
  if (f.hold && !(attack && f.controlled)) letGo(world, f, true, events); // let go of the button: fling them
  const grabbing = f.reaching || !!f.hold;
  // ---- body slam (owner): holding someone, off the ground, holding S: a suplex. Nothing steers them; your grabbing arm gets strong and
  // sweeps up over your head toward your back (see the arm pose below), and they go over in that arc through the grip. If they hit the
  // ground hard while you still hold S (even after you land), it is a slam, scored in world.ts (resolveBodySlams). ----
  const wasSlamming = f.slamming;
  f.slamming = !!f.hold && !!f.held && f.controlled && input.crouch && f.stun === 0 && f.holdFrames >= T.slam.settleFrames && (f.slamming || !f.grounded);
  if (f.slamming && f.held) {
    f.held.slamBy = f.index;
    if (!wasSlamming) { const r = wrapAngle(f.upper.body.rotation()); f.slamArc = s > 0 ? r : wrapAngle(Math.PI - r); } // from where the arm is now...
    f.slamArc = Math.max(T.slam.sweepTo, f.slamArc - T.slam.sweepRate * dt); // ...up over your head toward your back
  }
  if (f.punch > 0) {
    const t = f.punch;
    punchPhase = t <= K.strikeFrames ? 'strike' : 'recover';
    strikeStart = t === 1;
    f.punch = t >= K.strikeFrames + K.recoverFrames ? 0 : t + 1;
  }

  // ---- lean and balance: the body leans into where it is going (and winds back before a lunge or punch), then springs upright ----
  const B = T.balance;
  const vx = body.linvel(tmp).x;
  let lean = 0;
  if (f.controlled) {
    const want = input.moveX * T.motion.moveSpeed;
    lean = clamp(vx * LN.perSpeed + (want - vx) * LN.perAccel, LN.max); // positive = leaning toward +x
    if (charging) lean -= s * LN.chargeBack * (f.charge / C.maxFrames);
    if (f.release > 0) lean += s * LN.slamForward;
    if (punchPhase === 'strike') lean += s * LN.punchForward * f.punchPower;
    if (threat && f.stun === 0 && !charging && f.release === 0 && f.punch === 0) lean -= threat * LN.flinch; // someone close attacks: lean away (not mid-attack yourself)
  }
  f.leanNow += (lean - f.leanNow) * Math.min(1, dt / LN.ease); // ease into a lean instead of snapping to it (owner: less flopping about)
  lean = f.leanNow;
  // Near the bottom of a crouch you stop holding yourself upright, so you tip over the way you are leaning and lie down. Only on the ground
  // (owner: holding S in the air tipped you onto your side mid-jump, so you landed sideways and bounced).
  const tip = f.grounded ? smooth(T.crouch.tipStart, T.crouch.tipAt, f.crouch) : 0;
  const balance = f.slamBy >= 0 || f.carried > 0 ? 0 : f.knock > 0 ? T.knock.balance : f.stun > 0 ? B.stunFactor : 1; // (held or being slammed: no keeping your balance)
  // Lying down lets go of the upright spring but keeps the spin damping, so crawling does not roll you over.
  const RU = T.rightUp;
  const tilt = wrapAngle(body.rotation());
  if (tip === 0 && Math.abs(tilt) > RU.from && f.stun === 0) {
    // Far from upright (after a knock, a landing, a tumble): turn back smoothly at a capped rate instead of a hard spring.
    const w = body.angvel();
    body.setAngvel(w + clamp(clamp(-RU.gain * tilt, RU.max) - w, RU.accel * dt), true);
  } else {
    // Lying down lets go of the upright spring but keeps the spin damping, so crawling does not roll you over. Stunned, the spring is weak but
    // most of the damping stays, so a dazed body sways slowly back up instead of rocking to and fro (owner: less flopping about).
    const damp = balance > 0 && f.knock === 0 && f.stun > 0 ? B.stunDamping : balance;
    const torque = clamp(-B.kp * (1 - tip) * wrapAngle(body.rotation() - lean) * balance - B.kd * body.angvel() * damp, B.maxTorque * damp);
    body.applyTorqueImpulse(torque * dt, true);
  }

  // ---- movement and jumping ----
  senseContacts(world, f);
  const grounded = f.grounded;
  { // landing: the knees give for a moment, deeper the harder you land, and you spring back up (owner: more fluid movement)
    const LD = T.landDip;
    if (!grounded) f.fallVy = Math.max(0, body.linvel(tmp).y);
    else if (f.fallVy > 0) { f.landDip = Math.max(f.landDip, LD.depth * smooth(LD.minSpeed, LD.fullSpeed, f.fallVy)); f.fallVy = 0; }
    f.landDip = Math.max(0, f.landDip - (LD.depth * dt) / LD.recover);
  }
  const CR = T.crouch;
  const lostLegs = +f.legLost[0] + +f.legLost[1];
  const crouchHeld = f.controlled && (input.crouch || lostLegs === 2);
  f.crouch = crouchHeld ? (grounded ? Math.min(1, f.crouch + CR.downRate) : f.crouch) : Math.max(0, f.crouch - CR.upRate); // you only go lower on the ground (in the air S keeps your momentum)
  standAndLegs(f, grounded, vx, s, tip);
  const lungeMul = 1 + T.crouch.lungeBonus * f.crouch; // crouching loads more momentum into a lunge or punch
  const M = T.motion;
  // Held up by something that is not a floor under your hips (legs jammed in a gap, a fist hooked on an edge, someone's head, a body): after a
  // moment there going nowhere you can jump (owner: you should never get stuck). Going nowhere, not motionless: wedged in a gap you wiggle.
  const sp = body.translation();
  if (grounded || Math.hypot(sp.x - f.stillX, sp.y - f.stillY) > M.stuckRange) { f.still = 0; f.stillX = sp.x; f.stillY = sp.y; } else f.still++;
  if (grounded || f.still >= M.stuckFrames) f.coyote = M.coyoteFrames;
  else if (f.coyote > 0) f.coyote--;
  if (input.jump && !f.prevJump) f.jumpBuffer = M.jumpBufferFrames;
  else if (f.jumpBuffer > 0) f.jumpBuffer--;
  if (f.controlled) {
    if (f.wall !== 0) { f.wallDir = f.wall; f.wallCoyote = M.wallCoyoteFrames; }
    else if (f.wallCoyote > 0) f.wallCoyote--;
    if (f.wallLock > 0) f.wallLock--;
    if (f.tuck > 0) f.tuck--;
    // Coming down is quicker than going up (owner: the jump felt floaty): extra pull while you fall on your own. Not while knocked down,
    // flung, held or holding someone (carries and slams keep their own arcs), so big hits and throws still fly.
    if (!grounded && f.knock === 0 && f.thrown === 0 && f.carried === 0 && !f.held && body.linvel(tmp).y > 0) shove(f, 0, (M.fallGravity - 1) * T.sim.gravity * fighterMass(f) * dt);
    // Wall slide: in the air, pushing toward a wall, you slide down it slowly instead of dropping.
    if (!grounded && f.wall !== 0 && input.moveX * f.wall > 0.2) {
      for (const p of f.parts) {
        if (p.role === 'stick' && !f.grip) continue;
        const lv = p.body.linvel(tmp);
        if (lv.y > M.wallSlideSpeed) p.body.setLinvel({ x: lv.x, y: M.wallSlideSpeed }, true);
      }
    }
  }
  if (!f.controlled && grounded) shove(f, clamp(-vx, M.groundAccel * dt) * fighterMass(f), 0); // the dummy plants its feet
  if (f.controlled && f.stun === 0) {
    const accel = (grounded ? M.groundAccel : M.airAccel) * dt;
    const winding = charging || !!f.hold; // slower while charging a club or holding someone
    // While lunging the walking controller must not brake, or it cancels the lunge.
    const legMul = [1, T.maim.oneLegSpeed, T.maim.noLegSpeed][lostLegs]; // missing legs: hobbling, then crawling
    // (holding S in the air keeps your momentum: no steering, no braking. Owner: it lets you carry speed into a collision.)
    const dv = f.release > 0 || f.wallLock > 0 || (!grounded && input.crouch) ? 0 : clamp(input.moveX * M.moveSpeed * legMul * (winding ? C.moveFactor : 1) * lerp(1, T.crouch.speedFactor, f.crouch) - vx, accel);
    shove(f, dv * fighterMass(f), 0);
    if (f.jumpBuffer > 0 && f.coyote > 0) { // pressing a touch early, or a touch late after walking off a ledge, still jumps
      const jumpSpeed = f.held ? T.slam.carryJumpSpeed : M.jumpSpeed; // someone in your hands weighs you down
      for (const p of f.parts) { // the whole body leaves the ground together
        if (p.role === 'stick' && !f.grip) continue;
        const lv = p.body.linvel(tmp);
        p.body.setLinvel({ x: lv.x, y: -jumpSpeed * [1, T.maim.oneLegJump, 0][lostLegs] * (1 + T.crouch.jumpBonus * f.crouch) }, true); // a jump from a crouch goes a little higher; missing legs jump lower
      }
      if (f.held) for (const p of f.held.parts) { // whoever you are holding comes up with you (they are in your hands)
        if (p.role === 'stick' && !f.held.grip) continue;
        const lv = p.body.linvel(tmp);
        p.body.setLinvel({ x: lv.x, y: -jumpSpeed }, true);
      }
      f.jumpBuffer = 0;
      f.coyote = 0;
      const t = body.translation();
      events.push({ t: 'jump', x: t.x, y: t.y, v: 0, owner: f.index, victim: -1 });
    } else if (f.jumpBuffer > 0 && !grounded && f.wallCoyote > 0) {
      // Wall jump: kicked away from the wall, up to the height of a normal jump.
      for (const p of f.parts) {
        if (p.role === 'stick' && !f.grip) continue;
        p.body.setLinvel({ x: -f.wallDir * M.wallJumpX, y: -M.wallJumpY }, true);
      }
      f.jumpBuffer = 0;
      f.wallCoyote = 0;
      f.wallLock = M.wallLockFrames;
      f.tuck = M.wallTuckFrames;
      const t = body.translation();
      events.push({ t: 'jump', x: t.x, y: t.y, v: 0, owner: f.index, victim: -1 });
    } else if (f.prevJump && !input.jump && body.linvel(tmp).y < -M.jumpCutMinSpeed) {
      // Let go of jump early and the jump is cut short: tap for a hop, hold for the full height.
      for (const p of f.parts) {
        if (p.role === 'stick' && !f.grip) continue;
        const lv = p.body.linvel(tmp);
        p.body.setLinvel({ x: lv.x, y: lv.y * M.jumpCut }, true);
      }
    }
  }
  f.prevJump = input.jump;

  // ---- club charge: hold to load momentum; releasing launches the fighter along the aim ----
  let fire = 0; // 0..1: how much of a full charge to release this frame
  if (armed) {
    if (charging) {
      f.charge = Math.min(f.charge + 1, C.maxFrames);
    } else {
      if (f.charge >= C.minFrames) fire = f.charge / C.maxFrames;
      f.charge = 0;
    }
  }
  if (fire > 0) {
    f.release = C.releaseFrames;
    f.releaseMul = 1 + (C.torqueMul - 1) * fire;
    // The lunge follows the aim but stays within lungeMaxAngle of horizontal: it throws you at the opponent, not into the floor or the sky.
    const la = lungeAngle(s, input.aim, C.lungeMaxAngle);
    shove(f, Math.cos(la) * C.lungeImpulse * fire * lungeMul, Math.sin(la) * C.lungeImpulse * fire * lungeMul);
  }
  if (f.release > 0) f.release--;
  if (f.throwPending) {
    if (!f.grip) {
      f.throwPending = false;
    } else if (C.releaseFrames - f.release >= C.slamDelay + T.throw.afterSlamFrames || f.release === 0) {
      // Let go mid-swing: the club keeps the speed of the arm and gets a boost along the aim.
      world.removeImpulseJoint(f.grip, true);
      f.grip = null;
      f.throwPending = false;
      const sv = f.stick!.body.linvel(tmp);
      const boost = T.throw.boost * f.throwPower;
      f.stick!.body.setLinvel({ x: sv.x + aimX * boost, y: sv.y + aimY * boost }, true);
      f.dropCooldown = T.drop.pickupDelay;
      const st = f.stick!.body.translation();
      events.push({ t: 'throw', x: st.x, y: st.y, v: boost, owner: f.index, victim: -1 });
    }
  }
  // After release the club stays raised while the fighter flies forward; slamDelay frames later it comes down (the burst).
  const slamming = armed && f.release > 0 && C.releaseFrames - f.release > C.slamDelay;
  const holdingUp = armed && f.release > 0 && !slamming;

  // ---- punch push: a lunge into the punch and a shove on the fist, both scaled by how long the punch was wound up ----
  if (strikeStart) {
    const la = lungeAngle(s, input.aim, C.lungeMaxAngle);
    shove(f, Math.cos(la) * K.lunge * f.punchPower * lungeMul, Math.sin(la) * K.lunge * f.punchPower * lungeMul);
  }
  if (punchPhase === 'strike') f.fore.body.applyImpulse({ x: aimX * K.strikeImpulse * f.punchPower, y: aimY * K.strikeImpulse * f.punchPower }, true);

  // ---- arm pose ----
  // Everything is worked out as if the fighter faces right, then mirrored: that keeps the arm on the correct side
  // when you aim left. Angles: U = upper arm (world), E = elbow bend, W = wrist bend (both relative); negative = up/counter-clockwise.
  const mirror = (a: number) => (s > 0 ? a : Math.PI - a); // a right-facing world angle -> the real world angle
  const aimR = clamp(wrapAngle(mirror(input.aim)), 1.9); // when the facing is locked the cursor can be behind you: the arm still stays in front
  const P = T.longMelee;
  // Near straight up or down the guard bend fades out (arm and club in line), so a sweep over the top does not snap to the other side.
  // (Only when aiming up: pointing the arm straight down would drive the club into the floor.)
  const guardBend = aimY < 0 ? Math.max(0, Math.min(1, (Math.abs(aimX) - FLIP) / P.bendFade)) : 1; // 0 near straight up, 1 elsewhere
  let U = aimR, E = 0, W = 0; // dummy: a straight arm hanging toward the aim
  let followAim = true;
  let gain = 1; // burst: stronger arm for a moment
  if (armed) {
    if (slamming) {
      E = P.slamElbow; W = P.slamWrist; // slam: arm swings down through the aim and straightens
      gain = f.releaseMul;
    } else {
      // The club cocks back gradually as the charge builds, from the guard toward raised-and-leaning-back, and stays there while you
      // fly forward after releasing. The pose is the charge indicator: there is nothing else to look at.
      const c = Math.max(holdingUp ? (f.releaseMul - 1) / (C.torqueMul - 1) : charging ? f.charge / C.maxFrames : 0, f.tuck > 0 ? 1 : 0); // (just after a wall jump the club is held up over the head)
      // Guard: the club points at the aim, gripped across the fist (wrist bent), and the arm is placed so it adds up: arm + elbow + wrist = aim.
      const dn = Math.min(1, Math.max(0, aimR / (Math.PI / 2))); // 1 aiming straight down: the arm points at the aim
      const gArm = P.holdArm * (1 - dn) * guardBend, gE = P.holdElbow * guardBend, gW = (P.holdLead - P.holdArm * (1 - dn) - P.holdElbow) * guardBend; // arm + elbow + wrist = lead
      U = lerp(aimR + gArm, P.chargeUpper, c);
      E = lerp(gE, P.chargeElbow + P.chargeCock * c, c);
      W = lerp(gW, P.chargeWrist, c);
      followAim = c < 0.5;
    }
  } else if (f.controlled) {
    if (grabbing) { E = 0; gain = G.armMul; if (f.slamming) { U = f.slamArc; followAim = false; if (f.slamArc > T.slam.sweepTo) gain = T.slam.armMul; } } // grab: arm straight out along the aim, strong enough to swing a body (slamming: it heaves them over your head)
    else if (punchPhase === 'strike') { E = 0; gain = 1 + (K.torqueMul - 1) * f.punchPower; } // arm whips straight out along the aim
    else { U = aimR + K.guardUpper * guardBend; E = K.guardElbow * guardBend; } // guard: fist up in front
  }

  const tr = body.rotation();
  const motor = (j: RevoluteImpulseJoint, target: number, stiff: number, damp: number, maxTorque: number) => {
    j.configureMotorPosition(target, stiff, damp);
    j.setMotorMaxForce(maxTorque);
  };
  if (!f.armLost) {
  // Shoulder: a velocity follower. It turns the arm toward its target at a speed proportional to the error (no overshoot),
  // plus the mouse's own turn rate as feed-forward so a steady sweep has almost no trailing error.
  const aimRate = followAim ? clamp(wrapAngle(input.aim - f.prevAim) / dt, A.maxAimRate) * A.aimFeedForward : 0;
  f.prevAim = input.aim;
  let err = wrapAngle(mirror(U) - f.upper.body.rotation());
  // A big swing (turning round, a flick of the mouse) goes up over the top rather than down through the floor, where the club would dig in
  // and shove the fighter.
  if (armed && Math.abs(err) > A.overTopMin) { // holding a club: does the short way round pass straight down? then go the other way
    const down = wrapAngle(Math.PI / 2 - f.upper.body.rotation());
    if (err > 0 ? down > 0 && down < err : down < 0 && down > err) err -= Math.sign(err) * Math.PI * 2;
  }
  const wantRate = clamp(A.shoulderTrack * err, A.shoulderMaxRate * (1 + (gain - 1) * A.burstRateShare)) + aimRate; // desired world turn rate of the arm
  f.shoulder.configureMotorVelocity(wantRate - body.angvel(), A.shoulderForce * gain); // the joint works in torso-relative terms
  f.shoulder.setMotorMaxForce(A.shoulderMaxTorque * gain);
  // Elbow and wrist are springs with a rest angle. Their targets glide (poseSmooth) so poses blend into each other instead of snapping.
  // With a club they are soft, so the club head lags and whips when you flick the mouse.
  const sm = slamming ? A.slamSmooth : A.poseSmooth;
  f.poseE += (s * E - f.poseE) * sm;
  f.poseW += (s * W - f.poseW) * sm;
  if (f.grip) {
    motor(f.elbow, f.poseE, P.elbowStiffness, P.elbowDamping, P.elbowMaxTorque);
    motor(f.grip as RevoluteImpulseJoint, f.poseW, P.wristStiffness, P.wristDamping, P.wristMaxTorque);
  } else {
    const eg = grabbing ? gain : 1; // holding a body needs a strong elbow too
    motor(f.elbow, f.poseE, A.elbowStiffness * eg, A.elbowDamping * eg, A.elbowMaxTorque * eg);
  }
  if (f.knock > 0) { // knocked down: the arm (and the weapon in it) goes limp, so it does not fight the tumble
    f.shoulder.setMotorMaxForce(A.shoulderMaxTorque * T.knock.armLimp);
    f.elbow.setMotorMaxForce(A.elbowMaxTorque * T.knock.armLimp);
    if (f.grip) (f.grip as RevoluteImpulseJoint).setMotorMaxForce(P.wristMaxTorque * T.knock.armLimp);
  }
  }

  // The second arm joins punches and grabs (for show: it only ever touches the floor and walls); otherwise it moves with what the fighter is
  // doing: a guard, a runner's swing, out for balance in the air, a counterweight for a swing, a brace when someone close attacks. Limp
  // when knocked down or stunned, so hits still look like hits.
  const OH = T.offArm;
  const vxNow = body.linvel(tmp).x, run = Math.min(1, Math.abs(vxNow) / 3);
  const pose: number[] | null = f.knock > 0 || f.stun > 0 || f.carried > 0 || !f.controlled ? null
    : threat ? OH.brace
    : f.release > 0 ? OH.lunge
    : armed && f.charge > 0 ? OH.charge
    : !f.grounded ? OH.air
    : run > 0.3 ? [Math.PI / 2 + OH.run * run * Math.sin(f.gait), OH.runElbow]
    : armed ? OH.rest : OH.guard;
  if (!armed && f.controlled && (grabbing || f.punch > 0)) {
    f.offShoulder.configureMotorPosition(wrapAngle(mirror(aimR + OH.trail) - tr), OH.stiffness, OH.poseDamping);
    f.offElbow.configureMotorPosition(f.punch > 0 && punchPhase === 'recover' ? s * K.guardElbow : 0, OH.stiffness, OH.poseDamping);
    f.offShoulder.setMotorMaxForce(OH.maxTorque);
    f.offElbow.setMotorMaxForce(OH.maxTorque);
  } else if (pose) {
    f.offShoulder.configureMotorPosition(wrapAngle(mirror(pose[0]) - tr), OH.softness, OH.poseDamping);
    f.offElbow.configureMotorPosition(s * pose[1], OH.softness, OH.poseDamping);
    f.offShoulder.setMotorMaxForce(OH.maxTorque);
    f.offElbow.setMotorMaxForce(OH.maxTorque);
  } else {
    f.offShoulder.configureMotorPosition(0, 0, T.offArm.damping);
    f.offElbow.configureMotorPosition(0, 0, T.offArm.damping);
    f.offShoulder.setMotorMaxForce(1e6);
    f.offElbow.setMotorMaxForce(1e6);
  }
}

import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { Collider, ImpulseJoint, RevoluteImpulseJoint, RigidBody, World } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import type { PlayerInput, SimEvent } from './types';

export type Shape =
  | { k: 'ball'; r: number; x: number; y: number }
  | { k: 'cap'; hl: number; r: number; x: number; y: number; rot: number }; // capsule long axis = local Y before rot

export interface Part {
  body: RigidBody;
  shapes: Shape[]; // what the renderer draws (can differ from the collider: the torso collider includes the legs, the drawing does not)
  colliders: Collider[];
  role: 'torso' | 'upper' | 'fore' | 'stick' | 'head' | 'leg';
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
  ragdolled: boolean; // dead: head and legs have become real physics parts
  grounded: boolean;
  wall: number; // -1 / 0 / 1: touching a wall on the left / none / the right (in the air only)
  wallDir: number; // the last wall touched
  wallCoyote: number; // frames left in which a wall jump still works
  wallLock: number; // frames of switched-off steering after a wall jump
  dodge: number; // frames left in the background plane (0 = none)
  dodgeCooldown: number; // frames until another dodge is allowed
  inBack: boolean; // currently on the background plane (collisions with fighters and weapons are off)
  prevDodge: boolean;
  stun: number;
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
  crouch: number; // 0 standing .. 1 fully crouched
  crouchApplied: number; // the crouch the body shape was last built for
  attackLock: number; // frames left before an attack can start (just after a dodge)
  punchPower: number; // strength (0..1) of the punch being thrown
  jumpBuffer: number; // frames a jump press is remembered (so pressing a touch early still jumps)
  coyote: number; // frames after leaving a ledge during which a jump still works
  prevDrop: boolean;
  dropCooldown: number; // frames until a dropped club can be picked up again
  spawnX: number;
  spawnY: number;
}

export const GROUP_WORLD = 1;
/** Rapier groups: high 16 bits = membership, low 16 = filter. Fighters ignore their own parts, hit everything else. */
export function ownerGroups(owner: number): number {
  const mem = 1 << (owner + 1);
  return ((mem << 16) | (0xffff & ~mem)) >>> 0;
}
export const worldGroups = ((GROUP_WORLD << 16) | 0xffff) >>> 0;
/** The background plane: touches the ground only, so it passes through every fighter and weapon. */
const backGroups = ((0x8000 << 16) | GROUP_WORLD) >>> 0;

/** Move a whole fighter (body, arm, club) between the normal plane and the background plane. */
export function setBackPlane(f: Fighter, back: boolean): void {
  f.inBack = back;
  const g = back ? backGroups : ownerGroups(f.index);
  for (const p of f.parts) for (const c of p.colliders) c.setCollisionGroups(g);
}

interface ShapeDef { s: Shape; mass: number; attacker?: 'fist' | 'stick'; visual?: Shape }

function addPart(
  world: World, owner: number, role: Part['role'], x: number, y: number, angle: number,
  defs: ShapeDef[], attackers: Attacker[] | null, damping = { lin: 0, ang: 0 },
): Part {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y).setRotation(angle)
      .setLinearDamping(damping.lin).setAngularDamping(damping.ang).setCcdEnabled(role !== 'torso'),
  );
  const part: Part = {
    body, shapes: defs.map((d) => d.visual ?? d.s), colliders: [], role, owner,
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

export function buildFighter(world: World, index: number, x: number, y: number, controlled: boolean, armed: boolean): Fighter {
  const F = T.fighter;
  const L = F.armLength;
  const armHl = L / 2 - F.armRadius;
  const damp = { lin: F.armLinearDamping, ang: F.armAngularDamping };
  const attackers: Attacker[] = [];

  // The collider is a full-height capsule (it is what touches the ground); the drawing is a shorter torso with animated legs under it.
  const torso = addPart(world, index, 'torso', x, y, 0, [
    {
      s: { k: 'cap', hl: F.torsoHalfHeight, r: F.torsoRadius, x: 0, y: 0, rot: 0 }, mass: F.torsoMass,
      visual: { k: 'cap', hl: T.legs.torsoVisualHalf, r: F.torsoRadius, x: 0, y: T.legs.torsoVisualY, rot: 0 },
    },
    { s: { k: 'ball', r: F.headRadius, x: 0, y: F.headY }, mass: F.headMass },
  ], null);

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

  const parts = [torso, arm.upper, arm.fore];
  const f: Fighter = {
    index, controlled, parts, torso, upper: arm.upper, fore: arm.fore, stick: null,
    shoulder: arm.shoulder, elbow: arm.elbow,
    grip: null, headCollider: torso.colliders[1], attackers, hp: F.hp, limp: false, ragdolled: false, grounded: false, wall: 0, wallDir: 0, wallCoyote: 0, wallLock: 0,
    dodge: 0, dodgeCooldown: 0, inBack: false, prevDodge: false,
    stun: 0, deadAt: 0,
    charge: 0, punch: 0, side: 1, prevAim: 0, release: 0, releaseMul: 1, prevJump: false, chargeLocked: false, throwPending: false, throwPower: 0, poseE: 0, poseW: 0, crouch: 0, crouchApplied: 0, attackLock: 0, punchPower: 0, jumpBuffer: 0, coyote: 0, prevDrop: false, dropCooldown: 0,
    spawnX: x, spawnY: y,
  };

  if (armed) {
    const S = T.stick;
    const grip = S.length / 2 - S.gripFromEnd; // grip point sits this far behind the stick centre
    const stick = addPart(world, index, 'stick', sx + 2 * L + grip, sy, 0, [
      { s: { k: 'cap', hl: S.length / 2 - S.thickness / 2, r: S.thickness / 2, x: 0, y: 0, rot: Math.PI / 2 }, mass: S.mass, attacker: 'stick' },
    ], attackers, { lin: 0, ang: 0.2 });
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
  const grip = T.stick.length / 2 - T.stick.gripFromEnd;
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

/**
 * Death ragdoll: the head comes off the torso onto a floppy neck and two real legs appear on loose hips,
 * all carrying the torso's speed so the body flies and flops. Returns the new parts.
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
    launch(head, 0, F.headY, (rng() - 0.5) * R.spin);
    out.push(head);
  }

  // Two legs on loose hips.
  const len = R.legLength, r = R.legRadius;
  for (const side of [-1, 1]) {
    const hx = side * 0.07, hy = T.legs.hipY;
    const lp = at(hx, hy + len / 2);
    const leg = addPart(world, f.index, 'leg', lp.x, lp.y, a, [
      { s: { k: 'cap', hl: len / 2 - r, r, x: 0, y: 0, rot: 0 }, mass: R.legMass },
    ], null, { lin: 0, ang: 0.1 });
    const hip = revolute(world, tb, hx, hy, leg.body, 0, -len / 2);
    hip.setLimits(-R.hipLimit, R.hipLimit);
    hip.configureMotorPosition(0, R.legStiffness, R.legDamping);
    launch(leg, hx, hy + len / 2, (rng() - 0.5) * R.spin);
    out.push(leg);
  }
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

/** What the body is touching: the ground under it, or a wall beside it (decided from where the contact is, relative to the body). */
function senseContacts(world: World, f: Fighter): void {
  const bt = f.torso.body.translation();
  let ground = false, wall = 0;
  for (const col of f.torso.colliders) { // the body capsule and the head: a leaning body touches a wall with its head first
    world.contactPairsWith(col, (other) => {
      if (!other.parent()?.isFixed()) return;
      world.contactPair(col, other, (m) => {
        if (m.numSolverContacts() === 0) return;
        const p = m.solverContactPoint(0, tmpC);
        if (!p) return;
        const dx = p.x - bt.x, dy = p.y - bt.y;
        if (dy > 0.2 && Math.abs(dx) < 0.25) ground = true; // under the body
        else if (Math.abs(dx) > 0.12 && Math.abs(dy) < 0.8) wall = dx > 0 ? 1 : -1; // beside it
      });
    });
  }
  f.grounded = ground;
  f.wall = ground ? 0 : wall;
}

const clamp = (x: number, lim: number) => Math.max(-lim, Math.min(lim, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const FLIP = 0.25;

/** Crouching shortens the body for real: the capsule gets shorter and the head comes down, so swings aimed at the head can miss. */
function applyCrouch(f: Fighter): void {
  const F = T.fighter, c = f.crouch;
  f.torso.colliders[0].setHalfHeight(lerp(F.torsoHalfHeight, T.crouch.minHalfHeight, c));
  if (f.headCollider) f.headCollider.setTranslationWrtParent({ x: 0, y: lerp(F.headY, F.headY + T.crouch.headLift, c) });
  f.crouchApplied = c;
} // the cursor has to get this far past straight up (or down) before the fighter turns to face the other way

/** Direction of a lunge: along the aim, but only within `max` of horizontal, and always the way the fighter faces (never backward). */
function lungeAngle(side: number, aim: number, max: number): number {
  const flat = side > 0 ? 0 : Math.PI;
  const rel = wrapAngle(aim - flat);
  return flat + (Math.abs(rel) > Math.PI / 2 ? 0 : clamp(rel, max));
}

/** One frame of control for one fighter: lean and balance, movement, arm pose, attacks. Runs before the physics step. */
export function controlFighter(world: World, f: Fighter, input: PlayerInput, events: SimEvent[]): void {
  const dt = T.sim.dt;
  const A = T.arm;
  const body = f.torso.body;

  if (f.stun > 0) f.stun--;

  // Dead: arms go floppy (the head and legs of the ragdoll have their own loose joints).
  if (f.limp) {
    for (const j of [f.shoulder, f.elbow]) j.configureMotorPosition(0, 0, A.limpDamping);
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
    events.push({ t: 'dodge', x: body.translation().x, y: body.translation().y, v: 0, owner: f.index, victim: -1 });
  }
  f.prevDodge = input.dodge;
  if (f.chargeLocked && !input.attack) f.chargeLocked = false;
  const attack = input.attack && !f.chargeLocked && !f.inBack && f.attackLock === 0; // no attacking from the background plane

  // ---- right-click: with a club in your hand it lets go (the club keeps the speed of your swing plus a small push, so swing first,
  // then drop it to throw it); with empty hands it picks your club up again if it is within reach ----
  if (f.dropCooldown > 0) f.dropCooldown--;
  if (f.controlled && input.drop && !f.prevDrop && f.stick) {
    const st = f.stick.body.translation();
    if (f.grip && attack && !f.throwPending) {
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
    } else if (f.grip) {
      world.removeImpulseJoint(f.grip, true);
      f.grip = null;
      f.throwPending = false;
      f.charge = 0;
      f.release = 0;
      const sv = f.stick.body.linvel(tmp);
      f.stick.body.setLinvel({ x: sv.x + Math.cos(input.aim) * T.drop.push, y: sv.y + Math.sin(input.aim) * T.drop.push }, true);
      f.dropCooldown = T.drop.pickupDelay;
      events.push({ t: 'drop', x: st.x, y: st.y, v: 0, owner: f.index, victim: -1 });
    } else if (f.dropCooldown === 0) {
      const bt = body.translation();
      if (Math.hypot(st.x - bt.x, st.y - bt.y) < T.drop.pickupRange) {
        attachStick(world, f);
        events.push({ t: 'pickup', x: bt.x, y: bt.y, v: 0, owner: f.index, victim: -1 });
      }
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
  let punchPhase: 'none' | 'wind' | 'strike' | 'recover' = 'none';
  let strikeStart = false;
  if (f.controlled && !armed && f.punch === 0) {
    // Unarmed: hold to wind up a punch, let go to throw it. A tap is a quick punch, a long hold a heavy one.
    if (attack) {
      f.charge = Math.min(f.charge + 1, K.maxWindFrames);
    } else if (f.charge >= K.windFrames) {
      const heavy = Math.max(0, Math.min(1, (f.charge - K.windFrames) / (K.maxWindFrames - K.windFrames)));
      f.punchPower = K.quickPower + (1 - K.quickPower) * heavy;
      f.charge = 0;
      f.punch = 1;
      events.push({ t: 'punch', x: body.translation().x, y: body.translation().y, v: f.punchPower, owner: f.index, victim: -1 });
    } else if (f.charge > 0) {
      f.charge++; // let go too early: keep drawing back until the minimum wind-up is done
    }
    if (f.charge > 0) punchPhase = 'wind';
  }
  if (f.punch > 0) {
    const t = f.punch;
    punchPhase = t <= K.strikeFrames ? 'strike' : 'recover';
    strikeStart = t === 1;
    f.punch = t >= K.strikeFrames + K.recoverFrames ? 0 : t + 1;
  }
  const windFraction = f.charge / K.maxWindFrames;

  // ---- lean and balance: the body leans into where it is going (and winds back before a lunge or punch), then springs upright ----
  const B = T.balance;
  const vx = body.linvel(tmp).x;
  let lean = 0;
  if (f.controlled) {
    const want = input.moveX * T.motion.moveSpeed;
    lean = clamp(vx * LN.perSpeed + (want - vx) * LN.perAccel, LN.max); // positive = leaning toward +x
    if (charging) lean -= s * LN.chargeBack * (f.charge / C.maxFrames);
    if (f.release > 0) lean += s * LN.slamForward;
    if (punchPhase === 'wind') lean -= s * LN.punchBack * (0.5 + windFraction);
    else if (punchPhase === 'strike') lean += s * LN.punchForward * f.punchPower;
  }
  const balance = f.stun > 0 ? B.stunFactor : 1;
  const torque = clamp(-B.kp * wrapAngle(body.rotation() - lean) - B.kd * body.angvel(), B.maxTorque) * balance;
  body.applyTorqueImpulse(torque * dt, true);

  // ---- movement and jumping ----
  senseContacts(world, f);
  const grounded = f.grounded;
  const crouchTarget = f.controlled && input.crouch && grounded ? 1 : 0;
  f.crouch += (crouchTarget - f.crouch) * T.crouch.rate;
  if (f.crouch < 0.01) f.crouch = 0;
  if (Math.abs(f.crouch - f.crouchApplied) > 0.005) applyCrouch(f);
  const lungeMul = 1 + T.crouch.lungeBonus * f.crouch; // crouching loads more momentum into a lunge or punch
  const M = T.motion;
  if (grounded) f.coyote = M.coyoteFrames;
  else if (f.coyote > 0) f.coyote--;
  if (input.jump && !f.prevJump) f.jumpBuffer = M.jumpBufferFrames;
  else if (f.jumpBuffer > 0) f.jumpBuffer--;
  if (f.controlled) {
    if (f.wall !== 0) { f.wallDir = f.wall; f.wallCoyote = M.wallCoyoteFrames; }
    else if (f.wallCoyote > 0) f.wallCoyote--;
    if (f.wallLock > 0) f.wallLock--;
    // Wall slide: in the air, pushing toward a wall, you slide down it slowly instead of dropping.
    if (!grounded && f.wall !== 0 && input.moveX * f.wall > 0.2) {
      for (const p of f.parts) {
        if (p.role === 'stick' && !f.grip) continue;
        const lv = p.body.linvel(tmp);
        if (lv.y > M.wallSlideSpeed) p.body.setLinvel({ x: lv.x, y: M.wallSlideSpeed }, true);
      }
    }
  }
  if (f.controlled && f.stun === 0) {
    const accel = (grounded ? M.groundAccel : M.airAccel) * dt;
    const winding = charging || punchPhase === 'wind';
    // While lunging the walking controller must not brake, or it cancels the lunge.
    const dv = f.release > 0 || f.wallLock > 0 ? 0 : clamp(input.moveX * M.moveSpeed * (winding ? C.moveFactor : 1) * lerp(1, T.crouch.speedFactor, f.crouch) - vx, accel);
    shove(f, dv * fighterMass(f), 0);
    if (f.jumpBuffer > 0 && f.coyote > 0) { // pressing a touch early, or a touch late after walking off a ledge, still jumps
      for (const p of f.parts) { // the whole body leaves the ground together
        if (p.role === 'stick' && !f.grip) continue;
        const lv = p.body.linvel(tmp);
        p.body.setLinvel({ x: lv.x, y: -M.jumpSpeed * (1 + T.crouch.jumpBonus * f.crouch) }, true); // a jump from a crouch goes a little higher
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
      const c = holdingUp ? (f.releaseMul - 1) / (C.torqueMul - 1) : charging ? f.charge / C.maxFrames : 0;
      U = lerp(aimR, P.chargeUpper, c);
      E = lerp(P.guardElbow * guardBend, P.chargeElbow + P.chargeCock * c, c);
      W = lerp(P.guardWrist * guardBend, P.chargeWrist, c);
      followAim = c < 0.5;
    }
  } else if (f.controlled) {
    if (punchPhase === 'wind') { U = aimR + K.cockUpper + K.cockExtra * windFraction; E = K.cockElbow; followAim = false; } // fist drawn back, elbow folded (further back the longer you hold)
    else if (punchPhase === 'strike') { E = 0; gain = 1 + (K.torqueMul - 1) * f.punchPower; } // arm whips straight out along the aim
    else { U = aimR + K.guardUpper * guardBend; E = K.guardElbow * guardBend; } // guard: fist up in front
  }

  const tr = body.rotation();
  const motor = (j: RevoluteImpulseJoint, target: number, stiff: number, damp: number, maxTorque: number) => {
    j.configureMotorPosition(target, stiff, damp);
    j.setMotorMaxForce(maxTorque);
  };
  // Shoulder: a velocity follower. It turns the arm toward its target at a speed proportional to the error (no overshoot),
  // plus the mouse's own turn rate as feed-forward so a steady sweep has almost no trailing error.
  const aimRate = followAim ? clamp(wrapAngle(input.aim - f.prevAim) / dt, A.maxAimRate) * A.aimFeedForward : 0;
  f.prevAim = input.aim;
  const err = wrapAngle(mirror(U) - f.upper.body.rotation());
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
    motor(f.elbow, f.poseE, A.elbowStiffness, A.elbowDamping, A.elbowMaxTorque);
  }
}

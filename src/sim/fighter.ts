import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { Collider, ImpulseJoint, RevoluteImpulseJoint, RigidBody, World } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import type { PlayerInput, SimEvent } from './types';

export type Shape =
  | { k: 'ball'; r: number; x: number; y: number }
  | { k: 'cap'; hl: number; r: number; x: number; y: number; rot: number }; // capsule long axis = local Y before rot

export interface Part {
  body: RigidBody;
  shapes: Shape[];
  role: 'torso' | 'upper' | 'fore' | 'stick';
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
  fore: Part;
  stick: Part | null;
  shoulder: RevoluteImpulseJoint;
  elbow: RevoluteImpulseJoint;
  grip: ImpulseJoint | null;
  attackers: Attacker[];
  hp: number;
  limp: boolean;
  stun: number;
  deadAt: number;
  punchTimer: number;
  windup: number; // frames left of an automatic (click) wind-up
  charge: number; // frames the weapon arm has been cocked back
  release: number; // frames left of the post-release torque burst
  releaseMul: number; // size of that burst (depends on charge)
  punchCooldown: number;
  prevJump: boolean;
  prevAttack: boolean;
  prevGrab: boolean;
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
    body, shapes: defs.map((d) => d.s), role, owner,
    px: x, py: y, pa: angle, cx: x, cy: y, ca: angle, vx: 0, vy: 0, w: 0,
  };
  for (const d of defs) {
    const desc = d.s.k === 'ball' ? RAPIER.ColliderDesc.ball(d.s.r) : RAPIER.ColliderDesc.capsule(d.s.hl, d.s.r).setRotation(d.s.rot);
    desc.setTranslation(d.s.x, d.s.y).setMass(d.mass).setFriction(T.fighter.friction)
      .setRestitution(T.fighter.restitution).setCollisionGroups(ownerGroups(owner));
    const collider = world.createCollider(desc, body);
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

  const torso = addPart(world, index, 'torso', x, y, 0, [
    { s: { k: 'cap', hl: F.torsoHalfHeight, r: F.torsoRadius, x: 0, y: 0, rot: 0 }, mass: F.torsoMass },
    { s: { k: 'ball', r: F.headRadius, x: 0, y: F.headY }, mass: F.headMass },
  ], null);

  // One arm per fighter. It starts pointing right (angle 0); the shoulder motor swings it to the aim angle.
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
    index, controlled, parts, torso, fore: arm.fore, stick: null,
    shoulder: arm.shoulder, elbow: arm.elbow,
    grip: null, attackers, hp: F.hp, limp: false, stun: 0, deadAt: 0,
    punchTimer: 0, windup: 0, charge: 0, release: 0, releaseMul: 1, punchCooldown: 0, prevJump: false, prevAttack: false, prevGrab: false,
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
  j.setLimits(-T.stick.wristLimit, T.stick.wristLimit);
  f.grip = j;
  const pose = (p: Part) => { const t = p.body.translation(); p.px = p.cx = t.x; p.py = p.cy = t.y; p.pa = p.ca = p.body.rotation(); };
  pose(stick);
}

export function wrapAngle(a: number): number {
  return a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
}

function isGrounded(world: World, f: Fighter): boolean {
  const col = f.torso.body.collider(0);
  let grounded = false;
  world.contactPairsWith(col, (other) => {
    if (grounded || !other.parent()?.isFixed()) return;
    world.contactPair(col, other, (m) => { if (m.numSolverContacts() > 0) grounded = true; });
  });
  return grounded;
}

/** One frame of control for one fighter: balance, movement, arm aiming, attacks. Runs before the physics step. */
export function controlFighter(world: World, f: Fighter, input: PlayerInput, events: SimEvent[]): void {
  const dt = T.sim.dt;
  const A = T.arm;
  const body = f.torso.body;

  if (f.stun > 0) f.stun--;
  if (f.punchCooldown > 0) f.punchCooldown--;

  // Limp (dead): everything goes floppy.
  if (f.limp) {
    for (const j of [f.shoulder, f.elbow]) j.configureMotorPosition(0, 0, A.limpDamping);
    return;
  }

  // Balance: spring + damper torque keeps the body mostly upright; heavy hits overpower it.
  const B = T.balance;
  const balance = f.stun > 0 ? B.stunFactor : 1;
  const torque = Math.max(-B.maxTorque, Math.min(B.maxTorque, -B.kp * wrapAngle(body.rotation()) - B.kd * body.angvel())) * balance;
  body.applyTorqueImpulse(torque * dt, true);

  const grounded = isGrounded(world, f);
  if (f.controlled && f.stun === 0) {
    const v = body.linvel(tmp);
    const accel = (grounded ? T.motion.groundAccel : T.motion.airAccel) * dt;
    const dv = Math.max(-accel, Math.min(accel, input.moveX * T.motion.moveSpeed - v.x));
    body.applyImpulse({ x: dv * body.mass(), y: 0 }, true);
    if (input.jump && !f.prevJump && grounded) {
      body.setLinvel({ x: v.x + dv, y: -T.motion.jumpSpeed }, true);
      const t = body.translation();
      events.push({ t: 'jump', x: t.x, y: t.y, v: 0, owner: f.index, victim: -1 });
    }
  }
  f.prevJump = input.jump;

  // Cock-back: hold `cock` to pull the arm up and behind; let go for a torque burst along the aim.
  // A click is the same thing on a short automatic timer (a quick chop, or a jab when unarmed).
  const K = T.cock;
  const aimX = Math.cos(input.aim), aimY = Math.sin(input.aim);
  if (f.controlled && input.attack && !f.prevAttack && f.punchCooldown === 0 && f.windup === 0) {
    f.windup = K.autoFrames;
    f.punchCooldown = T.fist.punchCooldown;
  }
  f.prevAttack = input.attack;
  const cocking = f.controlled && (input.cock || f.windup > 0);
  if (f.windup > 0) f.windup--;
  if (cocking) {
    f.charge = Math.min(f.charge + 1, K.maxFrames);
  } else if (f.charge > 0) {
    if (f.charge >= K.minFrames) {
      f.release = K.releaseFrames;
      f.releaseMul = 1 + ((K.releaseMul - 1) * f.charge) / K.maxFrames;
      if (!f.grip) f.punchTimer = T.fist.punchFrames;
    }
    f.charge = 0;
  }
  if (f.punchTimer > 0) {
    f.punchTimer--;
    f.fore.body.applyImpulse({ x: aimX * T.fist.punchImpulse, y: aimY * T.fist.punchImpulse }, true);
  }
  const cockAngle = cocking ? -K.angle * (aimX >= 0 ? 1 : -1) : 0; // "up and back" is the opposite way round when facing left
  const bursting = !cocking && f.release > 0; // the post-release burst raises both spring strength and torque cap
  const gain = bursting ? f.releaseMul : 1;
  const cap = cocking ? K.holdTorque : A.shoulderMaxTorque * gain;
  if (f.release > 0) f.release--;

  // Aim: shoulder motors chase the aim angle (relative to the torso), so body momentum adds to swings.
  const tr = body.rotation();
  const motor = (j: RevoluteImpulseJoint, target: number, stiff: number, damp: number, maxTorque: number) => {
    j.configureMotorPosition(target, stiff, damp);
    j.setMotorMaxForce(maxTorque);
  };
  motor(f.shoulder, wrapAngle(input.aim + cockAngle - tr), A.shoulderStiffness * gain, A.shoulderDamping, cap);
  motor(f.elbow, 0, A.elbowStiffness, A.elbowDamping, A.elbowMaxTorque);
  if (f.grip) motor(f.grip as RevoluteImpulseJoint, 0, T.stick.wristStiffness, T.stick.wristDamping, T.stick.wristMaxTorque);

  // Grab / drop the stick.
  if (input.grab && !f.prevGrab && f.stick) {
    const st = f.stick.body.translation();
    if (f.grip) {
      world.removeImpulseJoint(f.grip, true);
      f.grip = null;
      events.push({ t: 'drop', x: st.x, y: st.y, v: 0, owner: f.index, victim: -1 });
    } else {
      const ft = f.fore.body.translation();
      const near = Math.hypot(st.x - ft.x, st.y - ft.y) < T.stick.grabRange;
      if (near || st.y > T.arena.killY) {
        attachStick(world, f);
        events.push({ t: 'grab', x: ft.x, y: ft.y, v: 0, owner: f.index, victim: -1 });
      }
    }
  }
  f.prevGrab = input.grab;
  // A stick lost to the void comes back to the hand so nobody is stuck unarmed by accident.
  if (f.stick && !f.grip && f.stick.body.translation().y > T.arena.killY + 2) attachStick(world, f);
}

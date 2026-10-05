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
  prevAttack: boolean;
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
    grip: null, headCollider: torso.colliders[1], attackers, hp: F.hp, limp: false, ragdolled: false, grounded: false,
    dodge: 0, dodgeCooldown: 0, inBack: false, prevDodge: false,
    stun: 0, deadAt: 0,
    charge: 0, punch: 0, side: 1, prevAim: 0, release: 0, releaseMul: 1, prevJump: false, prevAttack: false,
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
  for (const p of f.parts) m += p.body.mass();
  return m;
}

/** Push a whole fighter: every part gets the same change of speed, so the arm and club are not left behind and the body does not stretch. */
export function shove(f: Fighter, ix: number, iy: number): void {
  const M = fighterMass(f);
  for (const p of f.parts) {
    const k = p.body.mass() / M;
    p.body.applyImpulse({ x: ix * k, y: iy * k }, true);
  }
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

const clamp = (x: number, lim: number) => Math.max(-lim, Math.min(lim, x));

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
  if (f.dodge > 0) f.dodge--; // the world keeps you back there while someone is still standing inside you
  if (f.controlled && input.dodge && !f.prevDodge && f.dodge === 0 && f.dodgeCooldown === 0 && !f.inBack) {
    f.dodge = T.dodge.frames;
    f.dodgeCooldown = T.dodge.cooldownFrames;
    setBackPlane(f, true);
    events.push({ t: 'dodge', x: body.translation().x, y: body.translation().y, v: 0, owner: f.index, victim: -1 });
  }
  f.prevDodge = input.dodge;

  const C = T.charge, K = T.punch, LN = T.lean;
  const armed = !!f.grip;
  const aimX = Math.cos(input.aim), aimY = Math.sin(input.aim);
  if (aimX > 0.25) f.side = 1;
  else if (aimX < -0.25) f.side = -1;
  const s = f.side;

  // ---- attack state ----
  const charging = f.controlled && armed && input.attack; // hold to charge a club
  let punchPhase: 'none' | 'wind' | 'strike' | 'recover' = 'none'; // unarmed: a click throws one punch
  let strikeStart = false;
  if (f.controlled && !armed && input.attack && !f.prevAttack && f.punch === 0) {
    f.punch = 1;
    events.push({ t: 'punch', x: body.translation().x, y: body.translation().y, v: 0, owner: f.index, victim: -1 });
  }
  f.prevAttack = input.attack;
  if (f.punch > 0) {
    const t = f.punch;
    punchPhase = t <= K.windFrames ? 'wind' : t <= K.windFrames + K.strikeFrames ? 'strike' : 'recover';
    strikeStart = t === K.windFrames + 1;
    f.punch = t >= K.windFrames + K.strikeFrames + K.recoverFrames ? 0 : t + 1;
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
    if (punchPhase === 'wind') lean -= s * LN.punchBack;
    else if (punchPhase === 'strike') lean += s * LN.punchForward;
  }
  const balance = f.stun > 0 ? B.stunFactor : 1;
  const torque = clamp(-B.kp * wrapAngle(body.rotation() - lean) - B.kd * body.angvel(), B.maxTorque) * balance;
  body.applyTorqueImpulse(torque * dt, true);

  // ---- movement ----
  const grounded = isGrounded(world, f);
  f.grounded = grounded;
  if (f.controlled && f.stun === 0) {
    const accel = (grounded ? T.motion.groundAccel : T.motion.airAccel) * dt;
    // While lunging the walking controller must not brake, or it cancels the lunge.
    const dv = f.release > 0 ? 0 : clamp(input.moveX * T.motion.moveSpeed * (charging ? C.moveFactor : 1) - vx, accel);
    shove(f, dv * fighterMass(f), 0);
    if (input.jump && !f.prevJump && grounded) {
      for (const p of f.parts) { // the whole body leaves the ground together
        const lv = p.body.linvel(tmp);
        p.body.setLinvel({ x: lv.x, y: -T.motion.jumpSpeed }, true);
      }
      const t = body.translation();
      events.push({ t: 'jump', x: t.x, y: t.y, v: 0, owner: f.index, victim: -1 });
    }
  }
  f.prevJump = input.jump;

  // ---- club charge: hold to load momentum; releasing launches the fighter along the aim ----
  let fire = 0; // 0..1: how much of a full charge to release this frame
  if (charging) {
    f.charge = Math.min(f.charge + 1, C.maxFrames);
  } else {
    if (f.charge >= C.minFrames) fire = f.charge / C.maxFrames;
    f.charge = 0;
  }
  if (fire > 0) {
    f.release = C.releaseFrames;
    f.releaseMul = 1 + (C.torqueMul - 1) * fire;
    // The lunge follows the aim but stays within lungeMaxAngle of horizontal: it throws you at the opponent, not into the floor or the sky.
    const flat = aimX >= 0 ? 0 : Math.PI;
    const la = flat + clamp(wrapAngle(input.aim - flat), C.lungeMaxAngle);
    shove(f, Math.cos(la) * C.lungeImpulse * fire, Math.sin(la) * C.lungeImpulse * fire);
  }
  if (f.release > 0) f.release--;
  // After release the club stays raised while the fighter flies forward; slamDelay frames later it comes down (the burst).
  const slamming = armed && f.release > 0 && C.releaseFrames - f.release > C.slamDelay;
  const holdingUp = armed && f.release > 0 && !slamming;

  // ---- punch push: a lunge into the punch and a shove on the fist ----
  if (strikeStart) {
    const flat = aimX >= 0 ? 0 : Math.PI;
    const la = flat + clamp(wrapAngle(input.aim - flat), C.lungeMaxAngle);
    shove(f, Math.cos(la) * K.lunge, Math.sin(la) * K.lunge);
  }
  if (punchPhase === 'strike') f.fore.body.applyImpulse({ x: aimX * K.strikeImpulse, y: aimY * K.strikeImpulse }, true);

  // ---- arm pose ----
  // Everything is worked out as if the fighter faces right, then mirrored: that keeps the arm on the correct side
  // when you aim left. Angles: U = upper arm (world), E = elbow bend, W = wrist bend (both relative); negative = up/counter-clockwise.
  const mirror = (a: number) => (s > 0 ? a : Math.PI - a); // a right-facing world angle -> the real world angle
  const aimR = mirror(input.aim);
  const P = T.longMelee;
  let U = aimR, E = 0, W = 0; // dummy: a straight arm hanging toward the aim
  let followAim = true;
  let gain = 1; // burst: stronger arm for a moment
  if (armed) {
    if (charging || holdingUp) {
      // Charge: club raised above the head, leaning slightly back; leans further back the longer you hold.
      const c = holdingUp ? (f.releaseMul - 1) / (C.torqueMul - 1) : f.charge / C.maxFrames;
      U = P.chargeUpper; E = P.chargeElbow + P.chargeCock * c; W = P.chargeWrist;
      followAim = false;
    } else if (slamming) {
      E = P.slamElbow; W = P.slamWrist; // slam: arm swings down through the aim and straightens
      gain = f.releaseMul;
    } else {
      E = P.guardElbow; W = P.guardWrist; // guard: elbow bent, club held upright in front
    }
  } else if (f.controlled) {
    if (punchPhase === 'wind') { U = aimR + K.cockUpper; E = K.cockElbow; followAim = false; } // fist drawn back, elbow folded
    else if (punchPhase === 'strike') { E = 0; gain = K.torqueMul; } // arm whips straight out along the aim
    else { U = aimR + K.guardUpper; E = K.guardElbow; } // guard: fist up in front
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
  // Elbow and wrist are springs with a rest angle. With a club they are soft, so the club head lags and whips when you flick the mouse.
  if (f.grip) {
    motor(f.elbow, s * E, P.elbowStiffness, P.elbowDamping, P.elbowMaxTorque);
    motor(f.grip as RevoluteImpulseJoint, s * W, P.wristStiffness, P.wristDamping, P.wristMaxTorque);
  } else {
    motor(f.elbow, s * E, A.elbowStiffness, A.elbowDamping, A.elbowMaxTorque);
  }
}

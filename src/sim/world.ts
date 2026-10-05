import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { World } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import { damageFor, impactValue, knockbackFor } from './combat';
import { buildFighter, controlFighter, fighterMass, giveStick, grabJoint, letGo, placeLoose, ragdoll, setBackPlane, shove, worldGroups } from './fighter';
import type { Attacker, Fighter, Part } from './fighter';
import { makeRng } from './rng';
import { NEUTRAL } from './types';
import type { PlayerInput, SimEvent } from './types';

// Pure game logic: no DOM, no Pixi, no Math.random, no clocks.

let ready: Promise<void> | null = null;
const initRapier = () => (ready ??= RAPIER.init());

/** The training dummy never gets real input: it holds its club in a low guard, facing the player (to its left). */
const DUMMY_INPUT: PlayerInput = { ...NEUTRAL, aim: Math.PI - 0.4 };

export class Sim {
  frame = 0;
  version = 0; // bumps whenever bodies are rebuilt, so the renderer knows to rebuild its sprites
  lastImpact = 0;
  events: SimEvent[] = [];
  fighters: Fighter[] = [];
  world!: World;
  private rng: () => number;
  private partByBody = new Map<number, Part>();
  private seed: number;
  private tmpV = { x: 0, y: 0 };
  private tmpN = { x: 0, y: 0 };
  private tmpP = { x: 0, y: 0 };

  scores = [0, 0, 0, 0]; // points per player this match
  round = 1;
  roundOver = false;
  roundWinner = -1; // index of the winner of the round just finished, or -1 for a draw
  private roundOverAt = 0;

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

  get matchActive(): boolean { return !this.dummy && this.count >= 2; }

  /** Rebuild everything from the current tuning values and start the scores again. */
  reset(): void {
    this.scores = [0, 0, 0, 0];
    this.round = 1;
    this.roundOver = false;
    this.roundWinner = -1;
    this.build();
  }

  /** Build a fresh arena and fighters (the scores are kept). */
  private build(): void {
    this.world?.free();
    this.rng = makeRng(this.seed);
    this.frame = 0;
    this.lastImpact = 0;
    this.events.length = 0;
    this.partByBody.clear();

    const A = T.arena;
    this.world = new RAPIER.World({ x: 0, y: T.sim.gravity });
    this.world.timestep = T.sim.dt;
    this.world.numSolverIterations = T.sim.solverIterations;
    this.world.numInternalPgsIterations = T.sim.pgsIterations;
    const ground = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(A.platformX + A.platformW / 2, A.platformTop + A.platformThickness / 2),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(A.platformW / 2, A.platformThickness / 2).setFriction(A.friction).setCollisionGroups(worldGroups),
      ground,
    );

    // A tall wall stands outside each platform end, with a gap: a fighter knocked off an end falls into the gap and can wall-jump out.
    const wallH = (A.killY + 2 - A.wallTop) / 2;
    for (const cx of [A.platformX - A.wallGap - A.wallThickness / 2, A.platformX + A.platformW + A.wallGap + A.wallThickness / 2]) {
      const wall = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, A.wallTop + wallH));
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(A.wallThickness / 2, wallH).setFriction(0.05).setCollisionGroups(worldGroups), wall);
    }

    const xs = this.dummy ? A.spawnX : A.fightSpawnX;
    this.fighters = Array.from({ length: this.count }, (_, i) => this.spawn(i, xs[i], !(this.dummy && i === 1)));
    // Arena weapon rule: with 'spots' or 'sky' nobody starts armed; the clubs lie at fixed spots or fall from above.
    if (A.weaponRule !== 'start') {
      this.fighters.forEach((f, i) => {
        if (!f.controlled || !f.stick) return;
        const x = A.platformX + A.platformW * A.weaponSpots[i % A.weaponSpots.length];
        if (A.weaponRule === 'spots') placeLoose(this.world, f, x, A.platformTop - 0.1, 0);
        else placeLoose(this.world, f, x, -1.5 - 2.5 * i, 0.4 * i);
      });
    }
    this.version++;
  }

  private spawn(index: number, x: number, player: boolean): Fighter {
    const y = T.arena.platformTop - T.stand.height - 0.02; // the hips at standing height
    const f = buildFighter(this.world, index, x, y, player, !player || T.fighter.startArmed); // the dummy always holds a club, so you can practise disarming
    for (const p of f.parts) this.partByBody.set(p.body.handle, p);
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

    for (const f of this.fighters) {
      if (f.held) {
        if (f.held.inBack) letGo(this.world, f, false, this.events); // a dodge slips out of a grab
        else f.held.stun = Math.max(f.held.stun, 2); // being held: no walking, weak balance
      }
    }
    for (const f of this.fighters) {
      controlFighter(this.world, f, f.controlled ? (inputs[f.index] ?? NEUTRAL) : DUMMY_INPUT, this.events);
      for (const p of f.parts) {
        const v = p.body.linvel(this.tmpV);
        p.vx = v.x; p.vy = v.y; p.w = p.body.angvel();
      }
    }

    this.resolvePickups();
    this.keepWeaponsInPlay();
    this.world.step();
    this.settlePlanes();
    this.resolveGrabs();
    this.resolveHits();
    this.resolveBodyHits();
    this.resolveSlams();
    this.checkDeaths();
    this.snapshot();
  }

  /** Right-click with empty hands: pick up the nearest loose weapon in reach, anyone's. */
  private resolvePickups(): void {
    for (const f of this.fighters) {
      if (!f.pickupRequest) continue;
      f.pickupRequest = false;
      if (f.limp || f.grip) continue;
      const bt = f.torso.body.translation();
      let best: Fighter | null = null, bestD = T.drop.pickupRange;
      for (const g of this.fighters) {
        if (!g.stick || g.grip || g.dropCooldown > 0) continue; // loose, and not just dropped
        const st = g.stick.body.translation();
        const d = Math.hypot(st.x - bt.x, st.y - bt.y);
        if (d < bestD) { bestD = d; best = g; }
      }
      if (!best) continue;
      giveStick(this.world, best, f);
      if (best !== f) this.version++; // the club changed hands, so the renderer must rebuild
      this.events.push({ t: 'pickup', x: bt.x, y: bt.y, v: 0, owner: f.index, victim: -1 });
    }
  }

  /** An outstretched empty hand locks onto the first part of another fighter it touches (not a club, not the floppy second arm). */
  private resolveGrabs(): void {
    for (const f of this.fighters) {
      if (!f.reaching || f.hold || f.limp) continue;
      const fist = f.fore.colliders[1];
      this.world.contactPairsWith(fist, (other) => {
        if (f.hold) return;
        const vb = other.parent();
        const part = vb && this.partByBody.get(vb.handle);
        if (!part || part.owner === f.index || part.role === 'stick' || part.role === 'off') return;
        const victim = this.fighters[part.owner];
        if (!victim || victim.inBack || victim.held === f) return;
        this.world.contactPair(fist, other, (m) => {
          const p = !f.hold && m.numSolverContacts() > 0 && m.solverContactPoint(0, this.tmpP);
          if (!p) return;
          f.hold = grabJoint(this.world, f, part, p);
          f.held = victim;
          f.holdFrames = 0;
          this.events.push({ t: 'grab', x: p.x, y: p.y, v: 0, owner: f.index, victim: victim.index });
        });
      });
    }
  }

  /**
   * Body collisions: a fighter moving much faster than the one they run into hurts them. Landing on top of someone from above is a
   * stomp (bigger damage, and a 'stomp' event so a special animation can be hooked in later).
   */
  private resolveBodyHits(): void {
    const B = T.body;
    for (const f of this.fighters) {
      if (f.limp || f.inBack || f.thrown > 0 || this.frame < f.bodyHitAt) continue; // a flung fighter's crashes are the slam rules instead
      for (const p of f.parts) {
        if (p.role !== 'torso' && p.role !== 'thigh' && p.role !== 'shin') continue;
        for (const col of p.colliders) {
          this.world.contactPairsWith(col, (other) => {
            if (this.frame < f.bodyHitAt) return;
            const vb = other.parent();
            const vp = vb && this.partByBody.get(vb.handle);
            if (!vp || vp.owner === f.index || (vp.role !== 'torso' && vp.role !== 'thigh' && vp.role !== 'shin')) return;
            const victim = this.fighters[vp.owner];
            if (!victim || victim.limp || victim.inBack) return;
            this.world.contactPair(col, other, (m) => {
              if (this.frame < f.bodyHitAt || m.numSolverContacts() === 0) return;
              const pt = m.solverContactPoint(0, this.tmpP) ?? this.tmpP;
              const c = this.contact(p, vp, pt, m.normal(this.tmpN));
              if (c.closing <= 0 || c.sa < B.minSpeed || c.sa < c.sb * B.ratio) return; // only a much faster fighter hurts
              const vt = victim.torso.body.translation();
              const fromAbove = c.ny > 1 - B.stompAngle && pt.y < vt.y; // contact along the vertical, with the attacker higher up and coming down
              const stomp = fromAbove && p.vy > 0;
              const impact = impactValue(c.closing, stomp ? B.stompFactor : B.factor);
              const dmg = damageFor(impact);
              if (dmg <= 0) return;
              f.bodyHitAt = this.frame + B.cooldown;
              const head = !!victim.headCollider && other.handle === victim.headCollider.handle;
              const k = knockbackFor(impact) * B.knockbackMul;
              shove(victim, c.nx * k, c.ny * k);
              this.events.push({ t: stomp ? 'stomp' : 'hit', x: pt.x, y: pt.y, v: impact, owner: f.index, victim: victim.index, head });
              this.wound(victim, dmg * (head ? T.combat.headMult : 1), impact, pt.x, pt.y, f.index, head, !stomp);
            });
          });
        }
      }
    }
  }

  /** A flung fighter crashing hard into the floor, a wall or a third fighter gets hurt (and so does that third fighter). */
  private resolveSlams(): void {
    const G = T.grab;
    for (const v of this.fighters) {
      if (v.thrown <= 0) continue;
      v.thrown--;
      if (v.slamWait > 0) { v.slamWait--; continue; }
      if (v.limp) continue;
      for (const p of v.parts) {
        if (p.role === 'off' || (p.role === 'stick' && !v.grip)) continue;
        for (const col of p.colliders) {
          this.world.contactPairsWith(col, (other) => {
            if (v.slamWait > 0) return;
            const ob = other.parent();
            const op = ob ? this.partByBody.get(ob.handle) : undefined;
            const third = op && op.owner !== v.index && op.owner !== v.thrownBy ? this.fighters[op.owner] : undefined;
            if (!ob || (!ob.isFixed() && !third)) return;
            this.world.contactPair(col, other, (m) => {
              if (v.slamWait > 0 || m.numSolverContacts() === 0) return;
              const n = m.normal(this.tmpN);
              const crash = Math.abs((p.vx - (op?.vx ?? 0)) * n.x + (p.vy - (op?.vy ?? 0)) * n.y);
              const impact = impactValue(crash, G.slamFactor);
              const dmg = damageFor(impact);
              if (dmg <= 0) return;
              v.slamWait = G.slamCooldown;
              const pt = m.solverContactPoint(0, this.tmpP) ?? p.body.translation();
              this.wound(v, dmg, impact, pt.x, pt.y, v.thrownBy);
              if (third && !third.limp) this.wound(third, dmg, impact, pt.x, pt.y, v.thrownBy);
            });
          });
        }
      }
    }
  }

  /** Take hidden HP off a fighter and stagger them; they die at zero. */
  private wound(victim: Fighter, dmg: number, impact: number, x: number, y: number, owner: number, head = false, announce = true): void {
    this.lastImpact = impact;
    victim.hp -= dmg;
    victim.stun = T.combat.stunFrames;
    if (victim.hold && impact >= T.grab.breakImpact) letGo(this.world, victim, false, this.events); // a good hit makes a grabber let go
    if (announce) this.events.push({ t: 'hit', x, y, v: impact, owner, victim: victim.index, head });
    if (victim.hp <= 0) this.kill(victim, false, impact);
  }

  /** A club lost in the void comes back from the sky after a while, so there are always weapons in play. */
  private keepWeaponsInPlay(): void {
    const A = T.arena;
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
        if (f.limp && att.kind === 'fist') continue; // a dead fighter's floppy fists hurt nobody (a club they threw still does)
        // Clubs first: a parry throws this swing back, so it must cancel the hits it would otherwise land on the body in the same frame.
        for (const clubsOnly of [true, false]) {
          if (this.frame < att.nextHit) break;
          this.world.contactPairsWith(att.collider, (other) => {
            const vb = other.parent();
            const victimPart = vb && this.partByBody.get(vb.handle);
            if (!victimPart || victimPart.owner === f.index || (victimPart.role === 'stick') !== clubsOnly) return;
            this.world.contactPair(att.collider, other, (m) => {
              if (m.numSolverContacts() === 0) return;
              if (victimPart.role === 'stick') { // a club hit by a club or fist: no damage, but a great clash can knock it out of a hand
                const holder = this.fighters[victimPart.owner];
                if (holder && holder.stick === victimPart && holder.grip) this.clash(f, att, holder, victimPart, m.solverContactPoint(0, this.tmpP) ?? this.tmpP, m.normal(this.tmpN));
                return;
              }
              const victim = this.fighters[victimPart.owner];
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
    const impact = impactValue(c.closing, (att.kind === 'stick' ? T.stick : T.fist).impactFactor);
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
    if (!victim || victim.limp) return;
    const { nx, ny, closing, sa, sb } = this.contact(att.part, vp, pt, n);
    const W = att.kind === 'stick' ? T.stick : T.fist;
    const impact = impactValue(closing, W.impactFactor);
    this.tryDisarm(f, victim, vp, pt, impact, nx, ny, sa, sb); // a great hit on the hand or arm can knock the club out
    const dmg = damageFor(impact, head ? T.combat.headMult : 1);
    if (dmg <= 0) return;

    att.nextHit = this.frame + T.combat.hitCooldown;
    this.lastImpact = impact;
    victim.hp -= dmg;
    victim.stun = T.combat.stunFrames;
    if (victim.hold && impact >= T.grab.breakImpact) letGo(this.world, victim, false, this.events); // a good hit on a grabber, from the one they hold or anyone else, breaks the hold
    const killing = victim.hp <= 0;
    const k = knockbackFor(impact) * (att.kind === 'fist' ? T.fist.knockbackMul : 1); // punches shove much less than a club
    shove(victim, nx * k, ny * k - impact * T.combat.knockbackUp);
    // A hit tips the victim backward (head swings away from the blow) a little: smooth and funny, not a random flip.
    victim.torso.body.applyTorqueImpulse(-Math.sign(nx || 1) * impact * T.combat.spinScale * (0.8 + 0.4 * this.rng()), true);
    this.events.push({ t: 'hit', x: pt.x, y: pt.y, v: impact, owner: f.index, victim: victim.index, head });
    if (killing) this.kill(victim, false, impact);
  }

  private kill(f: Fighter, fell: boolean, impact = 0): void {
    f.limp = true;
    f.deadAt = this.frame;
    f.dropCooldown = 0; // the club they were holding can be taken straight away
    if (f.inBack) setBackPlane(f, false);
    if (f.grip) { this.world.removeImpulseJoint(f.grip, true); f.grip = null; }
    for (const p of ragdoll(this.world, f, this.rng)) this.partByBody.set(p.body.handle, p);
    this.version++; // the ragdoll added parts, so the renderer must rebuild its sprites
    const t = f.torso.body.translation();
    this.events.push({ t: fell ? 'fall' : 'die', x: t.x, y: t.y, v: impact, owner: f.index, victim: f.index });
  }

  private checkDeaths(): void {
    const A = T.arena;
    for (const f of this.fighters.slice()) {
      const t = f.torso.body.translation();
      if (!f.limp && (t.y > A.killY || t.x < -A.killXMargin || t.x > A.viewW + A.killXMargin)) this.kill(f, true);
      if (!this.matchActive && f.limp && this.frame - f.deadAt >= T.respawn.frames) this.respawn(f); // alone, you respawn; in a fight you stay down
    }
    if (this.matchActive) this.updateRound();
  }

  /** The last fighter standing wins the round and scores a point; after a short pause the next round starts. */
  private updateRound(): void {
    if (this.roundOver) {
      if (this.frame - this.roundOverAt >= T.match.resultFrames) {
        this.round++;
        this.roundOver = false;
        this.roundWinner = -1;
        this.build();
      }
      return;
    }
    const alive = this.fighters.filter((f) => f.controlled && !f.limp);
    if (alive.length > 1) return;
    this.roundOver = true;
    this.roundOverAt = this.frame;
    this.roundWinner = alive.length === 1 ? alive[0].index : -1;
    if (this.roundWinner >= 0) this.scores[this.roundWinner]++;
    this.events.push({ t: 'round', x: 0, y: 0, v: 0, owner: this.roundWinner, victim: -1 });
  }
}

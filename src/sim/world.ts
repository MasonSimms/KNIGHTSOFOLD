import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { World } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import { damageFor, hitStopFor, impactValue, knockbackFor } from './combat';
import { buildFighter, controlFighter, ragdoll, setBackPlane, shove, worldGroups } from './fighter';
import type { Attacker, Fighter, Part } from './fighter';
import { makeRng } from './rng';
import { NEUTRAL } from './types';
import type { PlayerInput, SimEvent } from './types';

// Pure game logic: no DOM, no Pixi, no Math.random, no clocks.

let ready: Promise<void> | null = null;
const initRapier = () => (ready ??= RAPIER.init());

/** The training dummy never gets real input: it just hangs its arms down. */
const DUMMY_INPUT: PlayerInput = { ...NEUTRAL, aim: Math.PI / 2 };

export class Sim {
  frame = 0;
  version = 0; // bumps whenever bodies are rebuilt, so the renderer knows to rebuild its sprites
  hitStop = 0;
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

  private constructor(seed: number, private count: number) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.reset();
  }

  /** `count` fighters: 0 = you, 1 = the dummy, 2+ = extra armed fighters (used by the ?stress test). */
  static async create(seed: number, count = 2): Promise<Sim> {
    await initRapier();
    return new Sim(seed, count);
  }

  /** Rebuild the whole world from the current tuning values. */
  reset(): void {
    this.world?.free();
    this.rng = makeRng(this.seed);
    this.frame = 0;
    this.hitStop = 0;
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

    this.fighters = Array.from({ length: this.count }, (_, i) => this.spawn(i, A.spawnX[i], i !== 1));
    this.version++;
  }

  private spawn(index: number, x: number, player: boolean): Fighter {
    const F = T.fighter;
    const y = T.arena.platformTop - F.torsoHalfHeight - F.torsoRadius - 0.02;
    const f = buildFighter(this.world, index, x, y, player, player && T.fighter.startArmed);
    for (const p of f.parts) this.partByBody.set(p.body.handle, p);
    return f;
  }

  private respawn(f: Fighter): void {
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

    if (this.hitStop > 0) {
      this.hitStop--; // hit-stop: physics freezes for a few frames
      return;
    }

    for (const f of this.fighters) {
      controlFighter(this.world, f, f.controlled ? (inputs[f.index] ?? NEUTRAL) : DUMMY_INPUT, this.events);
      for (const p of f.parts) {
        const v = p.body.linvel(this.tmpV);
        p.vx = v.x; p.vy = v.y; p.w = p.body.angvel();
      }
    }

    this.world.step();
    this.settlePlanes();
    this.resolveHits();
    this.checkDeaths();
    this.snapshot();
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
      else setBackPlane(f, false);
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
      if (f.inBack) continue; // on the background plane you cannot hit anyone
      for (const att of f.attackers) {
        if (this.frame < att.nextHit) continue;
        this.world.contactPairsWith(att.collider, (other) => {
          const vb = other.parent();
          const victimPart = vb && this.partByBody.get(vb.handle);
          if (!victimPart || victimPart.owner === f.index || victimPart.role === 'stick') return;
          this.world.contactPair(att.collider, other, (m) => {
            if (m.numSolverContacts() === 0) return;
            const victim = this.fighters[victimPart.owner];
            const head = !!victim && !!victim.headCollider && other.handle === victim.headCollider.handle;
            this.hit(f, att, victim, victimPart, m.solverContactPoint(0, this.tmpP) ?? this.tmpP, m.normal(this.tmpN), head);
          });
        });
      }
    }
  }

  private hit(f: Fighter, att: Attacker, victim: Fighter | undefined, vp: Part, pt: { x: number; y: number }, n: { x: number; y: number }, head: boolean): void {
    if (!victim || victim.limp) return;
    const ab = att.part.body;
    const at = ab.translation();
    const vt = vp.body.translation();
    // Orient the normal from attacker to victim.
    const sign = (vt.x - at.x) * n.x + (vt.y - at.y) * n.y < 0 ? -1 : 1;
    const nx = n.x * sign, ny = n.y * sign;
    // Velocity of each body at the contact point, from the pre-step snapshot.
    const ap = att.part, rax = pt.x - at.x, ray = pt.y - at.y, rvx = pt.x - vt.x, rvy = pt.y - vt.y;
    const avx = ap.vx - ap.w * ray, avy = ap.vy + ap.w * rax;
    const bvx = vp.vx - vp.w * rvy, bvy = vp.vy + vp.w * rvx;
    const closing = (avx - bvx) * nx + (avy - bvy) * ny;
    const W = att.kind === 'stick' ? T.stick : T.fist;
    const impact = impactValue(closing, W.impactFactor);
    const dmg = damageFor(impact, head ? T.combat.headMult : 1);
    if (dmg <= 0) return;

    att.nextHit = this.frame + T.combat.hitCooldown;
    this.lastImpact = impact;
    victim.hp -= dmg;
    victim.stun = T.combat.stunFrames;
    const killing = victim.hp <= 0;
    const k = knockbackFor(impact) * (killing ? T.combat.killLaunchMul : 1);
    shove(victim, nx * k, ny * k - impact * T.combat.knockbackUp);
    // A hit tips the victim backward (head swings away from the blow) a little: smooth and funny, not a random flip.
    victim.torso.body.applyTorqueImpulse(-Math.sign(nx || 1) * impact * T.combat.spinScale * (0.8 + 0.4 * this.rng()), true);
    this.hitStop = killing ? T.combat.killHitStop : hitStopFor(impact);
    this.events.push({ t: 'hit', x: pt.x, y: pt.y, v: impact, owner: f.index, victim: victim.index, head });
    if (killing) this.kill(victim, false, impact);
  }

  private kill(f: Fighter, fell: boolean, impact = 0): void {
    f.limp = true;
    f.deadAt = this.frame;
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
      if (f.limp && this.frame - f.deadAt >= T.respawn.frames) this.respawn(f);
    }
  }
}

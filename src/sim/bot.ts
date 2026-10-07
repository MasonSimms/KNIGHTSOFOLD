import { tuning as T } from '../content/tuning';
import type { Fighter, Part } from './fighter';
import { makeRng } from './rng';
import { passingAt } from './train';
import type { PlayerInput } from './types';
import type { Sim } from './world';

// A computer player (owner: "play like a regular person would"). It only presses the buttons a player has (one PlayerInput a frame) and
// only looks at what a player can see on screen (where everyone is, who holds what, who is winding up a swing; never hidden health).
// Like a person it decides a beat late (tuning.bot.reactFrames), moves its aim like a hand on a mouse (turnRate, with a wobble), keeps
// away from open edges, climbs back after being knocked off, and now and then hesitates or hops for no reason. Deterministic: its own
// seeded random numbers, so a fight with bots plays the same on the server every time.

type Plan =
  | { kind: 'idle' }
  | { kind: 'recover' } // off the stage: get back on
  | { kind: 'fetch'; part: Part } // walk to a loose weapon and pick it up
  | { kind: 'approach' }
  | { kind: 'swing'; charge: number } // hold to charge for `charge` frames, then let go
  | { kind: 'shoot' } // a loaded gun: keep a little distance, aim, fire when the aim is on them
  | { kind: 'punch' }
  | { kind: 'backoff' } // after an attack: a step or two back out of reach, as people do
  | { kind: 'grab'; finish: 'fling' | 'toss' | 'slam' }
  | { kind: 'dodge' };

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x: number, lim: number) => Math.max(-lim, Math.min(lim, x));

export class Bot {
  private rng: () => number;
  private plan: Plan = { kind: 'idle' };
  private nextThink = 0;
  private busyUntil = 0; // an action under way (a swing, a grab) is not interrupted by the next thought, except to save itself
  private started = 0; // frame the current plan began
  private target: Fighter | null = null;
  private seen = { x: 0, y: 0, vx: 0, vy: 0, at: 0 }; // where the target was when last looked at (decisions run on this: a beat late)
  private aim = 0;
  private wobble = 0; // this thought's aiming error
  private stuck = 0; // frames spent lying down
  private from = { x: 0, at: 0 }; // where it was when it last made headway while trying to walk (see below)
  private hops = 0; // hops out of getting nowhere since it last made headway
  private detour = { dir: 0, until: 0 }; // a hop did not free it: walking the other way for a moment
  private jumpFrames = 0; // frames left holding jump (a person holds it for the full height: a quick tap is only a hop)

  constructor(seed: number) { this.rng = makeRng(seed); }

  think(sim: Sim, me: Fighter): PlayerInput {
    const B = T.bot, now = sim.frame, A = sim.arena, p = me.torso.body.translation();
    const out: PlayerInput = { moveX: 0, jump: false, aim: this.aim, attack: false, crouch: false, drop: false, dodge: false };
    if (me.limp) return out;
    if (now < this.started || this.nextThink - now > 60) { this.nextThink = now; this.busyUntil = 0; this.started = now; this.target = null; this.plan = { kind: 'idle' }; } // a new round: the clock started again

    // The stage floor: ground slabs (and a bridge across a gap) as spans; an end with a wall right at it is safe.
    const spans = sim.boats.length ? sim.boats.map((s) => { const x = s.body.translation().x; return [x - s.w / 2, x + s.w / 2]; }) /* (a ship drifts: where it is now) */ : (A.ground.length ? A.ground : [{ x: A.platformX, w: A.platformW }]).map((g) => [g.x, g.x + g.w]);
    if (A.bridge) spans.push([A.bridge.x0, A.bridge.x1]);
    for (const l of A.ledges) if (l.up < 0.3) spans.push([l.x, l.x + l.w]); // a stepping stone level with the floor
    const lo = Math.min(...spans.map((s) => s[0])), hi = Math.max(...spans.map((s) => s[1]));
    const backstop = (side: number) => A.walls.some((w) => w.side === side && w.gap < 0.3);
    const offStage = ((p.x < lo || p.x > hi) && p.y > A.platformTop - 2.5) || me.wet > T.swim.wetAt; // out past an end and not high up, or in the water

    // ---- think (a beat late, like a person) ----
    if (now >= this.nextThink) {
      this.nextThink = now + B.reactFrames[0] + Math.floor(this.rng() * (B.reactFrames[1] - B.reactFrames[0] + 1));
      this.wobble = (this.rng() + this.rng() - 1) * B.aimWobble;
      const foes = sim.fighters.filter((f) => f !== me && !f.limp && !f.inBack && !sim.gone[f.index]);
      if (!this.target || this.target.limp || !foes.includes(this.target) || this.rng() < 0.15) {
        foes.sort((a, b) => Math.abs(a.torso.body.translation().x - p.x) - Math.abs(b.torso.body.translation().x - p.x));
        this.target = foes[0] ?? null;
      }
      if (this.target) { const t = this.target.torso.body.translation(), tv = this.target.torso.body.linvel(); this.seen = { x: t.x, y: t.y, vx: tv.x, vy: tv.y, at: now }; }
      if (offStage) this.start({ kind: 'recover' }, now);
      else if (now >= this.busyUntil) this.decide(sim, me, now);
    }
    if (offStage && this.plan.kind !== 'recover') this.start({ kind: 'recover' }, now);
    if (!offStage && this.plan.kind === 'recover') this.start({ kind: 'idle' }, now);

    // ---- act on the plan, every frame ----
    const age = now - this.started, side = Math.sign(this.seen.x - p.x) || me.side;
    const late = (now - this.seen.at) / 60; // the target, as seen a beat ago, moved on a little since (people lead a moving target)
    let look = { x: this.seen.x + this.seen.vx * late, y: this.seen.y + this.seen.vy * late - 0.2 }; // the chest and head
    const dx = this.seen.x - p.x, dy = this.seen.y - p.y;
    const plan = this.plan;
    if (plan.kind === 'recover') {
      out.moveX = p.x < lo ? 1 : p.x > hi ? -1 : p.x < (lo + hi) / 2 ? -1 : 1; // (in the water under the deck: out from under it first, at the nearer end)
      look = { x: (lo + hi) / 2, y: A.platformTop - 1 };
      if (this.jumpFrames === 0) this.hop(); // keep trying: a wall jump or a late jump catches it
    } else if (plan.kind === 'fetch' && sim.partByBody.get(plan.part.body.handle) !== plan.part) {
      this.start({ kind: 'idle' }, now); // it is gone (smashed, shot in two): reading a removed body crashes the physics
    } else if (plan.kind === 'fetch') {
      const t = plan.part.body.translation();
      look = { x: t.x, y: t.y };
      if (Math.hypot(t.x - p.x, t.y - p.y) < T.drop.pickupRange * 0.8) { out.drop = age % 8 === 0; } // reach for it (right-click)
      else out.moveX = Math.sign(t.x - p.x);
      if (me.grip || age > 180) this.start({ kind: 'idle' }, now);
    } else if (plan.kind === 'approach') {
      out.moveX = Math.abs(dx) > 0.8 ? Math.sign(dx) : 0;
      // someone else is in the way: fight them instead (a person deals with whoever is in front of them, rather than walking into them)
      const blocker = out.moveX ? sim.fighters.find((g) => g !== me && g !== this.target && !g.limp && !g.inBack && Math.sign(g.torso.body.translation().x - p.x) === out.moveX && Math.abs(g.torso.body.translation().x - p.x) < B.personalSpace) : undefined;
      if (blocker) { this.target = blocker; const t = blocker.torso.body.translation(), v = blocker.torso.body.linvel(); this.seen = { x: t.x, y: t.y, vx: v.x, vy: v.y, at: now }; }
      // One right above the other, on different levels: walk to the nearer end of the ledge between you (off it, or out from under it),
      // as a person would, instead of jumping into its underside (two bots used to wait like that for ever).
      const over = Math.abs(dy) > B.climbHeight && Math.abs(dx) < 1.5 ? A.ledges.find((l) => p.x > l.x - 0.3 && p.x < l.x + l.w + 0.3) : undefined;
      if (over) out.moveX = p.x - over.x < over.x + over.w - p.x ? -1 : 1;
      else if (dy < -B.climbHeight && Math.abs(dx) < 2.5 && me.grounded) this.hop(); // they are up on a ledge: jump after them
    } else if (plan.kind === 'shoot') {
      const G = T.bot;
      out.moveX = Math.abs(dx) < G.gunKeep ? -Math.sign(dx) * 0.7 : Math.abs(dx) > G.gunMax ? Math.sign(dx) * 0.6 : 0; // not too close, not too far
      const want = Math.atan2(look.y - p.y, look.x - p.x);
      out.reach = Math.hypot(look.x - p.x, look.y - p.y);
      if (Math.abs(wrap(want - this.aim)) < G.gunAimTol && me.gunCool === 0 && age % 6 < 2) out.attack = true; // squeeze off a shot when it is on them
      if (!this.loaded(me) || age > 150) this.start({ kind: 'idle' }, now);
    } else if (plan.kind === 'swing') {
      out.moveX = Math.abs(dx) > 1.2 ? Math.sign(dx) * 0.6 : Math.abs(dx) < 0.7 ? -Math.sign(dx) * 0.8 : 0; // too close for a club: step back for room
      out.attack = age < plan.charge; // hold to charge, then let go: the lunge and the swing
      if (age === plan.charge - 1 && this.rng() < B.throwChance) out.drop = true; // now and then: let it fly
      if (age > plan.charge + 20) this.backOff(now);
    } else if (plan.kind === 'punch') {
      out.attack = age < 2;
      out.moveX = Math.sign(dx) * 0.4;
      if (age > 14) this.backOff(now);
    } else if (plan.kind === 'backoff') {
      out.moveX = Math.abs(dx) < B.backoffRange ? -Math.sign(dx) : 0;
    } else if (plan.kind === 'grab') {
      out.attack = age < 110; // hold on (let go to fling)
      if (!me.hold) { out.moveX = Math.sign(dx) * 0.6; if (age > 30) out.attack = false; } // still reaching for them
      else {
        const edge = this.edgeSide(p.x, lo, hi, backstop); // swing them toward the nearer open edge
        if (plan.finish === 'slam') { if (me.grounded && this.jumpFrames === 0) this.hop(); out.crouch = !me.grounded || age > 60; out.moveX = -edge; } // jump back and hold S: the suplex
        else if (plan.finish === 'toss') { look = { x: p.x + edge * 3, y: p.y - 1 }; out.drop = age > 40 && age % 6 === 0; }
        else { look = { x: p.x + edge * 3, y: p.y - 0.8 - Math.min(1, age / 40) * 1.5 }; out.moveX = edge * 0.5; if (age > 50) out.attack = false; } // swing them up and let go: fling
      }
      if (age > 130 || (!me.hold && age > 32)) this.start({ kind: 'idle' }, now);
    } else if (plan.kind === 'dodge') {
      out.dodge = age < 2;
      this.start({ kind: 'idle' }, now + 1);
    }

    // Slipped into the background inside someone: walk out of them (you only come back out once you are clear).
    if (me.inBack) {
      const near = sim.fighters.find((g) => g !== me && !g.limp && Math.abs(g.torso.body.translation().x - p.x) < 0.9);
      if (near) out.moveX = Math.sign(p.x - near.torso.body.translation().x) || 1;
    }

    // Lying down, or trying to walk and getting nowhere (tangled up with someone's club, wedged in a gap, propped up on a body, walking on a
    // barrel that rolls away under its feet): a person would jump out of it. Judged by headway, not speed: on a rolling barrel it is never still.
    const lying = Math.abs(wrap(me.torso.body.rotation())) > 1.1;
    if (Math.abs(p.x - this.from.x) > 0.3 || now < this.from.at) this.hops = 0; // (headway: whatever it tried worked)
    if (out.moveX === 0 || Math.abs(p.x - this.from.x) > 0.3 || now < this.from.at) this.from = { x: p.x, at: now };
    this.stuck = lying && me.grounded ? this.stuck + 1 : 0;
    if ((this.stuck > B.stuckFrames || now - this.from.at > B.stuckFrames) && this.jumpFrames === 0) {
      if (this.hops++ > 0 && out.moveX !== 0) this.detour = { dir: -Math.sign(out.moveX), until: now + B.stuckFrames }; // a hop did not do it (a ceiling over its head): step back out the other way
      else this.hop();
      this.stuck = 0; this.from = { x: p.x, at: now };
    }
    if (now < this.detour.until && now >= this.detour.until - B.stuckFrames) out.moveX = this.detour.dir;

    // A gap in the floor ahead with more floor past it (a pit, a gap by a stepping stone): hop over it rather than walk in.
    if (plan.kind !== 'recover' && me.grounded && out.moveX !== 0 && this.jumpFrames === 0) {
      const here = spans.find((s) => p.x >= s[0] - 0.1 && p.x <= s[1] + 0.1), end = here && (out.moveX > 0 ? here[1] : here[0]);
      if (end !== undefined && Math.abs(end - p.x) < B.gapHop && spans.some((s) => s !== here && (out.moveX > 0 ? s[0] > end - 0.1 && s[0] < end + B.gapReach : s[1] < end + 0.1 && s[1] > end - B.gapReach))) this.hop();
    }
    // Never walk off an open edge by accident (people mostly don't).
    if (plan.kind !== 'recover' && me.grounded && ((out.moveX < 0 && p.x < lo + B.edgeMargin && !backstop(-1)) || (out.moveX > 0 && p.x > hi - B.edgeMargin && !backstop(1)))) out.moveX = 0;

    // The hand on the mouse: it turns toward where it wants to aim at a limited speed, a little off.
    const want = Math.atan2(look.y - p.y, look.x - p.x) + this.wobble;
    this.aim = wrap(this.aim + clamp(wrap(want - this.aim), B.turnRate / 60));
    out.aim = this.aim;
    if (this.jumpFrames > 0) { out.jump = this.jumpFrames > 1; this.jumpFrames--; } // (the last frame lets go, so the next jump is a fresh press)
    if (A.chase && p.x < A.chase.mammothX + T.chase.length / 2 + B.mammothMargin) out.moveX = 1; // the mammoth: run
    if (A.train && passingAt(A, now).some((q) => q.x + q.hw > p.x - 0.5 && q.x - q.hw - p.x < A.train!.speed * B.duckAhead)) { out.crouch = true; out.jump = false; } // a sign or tunnel coming: get down
    return out;
  }

  /** What to do next, from what it saw a beat ago. */
  private decide(sim: Sim, me: Fighter, now: number): void {
    const B = T.bot, r = this.rng(), p = me.torso.body.translation();
    if (r < B.hesitate) { this.start({ kind: 'idle' }, now); return; } // a moment of nothing, like anyone
    // Someone close is winding up a big swing: sometimes slip out of the way.
    const threat = sim.fighters.some((f) => f !== me && !f.limp && f.grip && f.charge > 12 && Math.abs(f.torso.body.translation().x - p.x) < 2.2);
    if (threat && me.dodgeCooldown === 0 && this.rng() < B.dodgeChance) { this.start({ kind: 'dodge' }, now); return; }
    // Empty-handed: a loose weapon nearer than the fight is worth fetching.
    const tx = this.target ? this.seen.x : p.x;
    if (!me.grip && !me.armLost) { // (no arm: nothing to hold it with)
      const loose = this.looseWeapons(sim, me).sort((a, b) => Math.abs(a.body.translation().x - p.x) - Math.abs(b.body.translation().x - p.x))[0];
      if (loose && Math.abs(loose.body.translation().x - p.x) < Math.min(B.fetchRange, Math.abs(tx - p.x) + 1)) { this.start({ kind: 'fetch', part: loose }, now); return; }
    }
    if (!this.target) { this.start({ kind: 'idle' }, now); return; }
    const dx = this.seen.x - p.x, dy = this.seen.y - p.y;
    if (this.loaded(me)) { this.start({ kind: 'shoot' }, now, 30); return; } // a loaded gun: shoot (empty, it is a club: below)
    if (me.grip) {
      const reach = (me.stick?.weapon?.length ?? T.stick.length) + B.swingReach;
      if (Math.abs(dx) < reach && Math.abs(dy) < 1.6) {
        const c = B.charge[0] + Math.floor(this.rng() * (B.charge[1] - B.charge[0]));
        this.start({ kind: 'swing', charge: c }, now, c + 20);
        return;
      }
    } else if (Math.abs(dx) < B.closeRange && Math.abs(dy) < 1.1) {
      if (this.rng() < B.grabChance) {
        const f = this.rng(), finish = f < B.slamChance ? 'slam' : f < B.slamChance + B.tossChance ? 'toss' : 'fling';
        this.start({ kind: 'grab', finish }, now, 130);
      } else this.start({ kind: 'punch' }, now, 14);
      return;
    }
    this.start({ kind: 'approach' }, now);
    if (this.rng() < B.hopChance && me.grounded) this.hop(); // a hop for no reason, as people do
  }

  /** After an attack: step back out of reach for a moment (people do not stand in each other's faces). */
  private backOff(now: number): void {
    const B = T.bot;
    this.start({ kind: 'backoff' }, now, B.backoffFrames[0] + Math.floor(this.rng() * (B.backoffFrames[1] - B.backoffFrames[0] + 1)));
  }

  private hop(): void { this.jumpFrames = T.bot.jumpHold + 1; }

  /** Holding a gun with shots left. */
  private loaded(me: Fighter): boolean { return !!me.grip && !!me.stick?.weapon?.gun && (me.stick.ammo ?? 0) > 0 && !me.stick.flipped; }

  private start(plan: Plan, now: number, busy = 0): void { this.plan = plan; this.started = now; this.busyUntil = now + busy; }

  /** Weapons lying loose (a dropped club, a pickup, a plank): anything a player could right-click up. */
  private looseWeapons(sim: Sim, me: Fighter): Part[] {
    const out: Part[] = [];
    for (const g of sim.fighters) if (g.stick && !g.grip && g.dropCooldown <= 0 && (g === me || g.stick.owner === g.index)) out.push(g.stick);
    for (const p of sim.props) if (!p.links?.length && p.body.isDynamic() && p.body.mass() <= T.props.maxLift && p.body.translation().y < sim.arena.platformTop + 0.5) out.push(p);
    const y = me.torso.body.translation().y;
    return out.filter((w) => y - w.body.translation().y < T.bot.reachUp); // not up out of reach (on a high step)
  }

  /** Which way the nearer open edge is (-1 left, 1 right): where someone you hold should go. */
  private edgeSide(x: number, lo: number, hi: number, backstop: (side: number) => boolean): number {
    if (backstop(-1) && !backstop(1)) return 1;
    if (backstop(1) && !backstop(-1)) return -1;
    return x - lo < hi - x ? -1 : 1;
  }
}

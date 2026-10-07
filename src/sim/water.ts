import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { RigidBody, World } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import { fighterMass, isWeapon, terrainGroups } from './fighter';
import type { Fighter, Part } from './fighter';
import type { Arena } from './world';

// The sea (owner: a pirate era with a boat and water physics; the same water later carries the Nile barge, the longship, the paddy...).
// Everything in the water floats and is slowed by it. A fighter can swim for a few seconds (tuning.swim), then sinks: going under is a
// knock-off. A ship (arena.boats) is a real floating body: weight on one end tips it, waves rock it, and it always rights itself.
// Waves are a pure function of the frame, so a round plays the same every time.

/**
 * A floating ship: its hull body, where it drifts back to (homeX: its starting place home0, moved `away` toward `dir` once every rope
 * tying it to another ship is cut), and its pose last frame and this frame (for the renderer to blend between).
 */
export interface Boat { body: RigidBody; w: number; depth: number; homeX: number; home0: number; dir: number; away: number; sinks?: Sinking; px: number; py: number; pa: number; cx: number; cy: number; ca: number }
/** A wreck (arena.boats sinks): over its first `seconds` of a round it settles `settle` metres deeper and leans `tilt` radians bow down
 *  (the right end), slowly at first, then faster as it floods. */
export interface Sinking { seconds: number; tilt: number; settle: number }

/** The tar pit holding x, if any (arena.tar). */
export function tarAt(A: Arena, x: number): Arena['tar'][number] | null {
  for (const p of A.tar) if (x >= p.x && x <= p.x + p.w) return p;
  return null;
}

/** What liquid is at x: tar, the sea, or none. */
const liquidAt = (A: Arena, x: number) => (tarAt(A, x) ? T.tar : A.sea ? T.water : null);
type Liquid = NonNullable<ReturnType<typeof liquidAt>>;

/** How far below the platform top the sea stands at a given frame: its level, less what the tide has risen (arena.sea.tide: from low
 *  at the start of the round to `rise` metres higher after `seconds`, easing in and out; the frame counter starts again each round). */
export function seaLevel(A: Arena, frame: number): number {
  const S = A.sea, tide = S?.tide;
  if (!tide) return S?.level ?? 0;
  const k = Math.min(1, (frame * T.sim.dt) / tide.seconds);
  return S.level - tide.rise * k * k * (3 - 2 * k);
}

/** Height of the surface at x (y grows downward), at a given frame: a tar pit's is still, the sea's has waves (and may have a tide). */
export function surfaceY(A: Arena, frame: number, x: number): number {
  const pit = tarAt(A, x);
  if (pit) return A.platformTop + pit.level;
  let y = A.platformTop + seaLevel(A, frame);
  const t = frame * T.sim.dt;
  for (const w of T.water.waves) y += w.amp * Math.sin(2 * Math.PI * (x / w.length - t / w.period));
  return y;
}

/** The slope of the surface at x (dy/dx). */
function slopeAt(A: Arena, frame: number, x: number): number {
  let s = 0;
  const t = frame * T.sim.dt;
  for (const w of T.water.waves) s += w.amp * (2 * Math.PI / w.length) * Math.cos(2 * Math.PI * (x / w.length - t / w.period));
  return s;
}

/** A ship: a hull floating with its deck from x0, w wide, at the platform top, `depth` from the deck to the keel (a rowboat is shallower). */
export function buildBoat(world: World, A: Arena, x0: number, w: number, depth = T.boat.depth, sinks?: Sinking): Boat {
  const B = T.boat, d = depth, x = x0 + w / 2, y = A.platformTop + d / 2;
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y).setCanSleep(false));
  // The deck on top; the sides go straight down to just under the waterline (no overhang: a swimmer can kick straight up beside it and
  // climb aboard), then slope in to the keel.
  const side = -d / 2 + (A.sea?.level ?? 0) + 0.35;
  const hull = new Float32Array([-w / 2, -d / 2, w / 2, -d / 2, w / 2, side, w * 0.4, d / 2, -w * 0.42, d / 2, -w / 2, side]);
  const desc = RAPIER.ColliderDesc.convexHull(hull)!.setFriction(A.friction).setCollisionGroups(terrainGroups)
    .setMassProperties(B.mass, { x: 0, y: 0 }, (B.mass * (w * w + d * d)) / 12);
  world.createCollider(desc, body);
  return { body, w, depth: d, homeX: x, home0: x, dir: Math.sign(x - A.viewW / 2), away: 0, sinks, px: x, py: y, pa: 0, cx: x, cy: y, ca: 0 };
}

const tv = { x: 0, y: 0 };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** One body in the water (or tar): pushed up in proportion to how deep it is (`float` = 1 holds it level with the surface), and slowed. Returns how much of it is under (0..1). */
function floatBody(A: Arena, frame: number, b: RigidBody, float: number, W: Liquid): number {
  const dt = T.sim.dt, t = b.translation();
  const under = clamp01((t.y - surfaceY(A, frame, t.x)) / (2 * W.bodyHalf) + 0.5);
  if (under <= 0) return 0;
  const m = b.mass(), v = b.linvel();
  tv.x = -W.drag * under * m * v.x * dt;
  tv.y = (-float * under * m * T.sim.gravity - W.drag * under * m * v.y) * dt;
  b.applyImpulse(tv, true);
  b.setAngvel(b.angvel() * (1 - Math.min(1, W.spinDrag * under * dt)), true);
  return under;
}

/** The ship's own float: buoyancy for how deep the hull sits, a spring that rolls it upright (toward the wave under it), and a pull home. */
function floatBoat(A: Arena, frame: number, boat: Boat, fighters: Fighter[]): void {
  const B = T.boat, dt = T.sim.dt, g = T.sim.gravity, b = boat.body, t = b.translation(), v = b.linvel();
  let surf = 0;
  for (let i = 0; i < 5; i++) surf += surfaceY(A, frame, t.x + (i / 4 - 0.5) * boat.w) / 5;
  const s = boat.sinks, k = s ? Math.min(1, (frame * dt) / s.seconds) ** 2 : 0; // (a wreck: how far it has gone down)
  const draft = Math.max(0.1, boat.depth - (A.sea?.level ?? 0)) + (s ? s.settle * k : 0); // how deep the empty hull sits at rest
  const sunk = Math.max(0, Math.min(boat.depth, t.y + boat.depth / 2 - surf));
  tv.x = (-B.home * (t.x - boat.homeX) - B.drift * v.x) * B.mass * dt;
  tv.y = (-B.mass * g * (sunk / draft) - B.heaveDamping * B.mass * v.y) * dt;
  b.applyImpulse(tv, true);
  // Rolling: one fighter at the very end tips it by tuning.boat.tilt, so the spring is that fighter's weight times half the deck, per radian.
  const spring = (fighterMass(fighters[0]) * g * (boat.w / 2)) / B.tilt, want = Math.atan(slopeAt(A, frame, t.x)) * B.roll + (s ? s.tilt * k : 0);
  const a = Math.atan2(Math.sin(b.rotation()), Math.cos(b.rotation()));
  b.applyTorqueImpulse((-spring * (a - want) - B.rollDamping * b.principalInertia() * b.angvel()) * dt, true);
}

/**
 * The sea, each frame before the fighters move: everything floats, the ship rides the waves, and each fighter's time in the water is
 * counted (f.wet for the controls: swimming and the kick out; f.sinking once the swim has run out).
 */
export function applyWater(A: Arena, frame: number, fighters: Fighter[], props: Part[], boats: Boat[]): void {
  if (!A.sea && !A.tar.length) return;
  for (const f of fighters) {
    for (const p of f.parts) {
      const W = liquidAt(A, p.body.translation().x);
      const under = W ? floatBody(A, frame, p.body, isWeapon(p) && !f.grip ? W.propFloat : f.sinking ? W.sinkFloat : W.float, W) : 0;
      if (p === f.torso) { f.wet = under; f.tar = W === T.tar; }
    }
    if (f.limp) continue;
    if (f.wet > (f.tar ? T.tar.wetAt : T.swim.wetAt) && (!f.grounded || f.tar)) { if (++f.wetFrames >= (f.tar ? T.tar.frames : T.swim.frames)) f.sinking = true; } // (in tar a foot on the side of the pit is not out of it)
    else if (f.grounded) f.wetFrames = 0;
  }
  for (const p of props) { const W = liquidAt(A, p.body.translation().x); if (W) floatBody(A, frame, p.body, W.propFloat, W); }
  for (const b of boats) floatBoat(A, frame, b, fighters);
}

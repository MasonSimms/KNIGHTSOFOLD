import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import { PROPS } from '../content/props';
import { tuning as T } from '../content/tuning';
import { createProp, fighterMass, terrainGroups } from './fighter';
import type { Part } from './fighter';
import type { Arena, Sim } from './world';

// Helicopter Pad (Vietnam): a helicopter hovering over the pad (arena.heli). Its skid is a floor and its cabin roof another over it. It is
// a real body held up by springs (tuning.heli), like a ship floating (water.ts floatBoat): it dips when someone lands on it, tips when the
// weight is at one end (one fighter at the end of the skid tips it by `tilt`), always rights itself, and sways from side to side round
// its spot. One loose thing in sim.props, bolted (an online page steers it to the server's like any other), drawn from its picture.

/** Where it holds itself at a frame: its skid's middle, swaying from side to side once it is up. */
function holdAt(A: Arena, frame: number): { x: number; y: number } {
  const H = T.heli, t = frame * T.sim.dt - H.calm, k = Math.max(0, Math.min(1, t / H.ease));
  return { x: A.heli!.x + k * H.sway * Math.sin((2 * Math.PI * t) / H.swayPeriod), y: A.platformTop - A.heli!.up + PROPS.huey.thick / 2 + k * H.bob * Math.sin((2 * Math.PI * t) / H.bobPeriod) };
}

export function buildHeli(sim: Sim): Part {
  const S = PROPS.huey, H = T.heli, p = holdAt(sim.arena, 0);
  const part = createProp(sim.world, p.x, p.y, 0, { kind: 'huey', ...S });
  part.body.setGravityScale(0, true); // (its rotor holds it up: the springs below)
  const roof = { k: 'box' as const, hw: H.roof / 2, hh: H.roofThick / 2, x: H.roofX, y: -(S.thick / 2 + H.gap - H.roofThick / 2), rot: 0 };
  part.colliders.push(sim.world.createCollider(RAPIER.ColliderDesc.cuboid(roof.hw, roof.hh).setTranslation(roof.x, roof.y).setFriction(0.8).setDensity(0), part.body));
  part.shapes.push(roof);
  for (const c of part.colliders) c.setCollisionGroups(terrainGroups); // (ground: you stand on it, and a swing passes through it)
  part.bolted = true;
  sim.props.push(part); sim.machine.push(part); sim.partByBody.set(part.body.handle, part);
  return part;
}

/** Before the physics each frame: the rotor's pull toward where it holds itself, and the spring that rights it. */
export function stepHeli(sim: Sim, part: Part): void {
  if (!sim.props.includes(part)) return; // (gone: nothing to fly)
  const H = T.heli, dt = T.sim.dt, b = part.body, t = b.translation(), v = b.linvel(), m = b.mass(), to = holdAt(sim.arena, sim.frame + 1);
  b.applyImpulse({ x: (H.pull * (to.x - t.x) - H.damping * v.x) * m * dt, y: (H.pull * (to.y - t.y) - H.damping * v.y) * m * dt }, true);
  const spring = (fighterMass(sim.fighters[0]) * T.sim.gravity * (PROPS.huey.len / 2)) / H.tilt, a = Math.atan2(Math.sin(b.rotation()), Math.cos(b.rotation()));
  b.applyTorqueImpulse((-spring * a - H.rollDamping * b.principalInertia() * b.angvel()) * dt, true);
}

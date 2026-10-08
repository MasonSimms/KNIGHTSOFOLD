import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import { PROPS } from '../content/props';
import { createProp, ropeGroups } from './fighter';
import type { Arena, Sim } from './world';

// The drawbridge (Medieval: Castle Drawbridge): an oak deck level with the floor, hinged at its castle end, its far end held up by one
// iron chain from the gatehouse. The chain is cut like a rope (a club hit of tuning.bridge.cutImpact or more, or a bullet: its two joints
// are its `links`); then the deck swings down on its hinge and tips whoever is on it into the moat. Deck and chain are loose things in
// sim.props, so an online copy follows them like any other; they are the map's own machinery (sim.machine), kept by a training clear.

export function buildDrawbridge(sim: Sim, D: NonNullable<Arena['drawbridge']>, top: number): void {
  const S = PROPS.drawbridge, h = S.thick / 2, W = sim.world;
  const deck = createProp(W, D.x + D.w / 2, top + h, 0, { kind: 'drawbridge', ...S, len: D.w });
  const at = (x: number, y: number) => W.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y));
  // The hinge: at the deck's bottom corner, so its top edge swings away from the floor's edge as it drops (never into it).
  const hinge = W.createImpulseJoint(RAPIER.JointData.revolute({ x: 0, y: 0 }, { x: (D.hinge * D.w) / 2, y: h }), at(D.hinge < 0 ? D.x : D.x + D.w, top + 2 * h), deck.body, true) as RAPIER.RevoluteImpulseJoint;
  hinge.setLimits(D.hinge < 0 ? -0.02 : -Math.PI / 2, D.hinge < 0 ? Math.PI / 2 : 0.02); // (level, down to hanging straight; never up)
  // The chain: from the gatehouse to a ring on top of the deck near its far end.
  const ring = -D.hinge * (D.w / 2 - 0.15), ax = D.chain.x, ay = top - D.chain.up, bx = D.x + D.w / 2 + ring, by = top, len = Math.hypot(bx - ax, by - ay);
  const chain = createProp(W, (ax + bx) / 2, (ay + by) / 2, Math.atan2(by - ay, bx - ax), { kind: 'drawbridge-chain', ...PROPS['drawbridge-chain'], len });
  for (const c of chain.colliders) c.setCollisionGroups(ropeGroups); // (bodies pass through it; weapons and bullets meet it)
  const ringJoint = W.createImpulseJoint(RAPIER.JointData.revolute({ x: len / 2, y: 0 }, { x: ring, y: -h }), chain.body, deck.body, true);
  ringJoint.setContactsEnabled(false);
  chain.links = [W.createImpulseJoint(RAPIER.JointData.revolute({ x: 0, y: 0 }, { x: -len / 2, y: 0 }), at(ax, ay), chain.body, true), ringJoint];
  for (const p of [deck, chain]) { sim.props.push(p); sim.machine.push(p); sim.partByBody.set(p.body.handle, p); }
}

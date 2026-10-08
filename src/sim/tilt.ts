import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import { PROPS } from '../content/props';
import { createProp } from './fighter';
import type { Arena, Sim } from './world';

// The tilt (Medieval: Tournament Lists): the jousting barrier, an oak rail fixed on two trestles in the middle of the field. It is heavy
// furniture: too heavy to lift, you vault it (or slam someone into it). Blows (or bullets) break the rail apart (props.ts tilt-rail
// breaks: two halves, clubs; its joints go with it). The trestles and the whole rail are the map's own machinery (sim.machine): a
// training clear keeps them.

export function buildTilt(sim: Sim, R: NonNullable<Arena['tilt']>, top: number): void {
  const S = PROPS.trestle, L = PROPS['tilt-rail'], W = sim.world, mid = R.x + R.w / 2;
  const rail = createProp(W, mid, top - S.thick - L.thick / 2 - 0.005, 0, { kind: 'tilt-rail', ...L, len: R.w });
  const legs = [R.x + S.len / 2, R.x + R.w - S.len / 2].map((x) => createProp(W, x, top - S.thick / 2 - 0.005, 0, { kind: 'trestle', ...S }));
  for (const leg of legs) W.createImpulseJoint(RAPIER.JointData.fixed({ x: leg.body.translation().x - mid, y: L.thick / 2 }, 0, { x: 0, y: -S.thick / 2 }, 0), rail.body, leg.body, true).setContactsEnabled(false);
  for (const p of [rail, ...legs]) { sim.props.push(p); sim.machine.push(p); sim.partByBody.set(p.body.handle, p); }
}

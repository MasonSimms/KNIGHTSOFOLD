import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import { PROPS } from '../content/props';
import { createProp } from './fighter';
import type { Arena, Sim } from './world';

// The tilt (Medieval: Tournament Lists): the jousting barrier, an oak rail fixed on two trestles in the middle of the field. It is loose
// (about 40 kg all told): vault it, or shove the whole fence over. A club hit of tuning.bridge.cutImpact or a bullet knocks the rail off
// its trestles (its joints are its `links`, like a bridge plank's): then it is a long, heavy club. All three are the map's own machinery
// (sim.machine): a training clear keeps them.

export function buildTilt(sim: Sim, R: NonNullable<Arena['tilt']>, top: number): void {
  const S = PROPS.trestle, L = PROPS['tilt-rail'], W = sim.world, mid = R.x + R.w / 2;
  const rail = createProp(W, mid, top - S.thick - L.thick / 2 - 0.005, 0, { kind: 'tilt-rail', ...L, len: R.w });
  const legs = [R.x + S.len / 2, R.x + R.w - S.len / 2].map((x) => createProp(W, x, top - S.thick / 2 - 0.005, 0, { kind: 'trestle', ...S }));
  rail.links = legs.map((leg) => {
    const j = W.createImpulseJoint(RAPIER.JointData.fixed({ x: leg.body.translation().x - mid, y: L.thick / 2 }, 0, { x: 0, y: -S.thick / 2 }, 0), rail.body, leg.body, true);
    j.setContactsEnabled(false);
    leg.links = [j]; // (a trestle hit hard comes away too; until then nobody lifts it off the fence)
    return j;
  });
  for (const p of [rail, ...legs]) { sim.props.push(p); sim.machine.push(p); sim.partByBody.set(p.body.handle, p); }
}

import type { RigidBody } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import type { Arena, Sim } from './world';
import { floorAt } from './world';

// Streams (Samurai: Waterfall Torii; Vietnam: the Rice Paddy, still water that slows you): shallow water over the floor (arena.streams: from x, w wide, flowing at speed m/s; + is
// toward +x). Standing in it is standing on a moving floor (fighter.ts belt): you are carried along unless you walk against it, and over
// the edge it runs off (it still carries you a little past its lip). Light loose things and the dead float in it and drift with it; a
// stone too heavy to lift stays put. Where it runs is a pure function of the map, so an online page guessing its own fighter feels the
// same water as the server.

/** The stream at (x, y), reaching `above` metres over the floor, or null. */
function streamOver(A: Arena, x: number, y: number, above: number): { speed: number; slow?: number } | null {
  for (const s of A.streams) {
    const dir = Math.sign(s.speed), x0 = s.x - (dir < 0 ? T.stream.lip : 0), x1 = s.x + s.w + (dir > 0 ? T.stream.lip : 0);
    if (x >= x0 && x <= x1 && y > floorAt(A, x) - above) return s;
  }
  return null;
}

/** Where each stream runs off an edge (its downstream end, with no floor beyond it): the waterfalls, for the picture. */
export function streamFalls(A: Arena): { x: number; y: number; dir: number }[] {
  return A.streams.flatMap((s) => {
    if (!s.speed) return []; // (still water, a paddy, runs nowhere)
    const dir = Math.sign(s.speed), x = dir > 0 ? s.x + s.w : s.x, beyond = x + dir * 0.2;
    return A.ground.some((g) => beyond >= g.x && beyond <= g.x + g.w) ? [] : [{ x, y: floorAt(A, x - dir * 0.1), dir }];
  });
}

/** Each frame before the physics: who stands in a stream is carried (f.stream, read by the walk controller); light loose things and the
 *  dead in it float and drift along. `only`: just these fighters (an online page guessing its own). */
export function applyStreams(sim: Sim, only?: Sim['fighters']): void {
  const A = sim.arena;
  if (!A.streams.length) return;
  const S = T.stream, dt = T.sim.dt, g = T.sim.gravity;
  const drift = (b: RigidBody) => {
    const t = b.translation(), s = streamOver(A, t.x, t.y, S.depth), m = b.mass();
    if (!s || m > T.props.maxLift) return;
    b.applyImpulse({ x: (s.speed - b.linvel().x) * Math.min(1, S.drag * dt) * m, y: -S.float * g * m * dt }, true);
  };
  for (const f of only ?? sim.fighters) {
    const t = f.torso.body.translation();
    const s = streamOver(A, t.x, t.y, S.depth + 1.2); // (a standing fighter's middle is about a metre up: in it, not on a ledge over it)
    f.stream = s?.speed ?? 0;
    f.wade = s?.slow ?? 0; // (a paddy: you wade)
    if (f.limp) for (const p of f.parts) drift(p.body);
  }
  if (!only) for (const p of sim.props) if (p.body.isDynamic()) drift(p.body);
}

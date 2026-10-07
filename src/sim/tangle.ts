import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { ImpulseJoint } from '@dimforge/rapier2d-deterministic-compat';
import { tuning as T } from '../content/tuning';
import { ownerGroups } from './fighter';
import type { Fighter, Part } from './fighter';
import type { Sim } from './world';

// The net (owner, weapons batch two step 5; weapon `net`): a click throws it along your aim. The first fighter it touches in flight is
// tangled in it (tuning.netting.frames): they cannot attack, grab, jump or dodge and only shuffle (fighter.ts), and the net hangs on them;
// then it falls off and lies where it fell, the thrower's own net still, for anyone to pick up. Online the page is told who is tangled
// (snapshot.fighterState TANGLED: the server moves them) and draws the net over them.

const tangling = new WeakMap<Part, { victim: Fighter; joint: ImpulseJoint }>(); // a net wrapped round someone: who, and what holds it there

/** Each frame, after everyone's controls and before the physics: throw, catch, let go. */
export function moveNets(sim: Sim): void {
  const N = T.netting;
  for (const f of sim.fighters) {
    const p = f.stick;
    if (f.netRequest && p && f.grip && p.weapon?.net) { // thrown: out of the hand, along the aim
      sim.world.removeImpulseJoint(f.grip, true);
      f.grip = null;
      const v = f.torso.body.linvel();
      p.body.setLinvel({ x: v.x + Math.cos(f.aim) * N.speed, y: v.y + Math.sin(f.aim) * N.speed }, true);
      p.body.setAngvel(f.side * 6, true);
      p.netLive = N.flyFrames;
      const t = p.body.translation();
      sim.events.push({ t: 'throw', x: t.x, y: t.y, v: N.speed, owner: f.index, victim: -1 });
    }
    f.netRequest = false;
    if (!p?.weapon?.net) continue;
    const held = tangling.get(p);
    if (held) { // on someone: until it falls off (or they are down)
      if (held.victim.tangled > 0 && !held.victim.limp && f.stick === p) continue;
      if (sim.world.getImpulseJoint(held.joint.handle)) sim.world.removeImpulseJoint(held.joint, true);
      tangling.delete(p);
      held.victim.tangled = 0;
      for (const c of p.colliders) c.setCollisionGroups(ownerGroups(f.index)); // (it touches things again: it falls)
      continue;
    }
    if (!p.netLive || f.grip) { p.netLive = 0; continue; }
    p.netLive--;
    let victim: Fighter | undefined;
    for (const c of p.colliders) sim.world.contactPairsWith(c, (o) => {
      if (victim) return;
      const b = o.parent(), q = b ? sim.partByBody.get(b.handle) : undefined, g = q && q.role !== 'prop' && q.owner >= 0 && q.owner !== f.index ? sim.fighters[q.owner] : undefined;
      if (g && !g.limp && !g.inBack) sim.world.contactPair(c, o, (m) => { if (m.numSolverContacts() > 0) victim = g; });
    });
    if (victim) wrap(sim, p, f, victim);
  }
}

/** The net wraps round them: it hangs on their body (touching nothing else) until it falls off. */
function wrap(sim: Sim, p: Part, f: Fighter, v: Fighter): void {
  p.netLive = 0;
  v.tangled = T.netting.frames;
  for (const c of p.colliders) c.setCollisionGroups(0);
  const t = v.torso.body.translation();
  p.body.setTranslation(t, true);
  p.body.setLinvel(v.torso.body.linvel(), true);
  tangling.set(p, { victim: v, joint: sim.world.createImpulseJoint(RAPIER.JointData.revolute({ x: 0, y: 0 }, { x: 0, y: 0 }), v.torso.body, p.body, true) });
  sim.events.push({ t: 'tangle', x: t.x, y: t.y, v: 0, owner: f.index, victim: v.index });
}

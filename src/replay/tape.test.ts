import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { botLook } from '../content/looks';
import { tuning as T } from '../content/tuning';
import { Mirror } from '../net/snapshot';
import { Room } from '../net/room';
import { NEUTRAL } from '../sim/types';
import { Sim } from '../sim/world';
import { Tape } from './tape';
import type { Clip } from './tape';

// The end-of-round replay: a bot fight's rounds each give a clip of their best moment, and a clip plays back (as online does: a Mirror,
// no physics) without a single mismatch, ending on the moment.
const saved = { cg: T.eras.changeGameplay };
beforeAll(() => { T.eras.changeGameplay = true; });
afterAll(() => { T.eras.changeGameplay = saved.cg; });

async function botFight(seed: number) {
  const sim = await Sim.create(seed, 4, false);
  sim.looks = sim.looks.map(() => botLook());
  sim.reset();
  return sim;
}

function play(clip: Clip, sim: Sim) {
  const m = new Mirror(sim, 0, clip.snaps.length);
  for (const s of clip.snaps) m.push(JSON.parse(JSON.stringify(s)));
  const first = clip.snaps[0].frame, end = clip.snaps[clip.snaps.length - 1].frame;
  const seen = new Set<string>();
  let worst = 0;
  for (let at = first; at <= end; at += 0.7) {
    for (const e of m.show(at).events) seen.add(e.t);
    const k = clip.snaps.reduce((best, x, n) => (x.frame <= at ? n : best), 0), A = clip.snaps[k], B = clip.snaps[k + 1] ?? A; // every body is where the clip says
    sim.fighters.forEach((f, i) => f.parts.forEach((q, j) => { // (between two frames, or already at the second: a part that jumped is not smeared across)
      const x0 = A.f[i].p[j * 3], x1 = B.f[i].p[j * 3];
      if (x0 !== undefined) worst = Math.max(worst, Math.min(Math.abs(q.px - x0), Math.abs(q.px - (x1 ?? x0))));
    }));
  }
  return { m, seen, worst };
}

describe('the end-of-round replay', () => {
  it('each round of a bot fight gives a clip of about 3.5 s around its best moment, which plays back exactly', async () => {
    const sim = await botFight(31), tape = new Tape();
    const clips: Clip[] = [];
    for (let i = 0; i < 60 * 90 && clips.length < 3; i++) {
      sim.step([NEUTRAL, NEUTRAL, NEUTRAL, NEUTRAL]);
      tape.feed(sim);
      const c = tape.take();
      if (c) clips.push(c);
    }
    expect(clips.length).toBe(3);
    for (const clip of clips) {
      const span = clip.snaps[clip.snaps.length - 1].frame - clip.snaps[0].frame;
      if (clip.snaps[0].frame > 2) expect(span).toBeGreaterThan(60); // (a best moment in the round's first second, two bots clashing at the start: the clip starts with the round)
      expect(span).toBeLessThanOrEqual(T.replay.before + T.replay.after);
      const copy = await Sim.create(clip.seed, clip.count, clip.dummy);
      copy.looks = clip.looks; copy.forceMap = clip.map; copy.buildRound(clip.round, clip.era);
      const { m, seen, worst } = play(clip, copy);
      expect(m.desyncs).toBe(0);
      expect(worst).toBeLessThan(0.01);
      expect(seen.has('die') || seen.has('fall') || seen.has('hit') || seen.has('stomp')).toBe(true); // something happens in it
      expect(JSON.stringify(clip).length).toBeLessThan(400_000); // small enough to send to everyone
    }
  }, 120_000);

  it('with everything on (weapons dropping in, props lying about, mixed starts), every round of two bot matches replays without a mismatch', async () => {
    const saved2 = { sp: T.spawn.enabled, ly: T.props.lying, mx: T.eras.mixStarts };
    T.spawn.enabled = true; T.props.lying = true; T.eras.mixStarts = true;
    try {
      let clips = 0;
      for (const seed of [1, 3]) {
        const sim = await botFight(seed), tape = new Tape();
        for (let i = 0; i < 60 * 100; i++) {
          sim.step([NEUTRAL, NEUTRAL, NEUTRAL, NEUTRAL]);
          tape.feed(sim);
          const clip = tape.take();
          if (!clip) continue;
          clips++;
          const copy = await Sim.create(clip.seed, clip.count, clip.dummy);
          copy.looks = clip.looks; copy.forceMap = clip.map; copy.buildRound(clip.round, clip.era);
          const { m, worst } = play(clip, copy);
          expect(m.desyncs, `seed ${seed} round ${clip.round}`).toBe(0);
          expect(worst).toBeLessThan(0.01);
          copy.world.free();
        }
      }
      expect(clips).toBeGreaterThan(10);
    } finally { T.spawn.enabled = saved2.sp; T.props.lying = saved2.ly; T.eras.mixStarts = saved2.mx; }
  }, 300_000);

  it('online: the server cuts the clip, and waits for it before the next round', async () => {
    const sim = await botFight(32), room = new Room(sim);
    let clipAt = -1, roundAt = -1, newAt = -1;
    for (let i = 0; i < 60 * 120 && newAt < 0; i++) {
      const s = room.tick();
      if (s?.ev.some((e) => e.t === 'round')) roundAt = i;
      if (s?.ev.some((e) => e.t === 'newround') && roundAt >= 0) newAt = i;
      if (room.takeClip()) clipAt = i;
    }
    expect(clipAt).toBeGreaterThan(roundAt);
    expect(newAt - clipAt).toBeGreaterThanOrEqual(Tape.frames); // everyone has time to watch it
  }, 120_000);
});

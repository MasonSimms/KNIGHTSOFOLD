// Highlights: the moments of a fight worth watching again. The spotter watches the fight's events as they happen and scores moments
// (knockouts, knock-offs, slams, big hits, a double knockout, the blow that wins the round); moments close together become one clip, a few
// seconds before to a beat after. A clip is a recording (recording.ts) and a frame range, so it can be played back exactly, saved, or shared.
import { COLORS } from '../content/looks';
import { eraById } from '../content/eras';
import { tuning as T } from '../content/tuning';
import type { SimEvent } from '../sim/types';
import type { Sim } from '../sim/world';
import type { Recording } from './recording';

export interface Moment<R = Recording> {
  rec: R; // the round it belongs to (a recording to play back; for the end-of-round replay, just which round)
  from: number; to: number; // frames of the recording to show
  at: number; // the frame it happens
  score: number; // how good a moment it is (bigger = better)
  title: string; // what happened, in plain words ("Red knocks Blue off the stage")
  era: string;
}

const H = {
  before: 150, // frames shown before a moment (2.5 s)
  after: 90, // and after (1.5 s)
  merge: 150, // moments this close together become one clip
  knockoffMemory: 240, // a fall within 4 s of being hit is a knock-off by whoever hit them
  multiWindow: 180, // two knockouts by the same fighter within 3 s is a double
  keep: 40, // the best this many moments are kept
};

/** What a fighter is called in a title: their colour, a bot, or the training dummy. */
export function nameOf(sim: Sim, i: number): string {
  const f = sim.fighters[i], look = sim.looks[i];
  if (!f) return 'Someone';
  if (!f.controlled) return 'the dummy';
  if (look?.bot) return `Bot ${i + 1}`;
  return COLORS[look?.color ?? i]?.name ?? `Player ${i + 1}`;
}

export class Spotter<R extends { era: string } = Recording> {
  readonly moments: Moment<R>[] = [];
  private last = new Map<number, { owner: number; how: string; head: boolean; frame: number; impact: number }>(); // the last hit on each fighter
  private kills: { owner: number; frame: number }[] = [];
  private rec: R | null = null;

  /** Feed the events of one step (after sim.step), with the recording that step belongs to. */
  feed(sim: Sim, rec: R | null, events: SimEvent[]): void {
    if (!rec) return;
    if (rec !== this.rec) { this.rec = rec; this.last.clear(); this.kills = []; } // a new round
    const now = sim.frame;
    for (const e of events) {
      if ((e.t === 'hit' || e.t === 'stomp') && e.owner >= 0 && e.owner !== e.victim) {
        this.last.set(e.victim, { owner: e.owner, how: e.how ?? e.t, head: !!e.head, frame: now, impact: e.v });
        if (e.t === 'stomp') this.add(sim, rec, now, 25, `${nameOf(sim, e.owner)} stomps on ${nameOf(sim, e.victim)}`);
        else if (e.how === 'slam' && (e.d ?? 0) >= 25) this.add(sim, rec, now, 40, `${nameOf(sim, e.owner)} slams ${nameOf(sim, e.victim)}${e.head ? ' head first' : ''}`);
        else if (e.v >= 70) this.add(sim, rec, now, 15 + e.v / 4, `${nameOf(sim, e.owner)} lands a huge ${e.how === 'fist' ? 'punch' : 'blow'} on ${nameOf(sim, e.victim)}`);
      } else if (e.t === 'disarm' && e.owner >= 0) {
        this.add(sim, rec, now, 12, `${nameOf(sim, e.owner)} knocks the weapon out of ${nameOf(sim, e.victim)}'s hand`);
      } else if (e.t === 'die' || e.t === 'fall') {
        const v = e.owner, h = this.last.get(v), by = h && (e.t === 'die' || now - h.frame <= H.knockoffMemory + (sim.arena.sea ? T.swim.frames : sim.arena.tar.length ? T.tar.frames : 0)) ? h : null; // (in the sea you swim a while before you go under)
        if (!by) { if (e.t === 'fall') this.add(sim, rec, now, 6, `${nameOf(sim, v)} falls off on their own`); continue; }
        const who = nameOf(sim, by.owner), them = nameOf(sim, v);
        const title = e.t === 'fall' ? `${who} knocks ${them} off the stage`
          : by.how === 'slam' ? `${who} slams ${them} into the ground`
          : by.how === 'stomp' ? `${who} stomps ${them} flat`
          : by.how === 'fist' ? `${who} punches ${them} out`
          : `${who} takes ${them} down${by.head ? ' with a blow to the head' : ''}`;
        let score = (e.t === 'fall' ? 60 : 50) + Math.min(40, by.impact / 2) + (by.head ? 10 : 0) + (by.how === 'slam' ? 20 : 0);
        this.kills = this.kills.filter((k) => now - k.frame <= H.multiWindow);
        const streak = this.kills.filter((k) => k.owner === by.owner).length;
        this.kills.push({ owner: by.owner, frame: now });
        if (streak >= 1) score += 60 * streak;
        this.add(sim, rec, now, score, streak >= 1 ? `${['Double', 'Triple', 'Quadruple'][Math.min(2, streak - 1)]} knockout by ${who}` : title);
      } else if (e.t === 'explode') {
        this.add(sim, rec, now, 30, `${nameOf(sim, e.victim)} is blown apart`);
      } else if (e.t === 'round' && e.owner >= 0) {
        this.boostLast(rec, now, 25, nameOf(sim, e.owner));
      }
    }
  }

  /** The best moments first. */
  best(n = 10): Moment<R>[] { return [...this.moments].sort((a, b) => b.score - a.score).slice(0, n); }

  private add(sim: Sim, rec: R, at: number, score: number, title: string): void {
    const prev = this.moments[this.moments.length - 1];
    if (prev && prev.rec === rec && at - prev.at <= H.merge) { // part of the same moment: one clip, the better title
      if (score > prev.score / 2) prev.title = score >= prev.score ? title : prev.title;
      prev.score += score; prev.at = at; prev.to = at + H.after;
      return;
    }
    this.moments.push({ rec, from: Math.max(0, at - H.before), to: at + H.after, at, score, title, era: eraById(rec.era).name });
    if (this.moments.length > H.keep) this.moments.splice(this.moments.indexOf(this.best(H.keep + 1)[H.keep]), 1); // drop the weakest
  }

  /** The winning blow: the last moment of this round (if it was just now, and the winner's) is worth more. */
  private boostLast(rec: R, at: number, score: number, winner: string): void {
    const prev = this.moments[this.moments.length - 1];
    if (!prev || prev.rec !== rec || at - prev.at > T.match.resultFrames || !prev.title.includes(winner)) return;
    prev.score += score;
    if (prev.title.startsWith(winner) && !/Double|Triple|Quadruple|wins/.test(prev.title)) prev.title += ' and wins the round';
  }
}

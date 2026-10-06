import { tuning as T } from '../content/tuning';
import type { SimEvent } from '../sim/types';

// How exciting the fight is right now, 0..1, for the music (owner: it swells when something exciting happens and calms when players
// move less; subtly). Big moments add a burst that fades; how much the fighters are moving sets the level it settles to.

export class Excitement {
  level = 0; // what the music follows (smoothed)
  private burst = 0; // big moments, fading

  /** A game event: hits (by how hard), knockouts, knock-offs, slams, a snapped bridge. */
  event(e: SimEvent): void {
    const X = T.music.excite;
    if (e.t === 'hit') this.burst += Math.min(1, e.v / 100) * X.hit;
    else if (e.t === 'die' || e.t === 'fall' || e.t === 'explode') this.burst += X.knockout;
    else if (e.t === 'stomp' || e.t === 'crash' || e.t === 'cut' || e.t === 'parry') this.burst += X.big;
    this.burst = Math.min(1, this.burst);
  }

  /** Each frame: `motion` = how fast the fighters are moving on average (m/s). Returns the level. */
  update(seconds: number, motion: number): number {
    const X = T.music.excite;
    this.burst *= Math.exp(-seconds / X.burstFade);
    const target = Math.min(1, Math.min(1, motion / X.motionFull) * X.motion + this.burst);
    const tau = target > this.level ? X.rise : X.fall; // quick to swell, slow to calm
    this.level += (target - this.level) * (1 - Math.exp(-seconds / tau));
    return this.level;
  }
}

/** A random pitch change for a sound: normally distributed (most near 0), never past +-range. Owner: hits within -5%..+5%. */
export function pitchVariance(range: number, rnd: () => number = Math.random): number {
  if (range <= 0) return 0;
  const g = Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd()); // a standard normal (Box-Muller)
  return Math.max(-range, Math.min(range, g * (range / 2.5))); // 2.5 standard deviations to the edge: about 1 play in 80 reaches it
}

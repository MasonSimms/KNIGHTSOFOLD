import { afterEach, describe, expect, it } from 'vitest';
import { tuning as T } from '../content/tuning';
import { dodgePose } from './dodge';

describe('how a dodge is drawn', () => {
  const look = T.dodge.look;
  afterEach(() => { T.dodge.look = look; });

  it('every look leaves a fighter who is not dodging exactly as painted, and only the old one blurs heavily', () => {
    for (const n of [0, 1, 2, 3]) for (const secs of [0, 0.1, 5]) {
      T.dodge.look = n;
      const p = dodgePose(0, secs, 1);
      expect([p.sx, p.sy, p.rot + 0, p.pivot, p.raise, p.shade, p.blur, p.eyes], `look ${n}`).toEqual([1, 1, 0, 0, 0, 0, 0, 1]);
      if (n > 0) expect(dodgePose(1, secs, 1).blur, `look ${n}`).toBeLessThan(1); // (very subtle: the old one's 2.5 smudged a fighter 30 pixels tall)
    }
  });

  it('the spin goes once round and ends facing as before; the sway leans away from the way they face', () => {
    T.dodge.look = 2;
    expect(dodgePose(1, T.dodge.turn.spinSeconds / 2, 1).sx).toBeLessThan(-0.8); // halfway: seen from the other side
    expect(dodgePose(1, T.dodge.turn.spinSeconds, 1).sx).toBeCloseTo(T.dodge.turn.back);
    T.dodge.look = 3;
    expect(dodgePose(1, 1, 1).rot).toBeLessThan(0);
    expect(dodgePose(1, 1, -1).rot).toBeGreaterThan(0);
  });
});

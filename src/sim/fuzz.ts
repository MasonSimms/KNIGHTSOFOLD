import { makeRng } from './rng';
import type { PlayerInput } from './types';

/** Random but sticky inputs for every fighter: buttons are held for a while, so grabs, charges, flips and crouches really happen. */
export function fuzzer(seed: number) {
  const r = makeRng(seed);
  const hold = [0, 0, 0, 0].map(() => ({ left: 0, cur: {} as Partial<PlayerInput> }));
  return (n: number): PlayerInput[] =>
    Array.from({ length: n }, (_, i) => {
      const h = hold[i];
      if (h.left-- <= 0) {
        h.left = 5 + Math.floor(r() * 50);
        h.cur = { moveX: r() < 0.3 ? 0 : r() * 2 - 1, jump: r() < 0.25, aim: (r() * 2 - 1) * Math.PI, attack: r() < 0.5, crouch: r() < 0.15, flip: r() < 0.2, drop: r() < 0.1, dodge: r() < 0.05 };
      }
      return { moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false, ...h.cur };
    });
}

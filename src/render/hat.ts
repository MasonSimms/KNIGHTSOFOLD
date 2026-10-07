// A fighter's hat, for the fight and the portraits: its static part painted like the fighters (painter/sprites.ts paintedHat), on the head,
// turned with the facing and boiling with the rest.
import { Sprite } from 'pixi.js';
import type { Hat } from '../content/looks';
import { tuning as T } from '../content/tuning';
import { paintedHat, PPM } from './painter/sprites';

export interface HatView {
  front: Sprite; // the static part: add it to the head's container (it moves and turns with the head)
  show(variant: number, side: number): void; // this moment's boil variant, facing `side`
}

/** A hat for a head of radius `headR` (in the parent's units: metres in the fight, metres x zoom in a portrait). Null for Bare. */
export function makeHat(hat: Hat, headR: number): HatView | null {
  const P = T.finish.paint, painted = paintedHat(hat, headR, { relief: P.relief, bristle: P.bristle, jitter: P.jitter, under: P.under });
  if (!painted) return null;
  const front = new Sprite(painted.tex[0]);
  front.anchor.set(painted.ax, painted.ay);
  front.scale.set(1 / PPM);
  return {
    front,
    show(variant, side) { front.texture = painted.tex[variant]; front.scale.x = side / PPM; },
  };
}

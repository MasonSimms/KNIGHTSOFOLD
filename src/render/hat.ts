// A fighter's hat or hairstyle, for the fight and the portraits: its static parts painted like the fighters (painter/sprites.ts
// paintedHat), on the head, turned with the facing and boiling with the rest.
import { Sprite } from 'pixi.js';
import type { Container, Texture } from 'pixi.js';
import type { Hat } from '../content/looks';
import { tuning as T } from '../content/tuning';
import { paintedHat, PPM } from './painter/sprites';

export interface HatView {
  show(variant: number, side: number): void; // this moment's boil variant, facing `side`
}

/**
 * Put a hat on a head: its parts go into `head` (the container that moves and turns with the head), centred on (hx, hy) in it; the part
 * behind the head (the afro's curls) goes underneath everything else in that container. `headR` is in the container's units (metres in
 * the fight, metres x zoom in a portrait); `tint` = the player's colour. Null for Bare.
 */
export function makeHat(hat: Hat, head: Container, hx: number, hy: number, headR: number, tint: number): HatView | null {
  const P = T.finish.paint, K = { relief: P.relief, bristle: P.bristle, jitter: P.jitter, under: P.under };
  const sprites: { s: Sprite; tex: Texture[] }[] = [];
  for (const back of [false, true]) {
    const painted = paintedHat(hat, headR, tint, K, back);
    if (!painted) continue;
    const s = new Sprite(painted.tex[0]);
    s.anchor.set(painted.ax, painted.ay);
    s.scale.set(1 / PPM);
    s.position.set(hx, hy);
    if (back) head.addChildAt(s, 0); else head.addChild(s);
    sprites.push({ s, tex: painted.tex });
  }
  if (!sprites.length) return null;
  return {
    show(variant, side) { for (const { s, tex } of sprites) { s.texture = tex[variant]; s.scale.x = side / PPM; } },
  };
}

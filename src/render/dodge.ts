// How a dodging fighter is drawn (owner, 2026-10-09: no heavy blur; the body turns out of the blow and slips a little way into the
// background). The looks are the owner's to choose between (tuning.dodge.look, or ?dodge=2 on any link): 0 the old one (narrow, dark and
// blurred), 1 a quarter turn away (the back of the head: no eyes), 2 a spin on the spot, 3 a sway back from the feet. Looks only: the
// simulation's dodge (the background plane) is the same under all of them.
import { tuning as T } from '../content/tuning';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface DodgePose {
  sx: number; sy: number; // the body's width and height (1 = as painted; a negative width is the body seen from its other side)
  rot: number; // radians the body leans, about `pivot`
  pivot: number; // metres under the hips the body turns about (0: the hips; the feet for a sway)
  raise: number; // metres higher on the screen (farther back)
  shade: number; // how much darker (0..1)
  blur: number; // pixels at 1080p
  eyes: number; // how much of the eyes shows (0: the back of the head)
}

const pose: DodgePose = { sx: 1, sy: 1, rot: 0, pivot: 0, raise: 0, shade: 0, blur: 0, eyes: 1 }; // (one, written over each time: nothing made per frame)

/**
 * `vis`: 0 on the play plane, 1 behind it (eased by the renderer); `secs`: how long they have been back there; `side`: the way they face.
 * The same object comes back every time: use it before asking again.
 */
export function dodgePose(vis: number, secs: number, side: number): DodgePose {
  const D = T.dodge, L = D.turn;
  if (D.look === 0) { pose.sx = lerp(1, D.visualSquash, vis); pose.sy = lerp(1, 0.97, vis); pose.rot = 0; pose.pivot = 0; pose.raise = D.visualRaise * vis; pose.shade = D.visualShade * vis; pose.blur = D.visualBlur * vis; pose.eyes = 1; return pose; }
  const back = lerp(1, L.back, vis); // a step into the background: a little smaller
  pose.sx = pose.sy = back; pose.rot = 0; pose.pivot = 0; pose.raise = L.raise * vis; pose.shade = L.shade * vis; pose.blur = L.blur * vis; pose.eyes = 1;
  if (D.look === 2) { // a spin on the spot: round once (halfway they face the other way), then back as they were
    const t = Math.min(1, secs / L.spinSeconds), a = t * t * (3 - 2 * t) * 2 * Math.PI;
    pose.sx = back * lerp(1, Math.cos(a), Math.min(1, vis * 5));
  } else if (D.look === 3) { // a sway back: the feet stay, the head and shoulders go back out of reach
    pose.sx = back * lerp(1, L.swayNarrow, vis); pose.rot = -side * L.sway * vis; pose.pivot = vis > 0.01 ? T.stand.height : 0;
  } else { pose.sx = back * lerp(1, L.narrow, vis); pose.eyes = 1 - vis; } // a quarter turn away
  return pose;
}

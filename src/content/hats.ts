// The parts of a hat that sway (looks only, like the cape: the simulation never sees them; render/dangle.ts moves them).
// Every position and length is in head radii from the centre of the head: x toward the face, y down. Drawn facing right, mirrored with
// the facing. Angles: 0 = straight down, ±PI = straight up, positive turns toward the face side (so -2.6 is up and back).
// First guesses from LOOKS_HANDOFF.md: the owner tunes them.
import type { Hat } from './looks';

export interface DangleSpec {
  anchor: [number, number]; // where it hangs from on the head
  links: number; // points in the chain, including the anchor
  length: number; // total length
  rest: number; // the direction it wants to point when nothing moves (relative to the head)
  stiffness: number; // 0 = hangs like cloth, 1 = rigid: how hard each link turns back toward its rest (the first toward `rest`, the others toward the line of the link before; render/dangle.ts)
  damping?: number; // 0..1, how much speed each point keeps (default finish.dangle.damping)
  gravity?: number; // multiplier on finish.dangle.gravity (default 1)
  trail?: number; // push away from the way the fighter faces, m/s² (default finish.dangle.trail)
  flutter?: number; // small idle wobble, m/s² (default finish.dangle.flutter)
  width: [number, number]; // strip width at the root and at the tip ([0, 0]: no strip, just the tip)
  colors: [string, string?]; // its paint: the colour, and a second one along its middle (a feather's quill, a lock's lighter strand)
  alpha?: number; // how solid (a veil is sheer)
  tip?: 'bell' | 'tie' | 'pompom' | 'curl'; // something drawn at the last point: a brass bell, a braid's red tie and tuft, a beanie's pom-pom, a round curl of the hair
  braided?: boolean; // painted as a plait (alternating lumps)
  front?: boolean; // in front of the face, over the eyes (Fubo's curtain bangs); otherwise behind the head
}

const point = (anchor: [number, number], length: number, rest: number, stiffness: number, color: string): DangleSpec => ({ anchor, links: 4, length, rest, stiffness, width: [0.35, 0.05], colors: [color], tip: 'bell' });
const spike = (x: number): DangleSpec => { const y = -Math.sqrt(1 - x * x); return { anchor: [x * 0.97, y * 0.97], links: 2, length: 1.1 - (0.6 * Math.abs(x)) / 0.7, rest: Math.atan2(x, y), stiffness: 0.85, width: [0.2, 0.02], colors: ['#B5321F'] }; }; // straight out from the head
const lock = (anchor: [number, number], rest: number): DangleSpec => ({ anchor, links: 4, length: 1.6, rest, stiffness: 0.15, width: [0.5, 0.25], colors: ['#7A4E28', '#8C5A2E'] });

export const DANGLES: Partial<Record<Hat, DangleSpec[]>> = {
  plumed: [{ anchor: [0.27, -1.13], links: 4, length: 1.9, rest: -2.6, stiffness: 0.55, width: [0.35, 0.12], colors: ['#F1E6CF', '#BFB49A'] }], // a stiff feather: springs back upright after a hit
  jester: [point([-0.73, -0.6], 1.2, -2.2, 0.2, '#D8402A'), point([0, -0.87], 1.6, -3.0, 0.25, '#E8B931'), point([0.73, -0.6], 1.2, 2.2, 0.2, '#D8402A')], // three floppy points with a bell each
  wizard: [{ anchor: [0, -1.87], links: 3, length: 1.1, rest: -3.1, stiffness: 0.45, width: [0.4, 0.04], colors: ['#4A4288'] }], // the cone's tip droops and swings
  hennin: [{ anchor: [1.07, -2.8], links: 6, length: 4.2, rest: 0.3, stiffness: 0.05, width: [0.3, 0.7], colors: ['#F4EEE2'], alpha: 0.75, trail: 3, flutter: 2.5 }], // the veil: cloth, like the cape
  locks: [lock([-0.9, -0.3], -0.25), lock([-0.5, -0.8], -0.5), lock([0, -0.95], -0.75)], // the mane, fanned out behind the head so it shows past it (the handoff had all three at 0.2, hanging hidden behind the head; the strands overlap into one)
  beanie: [{ anchor: [0, -1.3], links: 2, length: 0.25, rest: -Math.PI, stiffness: 0.6, width: [0, 0], colors: ['#F1E6CF'], tip: 'pompom' }], // the pom-pom bobs on a short stiff spring
  // Hair. (The ponytail's and braid's rests are negative where the handoff had them positive: positive leans toward the face here, and they hang down the back.)
  ponytail: [{ anchor: [-0.93, -0.5], links: 4, length: 1.9, rest: -0.5, stiffness: 0.2, width: [0.45, 0.12], colors: ['#8A3A1E', '#6E2E16'] }], // whips round when you turn
  braid: [{ anchor: [-0.9, 0.05], links: 5, length: 2.0, rest: -0.15, stiffness: 0.1, gravity: 1.4, width: [0.42, 0.3], colors: ['#D8B35A', '#C79A44'], braided: true, tip: 'tie' }], // a heavy rope
  pigtails: [-1, 1].map((k): DangleSpec => ({ anchor: [0.97 * k, -0.33], links: 3, length: 1.0, rest: 0.7 * k, stiffness: 0.3, width: [0.45, 0.15], colors: ['#D8732E', '#C4602A'] })), // two bouncy bunches
  fubo: [ // the owner's named style: curtain bangs falling either side of the middle part, in front of the face (the right one longer, brushing past the eye), and three flyaway strands. (Rest 0.8, not the handoff's 0.35: from the middle part, 0.35 hangs them straight over both eyes.)
    ...[-1, 1].map((k): DangleSpec => ({ anchor: [0.03 * k, -0.87], links: 3, length: k < 0 ? 1.3 : 1.45, rest: 0.8 * k, stiffness: 0.4, width: [0.45, 0.12], colors: ['#1A1512', '#3E342A'], front: true })),
    ...[-0.4, 0.1, 0.6].map((x): DangleSpec => { const y = -Math.sqrt(1 - x * x) - 0.25; return { anchor: [x, y], links: 2, length: 0.4, rest: Math.atan2(x * 1.6, -1), stiffness: 0.6, width: [0.06, 0.03], colors: ['#1A1512'] }; }),
  ],
  mohawk: [-0.7, -0.47, -0.23, 0, 0.23, 0.47, 0.7].map(spike), // seven stiff spikes, the tallest in the middle: they mostly jiggle
  graham: [ // the owner's friend Graham (2026-10-06): a big loose brown mop of waves. Two side curls hang to the jaw and swing; four flyaway waves on top spring about (his browline glasses are render/hat.ts)
    ...[-1, 1].map((k): DangleSpec => ({ anchor: [1.0 * k, -0.15], links: 3, length: 0.85, rest: 0.25 * k, stiffness: 0.3, width: [0.5, 0.32], colors: ['#7E5A36', '#A9814F'] })),
    ...[-0.75, -0.3, 0.15, 0.55].map((x): DangleSpec => { const y = -Math.sqrt(1 - x * x) - 0.45; return { anchor: [x, y], links: 3, length: 0.6, rest: Math.atan2(x * 1.8, -1), stiffness: 0.35, width: [0.22, 0.06], colors: ['#7E5A36', '#A9814F'] }; }),
  ],
  bubby: [-0.95, -0.6, -0.2, 0.2, 0.6, 0.95].map((x): DangleSpec => { // the owner's friend Bubby (2026-10-06): tight springy curls round the rim of the cloud that bounce with every move (the cloud squashes like the afro's)
    const y = -0.65 - Math.sqrt(Math.max(0, 1.3 - x * x)) * 0.95;
    return { anchor: [x, y], links: 3, length: 0.32, rest: Math.atan2(x * 1.4, y + 0.6), stiffness: 0.4, width: [0.2, 0.14], colors: ['#6A4528', '#8E6440'], tip: 'curl' }; // a short coil with a round curl on the end
  }),
};

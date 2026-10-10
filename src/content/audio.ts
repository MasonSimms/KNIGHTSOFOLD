// What the game sounds like, as data. Owner: the sounds and music come later; until a file is listed here, a placeholder made in code
// plays instead, so everything already works. To add a real one: put the file in public/audio/ and write its name here.

/** The sound effects, by the game event that plays them. */
export type SoundName = 'hit' | 'jump' | 'punch' | 'dodge' | 'drop' | 'throw' | 'disarm' | 'round' | 'parry' | 'clash' | 'clack' | 'crash' | 'cut' | 'stomp' | 'grab' | 'pickup' | 'die' | 'fall'
  | 'shot' | 'bigshot' | 'empty' | 'spark' | 'splinter' | 'snap' | 'break' | 'impact' | 'splash' | 'ignite' | 'trample' | 'whistle' | 'shatter' | 'leak' | 'boom' | 'thunk' | 'hookThrow' | 'hook' | 'unhook' | 'tangle' | 'zap';

/**
 * Sound files (in public/audio/sfx/), and how much each one's pitch varies from play to play: a random amount with a normal distribution
 * (most plays close to the original, rarely near the edge), never past the range. Owner: hits vary across -5% to +5%.
 * Empty `file` = the placeholder made in code.
 */
export const SOUNDS: Record<SoundName, { file?: string; pitch: number; volume?: number }> = {
  hit: { pitch: 0.05 }, jump: { pitch: 0.02 }, punch: { pitch: 0.03 }, dodge: { pitch: 0.02 }, drop: { pitch: 0.02 }, throw: { pitch: 0.02 },
  disarm: { pitch: 0.03 }, round: { pitch: 0 }, parry: { pitch: 0.03 }, clash: { pitch: 0.06 }, clack: { pitch: 0.06 }, crash: { pitch: 0.03 }, cut: { pitch: 0.03 }, stomp: { pitch: 0.03 },
  grab: { pitch: 0.02 }, pickup: { pitch: 0.02 }, die: { pitch: 0.02 }, fall: { pitch: 0.02 },
  shot: { pitch: 0.05 }, bigshot: { pitch: 0.04 }, empty: { pitch: 0.03 }, spark: { pitch: 0.06 }, splinter: { pitch: 0.06 }, snap: { pitch: 0.04 },
  break: { pitch: 0.04 }, impact: { pitch: 0.06 }, splash: { pitch: 0.05 }, ignite: { pitch: 0.06 }, trample: { pitch: 0.04 }, whistle: { pitch: 0.02 }, shatter: { pitch: 0.06 }, leak: { pitch: 0.05 }, boom: { pitch: 0.05 }, thunk: { pitch: 0.06 }, hookThrow: { pitch: 0.08 }, hook: { pitch: 0.06 }, unhook: { pitch: 0.06 }, tangle: { pitch: 0.06 }, zap: { pitch: 0.08 },
};

/**
 * Music (owner): a base layer that always plays, one or two instruments added by each era, and a "drive" layer that swells with the
 * excitement of the fight. Every part (stem) is a loop of the SAME length and tempo, so they all play in step: written for the composer.
 * file: in public/audio/music/ (empty = a placeholder made in code, of the kind given); gain: its level in the mix.
 */
export type Placeholder = 'pad' | 'pulse' | 'pluck' | 'flute' | 'drum' | 'horn' | 'bass';
export interface Stem { id: string; kind: Placeholder; file?: string; gain: number }

export const MUSIC = {
  bpm: 96, bars: 4, // the placeholders' loop: 4 bars of 4/4 at 96 beats a minute (10 s). Real stems: any length, all the same
  base: [{ id: 'base-pad', kind: 'pad', gain: 0.55 }, { id: 'base-bass', kind: 'bass', gain: 0.4 }] as Stem[],
  drive: { id: 'drive', kind: 'pulse', gain: 0.5 } as Stem, // comes in with excitement
  eras: {
    caveman: [{ id: 'caveman-drum', kind: 'drum', gain: 0.6 }, { id: 'caveman-bone-flute', kind: 'flute', gain: 0.35 }],
    egypt: [{ id: 'egypt-harp', kind: 'pluck', gain: 0.45 }, { id: 'egypt-ney', kind: 'flute', gain: 0.35 }],
    gladiators: [{ id: 'gladiators-horn', kind: 'horn', gain: 0.35 }, { id: 'gladiators-drum', kind: 'drum', gain: 0.5 }],
    vikings: [{ id: 'vikings-horn', kind: 'horn', gain: 0.4 }, { id: 'vikings-war-drum', kind: 'drum', gain: 0.55 }],
    medieval: [{ id: 'medieval-lute', kind: 'pluck', gain: 0.45 }, { id: 'medieval-recorder', kind: 'flute', gain: 0.3 }],
    samurai: [{ id: 'samurai-shakuhachi', kind: 'flute', gain: 0.4 }, { id: 'samurai-taiko', kind: 'drum', gain: 0.6 }], // owner: flutes and a drum
    pirates: [{ id: 'pirates-fiddle', kind: 'horn', gain: 0.3 }, { id: 'pirates-concertina', kind: 'pluck', gain: 0.4 }],
    westerns: [{ id: 'westerns-whistle', kind: 'flute', gain: 0.4 }, { id: 'westerns-guitar', kind: 'pluck', gain: 0.5 }], // owner: whistles and a guitar
    ww1: [{ id: 'ww1-snare', kind: 'drum', gain: 0.45 }, { id: 'ww1-bugle', kind: 'horn', gain: 0.3 }],
    vietnam: [{ id: 'vietnam-guitar', kind: 'pluck', gain: 0.45 }],
    modern: [{ id: 'modern-synth', kind: 'pulse', gain: 0.35 }],
    scifi: [{ id: 'scifi-arp', kind: 'pluck', gain: 0.4 }, { id: 'scifi-theremin', kind: 'flute', gain: 0.3 }],
    fantasy: [{ id: 'fantasy-harp', kind: 'pluck', gain: 0.45 }, { id: 'fantasy-flute', kind: 'flute', gain: 0.35 }],
    mobsters: [{ id: 'mobsters-clarinet', kind: 'flute', gain: 0.35 }, { id: 'mobsters-upright-bass', kind: 'bass', gain: 0.45 }],
  } as Record<string, Stem[]>,
};

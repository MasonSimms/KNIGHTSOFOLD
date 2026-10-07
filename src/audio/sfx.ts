import { SOUNDS } from '../content/audio';
import type { SoundName } from '../content/audio';
import { tuning as T } from '../content/tuning';
import { pitchVariance } from './intensity';
import { startMusic } from './music';

// Sound effects. A sound with a file in content/audio.ts plays that file (public/audio/sfx/); the others are placeholders synthesised
// with WebAudio. Every play varies its pitch a little (a normal distribution within the sound's range: hits -5%..+5%, owner).
let ctx: AudioContext | null = null;
const samples = new Map<SoundName, AudioBuffer>();
let effects = 1; // the player's volume settings (master x sound effects), 0..1
/** The settings screen's volumes: master and sound effects (music has its own when there is music). */
export function setVolumes(master: number, sfx: number): void { effects = master * sfx; }
let noise: AudioBuffer | null = null;

/** Browsers only allow audio after a user gesture; call this from a click or key press. */
export function unlockAudio(): void {
  ctx ??= new AudioContext();
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  void ctx.resume();
  const c = ctx;
  if (!samples.size) for (const [name, s] of Object.entries(SOUNDS) as [SoundName, (typeof SOUNDS)[SoundName]][]) {
    if (s.file) void fetch(`audio/sfx/${s.file}`).then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)).then((buf) => samples.set(name, buf)).catch(() => { /* (the placeholder plays) */ });
  }
  startMusic(c);
}

/** Play a sound: its file if there is one, else its placeholder, at a slightly different pitch each time (p = the pitch factor). */
function play(name: SoundName, placeholder: (p: number) => void, vol = 1): void {
  if (!ctx) return;
  const S = SOUNDS[name], p = 1 + pitchVariance(S.pitch), buf = samples.get(name);
  if (!buf) return placeholder(p);
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = buf;
  s.playbackRate.value = p;
  g.gain.value = vol * (S.volume ?? 1) * T.audio.master * effects;
  s.connect(g).connect(ctx.destination);
  s.start();
}

function tone(type: OscillatorType, from: number, to: number, len: number, vol: number): void {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + len);
  g.gain.setValueAtTime(vol * T.audio.master * effects, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + len);
}

function burst(len: number, vol: number): void {
  if (!ctx || !noise) return;
  const s = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
  s.buffer = noise;
  g.gain.setValueAtTime(vol * T.audio.master * effects, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  s.connect(g).connect(ctx.destination);
  s.start(t);
  s.stop(t + len);
}

export const sfx = {
  hit(impact: number, head = false) {
    const k = Math.min(impact / T.audio.hitFullImpact, 1);
    play('hit', (p) => {
      tone('sine', T.audio.hitFreqHigh * p, T.audio.hitFreqLow * p, T.audio.hitLength, 0.5 + 0.5 * k);
      burst(0.06 + 0.06 * k, 0.3 + 0.5 * k);
      if (head) tone('square', 700 * p, 350 * p, 0.12, 0.35); // a "bonk" on top for a head shot
    }, 0.5 + 0.5 * k);
  },
  jump() { play('jump', (p) => tone('square', 220 * p, 440 * p, 0.08, 0.15)); },
  punch() { play('punch', (p) => { burst(0.08, 0.25); tone('triangle', 420 * p, 160 * p, 0.09, 0.15); }); }, // a quick whoosh
  dodge() { play('dodge', (p) => { tone('sine', 500 * p, 180 * p, 0.22, 0.2); burst(0.18, 0.12); }); }, // slipping away
  drop() { play('drop', (p) => tone('triangle', 520 * p, 240 * p, 0.09, 0.2)); }, // let go of the club
  throw() { play('throw', (p) => { tone('sawtooth', 220 * p, 650 * p, 0.12, 0.2); burst(0.1, 0.2); }); }, // whoosh
  disarm() { play('disarm', (p) => { tone('square', 900 * p, 300 * p, 0.14, 0.3); burst(0.08, 0.3); }); }, // a metallic clang
  round() { play('round', () => { tone('triangle', 392, 392, 0.12, 0.25); setTimeout(() => tone('triangle', 523, 523, 0.12, 0.25), 130); setTimeout(() => tone('triangle', 659, 659, 0.25, 0.25), 260); }); }, // a little win jingle
  parry() { play('parry', (p) => { tone('square', 1400 * p, 900 * p, 0.1, 0.35); tone('triangle', 2200 * p, 1500 * p, 0.15, 0.2); burst(0.05, 0.3); }); }, // a bright ring of steel
  crash() { play('crash', (p) => { tone('sine', 140 * p, 60 * p, 0.14, 0.45); burst(0.07, 0.4); }); }, // a thud
  cut() { play('cut', (p) => { tone('sawtooth', 300 * p, 120 * p, 0.1, 0.3); burst(0.08, 0.35); }); }, // a snapping rope
  stomp() { play('stomp', (p) => { tone('square', 120 * p, 60 * p, 0.18, 0.5); burst(0.12, 0.5); }); }, // a heavy squash
  grab() { play('grab', (p) => { tone('square', 180 * p, 120 * p, 0.08, 0.25); burst(0.05, 0.2); }); }, // a grunt-like thud
  pickup() { play('pickup', (p) => tone('triangle', 300 * p, 520 * p, 0.07, 0.2)); },
  die() { play('die', (p) => tone('sawtooth', 330 * p, 90 * p, 0.35, 0.2)); }, // a short comic "wah"
  fall() { play('fall', (p) => tone('sine', 700 * p, 80 * p, 0.6, 0.3)); },
  /** A shot: a revolver's crack, or (big = the flintlock) a deep boom. */
  shot(big = false) { if (big) play('bigshot', (p) => { burst(0.3, 0.9); tone('sine', 120 * p, 40 * p, 0.35, 0.8); }); else play('shot', (p) => { burst(0.09, 0.8); tone('square', 900 * p, 200 * p, 0.05, 0.25); tone('sine', 200 * p, 70 * p, 0.12, 0.5); }); },
  empty() { play('empty', (p) => { tone('square', 2200 * p, 1800 * p, 0.025, 0.25); setTimeout(() => tone('square', 1600 * p, 1300 * p, 0.02, 0.2), 60); }); }, // the dry click of a gun with nothing left
  spark() { play('spark', (p) => { tone('triangle', 2600 * p, 1900 * p, 0.12, 0.3); burst(0.03, 0.2); }); }, // a ping off metal
  splinter() { play('splinter', (p) => { burst(0.05, 0.35); tone('square', 380 * p, 220 * p, 0.04, 0.15); }); }, // wood cracking
  snap() { play('snap', (p) => { burst(0.12, 0.6); tone('square', 260 * p, 90 * p, 0.12, 0.35); }); }, // wood breaking in two
  break() { play('break', (p) => { burst(0.2, 0.6); tone('sine', 160 * p, 60 * p, 0.2, 0.5); }); }, // a barrel or crate falling apart
  impact() { play('impact', (p) => { burst(0.04, 0.25); tone('sine', 300 * p, 120 * p, 0.05, 0.15); }); }, // a bullet into the ground
  splash() { play('splash', (p) => { burst(0.25, 0.3); tone('sine', 500 * p, 200 * p, 0.15, 0.1); }); },
  trample() { play('trample', (p) => { tone('sawtooth', 300 * p, 560 * p, 0.25, 0.25); setTimeout(() => tone('sawtooth', 560 * p, 380 * p, 0.35, 0.2), 220); burst(0.2, 0.4); }); }, // the mammoth trumpets as it tosses you
  whistle() { play('whistle', (p) => { tone('triangle', 520 * p, 500 * p, 0.7, 0.18); tone('triangle', 650 * p, 625 * p, 0.7, 0.15); tone('triangle', 780 * p, 750 * p, 0.7, 0.12); }); }, // the train's steam whistle: something is coming
  shatter() { play('shatter', (p) => { burst(0.35, 0.5); tone('triangle', 3200 * p, 2400 * p, 0.2, 0.15); setTimeout(() => tone('triangle', 4100 * p, 3000 * p, 0.15, 0.1), 50); }); }, // a window breaking
  boom() { play('boom', (p) => { burst(0.6, 1); tone('sine', 90 * p, 30 * p, 0.6, 0.9); tone('square', 60 * p, 25 * p, 0.3, 0.3); }); }, // a grenade
  thunk() { play('thunk', (p) => { tone('square', 220 * p, 110 * p, 0.07, 0.35); burst(0.05, 0.3); }); }, // a spear sticks in
  leak() { play('leak', (p) => { burst(0.6, 0.3); tone('sine', 900 * p, 700 * p, 0.3, 0.06); }); }, // a bullet through the water tower: a gush
  ignite() { play('ignite', (p) => { burst(0.35, 0.35); tone('sawtooth', 90 * p, 160 * p, 0.3, 0.12); }); }, // a whoomph as something catches fire
};

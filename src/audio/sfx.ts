import { tuning as T } from '../content/tuning';

// Placeholder sounds synthesised with WebAudio (no asset files). Real licensed SFX come in the art/audio phase.
let ctx: AudioContext | null = null;
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
}

function tone(type: OscillatorType, from: number, to: number, len: number, vol: number): void {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + len);
  g.gain.setValueAtTime(vol * T.audio.master, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + len);
}

function burst(len: number, vol: number): void {
  if (!ctx || !noise) return;
  const s = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
  s.buffer = noise;
  g.gain.setValueAtTime(vol * T.audio.master, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  s.connect(g).connect(ctx.destination);
  s.start(t);
  s.stop(t + len);
}

export const sfx = {
  hit(impact: number) {
    const k = Math.min(impact / T.audio.hitFullImpact, 1);
    tone('sine', T.audio.hitFreqHigh, T.audio.hitFreqLow, T.audio.hitLength, 0.5 + 0.5 * k);
    burst(0.06 + 0.06 * k, 0.3 + 0.5 * k);
  },
  jump() { tone('square', 220, 440, 0.08, 0.15); },
  grab() { tone('triangle', 300, 500, 0.06, 0.25); },
  drop() { tone('triangle', 500, 250, 0.08, 0.25); },
  throw() { tone('sawtooth', 200, 700, 0.12, 0.2); },
  die() { tone('sawtooth', 300, 60, 0.35, 0.3); },
  fall() { tone('sine', 700, 80, 0.6, 0.3); },
};

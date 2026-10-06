import { tuning as T } from '../content/tuning';

// Placeholder sounds synthesised with WebAudio (no asset files). Real licensed SFX come in the art/audio phase.
let ctx: AudioContext | null = null;
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
    tone('sine', T.audio.hitFreqHigh, T.audio.hitFreqLow, T.audio.hitLength, 0.5 + 0.5 * k);
    burst(0.06 + 0.06 * k, 0.3 + 0.5 * k);
    if (head) tone('square', 700, 350, 0.12, 0.35); // a "bonk" on top for a head shot
  },
  jump() { tone('square', 220, 440, 0.08, 0.15); },
  punch() { burst(0.08, 0.25); tone('triangle', 420, 160, 0.09, 0.15); }, // a quick whoosh
  dodge() { tone('sine', 500, 180, 0.22, 0.2); burst(0.18, 0.12); }, // slipping away
  drop() { tone('triangle', 520, 240, 0.09, 0.2); }, // let go of the club
  throw() { tone('sawtooth', 220, 650, 0.12, 0.2); burst(0.1, 0.2); }, // whoosh
  disarm() { tone('square', 900, 300, 0.14, 0.3); burst(0.08, 0.3); }, // a metallic clang
  round() { tone('triangle', 392, 392, 0.12, 0.25); setTimeout(() => tone('triangle', 523, 523, 0.12, 0.25), 130); setTimeout(() => tone('triangle', 659, 659, 0.25, 0.25), 260); }, // a little win jingle
  parry() { tone('square', 1400, 900, 0.1, 0.35); tone('triangle', 2200, 1500, 0.15, 0.2); burst(0.05, 0.3); }, // a bright ring of steel
  crash() { tone('sine', 140, 60, 0.14, 0.45); burst(0.07, 0.4); }, // a thud
  cut() { tone('sawtooth', 300, 120, 0.1, 0.3); burst(0.08, 0.35); }, // a snapping rope
  stomp() { tone('square', 120, 60, 0.18, 0.5); burst(0.12, 0.5); }, // a heavy squash
  grab() { tone('square', 180, 120, 0.08, 0.25); burst(0.05, 0.2); }, // a grunt-like thud
  pickup() { tone('triangle', 300, 520, 0.07, 0.2); },
  die() { tone('sawtooth', 330, 90, 0.35, 0.2); }, // a short comic "wah"
  fall() { tone('sine', 700, 80, 0.6, 0.3); },
};

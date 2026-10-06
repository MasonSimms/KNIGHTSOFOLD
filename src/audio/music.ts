import { MUSIC } from '../content/audio';
import type { Placeholder, Stem } from '../content/audio';
import { tuning as T } from '../content/tuning';

// Dynamic music (owner). Every stem is a loop of the same length, all started on the same beat: the base layer always plays, the era's
// one or two instruments fade in when its rounds begin (and out when the era changes), and the drive layer follows the excitement of the
// fight, which also lifts the volume and opens up the sound a little (subtle, tuning.music.sway). Stems listed with a file in
// content/audio.ts are loaded from public/audio/music/; the rest are placeholders made here, so it can all be heard before the real music.

interface Layer { stem: Stem; gain: GainNode; source: AudioBufferSourceNode | null; want: number }

let ctx: AudioContext | null = null, out: GainNode | null = null, tone: BiquadFilterNode | null = null;
let t0 = 0, volume = 1, era = '';
const layers = new Map<string, Layer>();
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const loopSeconds = () => (60 / MUSIC.bpm) * 4 * MUSIC.bars;

/** Start the music on the game's audio context (after the first click or key: browsers require it). */
export function startMusic(c: AudioContext): void {
  if (ctx) return;
  ctx = c;
  tone = c.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = T.music.sway.brightLow;
  out = c.createGain();
  out.gain.value = 0;
  tone.connect(out).connect(c.destination);
  t0 = c.currentTime + 0.15;
  for (const s of MUSIC.base) layer(s).want = 1;
  layer(MUSIC.drive).want = 0;
}

/** The player's music volume (master x music, 0..1, from the settings). */
export function setMusicVolume(v: number): void { volume = v; }

/** The era being fought in ('' = none: menus, practice): its instruments fade in, the last era's fade out. */
export function setMusicEra(id: string): void {
  if (!ctx || id === era) return;
  era = id;
  const want = new Set((MUSIC.eras[id] ?? []).map((s) => s.id));
  for (const s of MUSIC.eras[id] ?? []) layer(s);
  for (const [id2, l] of layers) if (Object.values(MUSIC.eras).some((list) => list.some((s) => s.id === id2))) l.want = want.has(id2) ? 1 : 0;
}

/** Each frame, with how exciting the fight is (0..1): the drive layer, the volume and the brightness follow it, gently. */
export function updateMusic(excitement: number): void {
  if (!ctx || !out || !tone) return;
  const S = T.music.sway, now = ctx.currentTime, k = Math.max(0, Math.min(1, excitement));
  out.gain.setTargetAtTime(volume * T.music.volume * (1 - S.gain + S.gain * k), now, 0.4);
  tone.frequency.setTargetAtTime(S.brightLow + (S.brightHigh - S.brightLow) * k, now, 0.6);
  const drive = layers.get(MUSIC.drive.id);
  if (drive) drive.want = k * S.drive;
  for (const l of layers.values()) l.gain.gain.setTargetAtTime(l.want * l.stem.gain, now, (l.stem === MUSIC.drive ? 0.5 : T.music.eraFade) / 3);
}

/** A stem's layer: made (silent) and started in step with the others as soon as its sound is ready. */
function layer(stem: Stem): Layer {
  let l = layers.get(stem.id);
  if (l) return l;
  const c = ctx!, gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(tone!);
  l = { stem, gain, source: null, want: 0 };
  layers.set(stem.id, l);
  const made = l;
  void sound(stem).then((buf) => {
    if (!buf || made.source) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(gain);
    const at = Math.max(c.currentTime + 0.02, t0), len = buf.duration;
    src.start(at, (((at - t0) % len) + len) % len); // in step with everything already playing
    made.source = src;
  });
  return l;
}

function sound(stem: Stem): Promise<AudioBuffer | null> {
  let p = buffers.get(stem.id);
  if (!p) {
    p = (stem.file
      ? fetch(`audio/music/${stem.file}`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText)))).then((b) => ctx!.decodeAudioData(b))
      : Promise.reject(new Error('placeholder'))
    ).catch(() => placeholder(stem.kind, stem.id));
    buffers.set(stem.id, p);
  }
  return p;
}

// ---- placeholders: a few bars of each kind of instrument, made in code (a stand-in until the real stems) ----
const CHORDS = [[50, 53, 57], [46, 50, 53], [41, 45, 48], [48, 52, 55]]; // Dm, Bb, F, C (MIDI notes), one bar each
const SCALE = [62, 65, 67, 69, 72, 74]; // D minor pentatonic, for melodies
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
function rng(s: string) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

async function placeholder(kind: Placeholder, id: string): Promise<AudioBuffer | null> {
  if (typeof OfflineAudioContext === 'undefined') return null;
  const sr = 22050, len = loopSeconds(), beat = 60 / MUSIC.bpm, bar = beat * 4, o = new OfflineAudioContext(1, Math.round(len * sr), sr), R = rng(id);
  const noise = o.createBuffer(1, sr, sr);
  noise.getChannelData(0).forEach((_, i, d) => { d[i] = R() * 2 - 1; });
  /** One note: an oscillator through a gain envelope (attack, hold, release), optionally filtered. */
  const note = (type: OscillatorType, f: number, at: number, dur: number, vol: number, attack = 0.01, lp = 0, vib = 0, drop = 0) => {
    const osc = o.createOscillator(), g = o.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, at);
    if (drop) osc.frequency.exponentialRampToValueAtTime(f * drop, at + dur);
    if (vib) { const l = o.createOscillator(), lg = o.createGain(); l.frequency.value = 5; lg.gain.value = f * vib; l.connect(lg).connect(osc.frequency); l.start(at); l.stop(at + dur); }
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let last: AudioNode = osc.connect(g);
    if (lp) { const f2 = o.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; last = last.connect(f2); }
    last.connect(o.destination);
    osc.start(at); osc.stop(at + dur + 0.05);
  };
  const hiss = (at: number, dur: number, vol: number, hp: number) => {
    const s = o.createBufferSource(), g = o.createGain(), f = o.createBiquadFilter();
    s.buffer = noise; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f).connect(g).connect(o.destination); s.start(at); s.stop(at + dur);
  };
  for (let b = 0; b < MUSIC.bars; b++) {
    const t = b * bar, chord = CHORDS[b % CHORDS.length];
    if (kind === 'pad') for (const m of chord) for (const det of [0.997, 1.003]) note('sawtooth', hz(m + 12) * det, t, bar * 0.98, 0.05, 0.6, 900);
    if (kind === 'bass') for (const k of [0, 2]) note('triangle', hz(chord[0] - 12), t + k * beat, beat * 1.8, 0.35, 0.02, 400);
    if (kind === 'pulse') for (let k = 0; k < 8; k++) { note('square', hz(chord[0]), t + k * beat / 2, beat * 0.4, 0.09, 0.005, 700); if (k % 2) hiss(t + k * beat / 2, 0.05, 0.08, 6000); }
    if (kind === 'pluck') for (let k = 0; k < 8; k++) if (R() < 0.8) note('triangle', hz(chord[k % 3] + 24), t + k * beat / 2, 0.45, 0.16, 0.004, 3000);
    if (kind === 'drum') for (let k = 0; k < 4; k++) { if (k % 2 === 0 || R() < 0.3) note('sine', 130, t + k * beat, 0.3, 0.6, 0.003, 0, 0, 0.35); if (R() < 0.25) note('sine', 180, t + k * beat + beat / 2, 0.18, 0.35, 0.003, 0, 0, 0.4); }
    if (kind === 'flute') { let m = Math.floor(R() * SCALE.length); for (let k = 0; k < 2; k++) { if (R() < 0.75) note('sine', hz(SCALE[m] + 12), t + k * beat * 2, beat * 1.8, 0.12, 0.12, 0, 0.004); m = Math.max(0, Math.min(SCALE.length - 1, m + Math.floor(R() * 3) - 1)); } }
    if (kind === 'horn' && b % 2 === 0) note('sawtooth', hz(chord[0] + 12), t, bar * 1.4, 0.1, 0.35, 1100);
  }
  return o.startRendering();
}

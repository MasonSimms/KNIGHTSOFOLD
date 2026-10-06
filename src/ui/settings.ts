import { setMusicVolume } from '../audio/music';
import { setVolumes } from '../audio/sfx';
import { menuPresses } from '../input/input';
import type { Quality, Renderer } from '../render/render';
import { BACK, closeMenu, openMenu } from './menu';

// Settings (owner): graphics quality for slower computers, and the volumes. Kept in this browser (localStorage) and applied at start-up.
// Music has its own volume already, for when there is music.

export interface Settings { quality: Quality; master: number; effects: number; music: number }
const KEY = 'knights-settings';
const QUALITIES: Quality[] = ['high', 'medium', 'low'];
const ABOUT: Record<Quality, string> = {
  high: 'Everything: the full painted look, as sharp as your screen allows.',
  medium: 'The full painted look at normal resolution (easier on high-density screens and laptops).',
  low: 'For slower computers: still painted, but no soft shadows, no blur and no brush movement, at a lower resolution.',
};

export function loadSettings(): Settings {
  const d: Settings = { quality: 'high', master: 0.8, effects: 1, music: 0.7 };
  try {
    const s = { ...d, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } as Settings;
    if (!QUALITIES.includes(s.quality)) s.quality = d.quality;
    return s;
  } catch { return d; }
}

/** Put the settings into the game. */
export function applySettings(s: Settings, renderer: Renderer): void {
  renderer.setQuality(s.quality);
  setVolumes(s.master, s.effects);
  setMusicVolume(s.master * s.music);
}

/** Music volume, for the music player when there is one (master x music). */
export const musicVolume = (): number => { const s = loadSettings(); return s.master * s.music; };

/** The settings screen. Changes apply at once and are kept. Resolves when you go back. */
export function runSettings(renderer: Renderer): Promise<void> {
  const s = loadSettings();
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const vol = (k: 'master' | 'effects' | 'music') => (d: number) => { s[k] = Math.round(Math.min(1, Math.max(0, s[k] + d * 0.1)) * 10) / 10; };
  const rows: { name: string; value: () => string; step: (d: number) => void; about?: () => string }[] = [
    { name: 'Graphics', value: () => s.quality[0].toUpperCase() + s.quality.slice(1), step: (d) => { s.quality = QUALITIES[(QUALITIES.indexOf(s.quality) + d + 3) % 3]; }, about: () => ABOUT[s.quality] },
    { name: 'Master volume', value: () => pct(s.master), step: vol('master') },
    { name: 'Sound effects', value: () => pct(s.effects), step: vol('effects') },
    { name: 'Music', value: () => pct(s.music), step: vol('music') },
  ];
  const root = openMenu('prefs-wall', `<button class="back">${BACK}</button>
    <div class="prefs"><div class="plaque">Settings</div>
      <h3>Picture</h3>${row(0)}<div class="about" data-about="0"></div>
      <h3>Sound</h3>${row(1)}${row(2)}${row(3)}<div class="about" data-about="3"></div>
      <div class="hint">Changes apply at once and are remembered on this computer &middot; Esc goes back</div></div>`);
  function row(i: number) { return `<div class="row" data-r="${i}"><span class="name">${rows[i].name}</span><button class="arw" data-d="-1">&lsaquo;</button><span class="val"></span><button class="arw" data-d="1">&rsaquo;</button></div>`; }
  const els = [...root.querySelectorAll<HTMLElement>('.row')];
  const draw = () => {
    els.forEach((el, i) => { el.querySelector('.val')!.textContent = rows[i].value(); el.classList.toggle('sel', i === focus); });
    root.querySelectorAll<HTMLElement>('[data-about]').forEach((el) => { el.textContent = rows[Number(el.dataset.about)].about?.() ?? ''; });
  };
  const change = (i: number, d: number) => {
    rows[i].step(d);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private window: not remembered */ }
    applySettings(s, renderer);
    draw();
  };
  let focus = -1, raf = 0;
  els.forEach((el, i) => el.querySelectorAll<HTMLElement>('.arw').forEach((b) => { b.onclick = () => change(i, Number(b.dataset.d)); }));
  draw();
  menuPresses();
  return new Promise((ok) => {
    const done = () => { cancelAnimationFrame(raf); removeEventListener('keydown', onKey, true); closeMenu(); ok(); };
    root.querySelector<HTMLElement>('.back')!.onclick = done;
    const move = (d: number) => { focus = focus < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, focus + d)); draw(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); e.stopPropagation(); done(); }
      else if (e.code === 'ArrowUp') move(-1);
      else if (e.code === 'ArrowDown') move(1);
      else if (e.code === 'ArrowLeft' && focus >= 0) change(focus, -1);
      else if (e.code === 'ArrowRight' && focus >= 0) change(focus, 1);
    };
    addEventListener('keydown', onKey, true);
    const tick = () => {
      raf = requestAnimationFrame(tick);
      for (const p of menuPresses()) {
        if (p.b === 'up') move(-1);
        else if (p.b === 'down') move(1);
        else if (p.b === 'left' && focus >= 0) change(focus, -1);
        else if ((p.b === 'right' || p.b === 'a') && focus >= 0) change(focus, 1);
        else if (p.b === 'b' || p.b === 'start') return done();
      }
    };
    tick();
  });
}

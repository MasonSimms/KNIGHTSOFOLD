import { tuning as T } from '../content/tuning';
import { menuPresses } from '../input/input';
import { Mirror } from '../net/snapshot';
import type { Renderer } from '../render/render';
import type { Clip } from '../replay/tape';
import type { SimEvent } from '../sim/types';
import { Sim } from '../sim/world';

// Playing an end-of-round replay (replay/tape.ts): the round's best moment, slowed a little, in the game's own picture. No words
// (owner: as little text as possible): a gold replay mark in the corner says what it is. Esc, Enter, Space or a gamepad button skips it.

let mark: HTMLElement | null = null;
const showMark = (on: boolean) => {
  if (!mark) { mark = document.createElement('div'); mark.id = 'replaymark'; mark.innerHTML = '&#10226;'; document.body.appendChild(mark); }
  mark.style.display = on ? 'block' : 'none';
};

/** Play a clip, then show `live` again. Online, `arrived` = when it came: a clip the page could not start in time (a hidden tab) is skipped. */
export async function playClip(clip: Clip, renderer: Renderer, live: Sim, onEvent: (e: SimEvent) => void, arrived?: number): Promise<void> {
  const sim = await Sim.create(clip.seed, clip.count, clip.dummy);
  sim.looks = clip.looks.map((l) => ({ ...l }));
  sim.forceMap = clip.map;
  sim.buildRound(clip.round, clip.era);
  const m = new Mirror(sim, 0, clip.snaps.length);
  for (const s of clip.snaps) m.push(s);
  const first = clip.snaps[0].frame, end = clip.snaps[clip.snaps.length - 1].frame;
  m.show(first); // (the round so far: who is down, who is gone; no effects for those)
  const banner = document.getElementById('banner') as HTMLElement, was = banner.style.visibility;
  banner.style.visibility = 'hidden';
  renderer.show(sim);
  showMark(true);
  menuPresses();
  await new Promise<void>((done) => {
    let last = performance.now(), at = first, hold = 0.35, stop = false;
    const onKey = (e: KeyboardEvent) => { if (['Escape', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); stop = true; } };
    addEventListener('keydown', onKey, true);
    const frame = (now: number) => {
      if (arrived !== undefined && now - arrived > 1500 && at === first) stop = true; // (online, it could not start in time: the fight has gone on)
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (menuPresses().some((p) => p.b === 'a' || p.b === 'b' || p.b === 'start')) stop = true;
      at = Math.min(end, at + dt * 60 * T.replay.speed);
      try {
        const shown = m.show(at);
        for (const e of shown.events) onEvent(e);
        renderer.draw(shown.alpha, dt * T.replay.speed);
      } catch (err) { console.warn('replay stopped:', err); stop = true; } // (never leave the game stuck on a replay)
      if (at >= end) hold -= dt;
      if (stop || hold <= 0) { removeEventListener('keydown', onKey, true); done(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  showMark(false);
  banner.style.visibility = was;
  renderer.show(live);
  sim.world.free(); // (the copy's physics world lives in WebAssembly memory: give it back)
}

import { tuning as T } from '../content/tuning';
import { menuPresses } from '../input/input';
import type { Renderer } from '../render/render';
import type { Moment } from '../replay/highlights';
import { rebuild, stepOnce, stepTo, tuningFingerprint } from '../replay/recording';
import type { Recording } from '../replay/recording';
import type { SimEvent } from '../sim/types';
import type { Sim } from '../sim/world';
import { notice } from './lobby';
import { BACK, closeMenu, hangPicture, openMenu } from './menu';

// The highlights gallery (owner: highlights may become part of the game). The best moments of this session hang on the museum wall as
// paintings of their era, with what happened engraved underneath. Click one to watch it again in slow motion; save it as a video clip
// (for sharing) or as a replay file (a few hundred kilobytes: anyone with the game can watch it, exactly as it happened). A replay file
// someone sent you can be opened here too.

const SPEED = 0.5; // highlights play at half speed
const FILE_KIND = 'knights-of-old-replay';
interface ReplayFile { kind: string; v: 1; title: string; era: string; from: number; to: number; at: number; rec: Recording }

export interface HighlightsContext {
  moments: () => Moment[]; // the session's moments, best first
  renderer: Renderer;
  live: Sim; // the game being played (shown again afterwards)
  onEvent: (e: SimEvent) => void; // sounds for what happens in a replay
}

/** The gallery. Resolves when you leave it (Esc, Back or the arrow). */
export async function runHighlights(ctx: HighlightsContext): Promise<void> {
  const opened: Moment[] = []; // replay files opened this visit
  for (;;) {
    const pick = await gallery([...opened, ...ctx.moments()]);
    if (pick === null) return;
    if (pick.kind === 'open') { const m = await openFile(); if (m) { opened.unshift(m); await watch(ctx, m, false); } continue; }
    if (pick.kind === 'replay') { saveReplay(pick.m); continue; }
    await watch(ctx, pick.m, pick.kind === 'video');
  }
}

type Pick = { kind: 'watch' | 'video' | 'replay'; m: Moment } | { kind: 'open' };

function gallery(list: Moment[]): Promise<Pick | null> {
  const shown = list.slice(0, 10);
  const when = (m: Moment) => `${m.era} &middot; round ${m.rec.round} &middot; ${Math.max(1, Math.round(m.at / 60))} s in`;
  const cards = shown.map((m, i) => `<div class="pic go side" data-i="${i}">
    <div class="lamp"></div><div class="frame"><div class="art"><canvas></canvas></div></div>
    <div class="label">${m.title}</div><div class="sub">${when(m)}</div>
    <div class="clipacts"><button data-a="video" data-i="${i}">Save video</button><button data-a="replay" data-i="${i}">Save replay</button></div></div>`).join('');
  const root = openMenu('reel', `<button class="back">${BACK}</button>
    <div class="plaque">Highlights</div>
    ${shown.length ? `<div class="clips">${cards}</div>` : '<div class="note empty">No highlights yet. They appear as you fight: knockouts, slams, a double, the blow that wins the round.</div>'}
    <div class="spacer"></div>
    <button class="openfile">Open a replay file</button>
    <div class="hint">Click a painting to watch it again &middot; Esc goes back</div>`);
  root.querySelectorAll<HTMLCanvasElement>('.clips canvas').forEach((c, i) => hangPicture(c, shown[i].rec.era, 400, 225));
  const pics = [...root.querySelectorAll<HTMLElement>('.clips .pic')];
  let focus = -1, raf = 0;
  const light = () => pics.forEach((el, i) => el.classList.toggle('lit', i === focus));
  menuPresses();
  return new Promise((ok) => {
    const done = (p: Pick | null) => { cancelAnimationFrame(raf); removeEventListener('keydown', onKey, true); closeMenu(); ok(p); };
    pics.forEach((el, i) => {
      el.onmouseenter = () => { focus = i; light(); };
      el.onmouseleave = () => { focus = -1; light(); };
      el.onclick = (e) => { if (!(e.target as HTMLElement).closest('button')) done({ kind: 'watch', m: shown[i] }); };
    });
    root.querySelectorAll<HTMLButtonElement>('.clipacts button').forEach((b) => { b.onclick = () => done({ kind: b.dataset.a as 'video' | 'replay', m: shown[Number(b.dataset.i)] }); });
    root.querySelector<HTMLElement>('.back')!.onclick = () => done(null);
    root.querySelector<HTMLElement>('.openfile')!.onclick = () => done({ kind: 'open' });
    const move = (d: number) => { if (pics.length) { focus = focus < 0 ? 0 : Math.max(0, Math.min(pics.length - 1, focus + d)); light(); } };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyH' || e.code === 'Backspace') { e.preventDefault(); e.stopPropagation(); done(null); } // (the key stops here: it must not reach the fight)
      else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') move(-1);
      else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') move(1);
      else if ((e.code === 'Enter' || e.code === 'Space') && focus >= 0) { e.preventDefault(); done({ kind: 'watch', m: shown[focus] }); }
    };
    addEventListener('keydown', onKey, true);
    const tick = () => {
      raf = requestAnimationFrame(tick);
      for (const p of menuPresses()) {
        if (p.b === 'left' || p.b === 'up') move(-1);
        else if (p.b === 'right' || p.b === 'down') move(1);
        else if (p.b === 'a' && focus >= 0) return done({ kind: 'watch', m: shown[focus] });
        else if (p.b === 'b' || p.b === 'start') return done(null);
      }
    };
    tick();
  });
}

/** Play a moment again, in the game's own picture, at half speed. With `video`, it is also saved as a .webm clip. */
async function watch(ctx: HighlightsContext, m: Moment, video: boolean): Promise<void> {
  const banner = document.getElementById('banner') as HTMLElement;
  const copy = await rebuild(m.rec);
  stepTo(copy, m.rec, m.from); // (straight to the start of the clip, nothing drawn)
  const end = Math.min(m.to, m.rec.inputs.length);
  ctx.renderer.show(copy);
  banner.textContent = m.title;
  banner.style.color = '#e3c375';
  banner.style.fontSize = '40px';
  const warn = m.rec.tuning !== tuningFingerprint() ? ' (recorded with other game settings: it may not play the same)' : '';
  notice(`Replay${warn} · Esc stops`);
  let recorder: MediaRecorder | null = null;
  const chunks: Blob[] = [];
  if (video && typeof MediaRecorder !== 'undefined') {
    const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
    recorder = new MediaRecorder(ctx.renderer.canvas.captureStream(60), type ? { mimeType: type, videoBitsPerSecond: 8_000_000 } : undefined);
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.start();
  }
  await new Promise<void>((done) => {
    let last = performance.now(), acc = 0, hold = 0.8, stop = false; // a beat at the end before it closes
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape' || e.code === 'Backspace' || e.code === 'KeyH') { e.preventDefault(); e.stopPropagation(); stop = true; } };
    addEventListener('keydown', onKey, true);
    menuPresses();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (menuPresses().some((p) => p.b === 'b' || p.b === 'start')) stop = true;
      acc += dt * SPEED;
      while (acc >= T.sim.dt && copy.frame < end) { stepOnce(copy, m.rec); for (const e of copy.events) ctx.onEvent(e); acc -= T.sim.dt; }
      if (copy.frame >= end) hold -= dt;
      ctx.renderer.draw(copy.frame >= end ? 1 : acc / T.sim.dt, dt * SPEED);
      if (stop || hold <= 0) { removeEventListener('keydown', onKey, true); done(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  banner.textContent = ''; banner.style.fontSize = '';
  notice('');
  ctx.renderer.show(ctx.live);
  if (recorder) {
    await new Promise<void>((ok) => { recorder!.onstop = () => ok(); recorder!.stop(); });
    download(new Blob(chunks, { type: 'video/webm' }), `${fileName(m)}.webm`);
  }
  copy.world.free(); // (the copy's physics world lives in WebAssembly memory: give it back)
}

function saveReplay(m: Moment): void {
  const f: ReplayFile = { kind: FILE_KIND, v: 1, title: m.title, era: m.era, from: m.from, to: m.to, at: m.at, rec: m.rec };
  download(new Blob([JSON.stringify(f)], { type: 'application/json' }), `${fileName(m)}.knights-replay`);
}

/** Pick a replay file from the computer and turn it back into a moment (null if cancelled or not a replay). */
function openFile(): Promise<Moment | null> {
  return new Promise((ok) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.knights-replay,application/json';
    input.onchange = async () => {
      try {
        const f = JSON.parse(await input.files![0].text()) as ReplayFile;
        if (f.kind !== FILE_KIND || f.v !== 1 || !f.rec?.inputs) throw new Error('not a replay');
        ok({ rec: f.rec, from: f.from, to: f.to, at: f.at, score: 0, title: f.title, era: f.era });
      } catch { alert('That is not an Old Masters replay file.'); ok(null); }
    };
    addEventListener('focus', () => setTimeout(() => { if (!input.files?.length) ok(null); }, 600), { once: true }); // (cancelled)
    input.click();
  });
}

const fileName = (m: Moment) => `knights-${m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)}`;
function download(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

import { COLORS, EYE_NAMES, EYES, HAT_NAMES, HATS } from '../content/looks';
import type { Hat, Look } from '../content/looks';
import { tuning as T } from '../content/tuning';
import { connectedPads, menuPresses } from '../input/input';
import type { MenuButton } from '../input/input';
import { paintPortrait, PORTRAIT } from '../render/portrait';
import { BACK, closeMenu, openMenu } from './menu';

// The Hall of Champions: a painted portrait per seat with its hat, eyes and colour, a Ready button each, and To Battle.
// The view (mountHall) is shared by the fight on this computer (runHall, below) and online (lobby.ts).

/** One seat as drawn. `row` = where this seat's gamepad cursor is (0 hat, 1 eyes, 2 colour, 3 ready), -1 = none. */
export interface HallSeat { look: Look; ready: boolean; mine: boolean; row: number }
export interface HallModel { seats: (HallSeat | null)[]; empty: string; canStart: boolean; startLabel: string; note: string; hint: string; code?: string }
export interface HallActions { look(i: number, l: Look): void; ready(i: number): void; join(i: number): void; leave(i: number): void; start(): void; back(): void }
export const ROWS = 4;

const cycle = <V>(list: readonly V[], v: V, d: number): V => list[(list.indexOf(v) + d + list.length) % list.length];
/** The look after left/right on a row of the picker (colours skip the ones in `taken`). */
export function step(look: Look, row: number, d: number, taken: Set<number>): Look {
  if (row === 0) return { ...look, hat: cycle(HATS, look.hat, d) };
  if (row === 1) return { ...look, eyes: cycle(EYES, look.eyes, d) };
  if (row === 2) for (let k = 1, c = look.color; k < COLORS.length; k++) { c = (c + d + COLORS.length) % COLORS.length; if (!taken.has(c)) return { ...look, color: c }; }
  return look;
}
/** Colours other seats have. */
export const takenBy = (looks: (Look | null | undefined)[], except: number) => new Set(looks.flatMap((l, k) => (l && k !== except ? [l.color] : [])));

const HAT_ICON = '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 13h12M2.6 11 1.6 4.6l3.4 3L8 2.6l3 5 3.4-3-1 6.4z"/></svg>';
const EYE_ICON = '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8z"/><circle cx="8" cy="8" r="2"/></svg>';
const hexOf = (c: number) => '#' + COLORS[c].hex.toString(16).padStart(6, '0');

export function mountHall(actions: HallActions) {
  const root = openMenu('hall', `<button class="back" data-act="back" title="Back">${BACK}</button><div class="code"></div><div class="seats"></div>
    <div class="spacer"></div><div class="note"></div><button class="battle" data-act="start" disabled>To Battle</button><div class="hint"></div>`);
  const $ = (s: string) => root.querySelector(s) as HTMLElement;
  // Each seat keeps one canvas for its portrait; its three painted variants take turns on it (the boil).
  const shown = [0, 1, 2, 3].map(() => { const c = document.createElement('canvas'); c.width = PORTRAIT.w; c.height = PORTRAIT.h; return c; });
  const keys = ['', '', '', ''], variants: (HTMLCanvasElement[] | null)[] = [null, null, null, null];
  let boil = 0, model: HallModel | null = null;
  const show = (i: number) => { const v = variants[i]; if (v) shown[i].getContext('2d')!.drawImage(v[boil % v.length], 0, 0); };
  const timer = setInterval(() => { boil++; for (let i = 0; i < 4; i++) show(i); }, 1000 / T.finish.boilFps);

  root.onclick = (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el || !model) return;
    const i = Number(el.dataset.seat), s = model.seats[i], act = el.dataset.act;
    if (act === 'back') actions.back();
    else if (act === 'start') actions.start();
    else if (act === 'join') actions.join(i);
    else if (!s?.mine) return;
    else if (act === 'leave') actions.leave(i);
    else if (act === 'ready') actions.ready(i);
    else if (act === 'hat' || act === 'eyes') actions.look(i, step(s.look, act === 'hat' ? 0 : 1, Number(el.dataset.d), new Set()));
    else if (act === 'color') { const c = Number(el.dataset.v); if (!takenBy(model.seats.map((x) => x?.look), i).has(c)) actions.look(i, { ...s.look, color: c }); }
  };

  const seatHtml = (s: HallSeat | null, i: number, m: HallModel) => {
    if (!s) return `<div class="seat empty"><div class="pic"><div class="lamp"></div><div class="frame"><div class="art" data-act="join" data-seat="${i}"><div class="join">${m.empty}</div></div></div></div></div>`;
    const taken = takenBy(m.seats.map((x) => x?.look), i), d = `data-seat="${i}"`, sel = (r: number) => (s.row === r ? ' sel' : '');
    const picker = (act: string, icon: string, name: string, r: number) =>
      `<div class="row${sel(r)}">${icon}<button class="arw" data-act="${act}" data-d="-1" ${d}>&lsaquo;</button><span class="val">${name}</span><button class="arw" data-act="${act}" data-d="1" ${d}>&rsaquo;</button></div>`;
    const swatches = COLORS.map((c, k) => `<button class="sw${k === s.look.color ? ' mine' : ''}${taken.has(k) ? ' taken' : ''}" data-act="color" data-v="${k}" ${d} title="${c.name}" style="background:${hexOf(k)}"></button>`).join('');
    return `<div class="seat${s.ready ? ' ready' : ''}${s.ready || !s.mine ? ' locked' : ''}"><div class="pic lit"><div class="lamp"></div><div class="frame">`
      + `${s.mine ? `<button class="leave" data-act="leave" ${d} title="Leave">&times;</button>` : ''}<div class="art"></div></div></div>`
      + picker('hat', HAT_ICON, HAT_NAMES[s.look.hat], 0) + picker('eyes', EYE_ICON, EYE_NAMES[s.look.eyes], 1)
      + `<div class="row swatches${sel(2)}">${swatches}</div>`
      + `<button class="readyb${sel(3)}" data-act="ready" ${d}${s.mine ? '' : ' disabled'}>${s.ready ? 'Ready' : 'Ready up'}</button></div>`;
  };

  return {
    update(m: HallModel) {
      model = m;
      $('.code').innerHTML = m.code ? `<div class="plaque">Room<b>${m.code}</b><br><small>tell your friends the code</small></div>` : '';
      $('.seats').innerHTML = m.seats.map((s, i) => seatHtml(s, i, m)).join('');
      const arts = root.querySelectorAll<HTMLElement>('.seat');
      m.seats.forEach((s, i) => {
        if (!s) { keys[i] = ''; variants[i] = null; return; }
        arts[i].querySelector('.art')!.appendChild(shown[i]);
        const key = `${s.look.color}|${s.look.hat}|${s.look.eyes}`;
        if (key !== keys[i]) { keys[i] = key; paintPortrait(s.look, i).then((v) => { if (keys[i] === key) { variants[i] = v; show(i); } }); }
      });
      $('.note').textContent = m.note;
      $('.hint').textContent = m.hint;
      const go = $('.battle') as HTMLButtonElement;
      go.disabled = !m.canStart;
      go.textContent = m.startLabel;
    },
    close() { clearInterval(timer); closeMenu(); },
  };
}

// ---- The fight on this computer: keyboard + mouse is one player, every gamepad another. ----

export type Device = 'kb' | number; // keyboard and mouse, or a gamepad (its index)
interface Local { dev: Device; look: Look; ready: boolean; row: number }
const local: (Local | null)[] = [null, null, null, null]; // kept while the page is open: back from a fight, everyone is still seated
const FIRST_HATS: Hat[] = ['helmet', 'crown', 'tophat', 'horns'];

/** Resolves with the seated players (in seat order) when someone starts the fight, or null to go back home. */
export function runHall(): Promise<{ dev: Device; look: Look }[] | null> {
  const live = () => new Set(connectedPads().map((p) => p.index));
  const pads = live();
  local.forEach((s, i) => { if (s) { s.ready = false; s.row = 0; if (s.dev !== 'kb' && !pads.has(s.dev)) local[i] = null; } });
  menuPresses(); // (buttons already held when the hall opens are not presses)

  return new Promise((resolve) => {
    let raf = 0, done = false;
    const seated = () => local.filter((s): s is Local => !!s);
    const taken = (i: number) => takenBy(local.map((s) => s?.look), i);
    const canStart = () => seated().length >= 2 && seated().every((s) => s.ready);
    const finish = (r: { dev: Device; look: Look }[] | null) => { done = true; cancelAnimationFrame(raf); removeEventListener('keydown', onKey); view.close(); resolve(r); };
    const start = () => { if (canStart()) finish(seated().map(({ dev, look }) => ({ dev, look: { ...look } }))); };
    const join = (dev: Device, at = local.findIndex((s) => !s)) => {
      if (at < 0 || local[at] || local.some((s) => s?.dev === dev)) return;
      const used = taken(-1);
      local[at] = { dev, ready: false, row: 0, look: { color: COLORS.findIndex((_, c) => !used.has(c)), hat: FIRST_HATS[at], eyes: 'round' } };
    };
    const view = mountHall({
      look: (i, l) => { const s = local[i]; if (s && !s.ready && !taken(i).has(l.color)) s.look = l; draw(); },
      ready: (i) => { const s = local[i]; if (s) s.ready = !s.ready; draw(); },
      join: (i) => { join('kb', i); draw(); },
      leave: (i) => { local[i] = null; draw(); },
      start, back: () => finish(null),
    });
    const draw = () => {
      if (done) return;
      const n = seated().length;
      view.update({
        seats: local.map((s) => s && { look: s.look, ready: s.ready, mine: true, row: s.dev === 'kb' ? -1 : s.row }),
        empty: local.some((s) => s?.dev === 'kb') ? 'Press A to join' : 'Press A to join, or click',
        canStart: canStart(), startLabel: 'To Battle',
        note: n < 2 ? 'Two or more knights are needed for a fight (alone? try Training)' : canStart() ? '' : 'Waiting for everyone to be ready',
        hint: 'Gamepad: A joins, the stick picks and changes, A is ready, B goes back. Keyboard: Enter. Mouse: click.',
      });
    };
    const press = (p: { pad: number; b: MenuButton }) => {
      const i = local.findIndex((s) => s?.dev === p.pad), s = local[i];
      if (!s) { if (p.b === 'a') join(p.pad); else if (p.b === 'b' && !seated().length) finish(null); return; }
      if (p.b === 'a') { if (!s.ready) s.ready = true; else start(); }
      else if (p.b === 'start') start();
      else if (p.b === 'b') { if (s.ready) s.ready = false; else local[i] = null; }
      else if (s.ready) return; // a ready seat is locked in
      else if (p.b === 'up') s.row = Math.max(0, s.row - 1);
      else if (p.b === 'down') s.row = Math.min(ROWS - 1, s.row + 1);
      else if (s.row === ROWS - 1) s.ready = true; // left/right on the Ready button
      else s.look = step(s.look, s.row, p.b === 'left' ? -1 : 1, taken(i));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') return finish(null);
      if (e.code !== 'Enter') return;
      const i = local.findIndex((s) => s?.dev === 'kb');
      if (i < 0) join('kb'); else if (!local[i]!.ready) local[i]!.ready = true; else start();
      draw();
    };
    addEventListener('keydown', onKey);
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const presses = menuPresses(), now = live();
      let changed = presses.length > 0;
      local.forEach((s, i) => { if (s && s.dev !== 'kb' && !now.has(s.dev)) { local[i] = null; changed = true; } }); // unplugged
      for (const p of presses) if (!done) press(p);
      if (changed) draw();
    };
    draw();
    tick();
  });
}

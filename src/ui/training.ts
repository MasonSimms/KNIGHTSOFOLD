import { eraById, eras } from '../content/eras';
import { botLook } from '../content/looks';
import { ITEMS } from '../content/props';
import { tuning as T } from '../content/tuning';
import { menuPresses } from '../input/input';
import type { Sim } from '../sim/world';
import { closeMenu, openMenu } from './menu';
import { isOverlayOn, toggleOverlay } from './overlay';

// Training settings (owner): a panel slid over the right of the paused fight, in the museum style of the other menus. Who you practise on
// (a standing dummy or a bot that fights back, armed or not), which arena, any weapon dropped in on request, the testing switches, the game
// speed and the debug numbers. Tab (or Back on a gamepad) opens and closes it. Your choices are kept for next time (in this browser only).

export interface TrainingSettings {
  foe: 'dummy' | 'bot'; foeArmed: boolean; // who you practise on (only when you are training alone)
  era: string; map: number; // the arena (an era id, and which of its maps)
  arrive: boolean; lying: boolean; startArmed: boolean; // weapons arrive over time; planks and logs lie on the map; you start with a club
  speed: number; // game speed (1 = normal)
}

const KEY = 'knights-training';
/** The game's own settings at start-up, put back when you leave training. */
const NORMAL = { arrive: T.spawn.enabled, lying: T.props.lying, startArmed: T.fighter.startArmed };

export function loadTraining(): TrainingSettings {
  const d: TrainingSettings = { foe: 'dummy', foeArmed: true, era: 'medieval', map: 0, ...NORMAL, speed: 1 };
  try {
    const s = { ...d, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } as TrainingSettings;
    if (!eras.some((e) => e.id === s.era)) s.era = d.era;
    s.map = Math.min(s.map, eraById(s.era).alt?.length ?? 0);
    return s;
  } catch { return d; }
}
function save(s: TrainingSettings): void { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private window: just not remembered */ } }

/** Put training's settings into the game (the caller rebuilds the world). */
export function applyTraining(sim: Sim, s: TrainingSettings, alone: boolean): void {
  sim.forceEra = s.era; sim.forceMap = s.map;
  sim.training = { foe: s.foe, foeArmed: s.foeArmed };
  if (alone) sim.looks[1] = s.foe === 'bot' ? botLook() : { color: 1, hat: 'none', eyes: 'round' }; // (alone, seat 2 is the training partner)
  T.spawn.enabled = s.arrive; T.props.lying = s.lying; T.fighter.startArmed = s.startArmed;
}

/** Leaving training: everything back to how the game normally plays. */
export function leaveTraining(sim: Sim, forceEra: string | null, forceMap: number | null): void {
  sim.forceEra = forceEra; sim.forceMap = forceMap;
  sim.training = { foe: 'dummy', foeArmed: true };
  T.spawn.enabled = NORMAL.arrive; T.props.lying = NORMAL.lying; T.fighter.startArmed = NORMAL.startArmed;
}

const SPEEDS = [1, 0.5, 0.25];
const mapName = (era: string, i: number) => (i === 0 ? 'Main arena' : (eraById(era).alt?.[i - 1]?.name ?? `Map ${i + 1}`));
const fromEra = (id: string) => eras.find((e) => e.weapon === id || e.pickups?.includes(id))?.name ?? 'Anywhere';

interface Row { name: string; value: () => string; step: (d: number) => void; show?: () => boolean }

/**
 * Open the panel over the paused fight. `alone`: practising on your own (the opponent settings only apply then). `you`: your fighter's
 * index (weapons drop in beside you). Resolves 'back' (play on) or 'leave' (back to the home screen).
 */
export function runTraining(sim: Sim, you: number, alone: boolean, setSpeed: (x: number) => void): Promise<'back' | 'leave'> {
  const s = loadTraining();
  let rebuild = false; // a change that needs a fresh world (the arena, the opponent, what lies on the map)
  const set = (fn: () => void, fresh: boolean) => { fn(); save(s); applyTraining(sim, s, alone); setSpeed(s.speed); if (fresh) rebuild = true; draw(); };
  const onOff = (b: boolean) => (b ? 'On' : 'Off');
  const rows: Row[] = [
    { name: 'Opponent', value: () => (s.foe === 'bot' ? 'A bot' : 'Training dummy'), step: () => set(() => { s.foe = s.foe === 'bot' ? 'dummy' : 'bot'; }, true), show: () => alone },
    { name: 'They hold', value: () => (s.foeArmed ? 'The era\'s weapon' : 'Nothing'), step: () => set(() => { s.foeArmed = !s.foeArmed; }, true), show: () => alone },
    { name: 'Era', value: () => eraById(s.era).name, step: (d) => set(() => { const i = eras.findIndex((e) => e.id === s.era); s.era = eras[(i + d + eras.length) % eras.length].id; s.map = 0; }, true) },
    { name: 'Map', value: () => mapName(s.era, s.map), step: (d) => set(() => { const n = (eraById(s.era).alt?.length ?? 0) + 1; s.map = (s.map + d + n) % n; }, true) },
    { name: 'Weapons arrive', value: () => onOff(s.arrive), step: () => set(() => { s.arrive = !s.arrive; }, false) },
    { name: 'Planks and logs', value: () => onOff(s.lying), step: () => set(() => { s.lying = !s.lying; }, true) },
    { name: 'You start armed', value: () => onOff(s.startArmed), step: () => set(() => { s.startArmed = !s.startArmed; }, true) },
    { name: 'Game speed', value: () => `${Math.round(s.speed * 100)}%`, step: (d) => set(() => { const i = SPEEDS.indexOf(s.speed); s.speed = SPEEDS[(Math.max(0, i) - d + SPEEDS.length) % SPEEDS.length]; }, false) },
    { name: 'Debug numbers', value: () => onOff(isOverlayOn()), step: () => { toggleOverlay(); draw(); } },
  ];
  const sections: [string, Row[]][] = [['Opponent', rows.slice(0, 2)], ['Arena', rows.slice(2, 4)], ['Rules', rows.slice(4, 7)], ['Game', rows.slice(7)]];
  const rowHtml = (r: Row) => `<div class="row"><span class="name">${r.name}</span><button class="arw" data-d="-1">&lsaquo;</button><span class="val"></span><button class="arw" data-d="1">&rsaquo;</button></div>`;
  const html = `<div class="drill">
    <div class="plaque">Training</div>
    ${sections.map(([h, rs]) => (rs.some((r) => !r.show || r.show()) ? `<h3>${h}</h3>${rs.filter((r) => !r.show || r.show()).map(rowHtml).join('')}` : '')).join('')}
    <h3>Drop in a weapon</h3>
    <div class="items">${ITEMS.map((it) => `<button class="item" data-item="${it.id}">${it.name}<small>${fromEra(it.id)}</small></button>`).join('')}</div>
    <button class="act wide" data-act="clear">Clear the loose weapons</button>
    <div class="acts"><button class="act" data-act="reset">Start again</button><button class="act gold" data-act="back">Back to it</button><button class="act" data-act="leave">Leave</button></div>
    <div class="hint">Tab or Back closes &middot; changes to the arena or opponent start the practice again</div>
  </div>`;
  const root = openMenu('drill-wrap', html);
  root.classList.add('over');
  const shown = rows.filter((r) => !r.show || r.show());
  const rowEls = [...root.querySelectorAll<HTMLElement>('.row')];
  function draw() { rowEls.forEach((el, i) => { el.querySelector('.val')!.textContent = shown[i].value(); }); }
  draw();

  // Everything that can be selected with the keyboard or a gamepad, top to bottom (the weapon grid is 3 across).
  type Spot = { el: HTMLElement; row?: Row; press?: () => void; grid?: number };
  const spots: Spot[] = [];
  rowEls.forEach((el, i) => spots.push({ el, row: shown[i] }));
  const drop = (id: string) => {
    const f = sim.fighters[you], t = f.torso.body.translation(), A = sim.arena;
    const x = Math.max(A.platformX + 0.5, Math.min(A.platformX + A.platformW - 0.5, t.x + f.side * 0.8));
    sim.spawnItem(id, x, t.y - 2.2); // just above and in front of you: it falls at your feet
  };
  const dropped: string[] = []; // what was dropped in this time (dropped again if the practice starts over when the panel closes)
  root.querySelectorAll<HTMLElement>('.item').forEach((el, i) => spots.push({ el, press: () => { drop(el.dataset.item!); dropped.push(el.dataset.item!); flash(el); }, grid: i }));
  const flash = (el: HTMLElement) => { el.classList.add('done'); setTimeout(() => el.classList.remove('done'), 300); };
  root.querySelectorAll<HTMLElement>('.act').forEach((el) => spots.push({ el, press: () => act(el.dataset.act!, el) }));
  let focus = -1, raf = 0, resolveFn: (r: 'back' | 'leave') => void = () => {};
  const mark = () => spots.forEach((p, i) => p.el.classList.toggle('sel', i === focus));
  const close = (r: 'back' | 'leave') => {
    cancelAnimationFrame(raf); removeEventListener('keydown', onKey, true); closeMenu();
    if (rebuild && r === 'back') { sim.reset(); dropped.forEach(drop); }
    resolveFn(r);
  };
  function act(a: string, el: HTMLElement) {
    if (a === 'clear') { sim.clearLoose(); dropped.length = 0; flash(el); }
    else if (a === 'reset') { sim.reset(); rebuild = false; close('back'); }
    else close(a as 'back' | 'leave');
  }

  // The mouse: arrows change a setting, buttons do what they say.
  rowEls.forEach((el, i) => el.querySelectorAll<HTMLElement>('.arw').forEach((b) => { b.onclick = () => shown[i].step(Number(b.dataset.d)); }));
  spots.forEach((p) => { if (p.press) p.el.onclick = p.press; });

  // The keyboard and gamepads: up and down move, left and right change a setting (or move along the weapons), Enter or A presses.
  const grid = spots.filter((p) => p.grid !== undefined), first = spots.indexOf(grid[0]), COLS = 3;
  const move = (d: number) => {
    const cur = spots[focus];
    if (focus < 0) focus = 0;
    else if (cur?.grid !== undefined) {
      const to = cur.grid + d * COLS;
      focus = to < 0 ? first - 1 : to >= grid.length ? first + grid.length : first + to;
    } else focus = Math.max(0, Math.min(spots.length - 1, focus + d));
    focus = Math.max(0, Math.min(spots.length - 1, focus));
    mark();
    spots[focus].el.scrollIntoView({ block: 'nearest' });
  };
  const side = (d: number) => {
    const cur = spots[focus];
    if (!cur) return move(1);
    if (cur.row) cur.row.step(d);
    else if (cur.grid !== undefined) { focus = Math.max(first, Math.min(first + grid.length - 1, focus + d)); mark(); }
    else { focus = Math.max(0, Math.min(spots.length - 1, focus + d)); mark(); }
  };
  const press = () => { const cur = spots[focus]; if (!cur) return move(1); if (cur.row) cur.row.step(1); else cur.press?.(); };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Tab' || e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close('back'); }
    else if (e.code === 'ArrowUp') move(-1);
    else if (e.code === 'ArrowDown') move(1);
    else if (e.code === 'ArrowLeft') side(-1);
    else if (e.code === 'ArrowRight') side(1);
    else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); press(); }
  };
  addEventListener('keydown', onKey, true); // (first, so Escape closes this panel instead of leaving training)
  menuPresses(); // (buttons already held when the panel opens are not presses)
  let backWas = true; // the Back button that opened the panel is still down
  const tick = () => {
    raf = requestAnimationFrame(tick);
    for (const p of menuPresses()) {
      if (p.b === 'up') move(-1);
      else if (p.b === 'down') move(1);
      else if (p.b === 'left') side(-1);
      else if (p.b === 'right') side(1);
      else if (p.b === 'a') press();
      else if (p.b === 'b' || p.b === 'start') return close('back');
    }
    const backNow = navigator.getGamepads?.().some((g) => !!g?.buttons[8]?.pressed) ?? false;
    if (backNow && !backWas) return close('back');
    backWas = backNow;
  };
  tick();
  return new Promise((ok) => { resolveFn = ok; });
}

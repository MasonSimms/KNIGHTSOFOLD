import { eraById, eras } from '../content/eras';
import { botLook } from '../content/looks';
import { ITEMS, PROPS } from '../content/props';
import { tuning as T } from '../content/tuning';
import { WEAPON_ART } from '../content/weaponArt';
import { menuPresses } from '../input/input';
import { paintedBox, paintedShape, paintedWeapon } from '../render/painter/sprites';
import type { Sim } from '../sim/world';
import { closeMenu, hangPicture, openMenu } from './menu';
import { isOverlayOn, toggleOverlay } from './overlay';

// The training menu (owner): Esc during practice opens it over the paused fight, in the museum style of the other menus. On the left, who
// you practise on (a standing dummy or a bot that fights back, armed or not), the rules, the game speed and the debug numbers; on the
// right, every map as a small painting (pick one and the practice starts again there) and every weapon as its painted picture (it drops
// in at your feet). Your choices are kept for next time (in this browser only).

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
const mapsOf = (era: string) => { const e = eraById(era); return [e.arena.name ?? 'Main arena', ...(e.alt ?? []).map((a, i) => a.name ?? `Map ${i + 2}`)]; };
const nameOf = (id: string) => ITEMS.find((it) => it.id === id)?.name ?? id;

/** The weapons, as the menu lists them: each era's own weapon and pickups, then the guns not placed in an era yet, any other weapon, and
 *  the loose things (planks, crates, stools...). */
export function itemGroups(): [string, string[]][] {
  const placed = new Set<string>(), groups: [string, string[]][] = [];
  for (const e of eras) {
    const ids = [e.weapon, ...(e.pickups ?? [])].filter((id) => ITEMS.some((it) => it.id === id));
    ids.forEach((id) => placed.add(id));
    groups.push([e.name, ids]);
  }
  const rest = ITEMS.map((it) => it.id).filter((id) => !placed.has(id));
  groups.push(['Gun Locker', rest.filter((id) => PROPS[id]?.gun)], ['Other weapons', rest.filter((id) => !PROPS[id]?.gun && WEAPON_ART[id])], ['Loose things', rest.filter((id) => !PROPS[id]?.gun && !WEAPON_ART[id])]);
  return groups.filter(([, ids]) => ids.length);
}

/** A weapon's painted picture (the one the fight draws) on its button, fitted to the canvas; a loose thing without one is its painted rod or block. */
function drawItem(c: HTMLCanvasElement, id: string): void {
  const P = T.finish.paint, K = { relief: P.relief, bristle: P.bristle, jitter: P.jitter, under: P.under }, spec = ITEMS.find((it) => it.id === id)!.spec, color = T.colors.things[id] ?? T.colors.stick;
  const art = paintedWeapon(id, spec.len, K), r = spec.thick / 2;
  const tex = art ? art.tex[0] : spec.box ? paintedBox(spec.len / 2, r, color, K)[0] : paintedShape({ k: 'cap', r, hl: Math.max(0.01, spec.len / 2 - r) }, color, K)[0];
  const src = tex.source.resource as HTMLCanvasElement, turn = !art && !spec.box; // (a rod is painted standing up)
  const w = turn ? src.height : src.width, h = turn ? src.width : src.height, k = Math.min(c.width / w, c.height / h, 1), g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  g.save(); g.translate(c.width / 2, c.height / 2); if (turn) g.rotate(-Math.PI / 2);
  g.drawImage(src, (-src.width * k) / 2, (-src.height * k) / 2, src.width * k, src.height * k);
  g.restore();
}

interface Row { name: string; value: () => string; step: (d: number) => void; show?: () => boolean }
/** Something that can be selected with the keyboard or a gamepad: a setting (left and right change it) or a button. */
type Spot = { el: HTMLElement; row?: Row; press?: () => void };

/**
 * Open the menu over the paused fight. `alone`: practising on your own (the opponent settings only apply then). `you`: your fighter's
 * index (weapons drop in beside you). Resolves 'back' (play on) or 'lobby' (back to the Hall).
 */
export function runTraining(sim: Sim, you: number, alone: boolean, setSpeed: (x: number) => void): Promise<'back' | 'lobby'> {
  const s = loadTraining();
  let rebuild = false; // a change that needs a fresh world (the arena, the opponent, what lies on the map)
  const set = (fn: () => void, fresh: boolean) => { fn(); save(s); applyTraining(sim, s, alone); setSpeed(s.speed); if (fresh) rebuild = true; draw(); };
  const onOff = (b: boolean) => (b ? 'On' : 'Off');
  const rows: Row[] = [
    { name: 'Opponent', value: () => (s.foe === 'bot' ? 'A bot' : 'Training dummy'), step: () => set(() => { s.foe = s.foe === 'bot' ? 'dummy' : 'bot'; }, true), show: () => alone },
    { name: 'They hold', value: () => (s.foeArmed ? 'The era\'s weapon' : 'Nothing'), step: () => set(() => { s.foeArmed = !s.foeArmed; }, true), show: () => alone },
    { name: 'Weapons arrive', value: () => onOff(s.arrive), step: () => set(() => { s.arrive = !s.arrive; }, false) },
    { name: 'Planks and logs', value: () => onOff(s.lying), step: () => set(() => { s.lying = !s.lying; }, true) },
    { name: 'You start armed', value: () => onOff(s.startArmed), step: () => set(() => { s.startArmed = !s.startArmed; }, true) },
    { name: 'Game speed', value: () => `${Math.round(s.speed * 100)}%`, step: (d) => set(() => { const i = SPEEDS.indexOf(s.speed); s.speed = SPEEDS[(Math.max(0, i) - d + SPEEDS.length) % SPEEDS.length]; }, false) },
    { name: 'Debug numbers', value: () => onOff(isOverlayOn()), step: () => { toggleOverlay(); draw(); } },
  ];
  const sections: [string, Row[]][] = [['Opponent', rows.slice(0, 2)], ['Rules', rows.slice(2, 5)], ['Game', rows.slice(5)]];
  const shown = rows.filter((r) => !r.show || r.show()), groups = itemGroups();
  const rowHtml = (r: Row) => `<div class="row"><span class="name">${r.name}</span><button class="arw" data-d="-1">&lsaquo;</button><span class="val"></span><button class="arw" data-d="1">&rsaquo;</button></div>`;
  const html = `<div class="drill">
    <div class="plaque">Training</div>
    <div class="cols"><div class="side">
      ${sections.map(([h, rs]) => (rs.some((r) => !r.show || r.show()) ? `<h3>${h}</h3>${rs.filter((r) => !r.show || r.show()).map(rowHtml).join('')}` : '')).join('')}
      <div class="acts"><button class="act gold" data-act="back">Back to it</button><button class="act" data-act="reset">Start again</button></div>
      <button class="act wide" data-act="clear">Clear the loose weapons</button>
      <button class="act wide" data-act="lobby">Back to the lobby</button>
      <div class="hint">Esc closes &middot; a new arena or opponent starts the practice again</div>
    </div><div class="shelf">
      <h3>Arena</h3>
      ${eras.map((e) => `<h4>${e.name}</h4><div class="maps">${mapsOf(e.id).map((m, i) => `<button class="map" data-era="${e.id}" data-map="${i}"><span class="art"><canvas></canvas></span><small>${m}</small></button>`).join('')}</div>`).join('')}
      <h3>Drop in a weapon</h3>
      ${groups.map(([g, ids]) => `<h4>${g}</h4><div class="items">${ids.map((id) => `<button class="item" data-item="${id}"><canvas width="132" height="40"></canvas><small>${nameOf(id)}</small></button>`).join('')}</div>`).join('')}
    </div></div>
  </div>`;
  const root = openMenu('drill-wrap', html);
  root.classList.add('over');
  const rowEls = [...root.querySelectorAll<HTMLElement>('.row')], mapEls = [...root.querySelectorAll<HTMLElement>('.map')];
  function draw() {
    rowEls.forEach((el, i) => { el.querySelector('.val')!.textContent = shown[i].value(); });
    mapEls.forEach((el) => el.classList.toggle('on', el.dataset.era === s.era && Number(el.dataset.map) === s.map));
  }
  draw();
  mapEls.forEach((el) => hangPicture(el.querySelector('canvas')!, el.dataset.era!, 192, 108, Number(el.dataset.map))); // (painted once, then kept)
  // The weapons' pictures, a few at a time so the menu opens at once (each is painted the first time it is needed, then kept).
  const toDraw = [...root.querySelectorAll<HTMLElement>('.item')];
  let paintTimer = 0;
  const paintSome = () => { for (const t0 = performance.now(); toDraw.length && performance.now() - t0 < 12;) { const el = toDraw.shift()!; drawItem(el.querySelector('canvas')!, el.dataset.item!); } if (toDraw.length) paintTimer = window.setTimeout(paintSome, 0); };
  paintSome();

  const drop = (id: string) => {
    const f = sim.fighters[you], t = f.torso.body.translation(), A = sim.arena;
    const x = Math.max(A.platformX + 0.5, Math.min(A.platformX + A.platformW - 0.5, t.x + f.side * 0.8));
    sim.spawnItem(id, x, t.y - 2.2); // just above and in front of you: it falls at your feet
  };
  const dropped: string[] = []; // what was dropped in this time (dropped again if the practice starts over when the menu closes)
  const flash = (el: HTMLElement) => { el.classList.add('done'); setTimeout(() => el.classList.remove('done'), 300); };

  // Everything selectable, in lines as it is laid out: up and down go from line to line, left and right along a line (or change a setting).
  const lines: Spot[][] = rowEls.map((el, i) => [{ el, row: shown[i] }]);
  const actOf = (el: HTMLElement): Spot => ({ el, press: () => act(el.dataset.act!, el) });
  lines.push([...root.querySelectorAll<HTMLElement>('.acts .act')].map(actOf), ...[...root.querySelectorAll<HTMLElement>('.act.wide')].map((el) => [actOf(el)]));
  root.querySelectorAll<HTMLElement>('.maps').forEach((m) => lines.push([...m.querySelectorAll<HTMLElement>('.map')].map((el) => ({ el, press: () => set(() => { s.era = el.dataset.era!; s.map = Number(el.dataset.map); }, true) }))));
  const COLS = 3; // (the weapon grid is 3 across, an era's weapon and its two pickups: see menu.css)
  root.querySelectorAll<HTMLElement>('.items').forEach((g) => {
    const items = [...g.querySelectorAll<HTMLElement>('.item')].map((el) => ({ el, press: () => { drop(el.dataset.item!); dropped.push(el.dataset.item!); flash(el); } }));
    for (let i = 0; i < items.length; i += COLS) lines.push(items.slice(i, i + COLS));
  });
  let line = -1, col = 0, raf = 0, resolveFn: (r: 'back' | 'lobby') => void = () => {};
  const cur = () => lines[line]?.[col];
  const mark = () => { lines.flat().forEach((p) => p.el.classList.toggle('sel', p === cur())); cur()?.el.scrollIntoView({ block: 'nearest' }); };
  const close = (r: 'back' | 'lobby') => {
    cancelAnimationFrame(raf); clearTimeout(paintTimer); removeEventListener('keydown', onKey, true); closeMenu();
    if (rebuild && r === 'back') { sim.reset(); dropped.forEach(drop); }
    resolveFn(r);
  };
  function act(a: string, el: HTMLElement) {
    if (a === 'clear') { sim.clearLoose(); dropped.length = 0; flash(el); }
    else if (a === 'reset') { sim.reset(); rebuild = false; close('back'); }
    else close(a as 'back' | 'lobby');
  }

  // The mouse: arrows change a setting, everything else does what it says.
  rowEls.forEach((el, i) => el.querySelectorAll<HTMLElement>('.arw').forEach((b) => { b.onclick = () => shown[i].step(Number(b.dataset.d)); }));
  lines.flat().forEach((p) => { if (p.press) p.el.onclick = p.press; });

  // The keyboard and gamepads.
  const move = (d: number) => { line = line < 0 ? 0 : Math.max(0, Math.min(lines.length - 1, line + d)); col = Math.min(col, lines[line].length - 1); mark(); };
  const side = (d: number) => { const p = cur(); if (!p) return move(1); if (p.row) p.row.step(d); else { col = Math.max(0, Math.min(lines[line].length - 1, col + d)); mark(); } };
  const press = () => { const p = cur(); if (!p) return move(1); if (p.row) p.row.step(1); else p.press?.(); };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Tab' || e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close('back'); }
    else if (e.code === 'ArrowUp') move(-1);
    else if (e.code === 'ArrowDown') move(1);
    else if (e.code === 'ArrowLeft') side(-1);
    else if (e.code === 'ArrowRight') side(1);
    else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); press(); }
  };
  addEventListener('keydown', onKey, true); // (first, so the Esc that closes this menu does not reach the fight)
  menuPresses(); // (buttons already held when the menu opens are not presses)
  let backWas = true; // the Back button that opened the menu may still be down
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

import type { PlayerInput } from '../sim/types';

// Keyboard + mouse + gamepads -> one PlayerInput struct per player per frame.
// Player 1 is keyboard and mouse (and the first gamepad too, so a lone gamepad works). Players 2-4 are the other gamepads.
const keys = new Set<string>(); // keys currently held
const taps = new Set<string>(); // keys pressed since last checked (survives a very fast tap)
let mouseX = 0, mouseY = 0, mouseDown = false, dropTap = false;
let padAim = 0, usePadAim = false;

addEventListener('keydown', (e) => {
  keys.add(e.code);
  taps.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'F3') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); taps.clear(); mouseDown = false; rightWas = false; });
// Read the state of ALL mouse buttons on every mouse event. Browsers do not send a "button pressed" event for a second button
// pressed while the first is still held (right-click while holding left-click, which is how a charged throw works):
// they only send a move event whose `buttons` field has changed.
let rightWas = false;
function syncButtons(e: PointerEvent): void {
  mouseDown = (e.buttons & 1) !== 0;
  const right = (e.buttons & 2) !== 0;
  if (right && !rightWas) dropTap = true; // a new right-button press, even with the left button held
  rightWas = right;
}
addEventListener('pointerdown', syncButtons);
addEventListener('pointerup', syncButtons);
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('pointermove', (e) => { mouseX = e.clientX; mouseY = e.clientY; usePadAim = false; syncButtons(e); });

/** One-shot key check (R, F3): true once per key press. */
export function wasPressed(code: string): boolean { return taps.delete(code); }

/** Forget key and button presses that happened while a menu was open, so they do not leak into the fight. */
export function flushInput(): void { taps.clear(); dropTap = false; }

// Menus with a gamepad: A, B, Start, and the d-pad or left stick as four directions.
export type MenuButton = 'a' | 'b' | 'start' | 'up' | 'down' | 'left' | 'right';
const menuHeld = new Map<number, Set<MenuButton>>();
/** Buttons newly pressed on each gamepad since the last call (`pad` = the gamepad's index). */
export function menuPresses(): { pad: number; b: MenuButton }[] {
  const out: { pad: number; b: MenuButton }[] = [];
  for (const p of connectedPads()) {
    const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0, on = (i: number) => !!p.buttons[i]?.pressed, now = new Set<MenuButton>();
    if (on(0)) now.add('a');
    if (on(1)) now.add('b');
    if (on(9)) now.add('start');
    if (on(12) || ay < -0.6) now.add('up');
    if (on(13) || ay > 0.6) now.add('down');
    if (on(14) || ax < -0.6) now.add('left');
    if (on(15) || ax > 0.6) now.add('right');
    const was = menuHeld.get(p.index);
    for (const b of now) if (!was?.has(b)) out.push({ pad: p.index, b });
    menuHeld.set(p.index, now);
  }
  return out;
}

/** Every connected gamepad, in the order the browser lists them. */
export function connectedPads(): Gamepad[] {
  return (navigator.getGamepads?.() ?? []).filter((g): g is Gamepad => !!g && g.connected);
}

// Gamepad buttons (standard layout): A jump, B or left bumper dodge, right trigger or right bumper attack,
// left stick moves, right stick aims, stick down or d-pad down crouches, X drops or picks up a weapon.
const padPrevDrop: boolean[] = [];
const padAimBySlot: number[] = [];

/** One gamepad as a player. `slot` is the player number (0-3): it sets which way the fighter faces until the right stick is used. */
export function readPadInput(slot: number, pad: Gamepad): PlayerInput {
  const ax = pad.axes[2] ?? 0, ay = pad.axes[3] ?? 0;
  if (padAimBySlot[slot] === undefined) padAimBySlot[slot] = slot % 2 === 0 ? 0 : Math.PI;
  if (Math.hypot(ax, ay) > 0.35) padAimBySlot[slot] = Math.atan2(ay, ax);
  const dropNow = !!pad.buttons[2]?.pressed;
  const drop = dropNow && !padPrevDrop[slot];
  padPrevDrop[slot] = dropNow;
  return {
    moveX: Math.abs(pad.axes[0] ?? 0) > 0.2 ? pad.axes[0] : 0,
    jump: !!pad.buttons[0]?.pressed,
    aim: padAimBySlot[slot],
    attack: !!pad.buttons[7]?.pressed || !!pad.buttons[5]?.pressed,
    crouch: (pad.axes[1] ?? 0) > 0.6 || !!pad.buttons[13]?.pressed,
    drop,
    dodge: !!pad.buttons[1]?.pressed || !!pad.buttons[4]?.pressed,
  };
}

/** Player 1. `fighter` = where the player is on screen (px); mouse aim is the angle from there to the cursor. `withPad` = the first
 * gamepad drives this player too (not in a local fight, where every gamepad has its own seat). */
export function readInput(fighter: { x: number; y: number }, withPad = true): PlayerInput {
  let moveX = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const tapped = (...codes: string[]) => codes.map((c) => taps.delete(c)).some(Boolean); // a press that was over before this frame still counts
  let jump = keys.has('Space') || tapped('Space');
  let attack = mouseDown;
  let crouch = keys.has('KeyS') || keys.has('ArrowDown');
  let drop = dropTap; // a right-click press counts even if it was over before this frame
  dropTap = false;
  let dodge = keys.has('ShiftLeft') || keys.has('ShiftRight') || tapped('ShiftLeft', 'ShiftRight');

  const pad = withPad ? connectedPads()[0] : undefined;
  if (pad) {
    if (Math.abs(pad.axes[0]) > 0.2) moveX = pad.axes[0];
    const ax = pad.axes[2] ?? 0, ay = pad.axes[3] ?? 0;
    if (Math.hypot(ax, ay) > 0.35) { padAim = Math.atan2(ay, ax); usePadAim = true; }
    jump = jump || !!pad.buttons[0]?.pressed;
    attack = attack || !!pad.buttons[7]?.pressed || !!pad.buttons[5]?.pressed; // right trigger / right bumper
    crouch = crouch || (pad.axes[1] ?? 0) > 0.6 || !!pad.buttons[13]?.pressed; // stick down / d-pad down
    dodge = dodge || !!pad.buttons[1]?.pressed || !!pad.buttons[4]?.pressed; // B / left bumper
    const dropNow = !!pad.buttons[2]?.pressed; // X
    drop = drop || (dropNow && !padPrevDrop[0]);
    padPrevDrop[0] = dropNow;
  }
  const aim = usePadAim ? padAim : Math.atan2(mouseY - fighter.y, mouseX - fighter.x);
  return { moveX, jump, aim, attack, crouch, drop, dodge };
}

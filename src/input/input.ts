import type { PlayerInput } from '../sim/types';

// Keyboard + mouse + gamepad -> one PlayerInput struct per frame.
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
addEventListener('blur', () => { keys.clear(); taps.clear(); mouseDown = false; });
addEventListener('pointerdown', (e) => { if (e.button === 0) mouseDown = true; if (e.button === 2) dropTap = true; });
addEventListener('pointerup', (e) => { if (e.button === 0) mouseDown = false;  });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('pointermove', (e) => { mouseX = e.clientX; mouseY = e.clientY; usePadAim = false; });

/** One-shot key check (R, F3): true once per key press. */
export function wasPressed(code: string): boolean { return taps.delete(code); }

/** `fighter` = where the player is on screen (px); mouse aim is the angle from there to the cursor. */
export function readInput(fighter: { x: number; y: number }): PlayerInput {
  let moveX = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const tapped = (...codes: string[]) => codes.map((c) => taps.delete(c)).some(Boolean); // a press that was over before this frame still counts
  let jump = keys.has('Space') || keys.has('KeyW') || keys.has('ArrowUp') || tapped('Space', 'KeyW', 'ArrowUp');
  let attack = mouseDown;
  const drop = dropTap; // a right-click press counts even if it was over before this frame
  dropTap = false;
  let dodge = keys.has('ShiftLeft') || keys.has('ShiftRight') || tapped('ShiftLeft', 'ShiftRight');

  const pad = navigator.getGamepads?.().find((g) => g?.connected);
  if (pad) {
    if (Math.abs(pad.axes[0]) > 0.2) moveX = pad.axes[0];
    const ax = pad.axes[2] ?? 0, ay = pad.axes[3] ?? 0;
    if (Math.hypot(ax, ay) > 0.35) { padAim = Math.atan2(ay, ax); usePadAim = true; }
    jump = jump || !!pad.buttons[0]?.pressed;
    attack = attack || !!pad.buttons[7]?.pressed || !!pad.buttons[5]?.pressed; // right trigger / right bumper
    dodge = dodge || !!pad.buttons[1]?.pressed || !!pad.buttons[4]?.pressed; // B / left bumper
  }
  const aim = usePadAim ? padAim : Math.atan2(mouseY - fighter.y, mouseX - fighter.x);
  return { moveX, jump, aim, attack, drop, dodge };
}

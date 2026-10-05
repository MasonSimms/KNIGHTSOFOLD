import { sfx, unlockAudio } from './audio/sfx';
import { tuning } from './content/tuning';
import { readInput, wasPressed } from './input/input';
import { createRenderer } from './render/render';
import { NEUTRAL } from './sim/types';
import type { PlayerInput } from './sim/types';
import { Sim } from './sim/world';
import { toggleOverlay, updateOverlay } from './ui/overlay';

const T = tuning;
// Open http://localhost:5173/?stress to add two scripted flailing fighters: a 4-fighter frame-time check, not AI.
const query = new URLSearchParams(location.search);
const stress = query.has('stress');
// Open http://localhost:5173/?slow=0.2 to run the game at 20% speed, to study a slam frame by frame.
const slow = Math.min(1, Number(query.get('slow')) || 1);
const sim = await Sim.create(1, stress ? 4 : 2);

function flail(frame: number, who: number): PlayerInput {
  const t = frame * (0.05 + who * 0.013);
  return { moveX: Math.sin(t * 0.7), jump: frame % (90 + who * 17) === 0, aim: Math.sin(t) * 3, attack: frame % 120 < 30, throw: false, grab: false };
}
const renderer = await createRenderer(sim, document.body);

addEventListener('pointerdown', unlockAudio);
addEventListener('keydown', unlockAudio);

// Hot reload: saving content/tuning.ts updates the live object in place, then the world rebuilds with the new numbers.
if (import.meta.hot) {
  import.meta.hot.accept('./content/tuning', (mod) => {
    if (!mod) return;
    const merge = (dst: any, src: any) => {
      for (const k in src) {
        if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k])) merge(dst[k], src[k]);
        else dst[k] = src[k];
      }
    };
    merge(tuning, mod.tuning);
    sim.reset();
  });
}

/** World metres -> screen px (the mouse aims relative to the fighter's screen position). */
function toScreen(x: number, y: number) {
  const o = renderer.toWorld(0, 0);
  const metresPerPx = renderer.toWorld(1, 0).x - o.x;
  return { x: (x - o.x) / metresPerPx, y: (y - o.y) / metresPerPx };
}

let acc = 0, last = performance.now();
let frames = 0, msSum = 0, simMsSum = 0, statTime = last;
let lastInput: PlayerInput = NEUTRAL;

function frame(now: number) {
  requestAnimationFrame(frame);
  const ft = Math.min(now - last, 100); // clamp so a tab switch doesn't cause a huge catch-up
  last = now;
  acc += (ft / 1000) * slow;

  if (wasPressed('F3')) toggleOverlay();
  if (wasPressed('KeyR')) sim.reset();

  const t0 = performance.now();
  for (let steps = 0; acc >= T.sim.dt && steps < T.sim.maxStepsPerFrame; steps++, acc -= T.sim.dt) {
    const p = sim.fighters[0].torso;
    lastInput = readInput(toScreen(p.cx, p.cy));
    sim.step([lastInput, NEUTRAL, flail(sim.frame, 2), flail(sim.frame, 3)]);
    for (const e of sim.events) {
      renderer.onEvent(e);
      if (e.t === 'hit') sfx.hit(e.v);
      else sfx[e.t]();
    }
  }
  if (acc >= T.sim.dt) acc = 0; // too far behind: drop the backlog instead of spiralling
  simMsSum += performance.now() - t0;

  renderer.draw(acc / T.sim.dt, ft / 1000);

  frames++;
  msSum += ft;
  if (now - statTime >= 500) {
    const fps = (frames * 1000) / (now - statTime);
    const [p1, dummy] = sim.fighters;
    updateOverlay([
      `FPS ${fps.toFixed(0)}   frame ${(msSum / frames).toFixed(1)} ms   sim ${(simMsSum / frames).toFixed(2)} ms`,
      `bodies ${sim.world.bodies.len()}   frame# ${sim.frame}   hit-stop ${sim.hitStop}`,
      `last impact ${sim.lastImpact.toFixed(1)}   hidden HP: you ${p1.hp.toFixed(0)}  dummy ${dummy.hp.toFixed(0)}`,
      `input x ${lastInput.moveX.toFixed(1)}  aim ${lastInput.aim.toFixed(2)}  jump ${+lastInput.jump} atk ${+lastInput.attack} throw ${+lastInput.throw} charge ${sim.fighters[0].charge}/${T.charge.maxFrames} grab ${+lastInput.grab}`,
      `F3 hide   R reset   edit src/content/tuning.ts to tune live`,
    ]);
    frames = 0; msSum = 0; simMsSum = 0; statTime = now;
  }
}

requestAnimationFrame(frame);

if (import.meta.env.DEV) (window as unknown as { sim: Sim }).sim = sim; // dev-only handle for console poking and browser tests

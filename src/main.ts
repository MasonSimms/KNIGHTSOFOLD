import { sfx, unlockAudio } from './audio/sfx';
import { eraById } from './content/eras';
import { botLook } from './content/looks';
import { tuning } from './content/tuning';
import { connectedPads, flushInput, readInput, readPadInput, wasPressed } from './input/input';
import { createRenderer } from './render/render';
import { NEUTRAL } from './sim/types';
import type { PlayerInput } from './sim/types';
import { NetClient, serverUrl } from './net/client';
import { Mirror } from './net/snapshot';
import type { Snapshot } from './net/snapshot';
import { Room } from './net/room';
import { Sim } from './sim/world';
import { runHall } from './ui/hall';
import type { Device } from './ui/hall';
import { runHome } from './ui/home';
import { updateHud } from './ui/hud';
import { forgetSession, loadSession, notice, runLobby } from './ui/lobby';
import { toggleOverlay, updateOverlay } from './ui/overlay';

const T = tuning;
// Open http://localhost:5173/?stress to add two scripted flailing fighters: a 4-fighter frame-time check, not AI.
const query = new URLSearchParams(location.search);
const stress = query.has('stress');
// Open http://localhost:5173/?slow=0.2 to run the game at 20% speed, to study a slam frame by frame.
const slow = Math.min(1, Number(query.get('slow')) || 1);
const sim = await Sim.create(1, stress ? 4 : 2);
// Look testing without a server: ?era=samurai keeps every round in that era; ?hats=cap,crown,horns,tophat and ?colors=4,5,6,7 dress the fighters.
const eraParam = query.get('era');
const mapParam = query.get('map');
if (eraParam || mapParam) { sim.forceEra = eraParam; sim.forceMap = mapParam === null ? null : Number(mapParam); sim.reset(); } // ?era=samurai&map=1 is the samurai bridge
query.get('hats')?.split(',').forEach((h, i) => { if (sim.looks[i]) sim.looks[i].hat = h as typeof sim.looks[0]['hat']; });
query.get('colors')?.split(',').forEach((c, i) => { if (sim.looks[i]) sim.looks[i].color = Number(c) || 0; });
query.get('eyes')?.split(',').forEach((e, i) => { if (sim.looks[i]) sim.looks[i].eyes = e as typeof sim.looks[0]['eyes']; }); // ?eyes=round,fierce,sleepy
// Open http://localhost:5173/?lag=100 to play through a pretend network: the real sim runs as a "server" in this page, your inputs and its
// snapshots each take 100 ms to arrive, and what you see is a client copy built only from those snapshots (solo vs the dummy; R is off).
const lagMs = Number(query.get('lag')) || 0;
const room = lagMs ? new Room(sim) : null;
let mirror: Mirror | null = lagMs ? new Mirror(await Sim.create(1, stress ? 4 : 2)) : null;
// Open http://localhost:5173/?online to play for real: make or join a room, the host starts. (Needs the room server: npm run server.)
let net: NetClient | null = null, mySlot = 0;
const onlineParam = query.get('online');
if (onlineParam !== null) {
  const url = serverUrl(onlineParam);
  const r = await runLobby(url);
  net = r.client; mySlot = r.you;
  const m = new Mirror(await Sim.create(r.seed, 4, false)); // online is always 4 fighters: empty seats are parked out of sight
  mirror = m;
  if (r.queued) notice('You join at the start of the next round');
  const attach = (c: NetClient) => {
    c.onMsg = (msg) => {
      if (msg.t === 'snap') m.push(msg.s);
      else if (msg.t === 'start') { mySlot = msg.you; m.reset(); notice(msg.queued ? 'You join at the start of the next round' : ''); } // (back after a drop: rebuild from the catch-up snapshot that follows)
      else if (msg.t === 'over') { forgetSession(); alert(`The fight is over: ${msg.why}.`); location.reload(); } // back to the menu (ponytail: a fresh connection; a lobby that survives the fight can come later)
      else if (msg.t === 'error') { forgetSession(); alert(`Could not rejoin: ${msg.why}.`); location.reload(); }
    };
    c.onClose(() => void reconnect());
  };
  // A dropped connection: keep trying for a minute to get back into the same seat (the server holds it for you).
  const reconnect = async () => {
    notice('Connection lost. Reconnecting...');
    for (let i = 0; i < 30; i++) {
      await new Promise((ok) => setTimeout(ok, 2000));
      const saved = loadSession();
      if (!saved) break;
      try { const c = await NetClient.connect(url); net = c; attach(c); c.send({ t: 'rejoin', ...saved }); return; } catch { /* still down: try again */ }
    }
    forgetSession(); alert('Could not get back into the game.'); location.reload();
  };
  attach(net);
}
const view = mirror ? mirror.sim : sim; // what is drawn
// The game opens on the menus (home, then the Hall of Champions or training). Testing links skip them and keep the old rules: plugging in
// a gamepad adds a player. Online has its own room screen.
const testing = ['stress', 'slow', 'era', 'map', 'hats', 'colors', 'eyes', 'lag', 'bots', 'arm'].some((k) => query.has(k));
let mode: 'auto' | 'training' | 'local' = testing || net ? 'auto' : 'training';
let devices: (Device | 'bot')[] = []; // a local fight: who drives each fighter (keyboard and mouse, a gamepad, or a bot that plays itself)
let hallTraining = false; // the Hall was opened for Training (one player is enough, bots allowed)
let paused = false, startHeld = false;
const toServer: { at: number; input: PlayerInput }[] = [], toClient: { at: number; s: Snapshot }[] = [];

function flail(frame: number, who: number): PlayerInput {
  const t = frame * (0.05 + who * 0.013);
  return { moveX: Math.sin(t * 0.7), jump: frame % (90 + who * 17) === 0, aim: Math.sin(t) * 3, attack: frame % 120 < 30, drop: false, crouch: false, dodge: frame % 400 === 150 + who * 20 };
}
const renderer = await createRenderer(view, document.body);

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
let players = 1; // how many people are playing: 1 plus every gamepad beyond the first

/** Show the menus (the fight waits underneath) until someone picks what to play. */
async function menu(screen: 'home' | 'hall') {
  paused = true;
  for (;;) {
    if (screen === 'home') {
      const go = await runHome();
      if (go === 'online') { location.search = '?online'; return; } // online starts on a fresh page
      hallTraining = go === 'training'; // (owner: Training goes through the same character screen, it just is not a live lobby)
      screen = 'hall';
      continue;
    }
    const seats = await runHall(hallTraining);
    if (!seats) { screen = 'home'; continue; }
    mode = 'local'; devices = seats.map((s) => s.dev);
    sim.looks = [0, 1, 2, 3].map((i) => ({ ...(seats[i]?.look ?? { color: i, hat: 'none' as const, eyes: 'round' as const }) })); // (an unseated look carries no bot over from last time)
    mySlot = Math.max(0, devices.indexOf('kb'));
    sim.setPlayers(seats.length); // one player: practice on the dummy; two or more (people or bots): a real fight
    break;
  }
  flushInput(); // (keys pressed in the menus do not reach the fight)
  last = performance.now(); acc = 0;
  paused = false;
}

/** A gamepad's controls for fighter `slot` (a gamepad that was unplugged stands still). */
function padInput(slot: number, index: number, pads: Gamepad[]): PlayerInput {
  const pad = pads.find((p) => p.index === index);
  return pad ? readPadInput(slot, pad) : NEUTRAL;
}

function frame(now: number) {
  requestAnimationFrame(frame);
  if (paused) return;
  const ft = Math.min(now - last, 100); // clamp so a tab switch doesn't cause a huge catch-up
  last = now;
  acc += (ft / 1000) * slow;

  // Plugging in or unplugging a gamepad changes the number of players (2-4 starts a real fight; alone you get the training dummy).
  const pads = connectedPads();
  const wanted = stress || mirror ? 1 : Math.max(1, Math.min(4, pads.length));
  if (mode === 'auto' && wanted !== players) {
    players = wanted;
    sim.setPlayers(players);
  }

  if (wasPressed('F3')) toggleOverlay();
  if (wasPressed('KeyR') && !room) sim.reset(); // (a reset is not an event a client can replay)
  // Esc (or Start on a gamepad) leaves the fight: back to the Hall with everyone still seated, or home from training.
  const startNow = pads.some((p) => !!p.buttons[9]?.pressed), leave = wasPressed('Escape') || (startNow && !startHeld);
  startHeld = startNow;
  if (leave && mode !== 'auto') { void menu(mode === 'local' ? 'hall' : 'home'); return; }

  const t0 = performance.now();
  for (let steps = 0; acc >= T.sim.dt && steps < T.sim.maxStepsPerFrame; steps++, acc -= T.sim.dt) {
    const p = view.fighters[mySlot].torso;
    lastInput = readInput(toScreen(p.cx, p.cy), mode !== 'local');
    if (room) {
      toServer.push({ at: now + lagMs, input: lastInput });
      while (toServer.length && toServer[0].at <= now) room.setInput(0, toServer.shift()!.input);
      room.setInput(2, flail(sim.frame, 2)); room.setInput(3, flail(sim.frame, 3));
      const s = room.tick();
      if (s) toClient.push({ at: now + lagMs, s: JSON.parse(JSON.stringify(s)) }); // through the "wire"
      continue;
    }
    if (net) { net.send({ t: 'in', i: lastInput }); continue; } // online: the server runs the fight, we only send our controls
    const inputs = [lastInput, NEUTRAL, flail(sim.frame, 2), flail(sim.frame, 3)];
    if (mode === 'local') for (let k = 0; k < devices.length; k++) { const d = devices[k]; inputs[k] = d === 'kb' ? lastInput : d === 'bot' ? NEUTRAL : padInput(k, d, pads); } // (a bot presses its own buttons inside the sim)
    else if (players > 1) for (let k = 1; k < players; k++) inputs[k] = readPadInput(k, pads[k]);
    sim.step(inputs);
    for (const e of sim.events) {
      renderer.onEvent(e);
      if (e.t === 'hit') sfx.hit(e.v, !!e.head);
      else (sfx as unknown as Record<string, (() => void) | undefined>)[e.t]?.(); // some events (respawn, new round) have no sound
    }
  }
  if (acc >= T.sim.dt) acc = 0; // too far behind: drop the backlog instead of spiralling
  simMsSum += performance.now() - t0;

  let alpha = acc / T.sim.dt;
  if (mirror) {
    while (toClient.length && toClient[0].at <= now) mirror.push(toClient.shift()!.s);
    const shown = mirror.update(ft / 1000);
    alpha = shown.alpha;
    for (const e of shown.events) {
      renderer.onEvent(e);
      if (e.t === 'hit') sfx.hit(e.v, !!e.head);
      else (sfx as unknown as Record<string, (() => void) | undefined>)[e.t]?.();
    }
  }
  renderer.draw(alpha, ft / 1000);
  updateHud(view);

  frames++;
  msSum += ft;
  if (now - statTime >= 500) {
    const fps = (frames * 1000) / (now - statTime);
    updateOverlay([
      `FPS ${fps.toFixed(0)}   frame ${(msSum / frames).toFixed(1)} ms   sim ${(simMsSum / frames).toFixed(2)} ms`,
      `bodies ${view.world.bodies.len()}   frame# ${view.frame}`,
      `last impact ${sim.lastImpact.toFixed(1)}   hidden HP: ${view.fighters.map((f) => (f.controlled ? 'P' + (f.index + 1) : 'dummy') + ' ' + Math.max(0, f.hp).toFixed(0)).join('  ')}   players ${players}`,
      `input x ${lastInput.moveX.toFixed(1)}  aim ${lastInput.aim.toFixed(2)}  jump ${+lastInput.jump} atk ${+lastInput.attack} charge ${view.fighters[mySlot].charge}/${T.charge.maxFrames} dodge-ready-in ${(view.fighters[mySlot].dodgeCooldown / 60).toFixed(1)}s`,
      `era ${eraById(view.era).name}   outfit ${eraById(view.era).outfits[view.outfits[mySlot]]}`,
      net ? `ONLINE: you are fighter ${mySlot + 1}, ${mirror!.desyncs} desyncs` : room ? `PRETEND NETWORK: ${lagMs} ms each way, ${mirror!.desyncs} desyncs` : `F3 hide   R reset   edit src/content/tuning.ts to tune live`,
    ]);
    frames = 0; msSum = 0; simMsSum = 0; statTime = now;
  }
}

// ?bots=3: you against three bots straight away (no menus); ?bots=4: watch four bots fight. Add &slow=0.3 to watch in slow motion.
const botsParam = Math.min(4, Number(query.get('bots')) || 0);
// ?arm=old: the free arm as it was before it was loosened (stiff, glued to the body), to compare with the new one
if (query.get('arm') === 'old') Object.assign(T.offArm, { softness: 25, swingDamping: 6, elbowSoftness: 25, elbowDamping: 6, blend: 1 / 60 });
if (botsParam) {
  mode = 'local'; mySlot = 0;
  devices = botsParam >= 4 ? ['bot', 'bot', 'bot', 'bot'] : ['kb', ...Array<'bot'>(botsParam).fill('bot')];
  sim.looks = devices.map((d, i) => (d === 'bot' ? botLook() : { color: i, hat: 'none' as const, eyes: 'round' as const }));
  sim.setPlayers(devices.length);
}

requestAnimationFrame(frame);
if (mode === 'training') void menu('home');

if (import.meta.env.DEV) (window as unknown as { sim: Sim }).sim = sim; // dev-only handle for console poking and browser tests
if (import.meta.env.DEV) (window as unknown as { tuning: typeof tuning }).tuning = tuning; // dev-only: lets the browser console and tests flip settings

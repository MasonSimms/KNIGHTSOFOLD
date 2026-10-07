import { sfx, unlockAudio } from './audio/sfx';
import { Excitement } from './audio/intensity';
import { setMusicEra, updateMusic } from './audio/music';
import { eraById } from './content/eras';
import { asEyes, asHat, botLook } from './content/looks';
import { tuning } from './content/tuning';
import { connectedPads, flushInput, readInput, readPadInput, wasPressed } from './input/input';
import { createRenderer } from './render/render';
import { NEUTRAL } from './sim/types';
import type { PlayerInput, SimEvent } from './sim/types';
import { NetClient, serverUrl } from './net/client';
import { Mirror } from './net/snapshot';
import { Predictor } from './net/predict';
import type { Snapshot } from './net/snapshot';
import { Room } from './net/room';
import { Spotter } from './replay/highlights';
import { Recorder } from './replay/recording';
import { Tape } from './replay/tape';
import { playClip } from './ui/replay';
import { createMuseum } from './render/museum';
import type { Clip } from './replay/tape';
import { Sim } from './sim/world';
import { runHall } from './ui/hall';
import { runHighlights } from './ui/highlights';
import type { Device } from './ui/hall';
import { runHome } from './ui/home';
import { updateHud } from './ui/hud';
import { forgetSession, loadSession, notice, runLobby, showPing } from './ui/lobby';
import { toggleOverlay, updateOverlay } from './ui/overlay';
import { applySettings, loadSettings, runSettings } from './ui/settings';
import { applyTraining, leaveTraining, loadTraining, runTraining } from './ui/training';
import { reportErrors } from './ui/oops';

reportErrors(); // (a crash in someone's browser shows on their screen and reaches the server's log)

const T = tuning;
// Open http://localhost:5173/?stress to add two scripted flailing fighters: a 4-fighter frame-time check, not AI.
const query = new URLSearchParams(location.search);
const stress = query.has('stress');
// Open http://localhost:5173/?slow=0.2 to run the game at 20% speed, to study a slam frame by frame.
const slow = Math.min(1, Number(query.get('slow')) || 1);
const sim = await Sim.create(1, stress ? 4 : 2);
// Look testing without a server: ?era=samurai keeps every round in that era; ?hats=plumed,jester,wizard,hennin and ?colors=4,5,6,7 dress the fighters.
const eraParam = query.get('era');
const mapParam = query.get('map');
if (eraParam || mapParam) { sim.forceEra = eraParam; sim.forceMap = mapParam === null ? null : Number(mapParam); sim.reset(); } // ?era=samurai&map=1 is the samurai bridge
query.get('hats')?.split(',').forEach((h, i) => { if (sim.looks[i]) sim.looks[i].hat = asHat(h); });
query.get('colors')?.split(',').forEach((c, i) => { if (sim.looks[i]) sim.looks[i].color = Number(c) || 0; });
query.get('eyes')?.split(',').forEach((e, i) => { if (sim.looks[i]) sim.looks[i].eyes = asEyes(e); }); // ?eyes=googly,startled,sly,cyclops
// Open http://localhost:5173/?lag=100 to play through a pretend network: the real sim runs as a "server" in this page, your inputs and its
// snapshots each take 100 ms to arrive, and what you see is a client copy built only from those snapshots (solo vs the dummy; R is off).
const lagMs = Number(query.get('lag')) || 0;
const room = lagMs ? new Room(sim) : null;
let mirror: Mirror | null = lagMs ? new Mirror(await Sim.create(1, stress ? 4 : 2)) : null;
// Open http://localhost:5173/?online to play for real: make or join a room, the host starts. (Needs the room server: npm run server.)
let net: NetClient | null = null, mySlot = 0, inputSeq = 0, ping = 0, isHost = false;
let predictor: Predictor | null = null, shownAlpha = 0; // online: your own fighter moved at once (the Settings switch 'Controls: Instant')
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
      if (msg.t === 'snap') { m.push(msg.s); predictor?.reconcile(msg.s); }
      else if (msg.t === 'pong') { ping = performance.now() - msg.n; showPing(ping); }
      else if (msg.t === 'clip') { pendingClip = msg.c; clipAt = performance.now(); } // the round's best moment: it plays in the museum
      else if (msg.t === 'start') { mySlot = msg.you; if (predictor) { predictor.stop(); predictor.slot = msg.you; } if (msg.seed !== m.sim.matchSeed) m.sim.reseed(msg.seed); m.reset(); if (!msg.resync) notice(msg.queued ? 'You join at the start of the next round' : ''); } // (back after a drop: rebuild from the catch-up snapshot that follows)
      else if (msg.t === 'over') void backToRoom(c); // the match is over (or the host ended it): back to the room's Hall, ready for a rematch
      else if (msg.t === 'error' && msg.fatal) { forgetSession(); alert(msg.why); location.href = location.pathname; }
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
  /** After a match: the room's Hall on the same connection, then the next fight (a new seed: a new order of maps). */
  const backToRoom = async (c: NetClient) => {
    c.onMsg = null; // (the room's messages wait for the Hall to pick them up)
    paused = true;
    notice('');
    museum.close();
    const r = await runLobby(url, c);
    mySlot = r.you; isHost = r.host;
    if (predictor) { predictor.stop(); predictor.slot = r.you; }
    m.sim.reseed(r.seed);
    m.reset();
    notice(r.queued ? 'You join at the start of the next round' : '');
    attach(c);
    flushInput(); last = performance.now(); acc = 0;
    paused = false;
  };
  isHost = r.host;
  attach(net);
  setInterval(() => net?.send({ t: 'ping', n: performance.now() }), 2000); // the round trip, shown in a corner
}
let desyncsSeen = 0, resyncAt = 0;
const view = mirror ? mirror.sim : sim; // what is drawn
if (mirror && loadSettings().predict) predictor = new Predictor(mirror, mySlot);
// The game opens on the menus (home, then the Hall of Champions or training). Testing links skip them and keep the old rules: plugging in
// a gamepad adds a player. Online has its own room screen.
const testing = ['stress', 'slow', 'era', 'map', 'hats', 'colors', 'eyes', 'lag', 'bots', 'arm'].some((k) => query.has(k));
let mode: 'auto' | 'training' | 'local' = testing || net ? 'auto' : 'training';
let devices: (Device | 'bot')[] = []; // a local fight: who drives each fighter (keyboard and mouse, a gamepad, or a bot that plays itself)
let hallTraining = false; // the Hall was opened for Training (one player is enough, bots allowed)
let paused = false, startHeld = false, backHeld = false;
let speed = slow; // game speed (the training settings can slow it down)
const toServer: { at: number; input: PlayerInput; n: number }[] = [], toClient: { at: number; s: Snapshot }[] = [];

function flail(frame: number, who: number): PlayerInput {
  const t = frame * (0.05 + who * 0.013);
  return { moveX: Math.sin(t * 0.7), jump: frame % (90 + who * 17) === 0, aim: Math.sin(t) * 3, attack: frame % 120 < 30, drop: false, crouch: false, dodge: frame % 400 === 150 + who * 20 };
}
const renderer = await createRenderer(view, document.body);
applySettings(loadSettings(), renderer);
// Every local round is recorded (the buttons pressed, a few hundred kilobytes) and the spotter picks out the moments worth seeing again.
const recorder = new Recorder(), spotter = new Spotter(), tape = new Tape();
const museum = createMuseum(renderer);
let replaying = false; // the museum between eras is on screen (it draws itself; locally the fight waits, online it goes on and we catch up)
let pendingClip: Clip | null = null, clipAt = 0, roundSeenAt = 0, lastAlpha = 1;

/**
 * Between eras (owner): the frozen end of the round becomes a painting on the museum wall, the round's best moment replays in it, then the
 * camera slides to the next painting (the next arena, everyone at their starting spots) and goes in. After the last round it stays on the
 * painting and the podium comes up instead.
 */
async function eraChange() {
  if (replaying) return;
  replaying = true;
  const now = museum.newCanvas();
  renderer.draw(lastAlpha, 0, undefined, now); // the freeze
  museum.hangNow(now);
  await museum.pullBack();
  for (let i = 0; i < 90 && net && !pendingClip; i++) await new Promise((ok) => setTimeout(ok, 20)); // (online: the server's clip is on its way)
  const clip = pendingClip;
  pendingClip = null;
  if (clip) await playClip(clip, renderer, view, play, net ? clipAt : undefined, (a, dt) => { renderer.draw(a, dt, undefined, now); museum.render(); });
  if (view.endsMatch) { // the last round: no next era; the podium comes up over the wall (the museum closes when everyone goes back to the Hall)
    if (!net && !room) sim.finishRoundPause();
    replaying = false; last = performance.now(); acc = 0;
    return;
  }
  const next = museum.newCanvas();
  await drawNextRound(next);
  museum.hangNext(next);
  await museum.slide();
  await museum.zoomIn();
  if (!net && !room) sim.finishRoundPause(); // (here the next round starts now; online the server has been waiting the same time)
  museum.close();
  replaying = false; last = performance.now(); acc = 0;
}

/** The next era's painting: its arena with everyone at their starting spots, drawn from a copy of the next round (nothing runs in it). */
async function drawNextRound(target: ReturnType<typeof museum.newCanvas>) {
  const up = view.upcoming(), pv = await Sim.create(view.matchSeed, view.fighters.length, view.practising);
  pv.looks = view.looks.map((l) => ({ ...l }));
  pv.gone = [...view.gone];
  pv.forceMap = view.forceMap; pv.forceEra = view.forceEra;
  pv.buildRound(view.round + 1, up.era);
  renderer.show(pv);
  renderer.draw(1, 0, undefined, target);
  renderer.show(view);
  pv.world.free();
}

const excitement = new Excitement(); // how exciting the fight is: the music follows it
/** The picture and the sound for what just happened in the fight. */
function play(e: SimEvent) {
  renderer.onEvent(e);
  excitement.event(e);
  if (e.t === 'hit') sfx.hit(e.v, !!e.head);
  else if (e.t === 'shot') sfx.shot(e.w === 'pistol');
  else if (e.t === 'break' && e.w === 'pane') sfx.shatter();
  else (sfx as unknown as Record<string, (() => void) | undefined>)[e.t]?.(); // some events (respawn, new round) have no sound
}

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
      if (go === 'settings') { await runSettings(renderer); continue; }
      if (go === 'highlights') { await highlights(); continue; }
      hallTraining = go === 'training'; // (owner: Training goes through the same character screen, it just is not a live lobby)
      screen = 'hall';
      continue;
    }
    const seats = await runHall(hallTraining);
    if (!seats) { screen = 'home'; continue; }
    mode = 'local'; devices = seats.map((s) => s.dev);
    sim.looks = [0, 1, 2, 3].map((i) => ({ ...(seats[i]?.look ?? { color: i, hat: 'none' as const, eyes: 'round' as const }) })); // (an unseated look carries no bot over from last time)
    // Training keeps its own settings (the training menu: Tab); anything else plays as normal.
    if (hallTraining) { const t = loadTraining(); applyTraining(sim, t, seats.length === 1); speed = t.speed; }
    else { leaveTraining(sim, eraParam, mapParam === null ? null : Number(mapParam)); speed = slow; }
    mySlot = Math.max(0, devices.indexOf('kb'));
    sim.reseed(Math.floor(Math.random() * 2 ** 31)); // a new match: a new order of maps and weapon drops
    sim.setPlayers(seats.length); // one player: practice on the dummy; two or more (people or bots): a real fight
    break;
  }
  flushInput(); // (keys pressed in the menus do not reach the fight)
  last = performance.now(); acc = 0;
  paused = false;
}

/** The training settings over the paused fight. */
async function trainingMenu() {
  paused = true;
  const r = await runTraining(sim, mySlot, sim.practising, (x) => { speed = x; });
  flushInput(); // (keys pressed in the panel do not reach the fight)
  last = performance.now(); acc = 0;
  if (r === 'leave') { void menu('home'); return; }
  paused = false;
}

/** The highlights gallery over the paused fight (H during a fight, or from the home screen). */
async function highlights() {
  const was = paused;
  paused = true;
  await runHighlights({ moments: () => spotter.best(10), renderer, live: view, onEvent: play });
  flushInput();
  last = performance.now(); acc = 0;
  paused = was;
}

/** A gamepad's controls for fighter `slot` (a gamepad that was unplugged stands still). */
function padInput(slot: number, index: number, pads: Gamepad[]): PlayerInput {
  const pad = pads.find((p) => p.index === index);
  return pad ? readPadInput(slot, pad) : NEUTRAL;
}

function frame(now: number) {
  requestAnimationFrame(frame);
  if (paused || replaying) return;
  const ft = Math.min(now - last, 100); // clamp so a tab switch doesn't cause a huge catch-up
  last = now;
  acc += (ft / 1000) * speed;

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
  if (leave && net) { // online: the host can end the fight for everyone (back to the room); anyone can leave
    if (isHost && confirm('End the fight for everyone and go back to the room?')) net.send({ t: 'end' });
    else if (!isHost && confirm('Leave this fight?')) { forgetSession(); location.href = location.pathname; }
    flushInput(); last = performance.now(); acc = 0;
    return;
  }
  // Tab (or Back on a gamepad) while training: the training settings.
  const backNow = pads.some((p) => !!p.buttons[8]?.pressed), drill = wasPressed('Tab') || (backNow && !backHeld);
  backHeld = backNow;
  if (drill && mode === 'local' && hallTraining) { void trainingMenu(); return; }
  if (wasPressed('KeyH') && !net && !room) { void highlights(); return; } // (online, the fight cannot wait for you)

  const t0 = performance.now();
  for (let steps = 0; acc >= T.sim.dt && steps < T.sim.maxStepsPerFrame; steps++, acc -= T.sim.dt) {
    const p = view.fighters[mySlot].torso;
    lastInput = readInput(toScreen(p.cx, p.cy), mode !== 'local', 1 / (renderer.toWorld(1, 0).x - renderer.toWorld(0, 0).x));
    if (room) {
      const n = ++inputSeq;
      toServer.push({ at: now + lagMs, input: lastInput, n });
      while (toServer.length && toServer[0].at <= now) { const x = toServer.shift()!; room.setInput(0, x.input, x.n); }
      for (const e of predictor?.tick(lastInput, n, shownAlpha) ?? []) play(e);
      room.setInput(2, flail(sim.frame, 2)); room.setInput(3, flail(sim.frame, 3));
      const s = room.tick();
      if (s) toClient.push({ at: now + lagMs, s: JSON.parse(JSON.stringify(s)) }); // through the "wire"
      continue;
    }
    if (net) { const n = ++inputSeq; net.send({ t: 'in', i: lastInput, n }); for (const e of predictor?.tick(lastInput, n, shownAlpha) ?? []) play(e); continue; } // online: the server runs the fight; we send our controls (and, predicting, move our own fighter at once)
    const inputs = [lastInput, NEUTRAL, flail(sim.frame, 2), flail(sim.frame, 3)];
    if (mode === 'local') for (let k = 0; k < devices.length; k++) { const d = devices[k]; inputs[k] = d === 'kb' ? lastInput : d === 'bot' ? NEUTRAL : padInput(k, d, pads); } // (a bot presses its own buttons inside the sim)
    else if (players > 1) for (let k = 1; k < players; k++) inputs[k] = readPadInput(k, pads[k]);
    recorder.before(sim, inputs);
    sim.step(inputs);
    spotter.feed(sim, recorder.current, sim.events);
    for (const e of sim.events) play(e);
    tape.feed(sim);
    const clip = tape.take();
    if (clip) pendingClip = clip;
    if (sim.matchActive && sim.roundOver && !sim.matchOver && sim.roundFrames >= T.transition.freezeFrames) { void eraChange(); break; } // half a second after the last one fell: the museum (the fight waits)
  }
  if (acc >= T.sim.dt) acc = 0; // too far behind: drop the backlog instead of spiralling
  simMsSum += performance.now() - t0;
  if (!net && !room && sim.matchOver && sim.matchFrames >= T.match.crownFrames) { // the crown has been shown: back to the Hall, everyone still seated
    museum.close();
    if (mode === 'local') { void menu('hall'); return; }
    sim.reseed(Math.floor(Math.random() * 2 ** 31)); // (testing links: straight into the next match)
  }

  let alpha = acc / T.sim.dt;
  if (mirror) {
    while (toClient.length && toClient[0].at <= now) { const s = toClient.shift()!.s; mirror.push(s); predictor?.reconcile(s); }
    const shown = mirror.update(ft / 1000);
    if (net && mirror.desyncs > desyncsSeen && now - resyncAt > 2000) { net.send({ t: 'resync' }); resyncAt = now; } // our copy went wrong: ask for all of it again
    desyncsSeen = mirror.desyncs;
    alpha = shownAlpha = shown.alpha;
    for (const e of shown.events) if (!(e.t === 'shot' && e.owner === mySlot && predictor?.active)) play(e); // (your own shot already flashed and banged when you clicked)
    if (shown.events.some((e) => e.t === 'round') && view.matchActive) roundSeenAt = now; // online: the round is won; the museum in half a second
    if (roundSeenAt && now - roundSeenAt >= (T.transition.freezeFrames / 60) * 1000) { roundSeenAt = 0; lastAlpha = alpha; void eraChange(); }
  }
  lastAlpha = alpha;
  renderer.draw(alpha, ft / 1000, predictor?.active ? { slot: mySlot, alpha: acc / T.sim.dt } : undefined);
  updateHud(view);
  { // the music: the era's instruments in a fight, swelling with the excitement (how much is happening, how much everyone moves)
    const alive = view.fighters.filter((f) => f.controlled && !f.limp);
    const motion = alive.length ? alive.reduce((s, f) => s + Math.hypot(f.torso.cx - f.torso.px, f.torso.cy - f.torso.py) * 60, 0) / alive.length : 0;
    setMusicEra(view.matchActive ? view.era : '');
    updateMusic(excitement.update(ft / 1000, motion));
  }

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
      net ? `ONLINE: you are fighter ${mySlot + 1}, ping ${Math.round(ping)} ms, ${mirror!.desyncs} desyncs` : room ? `PRETEND NETWORK: ${lagMs} ms each way, ${mirror!.desyncs} desyncs` : `F3 hide   R reset   edit src/content/tuning.ts to tune live`,
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
if (import.meta.env.DEV) (window as unknown as { view: Sim; mirror: Mirror | null }).view = view; // (online: the copy that is drawn)
if (import.meta.env.DEV) (window as unknown as { mirror: Mirror | null }).mirror = mirror;
if (import.meta.env.DEV) Object.assign(window, { devTape: tape, devPlay: play, devEraChange: (c?: Clip) => { if (c) pendingClip = c; return eraChange(); } }); // (dev: the museum between eras, and effects, from the console)
if (import.meta.env.DEV) (window as unknown as { tuning: typeof tuning }).tuning = tuning; // dev-only: lets the browser console and tests flip settings

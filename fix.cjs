const fs = require('fs');
const p = 'src/main.ts'; let s = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 50)); s = s.replace(a, b); };
rep("import { Sim } from './sim/world';", "import { Mirror } from './net/snapshot';\nimport type { Snapshot } from './net/snapshot';\nimport { Room } from './net/room';\nimport { Sim } from './sim/world';");
rep("const sim = await Sim.create(1, stress ? 4 : 2);\n", `const sim = await Sim.create(1, stress ? 4 : 2);
// Open http://localhost:5173/?lag=100 to play through a pretend network: the real sim runs as a "server" in this page, your inputs and its
// snapshots each take 100 ms to arrive, and what you see is a client copy built only from those snapshots (solo vs the dummy; R is off).
const lagMs = Number(query.get('lag')) || 0;
const room = lagMs ? new Room(sim) : null;
const mirror = lagMs ? new Mirror(await Sim.create(1, stress ? 4 : 2)) : null;
const view = mirror ? mirror.sim : sim; // what is drawn
const toServer: { at: number; input: PlayerInput }[] = [], toClient: { at: number; s: Snapshot }[] = [];
`);
rep("const renderer = await createRenderer(sim, document.body);", "const renderer = await createRenderer(view, document.body);");
rep("  if (wasPressed('KeyR')) sim.reset();", "  if (wasPressed('KeyR') && !room) sim.reset(); // (a reset is not an event a client can replay)");
rep("    const p = sim.fighters[0].torso;\n    lastInput = readInput(toScreen(p.cx, p.cy));\n    const inputs", "    const p = view.fighters[0].torso;\n    lastInput = readInput(toScreen(p.cx, p.cy));\n    if (room) {\n      toServer.push({ at: now + lagMs, input: lastInput });\n      while (toServer.length && toServer[0].at <= now) room.setInput(0, toServer.shift()!.input);\n      room.setInput(2, flail(sim.frame, 2)); room.setInput(3, flail(sim.frame, 3));\n      const s = room.tick();\n      if (s) toClient.push({ at: now + lagMs, s: JSON.parse(JSON.stringify(s)) }); // through the \"wire\"\n      continue;\n    }\n    const inputs");
rep("  if (acc >= T.sim.dt) acc = 0; // too far behind: drop the backlog instead of spiralling\n  simMsSum += performance.now() - t0;\n\n  renderer.draw(acc / T.sim.dt, ft / 1000);\n  updateHud(sim);", `  if (acc >= T.sim.dt) acc = 0; // too far behind: drop the backlog instead of spiralling
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
  updateHud(view);`);
rep("      \`F3 hide   R reset   edit src/content/tuning.ts to tune live\`,", "      room ? `PRETEND NETWORK: ${lagMs} ms each way, ${mirror!.desyncs} desyncs` : `F3 hide   R reset   edit src/content/tuning.ts to tune live`,");
fs.writeFileSync(p, s);

// npm run deploy: put the new version live, but not while anyone is in a fight (a deploy restarts the server and ends every fight:
// the 2026-10-06 playtest lost its match that way). npm run deploy -- --force goes up anyway.
import { spawnSync } from 'node:child_process';

const URL = 'https://knightsofold.fly.dev/health';
const force = process.argv.includes('--force');
let text = '';
try { text = await (await fetch(URL, { signal: AbortSignal.timeout(20000) })).text(); } catch (e) { text = `unreachable (${e.message})`; }
const fighting = /(\d+) fighting/.exec(text)?.[1] ?? /ok (\d+) rooms/.exec(text)?.[1]; // (an older server only says how many rooms)
console.log(`Live server: ${text}`);
if (fighting === undefined && !force) { console.log('Could not tell whether anyone is playing. Check the address above, or: npm run deploy -- --force'); process.exit(1); }
if (Number(fighting) > 0 && !force) { console.log(`Not deploying: ${fighting} room(s) in use right now, and a deploy would end their fight. Try again when they are done, or: npm run deploy -- --force`); process.exit(1); }
process.exit(spawnSync('fly', ['deploy'], { stdio: 'inherit', shell: true }).status ?? 1);

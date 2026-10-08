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
// Only code everyone has: a copy behind GitHub's master would put older code live and undo other windows' fixes (2026-10-08: a stale
// checkout went live over the day's online fixes), and unsaved edits would put someone's half-done work live. npm run deploy -- --stale
// skips both checks. Each release is labelled with its commit, so `fly releases --image` says what is live.
const git = (...a) => spawnSync('git', a, { encoding: 'utf8' });
const stale = process.argv.includes('--stale');
git('fetch', '-q', 'origin');
const behind = Number(git('rev-list', '--count', 'HEAD..origin/master').stdout.trim() || 0), dirty = git('status', '--porcelain', '--untracked-files=no').stdout.trim();
if (behind > 0 && !stale) { console.log(`Not deploying: this copy is ${behind} commit(s) behind GitHub's master, and would put older code live. Update it first (git pull), or: npm run deploy -- --stale`); process.exit(1); }
if (dirty && !stale) { console.log(`Not deploying: this copy has unsaved changes (deploy only committed code, from a clean checkout: DEPLOY.md):
${dirty}`); process.exit(1); }
const label = git('rev-parse', '--short', 'HEAD').stdout.trim() + (dirty ? '-unsaved' : '');
console.log(`Deploying commit ${label}.`);
process.exit(spawnSync('fly', ['deploy', '--image-label', label], { stdio: 'inherit', shell: true }).status ?? 1);

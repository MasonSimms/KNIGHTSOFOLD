// Something broke in this browser (a friend's page draws nothing, say): it says so in a corner of the screen and tells the server, whose
// log (`fly logs`) is how the owner and Claude find out what went wrong on someone else's computer. Each different error is told once.

const told = new Set<string>();

function tell(what: string): void {
  if (told.has(what) || told.size >= 10) return;
  told.add(what);
  const why = what.slice(0, 500);
  try { navigator.sendBeacon('/oops', JSON.stringify({ why, browser: navigator.userAgent.slice(0, 200) })); } catch { /* no server here (local play) */ }
  let el = document.getElementById('oops');
  if (!el) {
    el = document.createElement('div');
    el.id = 'oops';
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;max-width:60vw;padding:6px 10px;background:#2a1712e6;color:#f3d9a4;font:12px sans-serif;border:1px solid #8a5a2b;z-index:99;white-space:pre-wrap';
    document.body.appendChild(el);
  }
  el.textContent = `Something went wrong in this browser (Chrome works best):\n${why}`;
}

/** A note for the server's log (not an error: shown nowhere on screen). */
export function tellServer(note: string): void {
  try { navigator.sendBeacon('/oops', JSON.stringify({ why: `note: ${note.slice(0, 300)}`, browser: navigator.userAgent.slice(0, 200) })); } catch { /* no server here */ }
}

let hiddenSince = 0, hiddenFor = 0;
addEventListener('visibilitychange', () => { if (document.hidden) hiddenSince = performance.now(); else if (hiddenSince) { hiddenFor = performance.now() - hiddenSince; hiddenSince = 0; } });
/** How long the page was last out of sight (or has been, if it still is), in seconds. */
export const hiddenSeconds = (): number => Math.round((hiddenSince ? performance.now() - hiddenSince : hiddenFor) / 1000);

export function reportErrors(): void {
  addEventListener('error', (e) => tell(`${e.message}${e.error?.stack ? `\n${String(e.error.stack).split('\n').slice(1, 4).join('\n')}` : ` @ ${String(e.filename).split('/').pop()}:${e.lineno}`}`));
  addEventListener('unhandledrejection', (e) => tell(String((e.reason as Error)?.stack ?? e.reason).split('\n').slice(0, 4).join('\n')));
}

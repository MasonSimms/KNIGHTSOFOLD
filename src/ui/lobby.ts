import { menuPresses } from '../input/input';
import { NetClient } from '../net/client';
import { MAX_PLAYERS, MIN_PLAYERS } from '../net/protocol';
import type { ServerMsg } from '../net/protocol';
import { mountHall, ROWS, step, takenBy } from './hall';
import { BACK, closeMenu, openMenu } from './menu';

// Online: make a room or join one by its 4-letter code (also while a fight is under way: you appear next round), then the Hall of
// Champions with the room code on a plaque. Everyone readies up and the host starts. Resolves when you are in a fight.

// Your seat in a room, remembered for this tab so a page reload or a dropped connection puts you back in the same seat with your score.
const KEY = 'knights-session';
export interface Session { code: string; token: string }
export const loadSession = (): Session | null => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); } catch { return null; } };
export const saveSession = (s: Session): void => { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: reconnecting by reload just will not work */ } };
export const forgetSession = (): void => { try { sessionStorage.removeItem(KEY); } catch { /* nothing to forget */ } };

/** A line of text over the game ("Reconnecting...", "You join next round"). Empty text hides it. */
export function notice(text: string): void {
  let el = document.getElementById('notice');
  if (!el) { el = document.createElement('div'); el.id = 'notice'; document.body.appendChild(el); }
  el.textContent = text;
  el.style.display = text ? 'block' : 'none';
}

const home = () => { forgetSession(); location.href = location.pathname; }; // back to the gallery (a fresh page)

export function runLobby(url: string): Promise<{ client: NetClient; seed: number; you: number; queued: boolean }> {
  notice('');
  const root = openMenu('door', `<button class="back" title="Back">${BACK}</button><h1>Knights of Old</h1><div class="body">Connecting...</div><div class="err"></div>`);
  const body = root.querySelector('.body') as HTMLElement, err = root.querySelector('.err') as HTMLElement;
  (root.querySelector('.back') as HTMLElement).onclick = home;

  return new Promise((resolve) => {
    NetClient.connect(url).then((client) => {
      let code = '', last: Extract<ServerMsg, { t: 'lobby' }> | null = null, row = 0, problem = '', raf = 0;
      let hall: ReturnType<typeof mountHall> | null = null;
      const door = () => {
        body.innerHTML = `<p class="sub">Play with friends online</p><p><button class="btn mk">Make a room</button></p><p><input maxlength="4" placeholder="CODE"> <button class="btn jn">Join</button></p>`;
        const input = body.querySelector('input') as HTMLInputElement;
        (body.querySelector('.mk') as HTMLElement).onclick = () => client.send({ t: 'create' });
        const join = () => { code = input.value.toUpperCase(); client.send({ t: 'join', code }); };
        (body.querySelector('.jn') as HTMLElement).onclick = join;
        input.onkeydown = (e) => { if (e.code === 'Enter') join(); };
      };
      const mine = () => last?.looks[last.you] ?? null;
      const allReady = (m: NonNullable<typeof last>) => m.looks.every((l, i) => !l || m.ready[i]);
      const seated = (m: NonNullable<typeof last>) => m.looks.filter(Boolean).length; // people and bots
      const canStart = (m: NonNullable<typeof last>) => m.host && seated(m) >= MIN_PLAYERS && allReady(m);
      const setReady = (on: boolean) => client.send({ t: 'ready', ready: on });
      const go = () => { if (last && canStart(last)) client.send({ t: 'start' }); };
      const change = (d: number) => { const l = mine(); if (l && last && !last.ready[last.you]) client.send({ t: 'look', ...step(l, row, d, takenBy(last.looks, last.you)) }); };
      const draw = () => {
        const m = last;
        if (!m || !hall) return;
        hall.update({
          seats: Array.from({ length: MAX_PLAYERS }, (_, i) => { const l = m.looks[i]; return l ? { look: l, ready: m.ready[i], mine: i === m.you, row: i === m.you ? row : -1 } : null; }),
          empty: 'Waiting for a friend', code: m.code, bots: m.host,
          canStart: canStart(m), startLabel: m.host ? 'To Battle' : 'The host starts the fight',
          note: problem || (seated(m) < MIN_PLAYERS ? (m.host ? 'Waiting for a friend to join (or add a bot)' : 'Waiting for a friend to join') : !allReady(m) ? 'Waiting for everyone to be ready' : m.host ? '' : 'Waiting for the host'),
          hint: 'Gamepad: the stick picks and changes, A is ready, B takes it back. Keyboard: Enter. Mouse: click.',
        });
      };
      const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter' && last) { if (!last.ready[last.you]) setReady(true); else go(); } };
      const tick = () => { // your gamepad drives your own seat
        raf = requestAnimationFrame(tick);
        const m = last;
        if (!m) return;
        for (const p of menuPresses()) {
          const ready = m.ready[m.you];
          if (p.b === 'a') { if (!ready) setReady(true); else go(); }
          else if (p.b === 'start') go();
          else if (p.b === 'b') { if (ready) setReady(false); }
          else if (ready) continue;
          else if (p.b === 'up' || p.b === 'down') { row = Math.max(0, Math.min(ROWS - 1, row + (p.b === 'up' ? -1 : 1))); draw(); }
          else if (row === ROWS - 1) setReady(true);
          else change(p.b === 'left' ? -1 : 1);
        }
      };
      const saved = loadSession();
      if (saved) { body.textContent = 'Rejoining your room...'; code = saved.code; client.send({ t: 'rejoin', ...saved }); } else door();
      client.onClose(() => { problem = 'Lost the connection to the server. Reload the page to try again.'; err.textContent = problem; draw(); });
      client.onMsg = (m) => {
        if (m.t === 'error') {
          problem = m.why; err.textContent = m.why; draw();
          if (saved && /seat is gone/.test(m.why)) { forgetSession(); err.textContent = problem = ''; door(); }
        } else if (m.t === 'lobby') {
          problem = '';
          code = m.code;
          saveSession({ code: m.code, token: m.token });
          if (!hall) {
            hall = mountHall({
              look: (i, l) => { if (last && i === last.you) client.send({ t: 'look', ...l }); },
              ready: (i) => { if (last && i === last.you) setReady(!last.ready[i]); },
              join: () => {}, leave: home, back: home, start: go,
              bot: (i) => client.send({ t: 'bot', at: i }),
            });
            addEventListener('keydown', onKey);
            menuPresses(); // (buttons already held are not presses)
            tick();
          }
          last = m;
          draw();
        } else if (m.t === 'start') {
          saveSession({ code, token: m.token });
          client.onMsg = null; // anything that arrives next (the first snapshot) waits for the game to pick it up
          cancelAnimationFrame(raf);
          removeEventListener('keydown', onKey);
          if (hall) hall.close(); else closeMenu();
          resolve({ client, seed: m.seed, you: m.you, queued: m.queued });
        }
      };
    }).catch((e: Error) => { body.textContent = ''; err.textContent = e.message; });
  });
}

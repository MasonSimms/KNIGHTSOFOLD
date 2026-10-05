import { NetClient } from '../net/client';

// The lobby: make a room or join one by its 4-letter code (also while a fight is under way: you appear next round), wait for friends,
// the host presses Start. Plain HTML laid over the page (no art yet). Resolves when you are in a fight.
const css = `
#lobby{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,10,20,.92);color:#eee;font:18px/1.4 system-ui,sans-serif;z-index:10}
#lobby .box{width:min(92vw,380px);text-align:center}
#lobby h1{margin:0 0 4px;font-size:28px}
#lobby input,#lobby button{font:inherit;padding:10px 14px;margin:6px 4px;border-radius:8px;border:1px solid #556;background:#223;color:#eee}
#lobby input{width:7em;text-transform:uppercase;text-align:center;letter-spacing:.2em}
#lobby button{cursor:pointer;background:#345}
#lobby button:hover{background:#456}
#lobby .code{font-size:48px;letter-spacing:.25em;margin:8px 0}
#lobby .err{color:#f88;min-height:1.4em}
#notice{position:fixed;top:56px;left:50%;transform:translateX(-50%);padding:6px 16px;border-radius:8px;background:rgba(0,0,0,.65);color:#fff;font:18px system-ui,sans-serif;z-index:5;display:none}
`;

// Your seat in a room, remembered for this tab so a page reload or a dropped connection puts you back in the same seat with your score.
const KEY = 'knights-session';
export interface Session { code: string; token: string }
export const loadSession = (): Session | null => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); } catch { return null; } };
export const saveSession = (s: Session): void => { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: reconnecting by reload just will not work */ } };
export const forgetSession = (): void => { try { sessionStorage.removeItem(KEY); } catch { /* nothing to forget */ } };

/** A line of text over the game ("Reconnecting...", "You join next round"). Empty text hides it. */
export function notice(text: string): void {
  let el = document.getElementById('notice');
  if (!el) { el = document.createElement('div'); el.id = 'notice'; document.body.appendChild(el); if (!document.getElementById('lb-style')) { const st = document.createElement('style'); st.id = 'lb-style'; st.textContent = css; document.head.appendChild(st); } }
  el.textContent = text;
  el.style.display = text ? 'block' : 'none';
}

export function runLobby(url: string): Promise<{ client: NetClient; seed: number; you: number; queued: boolean }> {
  notice('');
  const root = document.createElement('div');
  root.id = 'lobby';
  root.innerHTML = `<style>${css}</style><div class="box"><h1>Knights of Old</h1><div id="lb-body">Connecting...</div><div class="err" id="lb-err"></div></div>`;
  document.body.appendChild(root);
  const body = root.querySelector('#lb-body') as HTMLElement, err = root.querySelector('#lb-err') as HTMLElement;

  return new Promise((resolve) => {
    NetClient.connect(url).then((client) => {
      let code = '';
      const menu = () => {
        body.innerHTML = `<p>Play with friends online</p><button id="lb-make">Make a room</button><br><input id="lb-code" maxlength="4" placeholder="CODE"><button id="lb-join">Join</button>`;
        (body.querySelector('#lb-make') as HTMLElement).onclick = () => client.send({ t: 'create' });
        (body.querySelector('#lb-join') as HTMLElement).onclick = () => { code = (body.querySelector('#lb-code') as HTMLInputElement).value.toUpperCase(); client.send({ t: 'join', code }); };
      };
      const saved = loadSession();
      if (saved) { body.textContent = 'Rejoining your room...'; code = saved.code; client.send({ t: 'rejoin', ...saved }); } else menu();
      client.onClose(() => { err.textContent = 'Lost the connection to the server. Reload the page to try again.'; });
      client.onMsg = (m) => {
        if (m.t === 'error') {
          err.textContent = m.why;
          if (saved && /seat is gone/.test(m.why)) { forgetSession(); err.textContent = ''; menu(); }
        } else if (m.t === 'lobby') {
          err.textContent = '';
          code = m.code;
          saveSession({ code: m.code, token: m.token });
          body.innerHTML = `<p>Room code (tell your friends)</p><div class="code">${m.code}</div><p>${m.n} of 4 players</p>`
            + (m.host ? `<button id="lb-go"${m.n < 2 ? ' disabled' : ''}>${m.n < 2 ? 'Waiting for a friend...' : 'Start the fight'}</button>` : '<p>Waiting for the host to start...</p>');
          const go = body.querySelector('#lb-go') as HTMLElement | null;
          if (go) go.onclick = () => client.send({ t: 'start' });
        } else if (m.t === 'start') {
          saveSession({ code, token: m.token });
          client.onMsg = null; // anything that arrives next (the first snapshot) waits for the game to pick it up
          root.remove();
          resolve({ client, seed: m.seed, you: m.you, queued: m.queued });
        }
      };
    }).catch((e: Error) => { body.textContent = ''; err.textContent = e.message; });
  });
}

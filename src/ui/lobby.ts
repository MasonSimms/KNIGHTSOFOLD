import { NetClient } from '../net/client';

// The lobby: make a room or join one by its 4-letter code, wait for friends, the host presses Start.
// Plain HTML laid over the page (no art yet). Resolves when the fight starts.
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
`;

export function runLobby(url: string): Promise<{ client: NetClient; seed: number; count: number; you: number }> {
  const root = document.createElement('div');
  root.id = 'lobby';
  root.innerHTML = `<style>${css}</style><div class="box"><h1>Knights of Old</h1><div id="lb-body">Connecting...</div><div class="err" id="lb-err"></div></div>`;
  document.body.appendChild(root);
  const body = root.querySelector('#lb-body') as HTMLElement, err = root.querySelector('#lb-err') as HTMLElement;

  return new Promise((resolve) => {
    NetClient.connect(url).then((client) => {
      const menu = () => {
        body.innerHTML = `<p>Play with friends online</p><button id="lb-make">Make a room</button><br><input id="lb-code" maxlength="4" placeholder="CODE"><button id="lb-join">Join</button>`;
        (body.querySelector('#lb-make') as HTMLElement).onclick = () => client.send({ t: 'create' });
        (body.querySelector('#lb-join') as HTMLElement).onclick = () => client.send({ t: 'join', code: (body.querySelector('#lb-code') as HTMLInputElement).value });
      };
      menu();
      client.onClose(() => { err.textContent = 'Lost the connection to the server. Reload the page to try again.'; });
      client.onMsg = (m) => {
        if (m.t === 'error') err.textContent = m.why;
        else if (m.t === 'lobby') {
          err.textContent = '';
          body.innerHTML = `<p>Room code (tell your friends)</p><div class="code">${m.code}</div><p>${m.n} of 4 players</p>`
            + (m.host ? `<button id="lb-go"${m.n < 2 ? ' disabled' : ''}>${m.n < 2 ? 'Waiting for a friend...' : 'Start the fight'}</button>` : '<p>Waiting for the host to start...</p>');
          const go = body.querySelector('#lb-go') as HTMLElement | null;
          if (go) go.onclick = () => client.send({ t: 'start' });
        } else if (m.t === 'start') {
          root.remove();
          resolve({ client, seed: m.seed, count: m.count, you: m.you });
        }
      };
    }).catch((e: Error) => { body.textContent = ''; err.textContent = e.message; });
  });
}

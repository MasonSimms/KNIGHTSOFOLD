import type { ClientMsg, ServerMsg } from './protocol';

/** The browser's end of the room server connection. Messages that arrive before anyone is listening are kept and handed over once a handler is set. */
export class NetClient {
  private handler: ((m: ServerMsg) => void) | null = null;
  private backlog: ServerMsg[] = [];

  private constructor(private ws: WebSocket) {
    ws.onmessage = (e) => {
      let m: ServerMsg;
      try { m = JSON.parse(String(e.data)); } catch { return; }
      if (this.handler) this.handler(m); else this.backlog.push(m);
    };
  }

  static connect(url: string): Promise<NetClient> {
    return new Promise((ok, fail) => {
      const ws = new WebSocket(url);
      ws.onopen = () => ok(new NetClient(ws));
      ws.onerror = () => fail(new Error(`could not reach the game server at ${url}`));
    });
  }

  set onMsg(h: ((m: ServerMsg) => void) | null) {
    this.handler = h;
    if (h) for (const m of this.backlog.splice(0)) h(m);
  }

  onClose(h: () => void): void { this.ws.onclose = h; }
  send(m: ClientMsg): void { if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }
}

/** Where the room server is: ?online=ws://host:port overrides; otherwise the build setting; otherwise this machine (dev) or this site (deployed). */
export function serverUrl(param: string): string {
  if (param.startsWith('ws')) return param;
  const built = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (built) return built;
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'ws://localhost:8080' : `wss://${location.host}`;
}

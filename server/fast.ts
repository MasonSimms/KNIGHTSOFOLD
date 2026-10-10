import { lookup } from 'node:dns/promises';
import type { DataChannel, PeerConnection } from 'node-datachannel';
import type { ServerMsg } from '../src/net/protocol';

// The fast lane (owner, 2026-10-07: "do it for Sunday"): snapshots and inputs also go over a WebRTC data channel, which is UDP, unordered
// and never sends anything twice. Over the WebSocket (TCP) one lost message holds up everything behind it until it has been sent again,
// a stall of about a round trip; here it is simply gone and the next one shows (the snapshots repeat the deaths and pickups of the last
// half second: Snapshot.back). The WebSocket keeps carrying everything as well, so if a network blocks UDP, or this lane fails or never
// opens, the game plays exactly as before. On Fly.io UDP needs a dedicated IPv4 and the socket bound to `fly-global-services`; the
// address the browser is given is that public IPv4 (RTC_PUBLIC_IP): see fly.toml and DEPLOY.md.

export interface Lane {
  /** The page's offer or one of its addresses (through the WebSocket). */
  signal(m: { sdp?: string; candidate?: string; mid?: string }): void;
  send(msg: string): void;
  readonly open: boolean;
  close(): void;
}
type MakeLane = (reply: (m: ServerMsg) => void, onMessage: (raw: string) => void) => Lane;

/** The fast lane's maker, or null when it cannot run here (no WebRTC library for this machine): then there is only the WebSocket. */
export async function fastLanes(port: number, publicIp?: string): Promise<MakeLane | null> {
  let rtc: typeof import('node-datachannel');
  try { rtc = await import('node-datachannel'); } catch (e) { console.log(`fast lane off (no WebRTC here): ${String(e).slice(0, 200)}`); return null; }
  const bindAddress = process.env.FLY_APP_NAME ? (await lookup('fly-global-services', { family: 4 })).address : undefined; // (Fly.io: replies must leave from there)
  // The server's own address as the page should dial it: on Fly.io the dedicated public IPv4, not the private address the socket is on.
  const outside = (c: string) => (publicIp ? c.replace(/^(candidate:\S+ \d+ udp \d+ )(\S+)( \d+ typ host)/i, `$1${publicIp}$3`) : c);
  console.log(`fast lane on: UDP ${port}${bindAddress ? ` on ${bindAddress}` : ''}${publicIp ? `, dialled as ${publicIp}` : ''}`);
  return (reply, onMessage) => {
    let pc: PeerConnection | null = null, dc: DataChannel | null = null, offers = 0;
    const lane: Lane = {
      signal(m) {
        try {
          if (typeof m.sdp === 'string' && m.sdp.length < 20_000 && ++offers <= 3) { // (a page asks once, or again after a hiccup: never a flood)
            lane.close();
            const p = (pc = new rtc.PeerConnection('lane', { iceServers: [], enableIceUdpMux: true, portRangeBegin: port, portRangeEnd: port, ...(bindAddress ? { bindAddress } : {}) }));
            p.onLocalDescription((sdp, type) => { if (type === 'answer') reply({ t: 'rtc', sdp: sdp.split('\r\n').map((l) => (l.startsWith('a=candidate:') ? `a=${outside(l.slice(2))}` : l)).join('\r\n') }); });
            p.onLocalCandidate((candidate, mid) => { const c = candidate.replace(/^a=/, ''); if (!publicIp || / typ host/.test(c)) reply({ t: 'rtc', candidate: outside(c), mid }); });
            p.onDataChannel((d) => {
              dc = d;
              d.onMessage((msg) => { if (typeof msg === 'string' && msg.length < 4096) onMessage(msg); });
              d.onClosed(() => { if (dc === d) dc = null; });
            });
            p.setRemoteDescription(m.sdp, 'offer');
          } else if (pc && typeof m.candidate === 'string' && m.candidate.length < 1000) pc.addRemoteCandidate(m.candidate, typeof m.mid === 'string' ? m.mid : '0');
        } catch (e) { if (m.sdp) console.log(`fast lane could not open: ${String(e).slice(0, 200)}`); /* (a page's address it cannot use, a browser's private .local name, is fine: the page's own messages show the way) */ }
      },
      send(msg) { try { if (dc?.isOpen() && dc.bufferedAmount() < 256_000) dc.sendMessage(msg); } catch { /* closing */ } },
      get open() { try { return !!dc?.isOpen(); } catch { return false; } },
      close() { try { dc?.close(); pc?.close(); } catch { /* already */ } dc = null; pc = null; },
    };
    return lane;
  };
}

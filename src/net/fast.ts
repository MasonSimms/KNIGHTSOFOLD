import type { NetClient } from './client';
import type { ClientMsg, ServerMsg } from './protocol';

/**
 * The fast lane, the page's end (see server/fast.ts): a WebRTC data channel to the server, opened through the WebSocket. Unordered and
 * never resent (UDP): a lost snapshot is simply skipped where the WebSocket would hold up everything behind it. The same snapshots and
 * inputs still go by the WebSocket; whichever comes first is used. If it never opens (no WebRTC, a network that blocks UDP), the
 * WebSocket carries everything as before.
 */
export class FastLane {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private answered = false;
  private early: RTCIceCandidateInit[] = []; // the server's addresses that came before its answer

  constructor(private ws: NetClient, private onMsg: (m: ServerMsg) => void) {}

  get open(): boolean { return this.dc?.readyState === 'open'; }

  async start(): Promise<void> {
    if (typeof RTCPeerConnection === 'undefined') return;
    try {
      const pc = (this.pc = new RTCPeerConnection({ iceServers: [] })); // (the server has a public address: no go-between needed)
      const dc = (this.dc = pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 }));
      dc.onmessage = (e) => { if (typeof e.data === 'string') try { this.onMsg(JSON.parse(e.data)); } catch { /* not ours */ } };
      pc.onicecandidate = (e) => { if (e.candidate?.candidate) this.ws.send({ t: 'rtc', candidate: e.candidate.candidate, mid: e.candidate.sdpMid ?? '0' }); };
      await pc.setLocalDescription(await pc.createOffer());
      this.ws.send({ t: 'rtc', sdp: pc.localDescription!.sdp });
    } catch { this.close(); }
  }

  /** The server's answer, or one of its addresses. */
  async signal(m: { sdp?: string; candidate?: string; mid?: string }): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    try {
      if (m.sdp) {
        await pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
        this.answered = true;
        for (const c of this.early.splice(0)) await pc.addIceCandidate(c);
      } else if (m.candidate) {
        const c = { candidate: m.candidate, sdpMid: m.mid ?? '0' };
        if (this.answered) await pc.addIceCandidate(c); else this.early.push(c);
      }
    } catch { /* this lane will not open: the WebSocket carries on */ }
  }

  send(m: ClientMsg): void { if (this.open) try { this.dc!.send(JSON.stringify(m)); } catch { /* closing */ } }

  close(): void {
    try { this.dc?.close(); this.pc?.close(); } catch { /* already */ }
    this.dc = null; this.pc = null; this.answered = false; this.early = [];
  }
}

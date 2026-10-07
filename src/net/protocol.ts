import type { Look } from '../content/looks';
import type { PlayerInput } from '../sim/types';
import type { Snapshot } from './snapshot';
import type { Clip } from '../replay/tape';

// Messages between a browser and the room server: one JSON object per WebSocket message.
/** Bump when the messages change. A page and a server with different versions (or different gameplay numbers) refuse to play together:
 *  their copies of the fight would not match. */
export const PROTOCOL = 5;

export type ClientMsg =
  | { t: 'hello'; v: number; tuning: string } // the first message: which version of the game this page is (PROTOCOL, and the gameplay numbers' fingerprint)
  | { t: 'create' } // make a room and become its host
  | { t: 'join'; code: string } // also works while a fight is under way: you join at the start of the next round
  | { t: 'rejoin'; code: string; token: string } // back after a dropped connection or a page reload: you get your own seat and score back
  | { t: 'look'; color: number; hat: string; eyes: string } // pick my colour (unique in the room), hat and eyes; allowed any time, in the lobby or in a fight
  | { t: 'ready'; ready: boolean } // lobby: I am ready (or not any more); the host can start once everyone is
  | { t: 'bot'; at: number } // host only, in the lobby: put a bot in empty seat `at`, or take away the bot sitting there
  | { t: 'start' } // host only
  | { t: 'end' } // host only: back to the lobby
  | { t: 'in'; i: PlayerInput; n?: number; r?: [number, PlayerInput][] } // my controls, sent every tick; n counts them (the snapshot says which one the server used last: prediction needs it). r: the few before it again (over the fast lane, where one can be lost)
  | { t: 'rtc'; sdp?: string; candidate?: string; mid?: string } // opening the fast lane (server/fast.ts): this page's offer, then its addresses
  | { t: 'resync' } // my copy of the fight went wrong (a missed event): send me all of it again
  | { t: 'ping'; n: number } // send n straight back (to measure the round trip)
  | { t: 'stats'; ping: number; pingMax: number; buffer: number; stalls: number; carried: number; off: number; snaps: number; fps: number; slow: number; hidden: number; fast?: boolean }; // every 30 s in a fight: how this page's connection is going (into the server's log, fly logs: what real connections are like)

export type ServerMsg =
  | { t: 'lobby'; code: string; n: number; you: number; host: boolean; token: string; looks: (Look | null)[]; ready: boolean[] } // who is in the room and who is ready (sent to everyone whenever it changes); `token` is your private key to rejoin
  | { t: 'start'; seed: number; you: number; queued: boolean; token: string; resync?: boolean } // you are in a fight (new, or back): build or reset the Mirror (always 4 fighters; the snapshot that follows says which seats are empty), you are fighter `you`; `queued` = you appear next round
  | { t: 'snap'; s: Snapshot }
  | { t: 'over'; why: string } // the host ended the fight (or everyone left): back to the menu
  | { t: 'pong'; n: number }
  | { t: 'clip'; c: Clip } // the replay of the round just over: everyone watches it (about 5 s) before the next round
  | { t: 'error'; why: string; fatal?: boolean } // fatal: this page cannot play here (an old version, the server restarting): the connection closes
  | { t: 'rtc'; sdp?: string; candidate?: string; mid?: string }; // the fast lane: the server's answer, then its address

export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2; // to start a fight
export const GRACE_MS = 5_000; // a player whose connection drops mid-fight stands still this long before their fighter dies: back within it, they go on with the same round
export const RESERVE_MS = 60_000; // how long a player's seat is kept for them after they drop out of a fight
export const EMPTY_MS = 60_000; // how long a fight with nobody connected is kept before the room is deleted
export const CREATE_LIMIT = { rooms: 10, perMs: 600_000 }; // one address can make at most this many rooms in this long (stops a script filling the server)

const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);

/** Never trust a client: turn whatever arrived into a valid PlayerInput (junk numbers become 0, junk flags become false). */
export function cleanInput(raw: unknown): PlayerInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    moveX: num(r.moveX, -1, 1), aim: num(r.aim, -10, 10),
    jump: r.jump === true, attack: r.attack === true, crouch: r.crouch === true, drop: r.drop === true, dodge: r.dodge === true,
    ...(typeof r.reach === 'number' && Number.isFinite(r.reach) ? { reach: Math.max(0, Math.min(60, r.reach)) } : {}),
  };
}

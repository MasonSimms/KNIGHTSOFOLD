import type { Look } from '../content/looks';
import type { PlayerInput } from '../sim/types';
import type { Snapshot } from './snapshot';

// Messages between a browser and the room server: one JSON object per WebSocket message.
export type ClientMsg =
  | { t: 'create' } // make a room and become its host
  | { t: 'join'; code: string } // also works while a fight is under way: you join at the start of the next round
  | { t: 'rejoin'; code: string; token: string } // back after a dropped connection or a page reload: you get your own seat and score back
  | { t: 'look'; color: number; hat: string } // pick my colour (unique in the room) and hat; allowed any time, in the lobby or in a fight
  | { t: 'start' } // host only
  | { t: 'end' } // host only: back to the lobby
  | { t: 'in'; i: PlayerInput }; // my controls, sent every tick

export type ServerMsg =
  | { t: 'lobby'; code: string; n: number; you: number; host: boolean; token: string; looks: (Look | null)[] } // who is in the room (sent to everyone whenever it changes); `token` is your private key to rejoin
  | { t: 'start'; seed: number; you: number; queued: boolean; token: string } // you are in a fight (new, or back): build or reset the Mirror (always 4 fighters; the snapshot that follows says which seats are empty), you are fighter `you`; `queued` = you appear next round
  | { t: 'snap'; s: Snapshot }
  | { t: 'over'; why: string } // the host ended the fight (or everyone left): back to the menu
  | { t: 'error'; why: string };

export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2; // to start a fight
export const RESERVE_MS = 60_000; // how long a player's seat is kept for them after they drop out of a fight
export const EMPTY_MS = 60_000; // how long a fight with nobody connected is kept before the room is deleted

const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);

/** Never trust a client: turn whatever arrived into a valid PlayerInput (junk numbers become 0, junk flags become false). */
export function cleanInput(raw: unknown): PlayerInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    moveX: num(r.moveX, -1, 1), aim: num(r.aim, -10, 10),
    jump: r.jump === true, attack: r.attack === true, crouch: r.crouch === true, drop: r.drop === true, dodge: r.dodge === true,
  };
}

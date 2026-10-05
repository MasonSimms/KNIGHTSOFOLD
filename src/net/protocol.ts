import type { PlayerInput } from '../sim/types';
import type { Snapshot } from './snapshot';

// Messages between a browser and the room server: one JSON object per WebSocket message.
export type ClientMsg =
  | { t: 'create' } // make a room and become its host
  | { t: 'join'; code: string }
  | { t: 'start' } // host only
  | { t: 'end' } // host only: back to the lobby
  | { t: 'in'; i: PlayerInput }; // my controls, sent every tick

export type ServerMsg =
  | { t: 'lobby'; code: string; n: number; you: number; host: boolean } // who is in the room (sent to everyone whenever it changes)
  | { t: 'start'; seed: number; count: number; you: number } // the fight begins: build a matching Mirror, you are fighter `you`
  | { t: 'snap'; s: Snapshot }
  | { t: 'over'; why: string } // the fight ended (not enough players left, or the host ended it): back to the lobby
  | { t: 'error'; why: string };

export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;

const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);

/** Never trust a client: turn whatever arrived into a valid PlayerInput (junk numbers become 0, junk flags become false). */
export function cleanInput(raw: unknown): PlayerInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    moveX: num(r.moveX, -1, 1), aim: num(r.aim, -10, 10),
    jump: r.jump === true, attack: r.attack === true, crouch: r.crouch === true, drop: r.drop === true, dodge: r.dodge === true, flip: r.flip === true,
  };
}

// The only way player intent enters the simulation: one struct per player per frame.
export interface PlayerInput {
  moveX: number; // -1..1
  jump: boolean;
  aim: number; // world-space angle in radians (0 = right, +pi/2 = down)
  attack: boolean; // left-click. Unarmed: a punch. With a club: hold to charge, release to lunge
  dodge: boolean; // press: slip into the background plane for a moment (long cooldown)
}

export const NEUTRAL: PlayerInput = { moveX: 0, jump: false, aim: 0, attack: false, dodge: false };

export type EventType = 'hit' | 'jump' | 'punch' | 'dodge' | 'die' | 'fall';

// Sim -> render/audio messages. Cleared at the start of every sim step.
export interface SimEvent {
  t: EventType;
  x: number;
  y: number;
  v: number; // impact value for 'hit'
  owner: number; // who caused it (attacker / the one who jumped / died)
  victim: number;
  head?: boolean; // a 'hit' that landed on the head
}

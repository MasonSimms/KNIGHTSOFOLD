// The only way player intent enters the simulation: one struct per player per frame.
export interface PlayerInput {
  moveX: number; // -1..1
  jump: boolean;
  aim: number; // world-space angle in radians (0 = right, +pi/2 = down)
  attack: boolean; // hold (left-click): charge momentum into the weapon; release: lunge along the aim
  throw: boolean; // press (right-click): cock the arm back and throw the held weapon along the aim
  grab: boolean; // drop / pick up the held weapon
}

export const NEUTRAL: PlayerInput = { moveX: 0, jump: false, aim: 0, attack: false, throw: false, grab: false };

export type EventType = 'hit' | 'jump' | 'grab' | 'drop' | 'throw' | 'die' | 'fall';

// Sim -> render/audio messages. Cleared at the start of every sim step.
export interface SimEvent {
  t: EventType;
  x: number;
  y: number;
  v: number; // impact value for 'hit'
  owner: number; // who caused it (attacker / the one who jumped / died)
  victim: number;
}

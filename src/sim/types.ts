// The only way player intent enters the simulation: one struct per player per frame.
export interface PlayerInput {
  moveX: number; // -1..1
  jump: boolean;
  aim: number; // world-space angle in radians (0 = right, +pi/2 = down)
  attack: boolean; // left-click. Unarmed: tap = punch, hold = grab (let go to fling). With a club: hold to charge, release to lunge
  crouch: boolean; // S / down: crouch (lower to the ground: higher jump, more swing momentum, ducks under swings)
  drop: boolean; // right-click: let go of the weapon (it keeps the speed of your swing, plus a small push)
  dodge: boolean; // press: slip into the background plane for a moment (long cooldown)
  reach?: number; // how far the cursor is from the fighter (m): a gun shoots from its muzzle to exactly that point (none = along the aim: a stick)
}

export const NEUTRAL: PlayerInput = { moveX: 0, jump: false, aim: 0, attack: false, crouch: false, drop: false, dodge: false };

export type EventType = 'hit' | 'jump' | 'punch' | 'dodge' | 'drop' | 'throw' | 'pickup' | 'disarm' | 'grab' | 'stomp' | 'parry' | 'respawn' | 'newround' | 'gone' | 'back' | 'explode' | 'crush' | 'dismember' | 'cut' | 'spawn' | 'crash' | 'round' | 'match' | 'die' | 'fall' | 'shot' | 'empty' | 'spark' | 'splinter' | 'impact' | 'snap' | 'break' | 'exit' | 'splash' | 'ignite' | 'trample' | 'whistle' | 'shatter' | 'leak' | 'boom' | 'thunk';

// Sim -> render/audio messages. Cleared at the start of every sim step.
export interface SimEvent {
  t: EventType;
  x: number;
  y: number;
  v: number; // impact value for 'hit'
  owner: number; // who caused it (attacker / the one who jumped / died)
  victim: number;
  head?: boolean; // a 'hit' that landed on the head
  how?: string; // a 'hit': what did it (club, fist, slam, stomp, body)
  w?: string; // a club 'hit': which weapon (an id from weapons.ts or props.ts)
  d?: number; // a 'hit': the hidden damage it did
}

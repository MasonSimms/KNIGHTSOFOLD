// Weapons. Pure data: a weapon is a row here plus (later) its art. Every era has one. They are all the long-melee "club" type for now:
// each differs in reach, weight and bite so the eras already play differently. (PLACEHOLDER names and numbers until the real weapons are designed.)
export interface Weapon {
  id: string;
  name: string;
  length: number; // metres
  thickness: number;
  mass: number; // kg
  gripFromEnd: number; // where the hand holds it, measured from the end
  impactFactor: number; // this weapon's damage factor: impact = hit speed (m/s) x this
  material?: Material; // what a bullet does to it in your hand (default wood)
  toughness?: number; // wood: how much shooting it takes before it snaps in two (bullet calibres added up)
  gun?: GunSpec; // it shoots (sim/guns.ts)
  push?: number; // its hits shove this many times harder (a shield bash)
  pull?: boolean; // its hits pull the victim toward you instead of knocking them away (the gravity hammer)
  spear?: boolean; // thrown, it flies point-first, hits harder (tuning.special.spearThrown) and sticks into the ground and walls (sim/special.ts)
  fuse?: number; // a grenade: seconds from leaving a hand to going off (sim/special.ts)
  hook?: boolean; // a grappling hook: a click throws the hook on a rope (sim/hook.ts)
  net?: boolean; // a net: a click throws it, and it tangles the first fighter it touches (sim/tangle.ts)
  lasso?: boolean; // ...a lasso: thrown the same way, but it only takes people and loose things (it passes the scenery by) and holds them longer
  edge?: 'blade'; // a blade (owner, 2026-10-07): it cuts, so it hurts from less speed and more, and shoves less (tuning.combat.blade); no edge = blunt (shoves more)
  point?: boolean; // it has a point: a hit with its last bit (tuning.combat.pointZone of its length) hurts more (tuning.combat.pointMul)
  thrust?: boolean; // a spear, a lance: charged, it draws back level along the aim and drives forward (sim/fighter.ts), instead of rising over the head
  lunge?: number; // a thrust weapon's lunge is this many times the usual (the lance: only good in a lunge)
}

/** A chain weapon (props.ts chain): a head of this weight and radius on a chain this long from the handle's far end (sim/fighter.ts addHead). */
export interface ChainSpec { length: number; r: number; mass: number }

/**
 * What a weapon is made of decides what a bullet does to it in your hand (owner): metal blocks it with a spark; wood (and bone) blocks it
 * but cracks, and snaps in two after enough shooting; light things (knives, fans, bamboo) are knocked out of your hand. 'shield' (later
 * eras) sends the bullet back the way it came: it can then hit anyone, the shooter too.
 */
export type Material = 'metal' | 'wood' | 'light' | 'shield' | 'stone';

/**
 * A gun (owner): one click is one shot; limited ammo, no reloading; the ammo belongs to the gun. Empty, it is turned round and held by the
 * barrel as a club. Bigger guns kick the shooter harder and shove what they hit harder. (PLACEHOLDER numbers until the playtest.)
 */
export interface GunSpec {
  ammo: number; // shots in a full gun
  cooldown: number; // frames between shots
  speed: number; // how fast the bullet flies (m/s): it can be seen, and dodged
  calibre: number; // how big the bullet is: what it does to wooden weapons and scenery (more = fewer shots to break them)
  impact: number; // its hit, on the same scale as a club's (a fully charged club hit is about 45; damage = combat.ts damageFor)
  push: number; // how hard it shoves what it hits (N s)
  recoil: number; // how hard it kicks the gun and arm back (N s)
  kick: number; // how hard it pushes the shooter's whole body back (N s)
  pellets?: number; // a scattergun: this many shots at once from one pull of the trigger (it uses one shot of ammo), in a cone...
  spread?: number; // ...each up to this far either side of the aim (radians)...
  fixedFan?: boolean; // ...or fanned out evenly across it (the duck-foot pistol's splayed barrels)
  hold?: boolean; // keeps firing (every `cooldown` frames) while the button is held
  burst?: number; // one pull fires this many shots, `burstGap` frames apart
  burstGap?: number;
  spreadPerShot?: number; // each shot in a row wanders up to this much more off the aim (radians; from the start again when you let go)
  gravity?: number; // the shot falls (1 = like everything else: a lob) or, below 0, floats up
  thrust?: number; // the shot speeds up as it flies (m/s each second: a rocket)
  bounces?: number; // it bounces off the ground and walls this many times (a falling shot loses speed each bounce: tuning.guns.bounceKeep)
  blast?: { radius: number; push: number; impact: number; fuse: number }; // it goes off where it stops, or after `fuse` frames in the air (0: only where it stops): world.ts blast
  selfBlast?: boolean; // ...and its blast can hurt the one who fired it (it always pushes them: a rocket jump)
  ignites?: boolean; // it sets alight what it hits: a fighter, or wood (sim/fire.ts)
  charge?: number; // hold the button this many frames and it fires itself (let go sooner: no shot)
  pierce?: boolean; // the shot goes through walls and everything, hitting every fighter on its line once
  aimLine?: boolean; // (picture only) a thin line along the barrel while the gun is held still
  zone?: { after: number; frames: number; radius: number; strength: number; pop: number }; // the shot stops after `after` frames (or where it hits) and pulls everything within `radius` toward it (m/s², less in its very middle) for `frames`, then pops them outward (m/s): sim/effects.ts
  beam?: { range: number; reel: number; fling: number; hold: number }; // a tractor beam: hold the button to catch a fighter or loose thing up to `range` away and reel it in (m/s); let go (or after `hold` frames) and it is flung along your aim (m/s). One catch uses one shot (sim/hook.ts)
  effect?: { kind: 'swap' | 'freeze' | 'bubble'; frames?: number; rise?: number }; // what the shot does to what it stops in (sim/effects.ts): swap places; an ice block for `frames`; a bubble rising at `rise` m/s for `frames`
  look?: { color: number; orb?: number }; // how its shots look (picture only): their colour, and a glowing ball this wide (m) instead of a streak
}

export const weapons: Weapon[] = [
  { id: 'bone-club', name: 'Bone Club', length: 1.05, thickness: 0.14, mass: 1.7, gripFromEnd: 0.15, impactFactor: 2.5, material: 'wood', toughness: 4 },
  { id: 'katana', name: 'Katana', length: 1.25, thickness: 0.08, mass: 0.9, gripFromEnd: 0.15, impactFactor: 2.4, material: 'metal', edge: 'blade', point: true },
  { id: 'rifle', name: 'Rifle (as a club)', length: 1.15, thickness: 0.08, mass: 1.4, gripFromEnd: 0.15, impactFactor: 2.2, material: 'wood', toughness: 4 },
  { id: 'shovel', name: 'Trench Shovel', length: 1.05, thickness: 0.09, mass: 1.5, gripFromEnd: 0.15, impactFactor: 2.3, material: 'metal' },
  { id: 'machete', name: 'Machete', length: 1.05, thickness: 0.08, mass: 0.8, gripFromEnd: 0.15, impactFactor: 2.2, material: 'metal', edge: 'blade' },
  { id: 'baton', name: 'Riot Baton', length: 1.05, thickness: 0.08, mass: 0.9, gripFromEnd: 0.15, impactFactor: 2.1, material: 'wood', toughness: 3 },
  { id: 'energy-staff', name: 'Energy Staff', length: 1.4, thickness: 0.08, mass: 0.8, gripFromEnd: 0.15, impactFactor: 2.3, material: 'metal' },
  { id: 'longbow', name: 'Longbow (as a staff)', length: 1.3, thickness: 0.08, mass: 0.7, gripFromEnd: 0.15, impactFactor: 2.1, material: 'wood', toughness: 2 },
  { id: 'bat', name: 'Baseball Bat', length: 1.05, thickness: 0.1, mass: 1.1, gripFromEnd: 0.15, impactFactor: 2.3, material: 'wood', toughness: 3 },
  { id: 'khopesh', name: 'Khopesh', length: 1.05, thickness: 0.08, mass: 1.0, gripFromEnd: 0.15, impactFactor: 2.4, material: 'metal', edge: 'blade' },
  { id: 'gladius', name: 'Gladius', length: 1.05, thickness: 0.08, mass: 0.8, gripFromEnd: 0.15, impactFactor: 2.2, material: 'metal', edge: 'blade', point: true },
  { id: 'axe', name: 'Battle Axe', length: 1.05, thickness: 0.1, mass: 1.6, gripFromEnd: 0.15, impactFactor: 2.6, material: 'metal', edge: 'blade' },
  { id: 'longsword', name: 'Longsword', length: 1.2, thickness: 0.08, mass: 1.1, gripFromEnd: 0.15, impactFactor: 2.4, material: 'metal', edge: 'blade', point: true },
  { id: 'cutlass', name: 'Cutlass', length: 1.05, thickness: 0.08, mass: 0.9, gripFromEnd: 0.15, impactFactor: 2.3, material: 'metal', edge: 'blade', point: true },
  { id: 'stone-axe', name: 'Stone Axe', length: 1.0, thickness: 0.13, mass: 1.9, gripFromEnd: 0.15, impactFactor: 2.6, material: 'stone' }, // (a map's own weapon: Standing Stones)
];

export const weaponById = (id: string): Weapon => weapons.find((w) => w.id === id) ?? weapons[0];

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
}

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
}

export const weapons: Weapon[] = [
  { id: 'bone-club', name: 'Bone Club', length: 1.05, thickness: 0.14, mass: 1.7, gripFromEnd: 0.15, impactFactor: 2.5, material: 'wood', toughness: 4 },
  { id: 'katana', name: 'Katana', length: 1.25, thickness: 0.08, mass: 0.9, gripFromEnd: 0.15, impactFactor: 2.4, material: 'metal' },
  { id: 'rifle', name: 'Rifle (as a club)', length: 1.15, thickness: 0.08, mass: 1.4, gripFromEnd: 0.15, impactFactor: 2.2, material: 'wood', toughness: 4 },
  { id: 'shovel', name: 'Trench Shovel', length: 1.05, thickness: 0.09, mass: 1.5, gripFromEnd: 0.15, impactFactor: 2.3, material: 'metal' },
  { id: 'machete', name: 'Machete', length: 1.05, thickness: 0.08, mass: 0.8, gripFromEnd: 0.15, impactFactor: 2.2, material: 'metal' },
  { id: 'baton', name: 'Riot Baton', length: 1.05, thickness: 0.08, mass: 0.9, gripFromEnd: 0.15, impactFactor: 2.1, material: 'wood', toughness: 3 },
  { id: 'energy-staff', name: 'Energy Staff', length: 1.4, thickness: 0.08, mass: 0.8, gripFromEnd: 0.15, impactFactor: 2.3, material: 'metal' },
  { id: 'longbow', name: 'Longbow (as a staff)', length: 1.3, thickness: 0.08, mass: 0.7, gripFromEnd: 0.15, impactFactor: 2.1, material: 'wood', toughness: 2 },
  { id: 'bat', name: 'Baseball Bat', length: 1.05, thickness: 0.1, mass: 1.1, gripFromEnd: 0.15, impactFactor: 2.3, material: 'wood', toughness: 3 },
  { id: 'khopesh', name: 'Khopesh', length: 1.05, thickness: 0.08, mass: 1.0, gripFromEnd: 0.15, impactFactor: 2.4, material: 'metal' },
  { id: 'gladius', name: 'Gladius', length: 1.05, thickness: 0.08, mass: 0.8, gripFromEnd: 0.15, impactFactor: 2.2, material: 'metal' },
  { id: 'axe', name: 'Battle Axe', length: 1.05, thickness: 0.1, mass: 1.6, gripFromEnd: 0.15, impactFactor: 2.6, material: 'metal' },
  { id: 'longsword', name: 'Longsword', length: 1.2, thickness: 0.08, mass: 1.1, gripFromEnd: 0.15, impactFactor: 2.4, material: 'metal' },
  { id: 'cutlass', name: 'Cutlass', length: 1.05, thickness: 0.08, mass: 0.9, gripFromEnd: 0.15, impactFactor: 2.3, material: 'metal' },
  { id: 'stone-axe', name: 'Stone Axe', length: 1.0, thickness: 0.13, mass: 1.9, gripFromEnd: 0.15, impactFactor: 2.6, material: 'stone' }, // (a map's own weapon: Standing Stones)
];

export const weaponById = (id: string): Weapon => weapons.find((w) => w.id === id) ?? weapons[0];

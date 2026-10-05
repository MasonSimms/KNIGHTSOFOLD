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
}

export const weapons: Weapon[] = [
  { id: 'bone-club', name: 'Bone Club', length: 0.9, thickness: 0.14, mass: 1.7, gripFromEnd: 0.22, impactFactor: 2.5 },
  { id: 'katana', name: 'Katana', length: 1.25, thickness: 0.05, mass: 0.9, gripFromEnd: 0.24, impactFactor: 2.4 },
  { id: 'rifle', name: 'Rifle (as a club)', length: 1.15, thickness: 0.07, mass: 1.4, gripFromEnd: 0.28, impactFactor: 2.2 },
  { id: 'shovel', name: 'Trench Shovel', length: 0.95, thickness: 0.09, mass: 1.5, gripFromEnd: 0.2, impactFactor: 2.3 },
  { id: 'machete', name: 'Machete', length: 0.8, thickness: 0.06, mass: 0.8, gripFromEnd: 0.2, impactFactor: 2.2 },
  { id: 'baton', name: 'Riot Baton', length: 0.85, thickness: 0.07, mass: 0.9, gripFromEnd: 0.2, impactFactor: 2.1 },
  { id: 'energy-staff', name: 'Energy Staff', length: 1.4, thickness: 0.08, mass: 0.8, gripFromEnd: 0.3, impactFactor: 2.3 },
  { id: 'longbow', name: 'Longbow (as a staff)', length: 1.3, thickness: 0.05, mass: 0.7, gripFromEnd: 0.3, impactFactor: 2.1 },
  { id: 'bat', name: 'Baseball Bat', length: 1.0, thickness: 0.1, mass: 1.1, gripFromEnd: 0.22, impactFactor: 2.3 },
  { id: 'khopesh', name: 'Khopesh', length: 1.0, thickness: 0.06, mass: 1.0, gripFromEnd: 0.22, impactFactor: 2.4 },
  { id: 'gladius', name: 'Gladius', length: 0.75, thickness: 0.06, mass: 0.8, gripFromEnd: 0.18, impactFactor: 2.2 },
  { id: 'axe', name: 'Battle Axe', length: 0.9, thickness: 0.1, mass: 1.6, gripFromEnd: 0.2, impactFactor: 2.6 },
  { id: 'longsword', name: 'Longsword', length: 1.2, thickness: 0.06, mass: 1.1, gripFromEnd: 0.25, impactFactor: 2.4 },
  { id: 'cutlass', name: 'Cutlass', length: 0.9, thickness: 0.06, mass: 0.9, gripFromEnd: 0.2, impactFactor: 2.3 },
];

export const weaponById = (id: string): Weapon => weapons.find((w) => w.id === id) ?? weapons[0];

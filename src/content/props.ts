import { weapons } from './weapons';

// Loose objects that can lie around an arena (placeholder sizes). Anything in the world is a physics body: players can pick it up and use it as a club.
// `factor` is the damage factor when held (default tuning.props.factor). The era pickups (listed per era in eras.ts, weakest first) are the better
// weapons that spawn in as a round goes on: heavier or longer, hitting harder.
export interface PropSpec { len: number; thick: number; mass: number; factor?: number }
export const PROPS: Record<string, PropSpec> = {
  plank: { len: 0.9, thick: 0.12, mass: 1.0 },
  log: { len: 1.2, thick: 0.2, mass: 2.5 },
  bone: { len: 0.7, thick: 0.1, mass: 0.5 },
  // era pickups (PLACEHOLDER numbers, all to be tuned by playtest)
  'stone-hammer': { len: 0.8, thick: 0.2, mass: 3.0, factor: 2.9 }, tusk: { len: 1.3, thick: 0.1, mass: 1.2, factor: 2.4 },
  sceptre: { len: 1.3, thick: 0.07, mass: 0.9, factor: 2.3 }, flail: { len: 0.9, thick: 0.15, mass: 2.2, factor: 2.8 },
  trident: { len: 1.5, thick: 0.06, mass: 1.1, factor: 2.4 }, 'chain-mace': { len: 0.9, thick: 0.16, mass: 2.4, factor: 2.8 },
  spear: { len: 1.5, thick: 0.05, mass: 1.0, factor: 2.4 }, 'great-axe': { len: 1.1, thick: 0.12, mass: 2.4, factor: 3.0 },
  mace: { len: 0.8, thick: 0.15, mass: 2.0, factor: 2.9 }, lance: { len: 1.9, thick: 0.08, mass: 1.6, factor: 2.7 },
  naginata: { len: 1.6, thick: 0.05, mass: 1.0, factor: 2.4 }, 'iron-fan': { len: 0.5, thick: 0.08, mass: 0.7, factor: 2.6 },
  pistol: { len: 0.4, thick: 0.08, mass: 0.9, factor: 2.4 }, 'boat-hook': { len: 1.3, thick: 0.06, mass: 1.3, factor: 2.7 },
  revolver: { len: 0.4, thick: 0.08, mass: 1.0, factor: 2.4 }, pickaxe: { len: 1.0, thick: 0.1, mass: 2.0, factor: 2.9 },
  'bayonet-rifle': { len: 1.6, thick: 0.07, mass: 1.5, factor: 2.6 }, grenade: { len: 0.3, thick: 0.1, mass: 1.2, factor: 2.8 },
  'bamboo-stick': { len: 1.4, thick: 0.05, mass: 0.5, factor: 2.2 }, 'bayonet-knife': { len: 0.4, thick: 0.05, mass: 0.5, factor: 2.8 },
  'combat-knife': { len: 0.4, thick: 0.05, mass: 0.5, factor: 2.8 }, 'riot-shield': { len: 1.0, thick: 0.12, mass: 2.5, factor: 2.6 },
  'plasma-blade': { len: 0.7, thick: 0.05, mass: 0.6, factor: 3.2 }, 'gravity-hammer': { len: 1.0, thick: 0.2, mass: 2.8, factor: 3.0 },
  'wizard-staff': { len: 1.5, thick: 0.06, mass: 0.8, factor: 2.4 }, 'war-hammer': { len: 1.0, thick: 0.14, mass: 2.4, factor: 3.0 },
  crowbar: { len: 0.8, thick: 0.05, mass: 1.2, factor: 2.5 }, 'lead-pipe': { len: 1.0, thick: 0.07, mass: 2.0, factor: 2.9 },
};
export const PROP_KINDS = Object.keys(PROPS); // a 'spawn' event names its prop by position in this list

/** Everything that can be dropped in from the training menu: every era's weapon, then the pickups and the loose objects. */
export const ITEMS: { id: string; name: string; spec: PropSpec }[] = [
  ...weapons.map((w) => ({ id: w.id, name: w.name, spec: { len: w.length, thick: w.thickness, mass: w.mass, factor: w.impactFactor } })),
  ...PROP_KINDS.map((id) => ({ id, name: id.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join(' '), spec: PROPS[id] })),
];

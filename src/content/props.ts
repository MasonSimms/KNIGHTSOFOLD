import { weapons } from './weapons';
import type { GunSpec, Material } from './weapons';

// Loose objects that can lie around an arena (placeholder sizes). Anything in the world is a physics body: players can pick it up and use it as a club.
// `factor` is the damage factor when held (default tuning.props.factor). The era pickups (listed per era in eras.ts, weakest first) are the better
// weapons that spawn in as a round goes on: heavier or longer, hitting harder.
/** breaks: scenery that breaks (owner: environments have destructible elements): how much it takes (bullets by calibre x 10, hard hits by
 *  impact) and the loose pieces it leaves (kinds in this list). */
export interface PropSpec { len: number; thick: number; mass: number; factor?: number; material?: Material; toughness?: number; gun?: GunSpec; breaks?: { hp: number; into: string[]; min?: number }; box?: boolean; back?: boolean; fixed?: boolean }

/** The guns (owner: the revolver and the flintlock first). PLACEHOLDER numbers until the playtest. */
const REVOLVER: GunSpec = { ammo: 6, cooldown: 14, speed: 70, calibre: 1, impact: 31, push: 9, recoil: 2.5, kick: 6 }; // 6 quick shots, each about half a full club hit
const FLINTLOCK: GunSpec = { ammo: 1, cooldown: 40, speed: 60, calibre: 2, impact: 44, push: 30, recoil: 6, kick: 32 }; // one big shot: a full club hit and a real shove
export const PROPS: Record<string, PropSpec> = {
  plank: { len: 0.9, thick: 0.12, mass: 1.0, toughness: 3 },
  log: { len: 1.2, thick: 0.2, mass: 2.5, toughness: 6 },
  bone: { len: 0.7, thick: 0.1, mass: 0.5, toughness: 2 },
  // breakable scenery: it splits into loose pieces when shot or hit hard enough
  barrel: { len: 0.7, thick: 0.5, mass: 6, factor: 2.6, breaks: { hp: 60, into: ['stave', 'stave', 'stave'] } },
  crate: { len: 0.6, thick: 0.55, mass: 5, factor: 2.6, breaks: { hp: 45, into: ['plank', 'plank', 'stave'] }, box: true },
  stave: { len: 0.6, thick: 0.08, mass: 0.5, toughness: 2 }, // a barrel stave or crate slat: a little club
  // era pickups (PLACEHOLDER numbers, all to be tuned by playtest)
  'stone-hammer': { len: 0.8, thick: 0.2, mass: 3.0, factor: 2.9 }, tusk: { len: 1.3, thick: 0.1, mass: 1.2, factor: 2.4 },
  sceptre: { len: 1.3, thick: 0.07, mass: 0.9, factor: 2.3 }, flail: { len: 0.9, thick: 0.15, mass: 2.2, factor: 2.8 },
  trident: { len: 1.5, thick: 0.06, mass: 1.1, factor: 2.4 }, 'chain-mace': { len: 0.9, thick: 0.16, mass: 2.4, factor: 2.8 },
  spear: { len: 1.5, thick: 0.05, mass: 1.0, factor: 2.4 }, 'great-axe': { len: 1.1, thick: 0.12, mass: 2.4, factor: 3.0 },
  mace: { len: 0.8, thick: 0.15, mass: 2.0, factor: 2.9 }, lance: { len: 1.9, thick: 0.08, mass: 1.6, factor: 2.7 },
  naginata: { len: 1.6, thick: 0.05, mass: 1.0, factor: 2.4 }, 'iron-fan': { len: 0.5, thick: 0.08, mass: 0.7, factor: 2.6 },
  pistol: { len: 0.45, thick: 0.08, mass: 0.9, factor: 2.4, material: 'metal', gun: FLINTLOCK }, 'boat-hook': { len: 1.3, thick: 0.06, mass: 1.3, factor: 2.7 },
  revolver: { len: 0.4, thick: 0.08, mass: 1.0, factor: 2.4, material: 'metal', gun: REVOLVER }, pickaxe: { len: 1.0, thick: 0.1, mass: 2.0, factor: 2.9 },
  'bayonet-rifle': { len: 1.6, thick: 0.07, mass: 1.5, factor: 2.6 }, grenade: { len: 0.3, thick: 0.1, mass: 1.2, factor: 2.8 },
  'bamboo-stick': { len: 1.4, thick: 0.05, mass: 0.5, factor: 2.2 }, 'bayonet-knife': { len: 0.4, thick: 0.05, mass: 0.5, factor: 2.8 },
  'combat-knife': { len: 0.4, thick: 0.05, mass: 0.5, factor: 2.8 }, 'riot-shield': { len: 1.0, thick: 0.12, mass: 2.5, factor: 2.6 },
  'plasma-blade': { len: 0.7, thick: 0.05, mass: 0.6, factor: 3.2 }, 'gravity-hammer': { len: 1.0, thick: 0.2, mass: 2.8, factor: 3.0 },
  'wizard-staff': { len: 1.5, thick: 0.06, mass: 0.8, factor: 2.4 }, 'war-hammer': { len: 1.0, thick: 0.14, mass: 2.4, factor: 3.0 },
  crowbar: { len: 0.8, thick: 0.05, mass: 1.2, factor: 2.5 }, 'lead-pipe': { len: 1.0, thick: 0.07, mass: 2.0, factor: 2.9 },
  // heavy stone blocks (len = width, thick = height): too heavy to lift (tuning.props.maxLift). Knocked off something, they crush whoever
  // they land on; lying about, they are cover. PLACEHOLDER sizes until the Standing Stones playtest.
  upright: { len: 0.6, thick: 1.6, mass: 60, material: 'stone', box: true, back: true }, // a standing stone: a step behind the fighters (it holds up a capstone; you walk in front of it)
  capstone: { len: 3.0, thick: 0.45, mass: 30, material: 'stone', box: true }, // laid across two uprights: a body slammed into it (about 200 N s) brings it down
  boulder: { len: 0.7, thick: 0.6, mass: 40, material: 'stone', box: true },
  // a shop window (Main Street): a pane of glass held in its frame (it does not fall), that a body thrown into it, a punch, a club or a
  // bullet breaks (min: the smallest knock that counts); you go on through into the shop
  pane: { len: 0.2, thick: 1.6, mass: 1, material: 'light', box: true, fixed: true, breaks: { hp: 8, into: [], min: 8 } },
};
// What each pickup is made of (what a bullet does to it in your hand). Anything not listed is wood.
for (const id of ['stone-hammer', 'sceptre', 'flail', 'trident', 'chain-mace', 'great-axe', 'mace', 'iron-fan', 'pickaxe', 'grenade', 'plasma-blade', 'gravity-hammer', 'war-hammer', 'crowbar', 'lead-pipe', 'riot-shield']) PROPS[id].material = 'metal';
for (const id of ['bamboo-stick', 'bayonet-knife', 'combat-knife']) PROPS[id].material = 'light';

export const PROP_KINDS = Object.keys(PROPS); // a 'spawn' event names its prop by position in this list

/** Everything that can be dropped in from the training menu: every era's weapon, then the pickups and the loose objects. */
export const ITEMS: { id: string; name: string; spec: PropSpec }[] = [
  ...weapons.map((w) => ({ id: w.id, name: w.name, spec: { len: w.length, thick: w.thickness, mass: w.mass, factor: w.impactFactor, material: w.material, toughness: w.toughness } })),
  ...PROP_KINDS.map((id) => ({ id, name: id.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join(' '), spec: PROPS[id] })),
];

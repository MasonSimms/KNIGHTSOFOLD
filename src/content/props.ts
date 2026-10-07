import { weapons } from './weapons';
import type { ChainSpec, GunSpec, Material } from './weapons';

// Loose objects that can lie around an arena (placeholder sizes). Anything in the world is a physics body: players can pick it up and use it as a club.
// `factor` is the damage factor when held (default tuning.props.factor). The era pickups (listed per era in eras.ts, weakest first) are the better
// weapons that spawn in as a round goes on: heavier or longer, hitting harder.
/** breaks: scenery that breaks (owner: environments have destructible elements): how much it takes (bullets by calibre x 10, hard hits by
 *  impact) and the loose pieces it leaves (kinds in this list). */
export interface PropSpec { len: number; thick: number; mass: number; factor?: number; material?: Material; toughness?: number; gun?: GunSpec; breaks?: { hp: number; into: string[]; min?: number }; box?: boolean; back?: boolean; fixed?: boolean; shatters?: boolean; hangs?: number; push?: number; pull?: boolean; spear?: boolean; fuse?: number; grip?: number; hook?: boolean; lasso?: boolean; net?: boolean; chain?: ChainSpec } // chain: a head on a chain (sim/fighter.ts addHead); hook: a grappling hook (sim/hook.ts); grip: where the hand holds it, as a share of its length from the back end (the ring on art-guide/visuals/weapons.png)

/** The guns (owner: the revolver and the flintlock first). PLACEHOLDER numbers until the playtest. */
const REVOLVER: GunSpec = { ammo: 6, cooldown: 14, speed: 70, calibre: 1, impact: 31, push: 9, recoil: 2.5, kick: 6 }; // 6 quick shots, each about half a full club hit
const FLINTLOCK: GunSpec = { ammo: 1, cooldown: 40, speed: 60, calibre: 2, impact: 44, push: 30, recoil: 6, kick: 32 }; // one big shot: a full club hit and a real shove
// The Gun Locker (GUNS_HANDOFF.md; the owner places them in eras later). Pellets: impact and push are each pellet's. Impacts are on the
// damage curve (combat.ts: nothing under 10, then growing faster): a pellet at 22 is about 12 damage, all 6 of a blunderbuss about 75.
const GUN_LOCKER: Record<string, PropSpec> = {
  blunderbuss: { len: 0.95, thick: 0.1, mass: 2.2, factor: 2.3, material: 'wood', toughness: 4, grip: 0.29, gun: { ammo: 2, cooldown: 40, speed: 38, calibre: 1, impact: 22, push: 2.2, recoil: 9, kick: 22, pellets: 6, spread: 0.32 } }, // a fan of 6 pellets, a big kick
  duckfoot: { len: 0.6, thick: 0.07, mass: 1.1, factor: 1.8, material: 'metal', grip: 0.17, gun: { ammo: 1, cooldown: 0, speed: 42, calibre: 1, impact: 24, push: 2.5, recoil: 6, kick: 10, pellets: 4, spread: 0.42, fixedFan: true } }, // 4 splayed barrels at once
  'coach-gun': { len: 0.95, thick: 0.09, mass: 2.0, factor: 2.2, material: 'wood', toughness: 4, grip: 0.34, gun: { ammo: 2, cooldown: 30, speed: 45, calibre: 1, impact: 22, push: 2.6, recoil: 8, kick: 16, pellets: 5, spread: 0.18 } }, // a tight cone, twice
  derringer: { len: 0.3, thick: 0.06, mass: 0.35, factor: 1.4, material: 'light', grip: 0.27, gun: { ammo: 2, cooldown: 20, speed: 55, calibre: 1, impact: 24, push: 1.2, recoil: 2, kick: 2 } }, // tiny, light, a small push
  'buffalo-rifle': { len: 1.4, thick: 0.07, mass: 2.4, factor: 2.3, material: 'wood', toughness: 5, grip: 0.2, gun: { ammo: 1, cooldown: 0, speed: 120, calibre: 4, impact: 40, push: 9, recoil: 16, kick: 30 } }, // one huge, very fast shot; the kick spins you
  'trench-gun': { len: 1.1, thick: 0.08, mass: 2.1, factor: 2.6, material: 'metal', grip: 0.27, gun: { ammo: 5, cooldown: 34, speed: 46, calibre: 1, impact: 21, push: 2.3, recoil: 8, kick: 14, pellets: 5, spread: 0.22 } }, // a pump shotgun
  beanbag: { len: 1.05, thick: 0.08, mass: 2.0, factor: 1.8, material: 'wood', toughness: 4, grip: 0.29, gun: { ammo: 4, cooldown: 34, speed: 40, calibre: 1, impact: 2, push: 24, recoil: 6, kick: 10, look: { color: 0xc9a46a, orb: 0.09 } } }, // a big shove, almost no hurt
  'lewis-gun': { len: 1.3, thick: 0.12, mass: 4.0, factor: 2.6, material: 'metal', grip: 0.18, gun: { ammo: 30, cooldown: 5, speed: 70, calibre: 2, impact: 17, push: 1.4, recoil: 3, kick: 4.5, hold: true, spreadPerShot: 0.015 } }, // hold to fire; every shot shoves you back
  'jungle-carbine': { len: 1.0, thick: 0.08, mass: 2.2, factor: 2.1, material: 'metal', grip: 0.3, gun: { ammo: 18, cooldown: 26, speed: 75, calibre: 2, impact: 18, push: 1.6, recoil: 4, kick: 5, burst: 3, burstGap: 4, spreadPerShot: 0.05 } }, // 3-shot bursts
  smg: { len: 0.65, thick: 0.08, mass: 2.0, factor: 1.8, material: 'metal', grip: 0.28, gun: { ammo: 30, cooldown: 4, speed: 70, calibre: 1, impact: 15, push: 1.0, recoil: 2, kick: 2, hold: true, spreadPerShot: 0.04 } }, // hold to fire, little hits, it wanders
  'flare-pistol': { len: 0.55, thick: 0.1, mass: 0.9, factor: 1.6, material: 'light', grip: 0.22, gun: { ammo: 2, cooldown: 40, speed: 16, calibre: 1, impact: 12, push: 1.5, recoil: 4, kick: 4, gravity: 1, ignites: true, look: { color: 0xff8a2a, orb: 0.06 } } }, // a slow arcing flare: sets a fighter or wood alight
  thumper: { len: 0.75, thick: 0.12, mass: 2.6, factor: 2.0, material: 'wood', toughness: 4, grip: 0.4, gun: { ammo: 3, cooldown: 45, speed: 18, calibre: 2, impact: 12, push: 2, recoil: 10, kick: 12, gravity: 1, bounces: 1, blast: { radius: 2.2, push: 14, impact: 30, fuse: 90 }, look: { color: 0x7a8a52, orb: 0.07 } } }, // a lobbed round: bounces once, then goes off
  'rocket-tube': { len: 1.2, thick: 0.12, mass: 4.5, factor: 2.4, material: 'metal', grip: 0.38, gun: { ammo: 1, cooldown: 0, speed: 14, calibre: 4, impact: 20, push: 4, recoil: 8, kick: 18, thrust: 18, blast: { radius: 2.6, push: 16, impact: 36, fuse: 0 }, selfBlast: true, look: { color: 0xd8402a, orb: 0.07 } } }, // a slow rocket that speeds up; a huge blast (rocket-jump off your own: push 16 lifts you about 3.5 m, 22 about 8.5)
  'ray-pistol': { len: 0.55, thick: 0.1, mass: 0.8, factor: 1.7, material: 'metal', grip: 0.22, gun: { ammo: 6, cooldown: 18, speed: 45, calibre: 1, impact: 22, push: 2, recoil: 3, kick: 3, bounces: 2, look: { color: 0x3de0e8 } } }, // cyan bolts that bounce off walls and the ground twice
  marksman: { len: 1.45, thick: 0.08, mass: 3.4, factor: 2.2, material: 'metal', grip: 0.22, gun: { ammo: 3, cooldown: 60, speed: 160, calibre: 3, impact: 42, push: 6, recoil: 10, kick: 14, aimLine: true } }, // very fast, a huge hit; a thin aim line while you hold still
  'rail-gun': { len: 1.35, thick: 0.12, mass: 3.6, factor: 2.3, material: 'metal', grip: 0.22, gun: { ammo: 2, cooldown: 60, speed: 400, calibre: 6, impact: 45, push: 16, recoil: 14, kick: 26, charge: 36, pierce: true, look: { color: 0x3de0e8 } } }, // hold 0.6 s: it fires through walls and everyone in line
  'freeze-ray': { len: 0.75, thick: 0.1, mass: 1.4, factor: 1.8, material: 'metal', grip: 0.24, gun: { ammo: 3, cooldown: 40, speed: 30, calibre: 0, impact: 0, push: 1, recoil: 2, kick: 2, effect: { kind: 'freeze', frames: 120 }, look: { color: 0xbff4ff, orb: 0.06 } } }, // the one hit is an ice block for 2 s: shove it off the stage
  'swap-pistol': { len: 0.55, thick: 0.1, mass: 0.8, factor: 1.6, material: 'metal', grip: 0.22, gun: { ammo: 3, cooldown: 40, speed: 50, calibre: 0, impact: 0, push: 0, recoil: 2, kick: 2, effect: { kind: 'swap' }, look: { color: 0x8a5cff } } }, // swap places with whatever you hit
  'bubble-blaster': { len: 0.7, thick: 0.1, mass: 0.9, factor: 1.4, material: 'light', grip: 0.2, gun: { ammo: 4, cooldown: 30, speed: 14, calibre: 0, impact: 0, push: 0.5, recoil: 1, kick: 1, gravity: -0.15, effect: { kind: 'bubble', frames: 240, rise: 1.2 }, look: { color: 0xd8f0ff, orb: 0.1 } } }, // the one hit floats up in a bubble; any hurt pops it
  'black-hole': { len: 1.0, thick: 0.16, mass: 3.0, factor: 2.0, material: 'metal', grip: 0.24, gun: { ammo: 1, cooldown: 0, speed: 6, calibre: 0, impact: 0, push: 0, recoil: 6, kick: 8, zone: { after: 50, frames: 120, radius: 3.5, strength: 30, pop: 12 }, look: { color: 0x8a5cff, orb: 0.14 } } }, // a slow orb that stops and pulls everything in for 2 s, then pops
  'tractor-beam': { len: 0.95, thick: 0.12, mass: 2.0, factor: 1.9, material: 'metal', grip: 0.25, gun: { ammo: 5, cooldown: 20, speed: 0, calibre: 0, impact: 0, push: 0, recoil: 0, kick: 0, beam: { range: 7, reel: 6, fling: 14, hold: 150 } } }, // hold: grab a fighter or loose thing at range and reel it in; let go: fling it
  'plasma-repeater': { len: 1.0, thick: 0.1, mass: 2.2, factor: 2.0, material: 'metal', grip: 0.28, gun: { ammo: 12, cooldown: 14, speed: 12, calibre: 2, impact: 22, push: 14, recoil: 4, kick: 4, look: { color: 0xe04bb0, orb: 0.16 } } }, // slow magenta balls you can dodge; a big shove
};
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
  sceptre: { len: 1.3, thick: 0.07, mass: 0.9, factor: 2.3 }, flail: { len: 0.45, thick: 0.07, mass: 0.6, factor: 2.8, chain: { length: 0.42, r: 0.075, mass: 1.6 } }, // the Golden Flail: a gold star on a chain (its hits: factor x the head's speed)
  trident: { len: 1.5, thick: 0.06, mass: 1.1, factor: 2.4 },
  // shields (owner, batch one): held out in front, they physically block clubs and fists, send bullets back, and a swing is a shove more
  // than a blow. The round shield is a disc at your fist; the riot shield a thin tall board, standing up in front of you as you hold it.
  'round-shield': { len: 0.62, thick: 0.62, mass: 2.4, factor: 1.4, material: 'shield', push: 2.5, grip: 0.5 }, 'chain-mace': { len: 0.42, thick: 0.08, mass: 0.7, factor: 2.8, chain: { length: 0.38, r: 0.085, mass: 1.8 } }, // a spiked iron ball on a chain
  spear: { len: 1.5, thick: 0.05, mass: 1.0, factor: 2.4, spear: true, grip: 0.38 }, 'great-axe': { len: 1.1, thick: 0.12, mass: 2.4, factor: 3.0 }, // (the spear: the Vikings' throwing spear, thrown point-first, and it sticks)
  mace: { len: 0.8, thick: 0.15, mass: 2.0, factor: 2.9 }, lance: { len: 1.9, thick: 0.08, mass: 1.6, factor: 2.7 },
  naginata: { len: 1.6, thick: 0.05, mass: 1.0, factor: 2.4 }, 'iron-fan': { len: 0.5, thick: 0.08, mass: 0.7, factor: 2.6 },
  pistol: { len: 0.45, thick: 0.08, mass: 0.9, factor: 2.4, material: 'metal', gun: FLINTLOCK }, 'boat-hook': { len: 1.3, thick: 0.06, mass: 1.3, factor: 2.7, hook: true, grip: 0.15 }, // (the grappling hook)
  revolver: { len: 0.4, thick: 0.08, mass: 1.0, factor: 2.4, material: 'metal', gun: REVOLVER }, pickaxe: { len: 1.0, thick: 0.1, mass: 2.0, factor: 2.9 },
  'bayonet-rifle': { len: 1.6, thick: 0.07, mass: 1.5, factor: 2.6 }, grenade: { len: 0.6, thick: 0.1, mass: 1.2, factor: 2.8, fuse: 2, grip: 0.12 }, // (the fuse starts when it leaves a hand)
  'bamboo-stick': { len: 1.4, thick: 0.05, mass: 0.5, factor: 2.2 }, 'bayonet-knife': { len: 0.4, thick: 0.05, mass: 0.5, factor: 2.8 },
  'combat-knife': { len: 0.4, thick: 0.05, mass: 0.5, factor: 2.8 }, 'riot-shield': { len: 0.12, thick: 1.0, mass: 3.0, factor: 1.4, material: 'shield', box: true, push: 3, grip: 0.5 },
  'plasma-blade': { len: 0.7, thick: 0.05, mass: 0.6, factor: 3.2 }, 'gravity-hammer': { len: 1.0, thick: 0.2, mass: 2.8, factor: 3.0, pull: true, grip: 0.08 }, // a hit pulls them in
  'wizard-staff': { len: 1.5, thick: 0.06, mass: 0.8, factor: 2.4 }, 'war-hammer': { len: 1.0, thick: 0.14, mass: 2.4, factor: 3.0 },
  crowbar: { len: 0.8, thick: 0.05, mass: 1.2, factor: 2.5 }, 'lead-pipe': { len: 1.0, thick: 0.07, mass: 2.0, factor: 2.9 },
  // heavy stone blocks (len = width, thick = height): too heavy to lift (tuning.props.maxLift). Knocked off something, they crush whoever
  // they land on; lying about, they are cover. PLACEHOLDER sizes until the Standing Stones playtest.
  upright: { len: 0.6, thick: 1.6, mass: 60, material: 'stone', box: true, back: true }, // a standing stone: a step behind the fighters (it holds up a capstone; you walk in front of it)
  capstone: { len: 3.0, thick: 0.45, mass: 30, material: 'stone', box: true }, // laid across two uprights: a body slammed into it (about 200 N s) brings it down
  boulder: { len: 0.7, thick: 0.6, mass: 40, material: 'stone', box: true },
  // a shop window (Main Street): a pane of glass held in its frame (it does not fall), that a body thrown into it, a punch, a club or a
  // bullet breaks (min: the smallest knock that counts); you go on through into the shop
  // the Saloon: a bar stool (a club) and a beer mug (throw it, or smash it on someone: it shatters on anything hard)
  // a hanging lantern (a light: render/light.ts): it swings on its rope when bumped; shot, hit or knocked down it breaks and the light
  // goes out (hangs: the rope's length, m)
  lantern: { len: 0.24, thick: 0.34, mass: 0.8, material: 'light', box: true, breaks: { hp: 5, into: [], min: 6 }, shatters: true, hangs: 0.7 },
  stool: { len: 0.6, thick: 0.3, mass: 2.2, factor: 2.5, toughness: 3 },
  mug: { len: 0.22, thick: 0.16, mass: 0.5, factor: 2.2, material: 'light', shatters: true },
  pane: { len: 0.2, thick: 1.6, mass: 1, material: 'light', box: true, fixed: true, breaks: { hp: 8, into: [], min: 8 } },
  gangplank: { len: 2.6, thick: 0.12, mass: 6, factor: 2.4, toughness: 4 }, // Ship to Ship: laid across from one ship to the other; it falls in when they drift apart
  // (new things go at the end: a 'spawn' event names a prop by its place in this list)
  net: { len: 0.55, thick: 0.18, mass: 0.8, factor: 0.8, material: 'light', net: true, grip: 0.3 }, // the net (weapons batch two, step 5; owner places it later): thrown, it tangles (sim/tangle.ts)
  lasso: { len: 0.5, thick: 0.12, mass: 0.6, factor: 1.2, material: 'light', hook: true, lasso: true, grip: 0.3 }, // the lasso (weapons batch two, step 4; owner places it later): a coil in the hand, thrown like the grappling hook (sim/hook.ts)
  ...GUN_LOCKER,
};
// What each pickup is made of (what a bullet does to it in your hand). Anything not listed is wood.
// (as on the weapon sheet, art-guide/visuals/weapons.png)
for (const id of ['flail', 'trident', 'chain-mace', 'great-axe', 'mace', 'naginata', 'pickaxe', 'grenade', 'bayonet-rifle', 'plasma-blade', 'gravity-hammer', 'war-hammer', 'crowbar', 'lead-pipe']) PROPS[id].material = 'metal';
for (const id of ['bamboo-stick', 'bayonet-knife', 'combat-knife', 'iron-fan']) PROPS[id].material = 'light';
PROPS['stone-hammer'].material = 'stone';

/** Where the hand holds a loose thing picked up as a club, metres from its back end. */
export const gripOf = (s: { len: number; grip?: number }): number => (s.grip !== undefined ? s.grip * s.len : Math.min(0.2, s.len * 0.25));

export const PROP_KINDS = Object.keys(PROPS); // a 'spawn' event names its prop by position in this list

/** Everything that can be dropped in from the training menu: every era's weapon, then the pickups and the loose objects. */
export const ITEMS: { id: string; name: string; spec: PropSpec }[] = [
  ...weapons.map((w) => ({ id: w.id, name: w.name, spec: { len: w.length, thick: w.thickness, mass: w.mass, factor: w.impactFactor, material: w.material, toughness: w.toughness } })),
  ...PROP_KINDS.map((id) => ({ id, name: id.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join(' '), spec: PROPS[id] })),
];

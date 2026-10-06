// The eras. Pure data: adding an era is adding a row here (and, later, its art, outfits and weapons). The colours below are PLACEHOLDERS so
// each era is visibly different in screenshots until the real art arrives. `special` eras turn up at random now and then instead of in the normal rotation.
/** How an era's arena differs from the standard one (any arena setting can be overridden; `ledges` adds floating platforms: x = left end in metres, up = height above the main platform, w = width). */
export interface EraArena {
  name?: string; // what the map is called (menus); the usual arena of an era needs none
  platformX?: number; platformW?: number;
  walls?: { side: -1 | 1; up: number; gap: number }[]; // side walls (see tuning.arena.walls): most maps have none
  ledges?: { x: number; up: number; w: number }[];
  ground?: { x: number; w: number }[]; // separate ground slabs instead of one platform
  bridge?: { x0: number; x1: number; planks: number }; // a breakable plank bridge between the slabs
  props?: { kind: string; x: number; up: number }[]; // loose objects lying around (see props.ts)
  front?: { kind: 'grass' | 'sign'; x: number; y: number; scale?: number; speed?: number }[]; // the front plane (see tuning.arena.front)
  fightSpawnX?: number[]; // where the fighters of a 2-4 player fight start (metres; for maps where the standard spots would be over a gap)
  sea?: { level: number }; // water under the stage (see tuning.arena.sea)
  boat?: boolean; // the platform is a floating ship (see tuning.boat)
}

/** How the whole picture is painted in this era (each one overrides tuning.finish.style): blur = background softness, haze = background fading into the air, grain = canvas weave, tint/tintAlpha = colour wash. */
export interface EraStyle { blur: number; haze: number; grain: number; tint: number; tintAlpha: number }

export interface Era {
  id: string;
  name: string;
  special: boolean;
  pickups?: string[]; // better weapons (props.ts) that spawn in as the round goes on, weakest first
  style?: Partial<EraStyle>; // painting style tweaks for this era
  sky: number; // arena colours (placeholders)
  platform: number;
  wall: number;
  weapon: string; // id in weapons.ts: the weapon everyone fights with in this era
  arena: EraArena; // the era's usual arena layout (placeholder layouts)
  alt?: EraArena[]; // other maps of this era: each round picks one of them at random (thematic layouts with their own physics, like the samurai bridge)
  outfits: [string, string, string, string]; // the 4 outfits of this era: each player gets a different one each round (placeholder names)
}

export const eras: Era[] = [
  { id: 'caveman', name: 'Cavemen', special: false, pickups: ['tusk', 'stone-hammer'], style: { grain: 0.05 }, sky: 0x6b8f5a, platform: 0x7a6248, wall: 0x5c5046, weapon: 'bone-club', arena: { platformX: 4.75, platformW: 14.5, walls: [/* the cave wall at your back */ { side: 1, up: 3.0, gap: 0 }], props: [{ kind: 'log', x: 12.0, up: 0 }, { kind: 'bone', x: 13.25, up: 0 }] }, alt: [/* Vine Ravine: $1*/ { name: 'Vine Ravine',  ground: [{ x: 5.25, w: 3.75 }, { x: 15.0, w: 3.75 }], bridge: { x0: 9.0, x1: 15.0, planks: 6 } }], outfits: ['fur pelt', 'bone necklace', 'leaf wrap', 'war paint'] },
  { id: 'egypt', name: 'Ancient Egypt', special: false, pickups: ['sceptre', 'flail'], sky: 0xd9b46a, platform: 0xb08a58, wall: 0x8a6a44, weapon: 'khopesh', arena: { walls: [/* the temple wall, level with the top step */ { side: -1, up: 3.6, gap: 0 }], ledges: [{ x: 5.6, up: 1.8, w: 2.2 }, { x: 7.8, up: 3.6, w: 2.2 }] }, alt: [/* Pyramid Steps: $1*/ { name: 'Pyramid Steps',  ledges: [{ x: 6.0, up: 1.8, w: 3.0 }, { x: 10.0, up: 3.6, w: 4.0 }, { x: 15.0, up: 1.8, w: 3.0 }] }], outfits: ['pharaoh', 'priest', 'guard', 'scribe'] },
  { id: 'gladiators', name: 'Roman Gladiators', special: false, pickups: ['trident', 'chain-mace'], sky: 0xb5875a, platform: 0xa88d68, wall: 0x7a6a56, weapon: 'gladius', arena: { platformX: 5.625, platformW: 12.75, walls: [/* a low parapet each side: nobody walks off, you are thrown (or jump) over it */ { side: -1, up: 1.0, gap: 0 }, { side: 1, up: 1.0, gap: 0 }], props: [{ kind: 'plank', x: 10.0, up: 0 }] }, alt: [/* Lion's Pit: $1*/ { name: "Lion's Pit",  walls: [/* tall arena walls: the pit is the only way out */ { side: -1, up: 2.5, gap: 0 }, { side: 1, up: 2.5, gap: 0 }], ground: [{ x: 5.25, w: 5.25 }, { x: 13.5, w: 5.25 }], ledges: [{ x: 11.125, up: 0, w: 1.75 }], fightSpawnX: [6.75, 17.25, 9.0, 15.0] }], outfits: ['murmillo', 'retiarius', 'thraex', 'centurion'] },
  { id: 'vikings', name: 'Vikings', special: false, pickups: ['spear', 'great-axe'], sky: 0x6f8aa0, platform: 0x6a5a48, wall: 0x4a4a4e, weapon: 'axe', arena: { platformW: 13.75, props: [{ kind: 'log', x: 11.75, up: 0 }] }, outfits: ['jarl', 'raider', 'shieldmaiden', 'berserker'] },
  { id: 'medieval', name: 'Medieval Knights', special: false, pickups: ['mace', 'lance'], sky: 0x7a8aa6, platform: 0x7a7a78, wall: 0x56565a, weapon: 'longsword', arena: { walls: [/* the castle wall across a moat: fall in and wall-jump out */ { side: -1, up: 2.5, gap: 1.2 }], ledges: [{ x: 6.25, up: 1.8, w: 2.0 }, { x: 15.75, up: 1.8, w: 2.0 }] }, outfits: ['knight', 'squire', 'archer', 'bishop'] },
  { id: 'samurai', name: 'Samurai Knights', special: false, pickups: ['iron-fan', 'naginata'], style: { blur: 7, grain: 0.025 }, sky: 0x8a6f86, platform: 0x6b4a3a, wall: 0x4a3a34, weapon: 'katana', arena: { platformX: 6.625, platformW: 10.75, walls: [/* Dojo Ridge: narrow walls both sides */ { side: -1, up: 2.0, gap: 1.0 }, { side: 1, up: 2.0, gap: 1.0 }] }, alt: [{ name: 'Rope Bridge', ground: [{ x: 5.25, w: 3.5 }, { x: 15.25, w: 3.5 }], bridge: { x0: 8.75, x1: 15.25, planks: 8 } }], outfits: ['armoured lord', 'ronin', 'ashigaru', 'monk'] },
  { id: 'pirates', name: 'Pirates', special: false, pickups: ['pistol', 'boat-hook'], sky: 0x5a9aa8, platform: 0x6a4a30, wall: 0x4a3626, weapon: 'cutlass', arena: { name: 'Ship Deck', platformX: 5.75, platformW: 12.5, sea: { level: 0.9 }, boat: true, props: [{ kind: 'plank', x: 10.0, up: 0 }] }, outfits: ['captain', 'buccaneer', 'first mate', 'cabin boy'] },
  { id: 'westerns', name: 'The Wild West', special: false, pickups: ['revolver', 'pickaxe'], sky: 0xc9915a, platform: 0x8a6240, wall: 0x6a4a34, weapon: 'rifle', arena: { walls: [/* the saloon wall */ { side: 1, up: 3.0, gap: 0 }], ledges: [{ x: 10.6, up: 1.8, w: 2.8 }], props: [{ kind: 'plank', x: 8.75, up: 0 }] }, outfits: ['sheriff', 'outlaw', 'gambler', 'rancher'] },
  { id: 'ww1', name: 'World War I', special: false, pickups: ['grenade', 'bayonet-rifle'], style: { grain: 0.05 }, sky: 0x7b8576, platform: 0x5a5444, wall: 0x45463c, weapon: 'shovel', arena: { ledges: [/* islands out past each end of the ground, over the void */ { x: 2.25, up: 0.6, w: 2.0 }, { x: 19.75, up: 0.6, w: 2.0 }] }, outfits: ['infantry', 'officer', 'medic', 'trench raider'] },
  { id: 'vietnam', name: 'Vietnam', special: false, pickups: ['bamboo-stick', 'bayonet-knife'], sky: 0x5f8a5a, platform: 0x6a5a3c, wall: 0x4a5a3c, weapon: 'machete', arena: { platformW: 12.5, ledges: [{ x: 11.25, up: 1.8, w: 2.0 }], front: [{ kind: 'grass', x: 1.25, y: 13.75, scale: 3.0 }, { kind: 'grass', x: 4.0, y: 13.9, scale: 2.1 }, { kind: 'grass', x: 22.25, y: 13.8, scale: 2.75 }] }, outfits: ['jungle grunt', 'scout', 'radioman', 'tunnel rat'] },
  { id: 'modern', name: 'Modern Warfare', special: false, pickups: ['combat-knife', 'riot-shield'], sky: 0x7a8794, platform: 0x585d63, wall: 0x42474c, weapon: 'baton', arena: { platformX: 6.0, platformW: 12.0, walls: [/* a building across the alley */ { side: 1, up: 3.0, gap: 1.4 }], ledges: [{ x: 10.75, up: 1.8, w: 2.5 }] }, outfits: ['rifleman', 'sniper', 'operator', 'engineer'] },
  { id: 'scifi', name: 'Space Age', special: false, pickups: ['plasma-blade', 'gravity-hammer'], style: { blur: 3, haze: 0.06, grain: 0.02 }, sky: 0x3a3f6b, platform: 0x4a5a7a, wall: 0x2e3350, weapon: 'energy-staff', arena: { platformX: 5.875, platformW: 12.25, ledges: [{ x: 6.75, up: 1.8, w: 2.0 }, { x: 15.25, up: 1.8, w: 2.0 }, { x: 10.75, up: 3.6, w: 2.5 }] }, outfits: ['pilot', 'android', 'marine', 'scientist'] },
  // Intermittent specials (the list will grow):
  { id: 'fantasy', name: 'Fantasy Archers', special: true, pickups: ['wizard-staff', 'war-hammer'], sky: 0x5a7a8a, platform: 0x5a6a3a, wall: 0x3e4a30, weapon: 'longbow', arena: { ledges: [{ x: 7.5, up: 1.8, w: 2.25 }, { x: 14.25, up: 1.8, w: 2.25 }] }, outfits: ['ranger', 'elf', 'hunter', 'druid'] },
  { id: 'mobsters', name: 'Mobsters', special: true, pickups: ['crowbar', 'lead-pipe'], sky: 0x4a3a4a, platform: 0x5a4a44, wall: 0x372c34, weapon: 'bat', arena: { platformX: 6.25, platformW: 11.5, walls: [/* the alley's brick wall */ { side: -1, up: 2.5, gap: 0 }] }, outfits: ['boss', 'enforcer', 'accountant', 'getaway driver'] },
];

export const eraById = (id: string): Era => eras.find((e) => e.id === id) ?? eras[0];

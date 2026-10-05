// The eras. Pure data: adding an era is adding a row here (and, later, its art, outfits and weapons). The colours below are PLACEHOLDERS so
// each era is visibly different in screenshots until the real art arrives. `special` eras turn up at random now and then instead of in the normal rotation.
/** How an era's arena differs from the standard one (any arena setting can be overridden; `ledges` adds floating platforms: x = left end in metres, up = height above the main platform, w = width). */
export interface EraArena {
  platformX?: number; platformW?: number; wallGap?: number;
  ledges?: { x: number; up: number; w: number }[];
  ground?: { x: number; w: number }[]; // separate ground slabs instead of one platform
  bridge?: { x0: number; x1: number; planks: number }; // a breakable plank bridge between the slabs
  props?: { kind: string; x: number; up: number }[]; // loose objects lying around (see props.ts)
}

/** How the whole picture is painted in this era (each one overrides tuning.finish.style): blur = background softness, grain = canvas weave, tint/tintAlpha = colour wash. */
export interface EraStyle { blur: number; grain: number; tint: number; tintAlpha: number }

export interface Era {
  id: string;
  name: string;
  special: boolean;
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
  { id: 'caveman', name: 'Cavemen', special: false, style: { grain: 0.11, tint: 0xd9a066, tintAlpha: 0.1 }, sky: 0x6b8f5a, platform: 0x7a6248, wall: 0x5c5046, weapon: 'bone-club', arena: { platformX: 3.8, platformW: 11.6, props: [{ kind: 'log', x: 9.6, up: 0 }, { kind: 'bone', x: 10.6, up: 0 }] }, outfits: ['fur pelt', 'bone necklace', 'leaf wrap', 'war paint'] },
  { id: 'egypt', name: 'Ancient Egypt', special: false, sky: 0xd9b46a, platform: 0xb08a58, wall: 0x8a6a44, weapon: 'khopesh', arena: { ledges: [{ x: 5.4, up: 0.8, w: 1.4 }, { x: 6.8, up: 1.6, w: 1.4 }] }, outfits: ['pharaoh', 'priest', 'guard', 'scribe'] },
  { id: 'gladiators', name: 'Roman Gladiators', special: false, sky: 0xb5875a, platform: 0xa88d68, wall: 0x7a6a56, weapon: 'gladius', arena: { platformX: 4.5, platformW: 10.2, props: [{ kind: 'plank', x: 8.0, up: 0 }] }, outfits: ['murmillo', 'retiarius', 'thraex', 'centurion'] },
  { id: 'vikings', name: 'Vikings', special: false, sky: 0x6f8aa0, platform: 0x6a5a48, wall: 0x4a4a4e, weapon: 'axe', arena: { platformW: 11.0, props: [{ kind: 'log', x: 9.4, up: 0 }] }, outfits: ['jarl', 'raider', 'shieldmaiden', 'berserker'] },
  { id: 'medieval', name: 'Medieval Knights', special: false, sky: 0x7a8aa6, platform: 0x7a7a78, wall: 0x56565a, weapon: 'longsword', arena: { ledges: [{ x: 5.0, up: 1.4, w: 1.6 }, { x: 12.6, up: 1.4, w: 1.6 }] }, outfits: ['knight', 'squire', 'archer', 'bishop'] },
  { id: 'samurai', name: 'Samurai Knights', special: false, style: { blur: 10, grain: 0.04, tint: 0xf0d0e0, tintAlpha: 0.09 }, sky: 0x8a6f86, platform: 0x6b4a3a, wall: 0x4a3a34, weapon: 'katana', arena: { platformX: 5.3, platformW: 8.6, wallGap: 1.0 }, alt: [{ ground: [{ x: 4.2, w: 2.8 }, { x: 12.2, w: 2.8 }], bridge: { x0: 7.0, x1: 12.2, planks: 8 } }], outfits: ['armoured lord', 'ronin', 'ashigaru', 'monk'] },
  { id: 'pirates', name: 'Pirates', special: false, style: { tint: 0x9fd0d8, tintAlpha: 0.1 }, sky: 0x5a9aa8, platform: 0x6a4a30, wall: 0x4a3626, weapon: 'cutlass', arena: { platformX: 4.2, platformW: 10.8, props: [{ kind: 'plank', x: 8.0, up: 0 }] }, outfits: ['captain', 'buccaneer', 'first mate', 'cabin boy'] },
  { id: 'westerns', name: 'The Wild West', special: false, sky: 0xc9915a, platform: 0x8a6240, wall: 0x6a4a34, weapon: 'rifle', arena: { ledges: [{ x: 8.5, up: 1.5, w: 2.2 }], props: [{ kind: 'plank', x: 7.0, up: 0 }] }, outfits: ['sheriff', 'outlaw', 'gambler', 'rancher'] },
  { id: 'ww1', name: 'World War I', special: false, style: { grain: 0.1, tint: 0xb8b8a0, tintAlpha: 0.14 }, sky: 0x7b8576, platform: 0x5a5444, wall: 0x45463c, weapon: 'shovel', arena: { ledges: [{ x: 5.2, up: 1.0, w: 1.6 }, { x: 12.4, up: 1.0, w: 1.6 }] }, outfits: ['infantry', 'officer', 'medic', 'trench raider'] },
  { id: 'vietnam', name: 'Vietnam', special: false, sky: 0x5f8a5a, platform: 0x6a5a3c, wall: 0x4a5a3c, weapon: 'machete', arena: { platformW: 10.0, ledges: [{ x: 9.0, up: 1.3, w: 1.6 }] }, outfits: ['jungle grunt', 'scout', 'radioman', 'tunnel rat'] },
  { id: 'modern', name: 'Modern Warfare', special: false, sky: 0x7a8794, platform: 0x585d63, wall: 0x42474c, weapon: 'baton', arena: { platformX: 4.8, platformW: 9.6, ledges: [{ x: 8.6, up: 1.5, w: 2.0 }] }, outfits: ['rifleman', 'sniper', 'operator', 'engineer'] },
  { id: 'scifi', name: 'Space Age', special: false, style: { blur: 5, grain: 0.03, tint: 0x9fb4ff, tintAlpha: 0.07 }, sky: 0x3a3f6b, platform: 0x4a5a7a, wall: 0x2e3350, weapon: 'energy-staff', arena: { platformX: 4.7, platformW: 9.8, ledges: [{ x: 5.4, up: 1.6, w: 1.6 }, { x: 11.6, up: 1.6, w: 1.6 }] }, outfits: ['pilot', 'android', 'marine', 'scientist'] },
  // Intermittent specials (the list will grow):
  { id: 'fantasy', name: 'Fantasy Archers', special: true, sky: 0x5a7a8a, platform: 0x5a6a3a, wall: 0x3e4a30, weapon: 'longbow', arena: { ledges: [{ x: 6.0, up: 1.5, w: 1.8 }, { x: 11.0, up: 1.5, w: 1.8 }] }, outfits: ['ranger', 'elf', 'hunter', 'druid'] },
  { id: 'mobsters', name: 'Mobsters', special: true, sky: 0x4a3a4a, platform: 0x5a4a44, wall: 0x372c34, weapon: 'bat', arena: { platformX: 5.0, platformW: 9.2 }, outfits: ['boss', 'enforcer', 'accountant', 'getaway driver'] },
];

export const eraById = (id: string): Era => eras.find((e) => e.id === id) ?? eras[0];

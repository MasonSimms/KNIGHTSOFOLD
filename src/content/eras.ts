// The eras. Pure data: adding an era is adding a row here (and, later, its art, outfits and weapons). The colours below are PLACEHOLDERS so
// each era is visibly different in screenshots until the real art arrives. `special` eras turn up at random now and then instead of in the normal rotation.
export interface Era {
  id: string;
  name: string;
  special: boolean;
  sky: number; // arena colours (placeholders)
  platform: number;
  wall: number;
  outfits: [string, string, string, string]; // the 4 outfits of this era: each player gets a different one each round (placeholder names)
}

export const eras: Era[] = [
  { id: 'caveman', name: 'Cavemen', special: false, sky: 0x6b8f5a, platform: 0x7a6248, wall: 0x5c5046, outfits: ['fur pelt', 'bone necklace', 'leaf wrap', 'war paint'] },
  { id: 'samurai', name: 'Samurai Knights', special: false, sky: 0x8a6f86, platform: 0x6b4a3a, wall: 0x4a3a34, outfits: ['armoured lord', 'ronin', 'ashigaru', 'monk'] },
  { id: 'westerns', name: 'The Wild West', special: false, sky: 0xc9915a, platform: 0x8a6240, wall: 0x6a4a34, outfits: ['sheriff', 'outlaw', 'gambler', 'rancher'] },
  { id: 'ww1', name: 'World War I', special: false, sky: 0x7b8576, platform: 0x5a5444, wall: 0x45463c, outfits: ['infantry', 'officer', 'medic', 'trench raider'] },
  { id: 'vietnam', name: 'Vietnam', special: false, sky: 0x5f8a5a, platform: 0x6a5a3c, wall: 0x4a5a3c, outfits: ['jungle grunt', 'scout', 'radioman', 'tunnel rat'] },
  { id: 'modern', name: 'Modern Warfare', special: false, sky: 0x7a8794, platform: 0x585d63, wall: 0x42474c, outfits: ['rifleman', 'sniper', 'operator', 'engineer'] },
  { id: 'scifi', name: 'Space Age', special: false, sky: 0x3a3f6b, platform: 0x4a5a7a, wall: 0x2e3350, outfits: ['pilot', 'android', 'marine', 'scientist'] },
  // Intermittent specials (the list will grow):
  { id: 'fantasy', name: 'Fantasy Archers', special: true, sky: 0x5a7a8a, platform: 0x5a6a3a, wall: 0x3e4a30, outfits: ['ranger', 'elf', 'hunter', 'druid'] },
  { id: 'mobsters', name: 'Mobsters', special: true, sky: 0x4a3a4a, platform: 0x5a4a44, wall: 0x372c34, outfits: ['boss', 'enforcer', 'accountant', 'getaway driver'] },
];

export const eraById = (id: string): Era => eras.find((e) => e.id === id) ?? eras[0];

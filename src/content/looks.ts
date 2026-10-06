// What a player picks for themselves: a colour, a hat and eyes. Colours are unique within a room, so every player is instantly identifiable.
export const COLORS: { name: string; hex: number }[] = [
  { name: 'Red', hex: 0xd8402a }, { name: 'Blue', hex: 0x2d5db0 }, { name: 'Yellow', hex: 0xe8b931 }, { name: 'Green', hex: 0x2f9e6b },
  { name: 'Purple', hex: 0x8a4fd0 }, { name: 'Orange', hex: 0xe8812e }, { name: 'Pink', hex: 0xe86aa8 }, { name: 'Teal', hex: 0x2fb5b0 },
];
export const HATS = ['none', 'cap', 'tophat', 'helmet', 'crown', 'horns', 'cowboy', 'beanie'] as const;
export type Hat = (typeof HATS)[number];
export const HAT_NAMES: Record<Hat, string> = { none: 'Bare', cap: 'Cap', tophat: 'Top hat', helmet: 'Helm', crown: 'Crown', horns: 'Horns', cowboy: 'Stetson', beanie: 'Beanie' };
export const EYES = ['round', 'fierce', 'sleepy'] as const;
export type Eyes = (typeof EYES)[number];
export const EYE_NAMES: Record<Eyes, string> = { round: 'Round', fierce: 'Fierce', sleepy: 'Sleepy' };

export interface Look { color: number; hat: Hat; eyes: Eyes } // color = index into COLORS

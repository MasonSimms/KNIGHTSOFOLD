// What a player picks for themselves: a colour and a hat. Colours are unique within a room, so every player is instantly identifiable.
export const COLORS: { name: string; hex: number }[] = [
  { name: 'Red', hex: 0xd9493a }, { name: 'Blue', hex: 0x3a7bd9 }, { name: 'Yellow', hex: 0xe6c229 }, { name: 'Green', hex: 0x3fae5a },
  { name: 'Purple', hex: 0x8a4fd0 }, { name: 'Orange', hex: 0xe8812e }, { name: 'Pink', hex: 0xe86aa8 }, { name: 'Teal', hex: 0x2fb5b0 },
];
export const HATS = ['none', 'cap', 'tophat', 'helmet', 'crown', 'horns', 'cowboy', 'beanie'] as const;
export type Hat = (typeof HATS)[number];

export interface Look { color: number; hat: Hat } // color = index into COLORS

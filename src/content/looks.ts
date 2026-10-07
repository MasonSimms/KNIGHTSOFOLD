// What a player picks for themselves: a colour, a hat and eyes. Colours are unique within a room, so every player is instantly identifiable.
// Looks v1 (LOOKS_HANDOFF.md): colours are named as oil pigments; the first four are the art guide's locked pigments. Colours travel as an
// index, so slot 7 (once Teal, too close to Viridian and Ultramarine for colourblind players) now means Bone.
export const COLORS: { name: string; hex: number }[] = [
  { name: 'Vermilion', hex: 0xd8402a }, { name: 'Ultramarine', hex: 0x2d5db0 }, { name: 'Cadmium', hex: 0xe8b931 }, { name: 'Viridian', hex: 0x2f9e6b },
  { name: 'Violet', hex: 0x8a4fd0 }, { name: 'Orange', hex: 0xe8812e }, { name: 'Rose', hex: 0xe86aa8 }, { name: 'Bone', hex: 0xe6dcc6 },
];
export const HATS = ['none', 'helmet', 'plumed', 'crown', 'horns', 'jester', 'wizard', 'hennin', 'locks'] as const;
export type Hat = (typeof HATS)[number];
export const HAT_NAMES: Record<Hat, string> = { none: 'Bare', helmet: 'Great Helm', plumed: 'Plumed Helm', crown: 'Crown', horns: 'Horned Helm', jester: 'Jester Cap', wizard: 'Wizard Hat', hennin: 'Hennin & Veil', locks: 'Flowing Locks' };
export const EYES = ['round', 'fierce', 'sleepy', 'googly', 'startled', 'sly', 'sad', 'cyclops'] as const;
export type Eyes = (typeof EYES)[number];
export const EYE_NAMES: Record<Eyes, string> = { round: 'Round', fierce: 'Fierce', sleepy: 'Sleepy', googly: 'Googly', startled: 'Startled', sly: 'Sly', sad: 'Sad', cyclops: 'Cyclops' };
/** An id from outside (a test link, an old build): anything unknown, like the old cap, top hat, stetson or beanie, is Bare / Round. */
export const asHat = (id: string): Hat => ((HATS as readonly string[]).includes(id) ? (id as Hat) : 'none');
export const asEyes = (id: string): Eyes => ((EYES as readonly string[]).includes(id) ? (id as Eyes) : 'round');

export interface Look { color: number; hat: Hat; eyes: Eyes; bot?: boolean } // color = index into COLORS; bot = a computer plays this seat (a gray robot: its colour is -1, it takes none)

/** Bots (owner: shades of gray, a classic robot): one gray per seat, light to dark, so two bots never look the same. */
export const BOT_GRAYS = [0xc9cdd1, 0x9ea4aa, 0x767c82, 0x575c61];
/** A bot's look. */
export const botLook = (): Look => ({ color: -1, hat: 'none', eyes: 'round', bot: true });

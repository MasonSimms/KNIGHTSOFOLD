// The eras. Pure data: adding an era is adding a row here (and, later, its art, outfits and weapons). The colours below are PLACEHOLDERS so
// each era is visibly different in screenshots until the real art arrives. `special` eras turn up at random now and then instead of in the normal rotation.
/** How an era's arena differs from the standard one (any arena setting can be overridden; `ledges` adds floating platforms: x = left end in metres, up = height above the main platform, w = width). */
export interface EraArena {
  name?: string; // what the map is called (menus); the usual arena of an era needs none
  platformX?: number; platformW?: number;
  platformThickness?: number; // how deep the ground goes (m): deep enough and it is a landmass running off the bottom of the picture
  walls?: { side: -1 | 1; up: number; gap: number }[]; // side walls (see tuning.arena.walls): most maps have none
  ledges?: { x: number; up: number; w: number }[];
  ground?: { x: number; w: number; up?: number; thick?: number }[]; // separate ground slabs instead of one platform (each at its own height and depth)
  bridge?: { x0: number; x1: number; planks: number; kind?: string; water?: boolean }; // a breakable plank bridge between the slabs (kind: stone blocks instead, props.ts; water: an aqueduct, tuning.aqueduct)
  props?: { kind: string; x: number; up: number }[]; // loose objects lying around (see props.ts)
  scenery?: { kind: string; x: number; up: number }[]; // breakable scenery (barrels, crates: props.ts breaks), always on the map
  front?: { kind: 'grass' | 'sign'; x: number; y: number; scale?: number; speed?: number }[]; // the front plane (see tuning.arena.front)
  spawnX?: number[]; // where you and the training dummy start, playing alone (metres)
  fightSpawnX?: number[]; // where the fighters of a 2-4 player fight start (metres; for maps where the standard spots would be over a gap)
  ice?: number; // an icy floor: the share of grip your feet lose (see tuning.arena.ice)
  sea?: { level: number; tide?: { rise: number; seconds: number }; chop?: number; water?: [string, string] }; // (water: its own colours, top and deep, instead of the era's void: a river) // (chop: waves this many times higher, a rough sea) // water under the stage (see tuning.arena.sea); tide: it rises `rise` m over the round's first `seconds`
  boats?: { x: number; w: number; depth?: number; sinks?: { seconds: number; tilt: number; settle: number }; look?: 'ship' | 'longship' | 'ice' | 'barge'; tilt?: number; crack?: boolean }[]; // (tilt: how far one fighter at its end tips it, instead of tuning.boat.tilt; crack: an ice floe that cracks and sinks, tuning.floe) // floating ships (see tuning.boat; depth: a rowboat is shallower than tuning.boat.depth; sinks: a wreck, water.ts Sinking)
  ropes?: { x0: number; up0: number; x1: number; up1: number }[]; // ropes tied between them (see tuning.rope)
  tar?: { x: number; w: number; level: number; lava?: boolean }[]; // tar pits, or lava pools (see tuning.arena.tar)
  fires?: { x: number; w: number; up: number }[]; // fires (see tuning.arena.fires)
  weapon?: string; // this map's own weapon (weapons.ts), instead of the era's
  chase?: { speed: number; mammothX: number; obstacles: string[]; gap: number }; // a treadmill map (see tuning.arena.chase)
  chariot?: { at: number; cycle: number; speed: number; dir: 1 | -1 }; // a runaway chariot charging across on a timetable (see tuning.chariot)
  trapdoors?: { x: number; w: number; hinge: -1 | 1; at: number }[]; // doors in the floor over a gap that open on a timetable (see tuning.trapdoor)
  train?: { speed: number; cycle: number; passing: { kind: 'sign' | 'tunnel'; at: number }[] }; // a train map (see tuning.arena.train)
  roll?: number; // the painting slides by (m/s)
  noWeapons?: boolean; // fists and throws only
  spawnSpots?: number[]; // where weapons appear when they do not fall from the sky (share of the platform; default tuning.spawn.spots)
  gunsOnly?: boolean; // (see also Era.gunRounds) nobody starts armed and only the era's guns drop in, early and often: a race for them (owner, 2026-10-07)
  tower?: { x: number; w: number }; // a water tower's tank (see tuning.arena.tower)
  wind?: { base: number; gust: number; dir: -1 | 1 }; // a windy map (see tuning.arena.wind)
  gusts?: number; // the wind shows as blown sand (0..1; see tuning.arena.gusts)
  rocks?: { kind: string; first: number; every: number }; // rocks falling from above on a timetable (see tuning.arena.rocks)
}

/** How the whole picture is painted in this era (each one overrides tuning.finish.style): blur = background softness, haze = background fading into the air, grain = canvas weave, tint/tintAlpha = colour wash. */
export interface EraStyle { blur: number; haze: number; grain: number; tint: number; tintAlpha: number }

export interface Era {
  id: string;
  name: string;
  special: boolean;
  pickups?: string[]; // better weapons (props.ts) that spawn in as the round goes on, weakest first
  gunRounds?: number; // this share of the era's rounds are played guns-only (Arena.gunsOnly) on whatever map comes up, but a fists-only one (owner, 2026-10-07: more gun arenas)
  strong?: number; // the last this many pickups are the strong ones: they come only later in a round (tuning.spawn.strongAfterFrames); the rest are common (default 1)
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
  { id: 'caveman', name: 'Cavemen', special: false, pickups: ['tusk', 'stone-hammer'], style: { grain: 0.05 }, sky: 0x6b8f5a, platform: 0x7a6248, wall: 0x5c5046, weapon: 'bone-club', arena: { name: 'Vine Ravine', ground: [{ x: 5.25, w: 3.75 }, { x: 15.0, w: 3.75 }], bridge: { x0: 9.0, x1: 15.0, planks: 6 } }, alt: [ // (the plain cave is retired: the era is the owner's five)
    // Campfire Clearing (owner's list): a fire in the middle (it burns you, and sets your club alight: a torch), a ledge over it
    { name: 'Campfire Clearing', fires: [{ x: 11.4, w: 1.2, up: 0 }], ledges: [{ x: 10.5, up: 1.8, w: 3.0 }], fightSpawnX: [6.5, 17.5, 9.25, 14.75], props: [{ kind: 'log', x: 8.2, up: 0 }, { kind: 'log', x: 15.8, up: 0 }] },
    // Tar Pit (owner's list): grass both sides of a pit of tar (slow, a weak kick, and it swallows you): leap it
    { name: 'Tar Pit', platformThickness: 6, ground: [{ x: 4.0, w: 6.5 }, { x: 13.5, w: 6.5 }], tar: [{ x: 10.5, w: 3.0, level: 0.25 }], fightSpawnX: [6.0, 18.0, 8.5, 15.5], props: [{ kind: 'log', x: 5.0, up: 0 }, { kind: 'plank', x: 19.0, up: 0 }] },
    // Standing Stones (owner's list): two trilithons, real stones: the capstones lie loose on the uprights and a hard enough knock (a
    // slam, a thrown body, shots) brings them down on whoever is under them; fallen, they are cover too heavy to lift. Stone axes.
    { name: 'Standing Stones', weapon: 'stone-axe', fightSpawnX: [6.0, 18.0, 10.75, 13.25], scenery: [
      { kind: 'upright', x: 7.3, up: 0 }, { kind: 'upright', x: 9.7, up: 0 }, { kind: 'capstone', x: 8.5, up: 1.62 },
      { kind: 'upright', x: 14.3, up: 0 }, { kind: 'upright', x: 16.7, up: 0 }, { kind: 'capstone', x: 15.5, up: 1.62 }] },
    // Mammoth Chase (owner's list): the ground slides left toward a mammoth at the left edge; run right; rocks and logs come along
    { name: 'Mammoth Chase', ground: [{ x: -1, w: 26 }], roll: 2.2, chase: { speed: 2.2, mammothX: 1.4, obstacles: ['boulder', 'log', 'boulder', 'log'], gap: 9 } },
    // Volcano Rim (owner asked for the lava map, 2026-10-07; it was on the old list): two shelves of black rock either side of a lava
    // pool, a basalt ledge over each shelf, and rocks falling from the rim now and then (a boulder crushes whoever it lands on, then lies
    // about as cover). Lava sets you burning the moment you touch it and has you in a blink: jump the pool, or throw people in.
    { name: 'Volcano Rim', platformThickness: 6, ground: [{ x: 3.0, w: 7.5 }, { x: 13.5, w: 7.5 }], tar: [{ x: 10.5, w: 3.0, level: 0.3, lava: true }],
      ledges: [{ x: 4.5, up: 1.9, w: 2.2 }, { x: 17.3, up: 1.9, w: 2.2 }], rocks: { kind: 'boulder', first: 4, every: 5 },
      fightSpawnX: [5.5, 18.5, 8.5, 15.5], spawnX: [5.5, 9.0, 18.5, 15.0], props: [{ kind: 'log', x: 4.0, up: 0 }] }], outfits: ['fur pelt', 'bone necklace', 'leaf wrap', 'war paint'] },
  { id: 'egypt', name: 'Ancient Egypt', special: false, pickups: ['sceptre', 'flail'], sky: 0xd9b46a, platform: 0xb08a58, wall: 0x8a6a44, weapon: 'khopesh', arena: { walls: [/* the temple wall, level with the top step */ { side: -1, up: 3.6, gap: 0 }], ledges: [{ x: 5.6, up: 1.8, w: 2.2 }, { x: 7.8, up: 3.6, w: 2.2 }] }, alt: [/* Pyramid Steps: $1*/ { name: 'Pyramid Steps',  ledges: [{ x: 6.0, up: 1.8, w: 3.0 }, { x: 10.0, up: 3.6, w: 4.0 }, { x: 15.0, up: 1.8, w: 3.0 }] },
    // Sandstorm Temple (owner's list): the temple's sand floor between its back wall (left) and the open desert (right), two stone pillars
    // standing on the floor under a lintel. A sandstorm blows toward the open side in gusts: on the ground your feet hold, in the air you
    // are carried. The pillars are too heavy to lift: knock one over onto someone, or club it until it breaks into rubble.
    { name: 'Sandstorm Temple', wind: { base: 1, gust: 11, dir: 1 }, gusts: 1, platformX: 3.5, platformW: 16.5, walls: [{ side: -1, up: 3.2, gap: 0 }],
      ledges: [{ x: 9.0, up: 1.9, w: 5.0 }], scenery: [{ kind: 'pillar', x: 9.5, up: 0 }, { kind: 'pillar', x: 13.5, up: 0 }],
      fightSpawnX: [6.0, 18.0, 8.0, 16.0], spawnX: [6.0, 11.5, 18.0, 16.0] },
    // Nile Barge (the era plan): a reed barge on the river, far tippier than a ship: run to one end and it leans hard (tilt), so loose
    // things and fighters slide toward the water. An oar to swing, clay jars to throw or smash. Reeds along the bank in front.
    { name: 'Nile Barge', platformX: 5.75, platformW: 12.5, sea: { level: 0.5, water: ['#5E8C80', '#22403C'] }, boats: [{ x: 5.75, w: 12.5, depth: 1.0, look: 'barge', tilt: 0.28 }],
      props: [{ kind: 'oar', x: 9.0, up: 0 }], scenery: [{ kind: 'jar', x: 7.6, up: 0 }, { kind: 'jar', x: 16.4, up: 0 }],
      front: [{ kind: 'grass', x: 1.0, y: 13.8, scale: 2.8 }, { kind: 'grass', x: 3.4, y: 13.95, scale: 2.0 }, { kind: 'grass', x: 22.6, y: 13.85, scale: 2.6 }] },
    // Toppling Obelisk (the era plan): a temple court split by a gap (a running jump crosses it), a terrace each side with an obelisk
    // standing on it. Fling someone into an obelisk and it tips over: toward the gap it comes down across it (a ramp to the far side),
    // away from it onto the court below; either way it crushes whoever it lands on. The terraces stand back from the gap, so a jump
    // across it never hits its head on them.
    { name: 'Toppling Obelisk', platformThickness: 6, ground: [{ x: 2.0, w: 8.7 }, { x: 13.3, w: 8.7 }],
      ledges: [{ x: 7.0, up: 1.9, w: 2.2 }, { x: 14.8, up: 1.9, w: 2.2 }], scenery: [{ kind: 'obelisk', x: 8.875, up: 1.9 }, { kind: 'obelisk', x: 15.125, up: 1.9 }, { kind: 'jar', x: 5.5, up: 0 }, { kind: 'jar', x: 18.5, up: 0 }],
      fightSpawnX: [4.0, 20.0, 7.0, 17.0], spawnX: [5.0, 9.5, 14.5, 19.0] }], outfits: ['pharaoh', 'priest', 'guard', 'scribe'] },
  { id: 'gladiators', name: 'Roman Gladiators', special: false, pickups: ['trident', 'chain-mace'], sky: 0xb5875a, platform: 0xa88d68, wall: 0x7a6a56, weapon: 'gladius', arena: { platformX: 5.625, platformW: 12.75, walls: [/* a low parapet each side: nobody walks off, you are thrown (or jump) over it */ { side: -1, up: 1.0, gap: 0 }, { side: 1, up: 1.0, gap: 0 }], props: [{ kind: 'plank', x: 10.0, up: 0 }] }, alt: [/* Lion's Pit: $1*/ { name: "Lion's Pit",  walls: [/* tall arena walls: the pit is the only way out */ { side: -1, up: 2.5, gap: 0 }, { side: 1, up: 2.5, gap: 0 }], ground: [{ x: 5.25, w: 5.25 }, { x: 13.5, w: 5.25 }], ledges: [{ x: 11.125, up: 0, w: 1.75 }], fightSpawnX: [6.75, 17.25, 9.0, 15.0] },
    // Aqueduct Bridge (owner chose it from the plan, 2026-10-07): a hill each side of a deep valley and between them the aqueduct, a
    // deck of stone blocks on piers with the water running along it. A club cannot chip a block out; a body slammed or flung into the
    // deck knocks one loose, and the water pours through the gap, washing down whoever stands in it. (Each block rests on a pier at
    // one end only, so one knocked loose falls.)
    { name: 'Aqueduct Bridge', ground: [{ x: 1.0, w: 5.5, thick: 8 }, { x: 8.2, w: 0.6, up: -0.45, thick: 7 }, { x: 10.2, w: 0.6, up: -0.45, thick: 7 },
      { x: 12.2, w: 0.6, up: -0.45, thick: 7 }, { x: 14.2, w: 0.6, up: -0.45, thick: 7 }, { x: 16.2, w: 0.6, up: -0.45, thick: 7 }, { x: 17.5, w: 5.5, thick: 8 }],
      bridge: { x0: 6.5, x1: 17.5, planks: 11, kind: 'aqueduct-block', water: true },
      fightSpawnX: [4.0, 20.0, 9.5, 13.5], spawnX: [3.5, 7.5, 20.0, 13.5], props: [{ kind: 'plank', x: 2.5, up: 0 }] },
    // Colosseum Floor (owner chose it from the plan, 2026-10-07): the arena's sand between its walls, with two trapdoors over the pit
    // underneath. Each rattles, drops open, hangs open a couple of seconds and swings shut, in turn (tuning.trapdoor): whoever is on one
    // drops into the pit. Fight near them, or throw people onto them.
    { name: 'Colosseum Floor', walls: [{ side: -1, up: 2.0, gap: 0 }, { side: 1, up: 2.0, gap: 0 }], ground: [{ x: 5.25, w: 3.0, thick: 6 }, { x: 10.25, w: 3.5, thick: 6 }, { x: 15.75, w: 3.0, thick: 6 }], // (the floor runs deep: the doors are over shafts down into the pit)
      trapdoors: [{ x: 8.25, w: 2.0, hinge: -1, at: 3 }, { x: 13.75, w: 2.0, hinge: 1, at: 7.5 }],
      fightSpawnX: [6.75, 17.25, 10.8, 13.2], spawnX: [7.0, 11.5, 17.25, 13.2], props: [{ kind: 'plank', x: 12.0, up: 0 }] },
    // Chariot Track (owner chose it from the plan, 2026-10-07): the circus's sand track, the full width of the picture, with the spina
    // (the long wall down its middle) to stand on, and a runaway chariot with no driver charging across every 7 s, one way and then back,
    // dust rising on its side first: whoever it catches is flung ahead of it. Jump it, or get up on the spina.
    { name: 'Chariot Track', platformX: 0, platformW: 24, platformThickness: 6, ledges: [{ x: 9.75, up: 1.8, w: 4.5 }], chariot: { at: 4, cycle: 7, speed: 13, dir: 1 } }], outfits: ['murmillo', 'retiarius', 'thraex', 'centurion'] },
  { id: 'vikings', name: 'Vikings', special: false, pickups: ['round-shield', 'spear'], sky: 0x6f8aa0, platform: 0x6a5a48, wall: 0x4a4a4e, weapon: 'axe', arena: { platformW: 13.75, props: [{ kind: 'log', x: 11.75, up: 0 }] }, alt: [
    // Mead Hall (owner chose the Vikings' plan, 2026-10-07): the long hall between its walls, the long hearth burning down the middle
    // (it burns you), a heavy table at each end to stand on, shove or tip over, benches to swing, drinking horns that shatter, and two
    // iron rings of candles hanging over the floor: hit one or shoot its rope and it comes down on whoever is under it.
    { name: 'Mead Hall', platformX: 2.5, platformW: 19, walls: [{ side: -1, up: 3.5, gap: 0 }, { side: 1, up: 3.5, gap: 0 }], fires: [{ x: 11.4, w: 1.2, up: 0 }],
      fightSpawnX: [8.8, 15.2, 10.4, 13.6], spawnX: [9.15, 14.5, 7.0, 17.0], // (written for the standard floor: stretched to this one's, they are 7.5, 16.5, 9.75 and 14.25)
      scenery: [{ kind: 'table', x: 5.0, up: 0 }, { kind: 'table', x: 19.0, up: 0 }, { kind: 'mug', x: 4.5, up: 0.8 }, { kind: 'mug', x: 5.6, up: 0.8 }, { kind: 'mug', x: 19.4, up: 0.8 },
        { kind: 'chandelier', x: 8.6, up: 3.0 }, { kind: 'chandelier', x: 15.4, up: 3.0 }],
      props: [{ kind: 'bench', x: 7.0, up: 0 }, { kind: 'bench', x: 17.0, up: 0 }] },
    // Frozen River (owner chose the Vikings' plan, 2026-10-07): two snowy banks and the frozen river between, everything icy underfoot
    // (you skate, and slide on when you stop). The river is a sheet of ice slabs over the water: a hard landing or a slam breaks one out
    // (props.ts ice-block slam), and whoever goes through is in the icy water: swim, then sink.
    { name: 'Frozen River', ice: 0.85, sea: { level: 0.1 }, ground: [{ x: 1.0, w: 6.5, thick: 6 }, { x: 16.5, w: 6.5, thick: 6 }],
      bridge: { x0: 7.5, x1: 16.5, planks: 9, kind: 'ice-block' },
      fightSpawnX: [4.0, 20.0, 6.5, 17.5], spawnX: [3.5, 6.0, 18.0, 20.5], props: [{ kind: 'log', x: 2.5, up: 0 }] },
    // Longship Deck (owner chose the Vikings' plan, 2026-10-07): a longship on a choppy fjord (waves 1.8 times the usual: the deck rocks
    // and pitches), a striped square sail and shields along its rail, its oars lying on deck (long clubs) and a chest of loot.
    { name: 'Longship Deck', platformX: 5.75, platformW: 12.5, sea: { level: 0.9, chop: 1.8 }, boats: [{ x: 5.75, w: 12.5, look: 'longship' }],
      props: [{ kind: 'oar', x: 9.45, up: 0 }, { kind: 'oar', x: 14.55, up: 0 }], scenery: [{ kind: 'chest', x: 12.0, up: 0 }] },
    // Ice Floe Fjord (owner chose the Vikings' plan, 2026-10-07): five floes of ice floating apart on the fjord, slippery underfoot. They
    // are small and light: they tip when someone stands near an edge. A hard landing or a slam cracks one, and the second crack sinks
    // it, taking whoever is on it into the water (tuning.floe). Jump from floe to floe.
    { name: 'Ice Floe Fjord', ice: 0.85, sea: { level: 0.25 }, fightSpawnX: [4.75, 20.5, 8.8, 16.5], spawnX: [8.8, 12.6, 4.75, 16.5],
      boats: [{ x: 3.0, w: 3.5, depth: 0.6, look: 'ice', tilt: 0.25, crack: true }, { x: 7.3, w: 3.0, depth: 0.6, look: 'ice', tilt: 0.25, crack: true },
        { x: 11.0, w: 3.2, depth: 0.6, look: 'ice', tilt: 0.25, crack: true }, { x: 15.0, w: 3.0, depth: 0.6, look: 'ice', tilt: 0.25, crack: true },
        { x: 18.8, w: 3.4, depth: 0.6, look: 'ice', tilt: 0.25, crack: true }] }], outfits: ['jarl', 'raider', 'shieldmaiden', 'berserker'] },
  { id: 'medieval', name: 'Medieval Knights', special: false, pickups: ['mace', 'lance'], sky: 0x7a8aa6, platform: 0x7a7a78, wall: 0x56565a, weapon: 'longsword', arena: { walls: [/* the castle wall across a moat: fall in and wall-jump out */ { side: -1, up: 2.5, gap: 1.2 }], ledges: [{ x: 6.25, up: 1.8, w: 2.0 }, { x: 15.75, up: 1.8, w: 2.0 }], scenery: [{ kind: 'crate', x: 18.1, up: 0 }] }, outfits: ['knight', 'squire', 'archer', 'bishop'] },
  { id: 'samurai', name: 'Samurai Knights', special: false, pickups: ['iron-fan', 'naginata'], style: { blur: 7, grain: 0.025 }, sky: 0x8a6f86, platform: 0x6b4a3a, wall: 0x4a3a34, weapon: 'katana', arena: { platformX: 6.625, platformW: 10.75, walls: [/* Dojo Ridge: narrow walls both sides */ { side: -1, up: 2.0, gap: 1.0 }, { side: 1, up: 2.0, gap: 1.0 }], fightSpawnX: [7.2, 16.8, 10.4, 13.6] }, alt: [{ name: 'Rope Bridge', ground: [{ x: 5.25, w: 3.5 }, { x: 15.25, w: 3.5 }], bridge: { x0: 8.75, x1: 15.25, planks: 8 } }], outfits: ['armoured lord', 'ronin', 'ashigaru', 'monk'] },
  { id: 'pirates', name: 'Pirates', special: false, gunRounds: 0.5, pickups: ['duckfoot', 'pistol', 'blunderbuss', 'boat-hook'], strong: 2, sky: 0x5a9aa8, platform: 0x6a4a30, wall: 0x4a3626, weapon: 'cutlass', arena: { name: 'Ship Deck', platformX: 5.75, platformW: 12.5, sea: { level: 0.9 }, boats: [{ x: 5.75, w: 12.5 }], props: [{ kind: 'plank', x: 10.0, up: 0 }], scenery: [{ kind: 'barrel', x: 7.3, up: 0 }, { kind: 'barrel', x: 16.7, up: 0 }] }, alt: [
    // Ship to Ship (owner, 2026-10-06): two ships lashed side by side, a gangplank across the 1.5 m gap and two ropes in an X from each
    // ship's rigging to the other's rail. Cut both ropes (a blade or a bullet) and the ships drift apart; the gangplank falls in.
    { name: 'Ship to Ship', sea: { level: 0.9 }, boats: [{ x: 3.25, w: 8 }, { x: 12.75, w: 8 }], fightSpawnX: [6.75, 17.25, 9.25, 14.75],
      ropes: [{ x0: 9.5, up0: 2.8, x1: 13.2, up1: 0.4 }, { x0: 14.5, up0: 2.8, x1: 10.8, up1: 0.4 }],
      props: [{ kind: 'gangplank', x: 12.0, up: 0 }], scenery: [{ kind: 'barrel', x: 4.5, up: 0 }, { kind: 'barrel', x: 19.5, up: 0 }] },
    // Harbour Pier (owner, 2026-10-07): a stone quay on the left, a pier of planks on two posts out over the sea to a pier-head, and a
    // rowboat moored off its end (a shallow boat, lower than the pier: the way back up out of the water). The planks are a bridge: a hard
    // blow or a slam breaks one loose (a gap, and a club). Cut the mooring line and the rowboat drifts off.
    { name: 'Harbour Pier', sea: { level: 0.5 },
      ground: [{ x: 2.0, w: 7.0, up: 0.9, thick: 6 }, { x: 10.9, w: 0.2, up: 0.66, thick: 2.4 }, { x: 12.9, w: 0.2, up: 0.66, thick: 2.4 }, { x: 15.0, w: 4.0, up: 0.9, thick: 2.2 }], // (the posts' tops are just under the planks)
      bridge: { x0: 9.0, x1: 15.0, planks: 6 }, boats: [{ x: 19.3, w: 3.0, depth: 0.9 }], ropes: [{ x0: 18.8, up0: 1.3, x1: 19.8, up1: 0.35 }],
      fightSpawnX: [6.75, 15.75, 3.75, 18.25], spawnX: [3.75, 8.25, 15.75, 18.25],
      props: [{ kind: 'plank', x: 5.25, up: 0.9 }], scenery: [{ kind: 'crate', x: 2.45, up: 0.9 }, { kind: 'barrel', x: 21.2, up: 0 }] },
    // Tidal Cove (owner, 2026-10-07): a treasure cove at low tide. The sea rises over the round (1.6 m in 30 s; low again at the start of
    // the next): the low sand goes under first (wade, then swim), then the dune; the rocks at both ends and the two old timbers above stay
    // dry, so a round ends in a fight for them. A sea chest sits on the dune.
    { name: 'Tidal Cove', sea: { level: 0.3, tide: { rise: 1.6, seconds: 30 } },
      ground: [{ x: 2.0, w: 3.5, up: 1.8, thick: 8 }, { x: 5.5, w: 6.0, up: 0, thick: 6 }, { x: 11.5, w: 4.0, up: 0.7, thick: 6 }, { x: 15.5, w: 3.0, up: 0, thick: 6 }, { x: 18.5, w: 3.5, up: 1.8, thick: 8 }],
      ledges: [{ x: 7.0, up: 2.2, w: 2.5 }, { x: 15.75, up: 2.2, w: 2.0 }],
      fightSpawnX: [7.5, 16.5, 10.0, 13.5], spawnX: [7.5, 12.5, 16.5, 3.75],
      props: [{ kind: 'plank', x: 9.0, up: 0 }], scenery: [{ kind: 'chest', x: 14.85, up: 0.7 }, { kind: 'barrel', x: 21.3, up: 1.8 }] },
    // Sinking Wreck (owner, 2026-10-07): the ship is going down. Over the round's first 25 s it settles deeper and leans bow down (the
    // right end) more and more, slowly at first, then faster as it floods: the bow goes under, the barrels and crate slide toward it,
    // and the stern stays dry longest. Afloat again at the start of the next round.
    { name: 'Sinking Wreck', platformX: 5.75, platformW: 12.5, sea: { level: 0.9 }, boats: [{ x: 5.75, w: 12.5, sinks: { seconds: 25, tilt: 0.3, settle: 0.55 } }],
      props: [{ kind: 'plank', x: 9.5, up: 0 }], scenery: [{ kind: 'barrel', x: 7.3, up: 0 }, { kind: 'crate', x: 12.0, up: 0 }, { kind: 'barrel', x: 16.7, up: 0 }] }], outfits: ['captain', 'buccaneer', 'first mate', 'cabin boy'] },
  // Main Street (owner's list; the era's main map, with shop windows): the street between two shops; each shop's window is real glass you can be thrown
  // through (or punch or shoot out) into the shop. The shop roofs and the porch roof in the middle are ledges. Barrels; revolvers.
  { id: 'westerns', name: 'The Wild West', special: false, pickups: ['derringer', 'revolver', 'coach-gun', 'pickaxe', 'buffalo-rifle'], strong: 2, sky: 0xc9915a, platform: 0x8a6240, wall: 0x6a4a34, weapon: 'rifle', arena: { name: 'Main Street', gunsOnly: true, spawnSpots: [0.33, 0.5, 0.67], platformX: 1.5, platformW: 21, walls: [{ side: -1, up: 1.9, gap: 0 }, { side: 1, up: 1.9, gap: 0 }],
    ledges: [{ x: 1.5, up: 1.9, w: 4.5 }, { x: 10.5, up: 1.9, w: 3.0 }, { x: 18.0, up: 1.9, w: 4.5 }], fightSpawnX: [9.43, 14.57, 11.2, 12.8],
    scenery: [{ kind: 'pane', x: 5.95, up: 0 }, { kind: 'pane', x: 18.05, up: 0 }, { kind: 'barrel', x: 7.3, up: 0 }, { kind: 'barrel', x: 16.7, up: 0 }] }, alt: [ // (the old western street is retired: the era is the owner's five)
    // The Train (owner's list): on the roofs of a moving train, no weapons; signs and tunnel mouths come at you (a whistle first): get
    // down or be swept off; throw people into them
    { name: 'Train', wind: { base: 6, gust: 6, dir: -1 }, ground: [{ x: 1.0, w: 6.5 }, { x: 8.75, w: 6.5 }, { x: 16.5, w: 6.5 }], platformThickness: 2.2, fightSpawnX: [4.0, 20.0, 10.5, 13.5], noWeapons: true, roll: 10,
      train: { speed: 10, cycle: 8, passing: [{ kind: 'sign', at: 3 }, { kind: 'tunnel', at: 7 }] } },
    // Rooftops (owner's list): across the town's roofs at different heights; the alleys between them are the void. Revolvers.
    { name: 'Rooftops', gunsOnly: true, wind: { base: 1, gust: 7, dir: -1 }, platformThickness: 6, ground: [{ x: 0.4, w: 4.0 }, { x: 5.6, w: 3.8, up: 1.0 }, { x: 10.6, w: 3.8, up: 0.4 }, { x: 15.6, w: 3.8, up: 1.2 }, { x: 20.6, w: 3.2, up: 0.2 }],
      fightSpawnX: [2.4, 22.2, 7.5, 17.5], spawnX: [7.5, 12.5, 2.4, 17.5] },
    // Saloon Brawl (owner's list): a bar fight indoors (walls both sides): the bar counter to stand on, a balcony above (from the
    // counter), bar stools to swing and beer mugs to throw or smash over heads. Fists, stools and mugs only.
    { name: 'Saloon', platformX: 2.5, platformW: 19, walls: [{ side: -1, up: 4.5, gap: 0 }, { side: 1, up: 4.5, gap: 0 }], noWeapons: true,
      ground: [{ x: 2.5, w: 7 }, { x: 9.5, w: 4, up: 1.1, thick: 2.3 }, { x: 13.5, w: 8 }], ledges: [{ x: 14.5, up: 2.6, w: 7 }], fightSpawnX: [6.67, 17.33, 8.8, 15.2],
      scenery: [{ kind: 'stool', x: 5.5, up: 0 }, { kind: 'stool', x: 8.0, up: 0 }, { kind: 'stool', x: 15.5, up: 0 }, { kind: 'stool', x: 18.0, up: 0 },
        { kind: 'mug', x: 10.3, up: 1.1 }, { kind: 'mug', x: 11.5, up: 1.1 }, { kind: 'mug', x: 12.7, up: 1.1 }, { kind: 'mug', x: 19.5, up: 2.6 },
        { kind: 'lantern', x: 6.0, up: 2.8 }, { kind: 'lantern', x: 11.5, up: 3.0 }] },
    // Water Tower (owner's list): on the round top of the town's water tower, with a narrow catwalk round it lower down; shoot the tank
    // and water jets out of the hole and shoves whoever it catches. Revolvers come as pickups.
    { name: 'Water Tower', gunsOnly: true, wind: { base: 2, gust: 8, dir: 1 }, ground: [{ x: 5.0, w: 3.5, up: -1.6, thick: 0.15 }, { x: 8.5, w: 7.0, thick: 3.2 }, { x: 15.5, w: 3.5, up: -1.6, thick: 0.15 }], tower: { x: 8.5, w: 7.0 },
      fightSpawnX: [6.5, 17.5, 10.25, 13.75], spawnX: [10.25, 13.75, 6.5, 17.5] }], outfits: ['sheriff', 'outlaw', 'gambler', 'rancher'] },
  { id: 'ww1', name: 'World War I', special: false, gunRounds: 0.5, pickups: ['grenade', 'flare-pistol', 'trench-gun', 'bayonet-rifle', 'lewis-gun'], strong: 2, style: { grain: 0.05 }, sky: 0x7b8576, platform: 0x5a5444, wall: 0x45463c, weapon: 'shovel', arena: { ledges: [/* islands out past each end of the ground, over the void */ { x: 2.25, up: 0.6, w: 2.0 }, { x: 19.75, up: 0.6, w: 2.0 }] }, outfits: ['infantry', 'officer', 'medic', 'trench raider'] },
  { id: 'vietnam', name: 'Vietnam', special: false, gunRounds: 0.5, pickups: ['bamboo-stick', 'jungle-carbine', 'thumper', 'bayonet-knife'], strong: 2, sky: 0x5f8a5a, platform: 0x6a5a3c, wall: 0x4a5a3c, weapon: 'machete', arena: { platformW: 12.5, ledges: [{ x: 11.25, up: 1.8, w: 2.0 }], front: [{ kind: 'grass', x: 1.25, y: 13.75, scale: 3.0 }, { kind: 'grass', x: 4.0, y: 13.9, scale: 2.1 }, { kind: 'grass', x: 22.25, y: 13.8, scale: 2.75 }] }, outfits: ['jungle grunt', 'scout', 'radioman', 'tunnel rat'] },
  { id: 'modern', name: 'Modern Warfare', special: false, pickups: ['combat-knife', 'smg', 'beanbag', 'marksman', 'riot-shield', 'rocket-tube'], strong: 3, sky: 0x7a8794, platform: 0x585d63, wall: 0x42474c, weapon: 'baton', arena: { gunsOnly: true, platformX: 6.0, platformW: 12.0, walls: [/* a building across the alley */ { side: 1, up: 3.0, gap: 1.4 }], ledges: [{ x: 10.75, up: 1.8, w: 2.5 }] }, outfits: ['rifleman', 'sniper', 'operator', 'engineer'] },
  { id: 'scifi', name: 'Space Age', special: false, gunRounds: 0.5, pickups: ['plasma-blade', 'ray-pistol', 'plasma-repeater', 'freeze-ray', 'swap-pistol', 'bubble-blaster', 'tractor-beam', 'gravity-hammer', 'rail-gun', 'black-hole'], strong: 3, style: { blur: 3, haze: 0.06, grain: 0.02 }, sky: 0x3a3f6b, platform: 0x4a5a7a, wall: 0x2e3350, weapon: 'energy-staff', arena: { platformX: 5.875, platformW: 12.25, ledges: [{ x: 6.75, up: 1.8, w: 2.0 }, { x: 15.25, up: 1.8, w: 2.0 }, { x: 10.75, up: 3.6, w: 2.5 }] }, outfits: ['pilot', 'android', 'marine', 'scientist'] },
  // Intermittent specials (the list will grow):
  { id: 'fantasy', name: 'Fantasy Archers', special: true, pickups: ['wizard-staff', 'war-hammer'], sky: 0x5a7a8a, platform: 0x5a6a3a, wall: 0x3e4a30, weapon: 'longbow', arena: { ledges: [{ x: 7.5, up: 1.8, w: 2.25 }, { x: 14.25, up: 1.8, w: 2.25 }] }, outfits: ['ranger', 'elf', 'hunter', 'druid'] },
  { id: 'mobsters', name: 'Mobsters', special: true, pickups: ['crowbar', 'lead-pipe'], sky: 0x4a3a4a, platform: 0x5a4a44, wall: 0x372c34, weapon: 'bat', arena: { platformX: 6.25, platformW: 11.5, fightSpawnX: [7.75, 16.25, 10.5, 13.5], walls: [/* the alley's brick wall */ { side: -1, up: 2.5, gap: 0 }], scenery: [{ kind: 'crate', x: 6.8, up: 0 }, { kind: 'barrel', x: 17.1, up: 0 }] }, outfits: ['boss', 'enforcer', 'accountant', 'getaway driver'] },
];

export const eraById = (id: string): Era => eras.find((e) => e.id === id) ?? eras[0];
/** Which map of an era has this name (0 = its main map, then its other maps in order), for links and tests that pick a map. */
export function mapNamed(eraId: string, name: string): number {
  const e = eraById(eraId), i = [e.arena, ...(e.alt ?? [])].findIndex((a) => a.name === name);
  if (i < 0) throw new Error(`no map called ${name} in ${eraId}`);
  return i;
}

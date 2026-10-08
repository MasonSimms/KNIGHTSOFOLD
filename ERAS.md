# Era plan: 12 eras x 5 arenas = 60 rounds, about one hour

Planning only, nothing here is built yet (except where marked BUILT). Everything is a first draft for the owner to cut and change.

## The shape of a full game (owner's answers, 2026-10-05)
- The GAME is built from a pool of about 60 arenas: 12 eras x 5 arenas each. Every match picks 12 arenas at random from the pool, one era after another in chronological order, and plays them in that order.
- SPECIALS (fantasy archers, mobsters, ...) turn up now and then at random, in the middle of that order. A special replaces a whole era's slot (the owner: "it replaces a chapter", for replayability), and its arena is picked from the special's own pool of 5.
- Rounds end by nature (a knockoff win, as now). There is no timer. Pacing comes from the weapons instead: more and better weapons spawn more rapidly as a round goes on, so fights escalate and finish themselves.
- Every era has: one SIGNATURE WEAPON that everyone starts with, 2 PICKUP weapons that spawn in during the round (these are the "better weapons" the spawner hands out later), and 5 ARENAS each with one physics idea.
- All of the proposed eras (Egypt, Roman, Viking, Medieval) are kept.
- ASSUMPTION TO CONFIRM: with 12 rounds per match, a match is about 12 rounds long (roughly 12 to 15 minutes), and the 60-arena pool is what gives replay value, not a one-hour sitting. If the owner meant a 60-round hour, an era would be a 5-round chapter instead.

## Chronological order
| # | Era | Rough date | Signature weapon | Status |
|---|-----|-----------|------------------|--------|
| 1 | Cavemen | prehistory | Bone Club | BUILT (placeholder) |
| 2 | Ancient Egypt | 2500 BC | Khopesh (curved blade) | new |
| 3 | Roman Gladiators | 100 AD | Gladius (short sword) | new |
| 4 | Vikings | 900 | Battle Axe | new |
| 5 | Medieval Knights | 1300 | Longsword | new |
| 6 | Samurai Knights | 1550 | Katana | BUILT (placeholder) |
| 7 | Pirates | 1715 | Cutlass | new, decided: a NORMAL era with boat and water physics |
| 8 | The Wild West | 1870 | Rifle (as a club) | BUILT (placeholder) |
| 9 | World War I | 1916 | Trench Shovel | BUILT (placeholder) |
| 10 | Vietnam | 1968 | Machete | BUILT (placeholder) |
| 11 | Modern Warfare | 2020 | Riot Baton | BUILT (placeholder) |
| 12 | Space Age | 2300 | Energy Staff | BUILT (placeholder) |

Rule for every map (owner, 2026-10-05, Stick Fight and SpiderHeck): open, and platforms never in the way. A floating ledge leaves at least 1.5 m under it (room to walk under; weapons in a hand pass through the scenery, so swings are never blocked), and a jump gets you onto it from somewhere. Side walls only where the map is about them (a backstop, a parapet you get thrown over, or a wall across a gap you wall-jump out of): most maps are open at both ends. The maps test checks every map (ideas below with ceilings or low overhangs, like the Bunker Walkway, break this rule and need rethinking).

Rule of thumb for weapons: signature weapons are long-melee "clubs" like the current engine. Pickups are where new behaviour comes in (a shield that parries, something thrown, a grappling tool), and each one needs an engine feature, listed in "What the engine needs".

---

## 1. Cavemen
Pickups: **Stone Hammer** (very heavy, slow, huge impact), **Mammoth Tusk** (long, light, sharp).
The owner's arena list (handwritten, 2026-10-06; REPLACES the earlier plan). Not built yet: online comes first.
1. **Campfire Clearing**: flat grassy ground with a campfire in it; the fire deals damage. Everyone starts with a stick. (Needs: a hazard zone that hurts.) **BUILT 2026-10-06** (cavemen map 1, placeholder look): the fire burns you and sets you (and wooden clubs) burning.
2. **Tar Pit**: a pit of tar in the centre with grassy ground on either side. Everyone starts with a stick. (Needs: a tar zone that slows and holds you; the old "Tar Pit Ledge" idea had it sink bodies and drag everything.) **BUILT 2026-10-06** (cavemen map 2): a 3 m pit between grassy cliffs; slow, a weak kick, 3 s and it swallows you.
3. **Standing Stones**: a Stonehenge-like structure whose rocks can fall and crush players. Stone weapons. (Needs: big loose rock bodies balanced on the uprights, crushing by weight: the crush death exists.) **BUILT 2026-10-06** (cavemen map 3): two stone doorways; the uprights stand a step behind the fighters, the 3 m capstones lie loose on top and a hard knock (about a flung body) tips one onto whoever is under it; stone axes.
4. **Mammoth Chase** (a moving map): everyone keeps running to the right while a woolly mammoth chases from the left; touching the mammoth kills you. (Needs: a scrolling map, the mammoth as a moving body.) **BUILT 2026-10-06** (cavemen map 4): a treadmill floor at 2.2 m/s, a painted placeholder mammoth that tosses you out of the picture, boulders and logs riding in, the painting sliding by.
5. **Vine Ravine** BUILT (a log bridge over a gorge, cut it or break it; the main map, cavemen map 0, since 2026-10-07). Not on the owner's list of four: kept as the fifth until the owner says otherwise.
The original plain cave map is retired (owner, 2026-10-06: five arenas per era; done 2026-10-07).
6. **Volcano Rim** **BUILT 2026-10-07** (cavemen map 5; the owner asked for the lava map, though it was off the list): two shelves of black rock either side of a lava pool with a basalt ledge over each; lava sets you burning the moment you touch it and has you in 0.3 s (tuning.lava); a boulder falls from the rim every 5 s (arena.rocks) and crushes whoever it lands on. **The era now has six: the owner decides whether it replaces Vine Ravine.**
Old ideas, not on the list: Mammoth Ribcage (rib bones as platforms you can pull free), Boulder Slope (a rolling boulder).

## 2. Ancient Egypt
Pickups: **Was Sceptre** (long staff), **Golden Flail** (a chain with a weight: swings wildly, hits hard).
1. **Pyramid Steps** BUILT (three floating steps: one 2.8 m up at each end and a top 5.2 m up in the middle): a staircase of ledges, so the high ground matters.
2. **Nile Barge**: a barge floating on the river (reuses the pirate water tech): rocks when people run to one side. **BUILT 2026-10-08** (egypt map 3): a 12.5 m reed barge (painted: papyrus ends, a striped awning, a steering oar, an eye on the prow) on a green river, tipping about twice as far as the pirate ship (arena.boats tilt 0.28: 13 degrees for one fighter at an end, against the ship's 6), an oar and two clay jars that shatter (props.ts jar), reeds along the bank in front.
3. **Toppling Obelisk**: a tall stone obelisk that, if hit hard at its base, falls across the gap as a bridge (or onto someone). **BUILT 2026-10-08** (egypt map 4): a court split by a 2.6 m gap (a running jump crosses it), a terrace each side 1.9 m up, set back from the gap, with a 5 m obelisk on it (props.ts obelisk: 60 kg, too heavy to lift). A body flung into one at 6 m/s or more, or about a second of leaning on it, tips it over: toward the gap it lands flat across it, a stone bridge; away from it, on the court; either way it crushes whoever it lands on. The era has its five.
4. **Sandstorm Temple**: pillars you can break into rubble; wind pushes everyone sideways in gusts. **BUILT 2026-10-07** (egypt map 2): the temple's sand floor between its back wall and the open desert, two stone pillars (props.ts pillar: 45 kg, too heavy to lift, they crush when toppled; 75 hp of club blows break one into three rubble blocks) under a lintel ledge; gusts to 12 m/s toward the open side (arena.wind), shown as sand streaking across (arena.gusts).
5. **Tomb Chamber**: sarcophagus lids as slidey props and a trapdoor floor that drops when the lever (a grabbable prop) is pulled.

## 3. Roman Gladiators
Pickups: **Trident** (long reach, prod), **Net** (thrown to tangle; needs the "entangle" feature).
1. **Colosseum Floor**: trapdoors that open on a timer under the sand. **BUILT 2026-10-07** (gladiators map 3; owner chose it): the sand between the arena walls with two 2 m trapdoors over shafts down to the pit; each rattles for a second, drops open, hangs open, then swings shut, in turn every 9 s (tuning.trapdoor).
2. **Chariot Track**: a runaway chariot crosses now and then and flattens or launches anyone in the way (the knockoff is the track edge). **BUILT 2026-10-07** (gladiators map 4; owner chose it): the circus's sand track the full width of the picture with the spina (a ledge) down the middle; a runaway chariot with no driver charges across every 7 s, one way then back, dust rising on its side 1.2 s first; it flings whoever it catches ahead of it (16 m/s, up 7) and hurts them like a heavy hit (impact 40): out of the picture near the edge it heads for. Jump it (it is 1.5 m tall) or stand on the spina. Bots jump it.
3. **Portcullis Gate**: a heavy gate you can cut loose to drop between fighters.
4. **Lion's Pit** BUILT (first version: two floors, a pit with one stepping stone level with the floor; no crowd yet): ledges over a pit. The fall is the knockoff and the crowd edge shows paint.
5. **Aqueduct Bridge**: a stone bridge of arches. Hard slams break an arch, a gap opens, and the water falls through. **BUILT 2026-10-07** (gladiators map 2; owner chose it): two hills and an 11 m deck of stone blocks on five piers over a deep valley; a club cannot chip a block out, a body slammed or flung into the deck at 9 m/s knocks out the block it hits, and the water pours through the gap, pushing down whoever is in it.

## 4. Vikings
Pickups: **Round Shield** (hold it to parry bigger hits), **Throwing Spear** (picked up, then thrown).
1. **Longship Deck**: a second boat (water tech): choppy fjord, rocking deck, oars as props. **BUILT 2026-10-07** (vikings map 3): a 12.5 m longship (painted as one: oak, a red and cream striped square sail, shields along the rail, a curled stern and a dragon at the prow) on a fjord whose waves are 1.8 times the usual (arena.sea chop), two oars on deck (2 m clubs) and a chest.
2. **Ice Floe Fjord**: floating ice slabs that tilt and drift. Heavy hits crack them. **BUILT 2026-10-07** (vikings map 4): five small floes (3-3.5 m, 0.6 m deep) on the fjord with gaps to jump, slippery (arena.ice 0.85); each tips 0.25 rad with one fighter at its edge; a body coming down on one at 8 m/s (a slam, a flung body, a fall from high; a jump's landing is about 6) cracks it, and the second crack sinks it over 2.5 s (tuning.floe).
3. **Mead Hall**: a long table and benches (all props), plus a chandelier on a rope you can cut. **BUILT 2026-10-07** (vikings map 1; owner chose the Vikings' plan): the hall between pillar walls, the long hearth burning in the middle, a heavy table at each end (stand on it, shove it, tip it onto someone), benches to swing, drinking horns that shatter, and two iron rings of candles on ropes: a club hit or a shot brings one down on whoever is under it (28 kg: it crushes), and its candles go out.
4. **Rune Stone Cliff**: tall standing stones to hide behind, with a high cliff edge and sea below.
5. **Frozen River**: a slippery ice floor (low friction) with a crack zone that breaks under a hard landing. **BUILT 2026-10-07** (vikings map 2): two snowy banks and a 9 m sheet of ice slabs over the river; everything is icy (arena.ice 0.85: you skate, and slide on about three times as far when you stop); a hard landing or a slam (6.5 m/s) breaks a slab out and you are in the icy water.

## 5. Medieval Knights
Pickups: **Mace** (heavy, small head: the biggest hit of any one-hand weapon), **Lance** (very long, only good in a lunge).
1. **Castle Drawbridge**: a chain drawbridge. Cut the chains and it drops (or slams up) and everything on it goes.
2. **Battlements and Catapult**: a wall walk with a catapult arm you can load with props and trigger.
3. **Tournament Lists**: a long flat arena with a barrier rail down the middle (a physics body) and banners to cut.
4. **Great Hall**: a huge chandelier, tapestries, and a suit of armour you can knock apart and wear as a club.
5. **Dungeon Cages**: hanging cages on chains. Cut one and it crashes down. Stone floor with a pit.

## 6. Samurai Knights
Pickups: **Naginata** (very long, sweeping), **Tessen** (iron war fan: short, fast, a good parry).
1. **Dojo Ridge** BUILT (usual samurai arena with narrow walls).
2. **Rope Bridge** BUILT (breakable plank bridge between two cliffs).
3. **Bamboo Grove**: bamboo stalks you can cut and that bend. A cut stalk is a spear or a ramp.
4. **Pagoda Rooftops**: sloped tiled roofs that tilt you down and loose roof tiles.
5. **Waterfall Torii**: a stone gate on a cliff over a waterfall: the sliding water pushes you downstream and off.

## 7. Pirates (decided: normal era; water and boat physics)
Pickups: **Flintlock Pistol** (clubbed with, or thrown), **Grappling Hook** (a hook and rope: hang it on something and swing).
1. **Ship Deck** (BUILT 2026-10-06, the era's main map): the main set piece: a hull floating on the water that rocks as people jump, with mast, rigging and barrels on deck. (Barrels not yet: the mast and rigging are painted, not physical.)
2. **Ship to Ship**: two boats side by side joined by a gangplank (a plank prop). Cut the ropes and they drift apart. **BUILT 2026-10-06** (pirates map 1): two 8 m ships, a 1.5 m gap, a 2.6 m gangplank lying across it and two ropes in an X from each ship's rigging to the other's rail; a blade or a bullet cuts a rope, and with both cut the ships drift apart (the gap opens to about 4 m) and the gangplank falls in.
3. **Harbour Pier**: a wooden pier on posts over shallow water, with barrels and crates. A broken plank is a gap and a club. **BUILT 2026-10-07** (pirates map 2): a stone quay, a 6 m pier of six breakable planks on two posts, a pier-head, and a shallow rowboat moored off its end (lower than the pier: the way back up out of the water); cut the mooring line and it drifts off. The water is deep (swim, then sink), not shallow.
4. **Sinking Wreck**: a hull that slowly tilts and sinks as the round goes on. The high side is safe and moves. **BUILT 2026-10-07** (pirates map 4; owner: slowly over the round): the Ship Deck's ship, going down over the round's first 25 s (it settles 0.55 m deeper and leans up to 0.3 rad bow down, slowly then faster): the bow goes under, the barrels and crate slide toward it, the stern stays dry longest. Afloat again next round.
5. **Tidal Cove**: a treasure cove where the tide rises and falls with the frame counter. The sand platform shrinks as the water comes in. **BUILT 2026-10-07** (pirates map 3; owner: the tide rises over the round): low sand, a dune with a sea chest, high rocks at both ends and two old timbers above; the sea comes up 1.6 m over the first 30 s of a round (low again next round), so the sand goes under, then the dune, and a round ends on the rocks and timbers.

## 8. The Wild West
Pickups: **Revolver**, **Lasso** (grab from a distance, needs the "grab at range" feature).
The owner's arena list (handwritten, 2026-10-06; REPLACES the earlier plan). Not built yet: online comes first.
1. **Main Street**: a dirt road with storefronts behind; players can get revolvers. **BUILT 2026-10-06** (westerns map 0, the main map since 2026-10-07): a shop at each end with a real glass window you can be thrown through, roofs and a porch roof to stand on, barrels.
2. **Rooftops**: on top of the town's buildings; falling off kills you (the gaps between roofs are the void). Players can get revolvers. **BUILT 2026-10-06** (westerns map 2): five roofs at different heights, 1.2 m alleys.
3. **Train**: a moving train with NO weapons: throw other players into the obstacles, and avoid the wooden signs and tunnels that pass. (Needs: a moving map, passing obstacles that hit you: the front plane's passing sign was planned for this.) **BUILT 2026-10-06** (westerns map 1): three boxcars, the land rushing past (motion-blurred), a sign and a tunnel mouth every 8 s with a whistle first.
4. **Saloon Brawl**: a bar fight inside the saloon, with beer glasses and bar stools to throw. **BUILT 2026-10-06** (westerns map 3): walls both sides, a bar counter to jump onto, a balcony from it, four stools, four mugs that shatter; fists, stools and mugs only.
5. **Water Tower**: on top of a water tower. **BUILT 2026-10-06** (westerns map 4): the tank top with a narrow catwalk each side 1.6 m below; shoot the tank's side and water jets out for 4 s, blasting whoever it catches off balance and off the catwalk.
Revolvers SHOOT (owner, 2026-10-06; built: see DECISIONS.md).
The old western street (the era's first map) is retired (owner, 2026-10-06: five arenas per era; done 2026-10-07).

## 9. World War I
Pickups: **Bayonet Rifle** (long, good lunge), **Stick Grenade** (thrown, goes off after a short time with a push, not a kill).
1. **Trench**: muddy trench with duckboards (planks to pick up) and sandbags.
2. **No Man's Land**: craters, barbed wire (sticky zone) and a long exposed top.
3. **Biplane Wing**: standing on a plane wing as it lurches (moving platform; air is the knockoff).
4. **Bunker Walkway**: low concrete bunker with a ceiling, so you have to crouch and wall jumps do not work.
5. **Slow Tank**: a tank crawls across the arena. The hull is the platform, and its tracks are a hazard.

## 10. Vietnam
Pickups: **Bamboo Stick** (long, bendy, light), **Bayonet Knife** (very short, very fast).
1. **Rice Paddy**: shallow water that slows everyone, with dikes (low walls) to stand on.
2. **Tunnel Network**: cramped low ceilings, so crouch and crawl are important.
3. **Jungle Canopy**: tree platforms linked by ropes. Cut a rope and a platform swings away.
4. **River Boat**: a small patrol boat on a river (water tech, a lighter boat than the pirate ship).
5. **Helicopter Pad**: a hovering helicopter's skid sways. The whole platform tips if everyone stands on one side.

## 11. Modern Warfare
Pickups: **Combat Knife** (very short, very fast), **Riot Shield** (big shield: blocks and shoves).
1. **Skyscraper Rooftop**: a flat roof edge with air vents, a window cleaner's platform on ropes, and a long fall.
2. **Subway Station**: a train passes through now and then. Stand back from the edge of the platform.
3. **Construction Crane**: a crane arm with a swinging load you can grab, cut, and drop.
4. **Highway Overpass**: cars pass below and a guardrail along the edge (props).
5. **Parking Garage**: concrete floors with gaps, and cars you can push off the edge.

## 12. Space Age
Pickups: **Plasma Blade** (short, huge impact), **Gravity Hammer** (a hit pulls the victim instead of pushing).
1. **Station Hull**: low gravity: everyone jumps higher and falls slowly.
2. **Asteroid Field**: drifting rocks as platforms.
3. **Reactor Core**: a glowing core in the middle that pulses and pushes everyone away.
4. **Alien Planet**: low gravity with big bouncy spore pods.
5. **Airlock**: an airlock door that opens on a timer: a sudden pull toward the door, and its far side is the knockoff.

---

## Specials (random, about 8%: about one a match)
In the game at launch (owner, 2026-10-06): **Fantasy Archers** (longbow-as-staff) and **Mobsters** (bat), and only these two. Each needs 5 arenas to stand in for a whole chapter; they are built last. Ideas to fill the list: Zombie Apocalypse, Ancient Greece (hoplites with spear and shield), Wizards, Dinosaur Age (cavemen with raptors), Robots.

## What the engine needs (in build order, cheapest first)
1. **Match schedule**: a pure function of the match seed (like eraFor now): 12 slots in chronological era order, each slot picks one arena at random from its era's 5 (a special occasionally swaps in at a slot). Replaces today's random era every round. (small, sim/era.ts and eras.ts; 5 fixed arenas per era, no more `alt` maps)
2. **Weapon spawner with escalation**: weapons drop into the arena during a round, the rate rising over time, with each era's pickups (better ones) appearing later. A data table per era (spawn times, weights, rates in tuning). Replaces the round timer.
3. **Cuttable ropes and chains**: BUILT for the bridge. Generalise it for the drawbridge, vines, chandeliers, cages, crane and rope bridges. Unlocks about 15 arenas.
4. **Water and buoyancy** (BUILT 2026-10-06: sim/water.ts, arena.sea and arena.boat; the owner chose a short swim and a self-righting ship): the pirate slice, deterministic (waves from the frame counter). Unlocks Egypt barge, longship, ice floes, pirate arenas, paddy, river boat, waterfall.
5. **Moving platforms**: train, tank, barge, plane wing, chariot, helicopter.
6. **Hazard zones**: lava, tar, wind, barbed wire, ice (low friction), low gravity. Data-driven zones with one effect each.
7. **New weapon behaviours**: shield (parry), thrown objects, grab at range (lasso, grapple), entangle (net). Each is a one-time engine feature, then data rows.

## Open questions for the owner
1. Settled: a match is 12 rounds (one arena per era); see DECISIONS.md, MATCH END AND REMATCH.
2. Weapon spawns: should they appear anywhere on the map or only at fixed spots per arena (data)? Recommended: fixed spots plus a few random airdrops.
3. Settled 2026-10-06: specials at about 8% per slot.

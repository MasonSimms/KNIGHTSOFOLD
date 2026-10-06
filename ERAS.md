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
1. **Campfire Clearing**: flat grassy ground with a campfire in it; the fire deals damage. Everyone starts with a stick. (Needs: a hazard zone that hurts.) **BUILT 2026-10-06** (cavemen map 2, placeholder look): the fire burns you and sets you (and wooden clubs) burning.
2. **Tar Pit**: a pit of tar in the centre with grassy ground on either side. Everyone starts with a stick. (Needs: a tar zone that slows and holds you; the old "Tar Pit Ledge" idea had it sink bodies and drag everything.) **BUILT 2026-10-06** (cavemen map 3): a 3 m pit between grassy cliffs; slow, a weak kick, 3 s and it swallows you.
3. **Standing Stones**: a Stonehenge-like structure whose rocks can fall and crush players. Stone weapons. (Needs: big loose rock bodies balanced on the uprights, crushing by weight: the crush death exists.) **BUILT 2026-10-06** (cavemen map 4): two stone doorways; the uprights stand a step behind the fighters, the 3 m capstones lie loose on top and a hard knock (about a flung body) tips one onto whoever is under it; stone axes.
4. **Mammoth Chase** (a moving map): everyone keeps running to the right while a woolly mammoth chases from the left; touching the mammoth kills you. (Needs: a scrolling map, the mammoth as a moving body.)
5. **Vine Ravine** BUILT (a log bridge over a gorge, cut it or break it). Not on the owner's list of four: kept as the fifth until the owner says otherwise.
Old ideas, not on the list: Mammoth Ribcage (rib bones as platforms you can pull free), Boulder Slope (a rolling boulder), Volcano Rim (lava and falling rocks).

## 2. Ancient Egypt
Pickups: **Was Sceptre** (long staff), **Golden Flail** (a chain with a weight: swings wildly, hits hard).
1. **Pyramid Steps** BUILT (three floating steps: one 2.8 m up at each end and a top 5.2 m up in the middle): a staircase of ledges, so the high ground matters.
2. **Nile Barge**: a barge floating on the river (reuses the pirate water tech): rocks when people run to one side.
3. **Toppling Obelisk**: a tall stone obelisk that, if hit hard at its base, falls across the gap as a bridge (or onto someone).
4. **Sandstorm Temple**: pillars you can break into rubble; wind pushes everyone sideways in gusts.
5. **Tomb Chamber**: sarcophagus lids as slidey props and a trapdoor floor that drops when the lever (a grabbable prop) is pulled.

## 3. Roman Gladiators
Pickups: **Trident** (long reach, prod), **Net** (thrown to tangle; needs the "entangle" feature).
1. **Colosseum Floor**: trapdoors that open on a timer under the sand.
2. **Chariot Track**: a runaway chariot crosses now and then and flattens or launches anyone in the way (the knockoff is the track edge).
3. **Portcullis Gate**: a heavy gate you can cut loose to drop between fighters.
4. **Lion's Pit** BUILT (first version: two floors, a pit with one stepping stone level with the floor; no crowd yet): ledges over a pit. The fall is the knockoff and the crowd edge shows paint.
5. **Aqueduct Bridge**: a stone bridge of arches. Hard slams break an arch, a gap opens, and the water falls through.

## 4. Vikings
Pickups: **Round Shield** (hold it to parry bigger hits), **Throwing Spear** (picked up, then thrown).
1. **Longship Deck**: a second boat (water tech): choppy fjord, rocking deck, oars as props.
2. **Ice Floe Fjord**: floating ice slabs that tilt and drift. Heavy hits crack them.
3. **Mead Hall**: a long table and benches (all props), plus a chandelier on a rope you can cut.
4. **Rune Stone Cliff**: tall standing stones to hide behind, with a high cliff edge and sea below.
5. **Frozen River**: a slippery ice floor (low friction) with a crack zone that breaks under a hard landing.

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
2. **Ship to Ship**: two boats side by side joined by a gangplank (a plank prop). Cut the ropes and they drift apart.
3. **Harbour Pier**: a wooden pier on posts over shallow water, with barrels and crates. A broken plank is a gap and a club.
4. **Sinking Wreck**: a hull that slowly tilts and sinks as the round goes on. The high side is safe and moves.
5. **Tidal Cove**: a treasure cove where the tide rises and falls with the frame counter. The sand platform shrinks as the water comes in.

## 8. The Wild West
Pickups: **Revolver**, **Lasso** (grab from a distance, needs the "grab at range" feature).
The owner's arena list (handwritten, 2026-10-06; REPLACES the earlier plan). Not built yet: online comes first.
1. **Main Street**: a dirt road with storefronts behind; players can get revolvers.
2. **Rooftops**: on top of the town's buildings; falling off kills you (the gaps between roofs are the void). Players can get revolvers.
3. **Train**: a moving train with NO weapons: throw other players into the obstacles, and avoid the wooden signs and tunnels that pass. (Needs: a moving map, passing obstacles that hit you: the front plane's passing sign was planned for this.)
4. **Saloon Brawl**: a bar fight inside the saloon, with beer glasses and bar stools to throw.
5. **Water Tower**: on top of a water tower.
OPEN (ask the owner before building): does a revolver SHOOT here (the game has no guns yet: a new weapon kind, and it changes balance), or is it still clubbed and thrown as planned?

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

## Specials (random, 15%)
Already chosen: **Fantasy Archers** (longbow-as-staff) and **Mobsters** (bat). Each needs 5 arenas to stand in for a whole chapter. Ideas to fill the list: Zombie Apocalypse, Ancient Greece (hoplites with spear and shield), Wizards, Dinosaur Age (cavemen with raptors), Robots.

## What the engine needs (in build order, cheapest first)
1. **Match schedule**: a pure function of the match seed (like eraFor now): 12 slots in chronological era order, each slot picks one arena at random from its era's 5 (a special occasionally swaps in at a slot). Replaces today's random era every round. (small, sim/era.ts and eras.ts; 5 fixed arenas per era, no more `alt` maps)
2. **Weapon spawner with escalation**: weapons drop into the arena during a round, the rate rising over time, with each era's pickups (better ones) appearing later. A data table per era (spawn times, weights, rates in tuning). Replaces the round timer.
3. **Cuttable ropes and chains**: BUILT for the bridge. Generalise it for the drawbridge, vines, chandeliers, cages, crane and rope bridges. Unlocks about 15 arenas.
4. **Water and buoyancy** (BUILT 2026-10-06: sim/water.ts, arena.sea and arena.boat; the owner chose a short swim and a self-righting ship): the pirate slice, deterministic (waves from the frame counter). Unlocks Egypt barge, longship, ice floes, pirate arenas, paddy, river boat, waterfall.
5. **Moving platforms**: train, tank, barge, plane wing, chariot, helicopter.
6. **Hazard zones**: lava, tar, wind, barbed wire, ice (low friction), low gravity. Data-driven zones with one effect each.
7. **New weapon behaviours**: shield (parry), thrown objects, grab at range (lasso, grapple), entangle (net). Each is a one-time engine feature, then data rows.

## Open questions for the owner
1. Confirm the assumption above: a match is 12 rounds (one arena per era), with the 60-arena pool for replay variety.
2. Weapon spawns: should they appear anywhere on the map or only at fixed spots per arena (data)? Recommended: fixed spots plus a few random airdrops.
3. Do specials stay about 15% per slot?

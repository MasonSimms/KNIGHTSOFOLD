# Knights of Old: marketing and launch plan

Living plan. Keep it current like DECISIONS.md. The full formatted version (with the timeline picture) is the "Knights of Old — Steam Launch Marketing Plan" doc in the owner's Claude artifacts; this file is the copy every Claude session reads.

## Status (update weekly)
- Last updated: 2026-10-06 (direction round: name, showcase eras, demo, specials)
- Name: **Old Masters** (no subtitle; owner, 2026-10-06). Owner to do: a trademark lawyer's check before the page goes up. Backup: Epochalypse.
- Wishlists: 0 (no Steam page yet). Owner: write the Steamworks number here every Monday.
- Steam page: not created. Steamworks account: not created.
- Next marketing deadline: Wild West, Cavemen and Pirates in final paint by 2026-11-01 (art handoffs 10-15, 10-20, 10-25); Coming Soon page public by 2026-11-15.
- Launch scope DECIDED (owner, 2026-10-06): the full game, 12 eras x 5 arenas, plus the 2 specials (Fantasy Archers, Mobsters) x 5: about 70 arenas, 27 built. Not Early Access unless the pace slips.

## Launch window
- Target launch: Tuesday 2027-03-09 (one week after Steam Next Fest). Fallback: Tuesday 2027-04-13.
- Not before: an early-January launch misses Next Fest (registration closes 2027-01-10) and leaves no time for wishlists.
- Avoid: launching during the Steam Spring Sale (2027-03-18 to 03-25).

## Fixed dates
| Date | What | Who sets it |
|------|------|-------------|
| 2026-11-15 | Coming Soon page public (needs capsule, 5+ screenshots, trailer v1) | us |
| 2027-01-10 | Next Fest registration closes | Valve |
| 2027-01-18 | Trailer used for Valve's own Next Fest promotion | Valve |
| 2027-01-25 | Store page reviewed + demo submitted | Valve |
| 2027-02-08 | Everything in review for Next Fest | Valve |
| 2027-02-08 to 02-15 | Couch Co-Op Fest (check the opt-in deadline in Steamworks) | Valve |
| 2027-02-11 | Next Fest press preview opens | Valve |
| 2027-02-22 to 03-01 | Steam Next Fest | Valve |
| 2027-03-09 | Launch | us |

Source: https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027 and https://www.pcgamer.com/games/steam-reveals-all-the-sale-dates-and-themed-events-for-the-first-half-of-2027/

## What development must deliver for marketing (the links between the two sides)
- By 2026-11-01: the showcase eras, Wild West, Cavemen and Pirates, in FINAL paint (capsule art, screenshots and trailer are made from them). Placeholder eras are never shown in marketing.
- By 2026-11-15: a build stable enough to record trailer footage of 4-player fights.
- By 2027-01-25: the demo (separate Steam app): the 3 showcase eras with all their arenas, local + online + Remote Play Together, a wishlist prompt on the end screen. The same demo goes on itch.io as the free browser version. knightsofold.fly.dev stays friends-only until then.
- By 2027-03-09: launch build (Electron + Steamworks.js, Steam Deck check, achievements optional).
- Every playtest is recorded (OBS) so it can be cut into clips.
- ASSETS.md stays exact: the Steam AI disclosure is answered from it.

## Positioning
- Pitch: "Brawl through all of human history in one match, inside a moving oil painting."
- Hooks: the era hop (bone club to energy staff), the painted look (paint splatter stays on the canvas), everything is a weapon (cut the bridge, swing a severed leg).
- Audience: friend groups on a Discord call (15-25 min sessions), streamers who want chaotic clips, couch co-op / Steam Deck players.
- Comparables (format only): Stick Fight: The Game, SpiderHeck, Rounds, Gang Beasts.
- Tags: Party, Local Multiplayer, Online PvP, Physics, Fighting, Funny, Hand-drawn/Painted, Remote Play Together, Controller, Steam Deck.
- Price: $5-10, checked against the comparables before the page goes live. Consider a 4-pack.

## Wishlist checkpoints
| Checkpoint | Date | Target | If well short |
|------------|------|--------|---------------|
| Page live 4 weeks | early Dec 2026 | 300 | Change capsule and first GIF |
| Next Fest registration | 2027-01-10 | 1,000 | More clips; new hook in the first 3 seconds |
| Next Fest starts | 2027-02-22 | 2,000 | Push the demo to streamers in press-preview week |
| Next Fest ends | 2027-03-01 | 4,000 | Move launch to 2027-04-13 |
| Launch | 2027-03-09 | 5,000+ | Launch anyway in Early Access |
Benchmark: 5,000 is a solid first solo launch; about 7,000 gathered quickly tends to reach Popular Upcoming (https://presskit.gg/field-guides/how-many-wishlists-to-launch).

## Channels (zero budget), by return per hour
1. Steam: Coming Soon page, a devlog post every 2 weeks, Next Fest, Couch Co-Op Fest.
2. TikTok, YouTube Shorts, Instagram Reels: 8-15 s clips, 3-5 a week, the same clip on all three, a wishlist end card.
3. Reddit: r/IndieGaming, r/IndieDev, r/gamedev (Screenshot Saturday), r/LocalMultiplayerGames, r/couchcoop. 1-2 posts a week; follow each sub's rules.
4. X and Bluesky: #screenshotsaturday, #indiedev, 3 a week.
5. Free browser demo on itch.io with a wishlist button.
6. Streamers (1k-50k subs, party games): Steam keys + a short pitch, 10 a week from January; offer keys for their friends.
7. Discord server: playtest sign-ups, clip of the week, patch notes.
8. Press: a press kit + emails in early February (press preview week).
Use a UTM link per platform (?utm_source=tiktok); Steamworks reports wishlists per link.

## Store page checklist
- [ ] Steamworks signup, $100 app fee, tax and bank forms
- [x] Name chosen: Old Masters. Web check done 2026-10-06 (no exact game title; Valley of the Old Masters on Steam is nearby; a live OLD MASTERS mark covers paint finishes)
- [ ] Trademark lawyer's check of "Old Masters" (owner)
- [ ] Capsule art in every required size, re-run with the new name (tools/store-art/capsules.py takes the name as an argument)
- [ ] 5+ screenshots from the 3 showcase eras, each a different arena, each a fight in progress
- [ ] 3-5 GIFs for the description
- [ ] Trailer 30-60 s, action in the first 2 seconds
- [ ] Short description + feature list
- [ ] Tags, Controller and Steam Deck marked
- [ ] Content survey (mild cartoon violence) + AI disclosure from ASSETS.md
- [ ] Demo app
- [ ] Press kit + Discord link

## Weekly routine (about 3 hours)
1. One recorded playtest with friends.
2. Cut 3-5 clips, schedule them on every short-video platform.
3. One Reddit post; reply to every comment.
4. Write the wishlist number in Status above; note which link brought them.
5. Every second week: a Steam devlog post.

## Decision gates
- 2026-11-15: is the page live? If not, everything after slips by the same amount.
- 2027-01-10: register for Next Fest only if the demo can be stable by 2027-01-25.
- 2027-03-01: 4,000+ wishlists -> launch 03-09; fewer -> launch 04-13.

## Log
- 2026-10-05: Plan created. Launch target 2027-03-09, Early Access recommended, launch scope still open.
- 2026-10-06: Launch scope decided: full game (12 x 5). Pirates: Ship Deck built (a floating ship that rocks, a sea you can swim in for a few seconds): a good trailer and GIF moment (someone knocked overboard, kicking back up the side).
- 2026-10-06: Direction round. The name is Old Masters. Showcase eras are Wild West, Cavemen and Pirates. The demo is those 3 eras. Specials are in at launch (about 70 arenas). Weapons are built next; real weapon shapes come first, and they appear in every screenshot.

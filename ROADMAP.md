# Roadmap

The plan in plain English: where the game is, what comes next, and how we know each step is done. Written 2026-10-05 from the
owner's answers in a round of questions (see DECISIONS.md). It replaces the phase table in DESIGN.pdf where they disagree.

## Where we are

Built: physics fighters with jointed arms and real legs, weapons, punches, grabs, throws and slams, hidden health, knockoffs,
rounds and a score, 2-4 local players on gamepads, 12 eras (one or two rough arenas each) with their weapons and outfits, the
oil-painted look, menus (museum home, Hall of Champions), and the online groundwork (room server, room codes, lobby, rejoin).
The Stick Fight feel pass is done (camera size, open maps with walls only where they matter, a quick 2.2 m jump).

Nobody but the owner has played it yet. The two gates that matter, "friends ask for a rematch" and "four players on real home
connections finish 10 fights", have never been run.

## Now: the first playtest night (about 2 weeks)

The owner plus 3 friends, at home, on the US East Coast, mouse and keyboard, Chrome. That night counts as the gate for both
local fights (Phase 2) and online (Phase 3). Steps, in order:

| # | Step | Done when |
|---|------|-----------|
| 1 | Slam rework: holding someone, jump and hold S; nothing steers them; landing them hard is a slam (a little extra damage, knockdown, you let go) | A backwards jump with S slams; tests pass |
| 2 | Right-click while holding someone: a short toss | Tested |
| 3 | Never stuck: wedged in a gap, hanging off an edge by the fist | Tested |
| 4 | Bots: a scripted "regular person" (same buttons as a player, about 0.2 s to react, imperfect aim), gray classic robots tagged "Bot". Training goes through the character screen: the dummy or 1-3 bots. Online the host can seat bots; a friend who joins takes a bot's seat next round | The owner fights bots alone and they feel like people |
| 5 | Everything on: weapons dropping in, mixed round starts, props lying around | Each checked solo |
| 6 | Cheaper lag: 60 snapshots a second, less blending | The owner tries `?lag=40` |
| 7 | Deploy: the owner signs up for Cloudflare Pages and Fly.io (Virginia); Claude walks through every click | A public link works for two people in different houses |
| 8 | A one-page "how to play" for the friends | Sent |
| 9 | The night (the owner records it) | Friends ask for another round, and 4 players finish 10 fights online |

If the night says the controls feel laggy, "prediction" (your own fighter moves before the server answers) is the next job.

Date (owner, 2026-10-06): Sunday 2026-10-11. Building does not pause for it.

## Next: weapons, then the showcase eras (owner, 2026-10-06; full order in DECISIONS.md)

Weapons first: real painted shapes for every weapon, then the grappling hook, then chain weapons. Then Pirates' 4 other arenas,
the round-break screens, and costumes for the showcase eras (Wild West, Cavemen, Pirates: final paint by 2026-11-01).

## The demo

The 3 showcase eras with all their arenas, local and online, with a wishlist button: a Steam demo and the same build on itch.io,
by 2027-01-25. The full game is 12 eras x 5 arenas plus 2 specials x 5 (about 70).

## Later (unchanged from DESIGN.pdf)

Steam: Electron wrapper, Steamworks, Steam Deck pass, store page, demo, Next Fest. About a month of store lead time.

## Open questions to settle with playtesters

More than 4 fighters? The free demo's exact eras and arenas. A catch-up weapon rule for players stuck unarmed.

## Notes for later (owner asks, not yet scheduled)
- 2026-10-07: some sound effects should differ for a fighter wearing a helmet (a head hit rings on metal, say). Owner's note; not placed in a phase yet.
- 2026-10-07: AN ART OVERHAUL will be needed (owner). Not scheduled or scoped yet: what changes, which eras first, and how it fits the showcase eras' final paint (2026-11-01, for the store page on 2026-11-15) are to settle with the owner before it starts.

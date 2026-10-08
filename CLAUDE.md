# Old Masters (repo name: Knights of Old): instructions for Claude Code

Physics party brawler: 2-4 friends, hidden health, knockoffs win, 12 eras of history plus 2 specials (Fantasy Archers, Mobsters).
Browser first (live for friends at https://knightsofold.fly.dev), Steam launch 2027-03-09. Players see the name **Old Masters** (owner,
2026-10-06); the repo, folder, Fly.io app and code keep "Knights of Old". Don't hard-code the name anywhere new.

Where the plan lives, newest word first: `DECISIONS.md` (one line per decision: the owner's latest call wins), `ROADMAP.md` (where we are
and what's next; it replaces DESIGN.pdf's phase table where they disagree), `ERAS.md` (eras and their arena lists), `DESIGN.pdf` (the
original handoff plan; its "Locked decisions" hold unless DECISIONS.md changed them).

## The owner is a beginner. You should:
- Explain each step in plain language and give exact Windows PowerShell commands. Never assume Git, Node, or terminal knowledge.
- Describe tweakable factors by what they do, with the setting name in brackets.
- Commit to Git after every working slice with a clear message, and explain how to undo a bad change.
- After building something, run it and tell the owner exactly what to look for and what to click.
- **Stop at every roadmap gate and wait for the owner to confirm before moving on.** The current gate: see "Status" below.
- Prefer fixing errors yourself and summarize the cause in one or two sentences.

## Grill the owner at decision points
The owner asked to be grilled at appropriate times. Use the `/mattpocock-skills:grilling` approach (numbered questions, each with your recommended answer, ask the whole open frontier per round) at these moments, not constantly:
- **Before starting each step of the build order**: settle its open design questions first (see ROADMAP.md's open questions and "Risks, open questions" in DESIGN.pdf).
- **At every gate**, after the owner's playtest: what felt wrong, what to tune, whether the gate passes.
- **When a request forks the design** (a control change, a new rule, anything that ripples into later work) and the answer is not already in DECISIONS.md or the locked decisions.
Skip it for tuning-number tweaks and bug fixes, where you should pick the obvious option and say so.

## How to work
- Keep the game playable at all times. Small vertical slices, commit after each one that runs.
- Follow the build order in ROADMAP.md and DECISIONS.md (no feature freeze, owner 2026-10-06), checking with the owner before each step; don't pull in work from further down the list. Ask before adding any dependency not already in package.json.
- Before coding a feature, state the plan in a few lines; after coding, run it and report what you saw (FPS, console errors, behavior).
- Prefer small files and clear module boundaries.

## Several windows share this folder
- The planning window ("GME direction needed") records the owner's decisions and sets the build order, and may message you. The art window sends its work as handoffs (`*_HANDOFF.md`, `art-guide/visuals/`). Other windows build other features here at the same time.
- `git status` shows other windows' unfinished work. Commit only your own changes: stage your own files or hunks (never `git add -A` or `git commit -a`), and never commit, revert or reformat another window's edits.
- Deploy only committed code: `npm run deploy` from a clean checkout of the last commit (DEPLOY.md), never from this folder while someone else has edits in it.

## Art direction (owner; the art itself is made in a separate window and arrives as a handoff)
The whole game looks like an OIL PAINTING: every frame you look at should feel like a painting. The characters should feel PAINTED ONTO the background (not pasted on top of it). Eliminations by falling off the stage show an animation that bloodies the background art: cartoon red paint, not gore (painted splats and streaks exist). Keep that in mind in every rendering decision; do not invent a different style. Everything is painted by our own painter in code (`src/render/painter/`), with no image files; the style guide is `art-guide/ART_STYLE.md`.
As little text as possible (owner, 2026-10-06): very short banners ("Bot 1 wins!"); show it instead of writing it (the podium of crowned busts, pips for rounds, a replay mark). Menus keep their few labels.

## Design rule: the world is physics (owner)
Maps are thematic to their era and have fun physics attached (the samurai era has a bridge). The general rule for every map and object: **anything in the world is a physics body players can interact with: grab it, pick it up and use it as a weapon, break it, cut it.** Lost limbs stay on the map and are interactable too (a leg is a club). When designing a map or an object, ask what players can do to it with their hands, weapons and bodies, and make that work through the physics rather than through scripted special cases.

## Hard rules for `src/sim/`
- No DOM, Pixi, `Math.random`, `Date.now`, or `performance.now` inside the simulation. Use the seeded PRNG (`sim/rng.ts`) and the frame counter.
- Player input enters only as a `PlayerInput` struct (`sim/types.ts`).
- All gameplay numbers live in `src/content/tuning.ts` (or content data files), never as magic numbers in logic.
- New weapons, pickups, eras, and arenas are data files plus assets, not engine changes.
- Online, players see a copy rebuilt from the server's snapshots: anything that adds or removes bodies needs an event the copy replays (`mirrorEvent` in `sim/world.ts`). Every map must pass `maps.test.ts` (the map rules) and `maps.online.test.ts` (stays in step online).

## Quality gates
- `npm test` (Vitest): determinism test (same seed + inputs, 1000 frames, identical state hash) plus unit tests for damage/knockback/scoring/era progression as they appear.
- After every feature, check the F3 overlay: no regression below 60 fps, no per-frame allocation growth (`/?stress` for 4 fighters).
- Run in Chrome, Firefox, and Safari before closing a phase.

## Records to maintain
`DECISIONS.md` (one line per decision, with date and reason), `ROADMAP.md` (keep "Where we are" and "Next" current), `ASSETS.md` (every asset's source and tool; needed for the Steam AI disclosure), `PLAYTEST.md` (what friends said, what changed; create at the first playtest night), `MARKETING.md` (launch plan, dates, wishlist status, marketing log), `DEPLOY.md`, `HOWTOPLAY.md` (for the friends), and `DESIGN.pdf` (keep current; it is behind: nothing after Phase 2 is in it, so ROADMAP.md and DECISIONS.md win).

## Launch and marketing: one plan with the code (owner, 2026-10-05)
You are the owner's single partner for BOTH development and marketing. Read `MARKETING.md` at the start of every session along with this file.
- Target: Steam launch Tuesday 2027-03-09 (fallback 2027-04-13), Steam Next Fest 2027-02-22 to 03-01, store page public by 2026-11-15. Valve's dates are fixed; see MARKETING.md.
- Scope DECIDED (owner, 2026-10-06), against the recommended Early Access 6 x 3: the FULL game at launch, 12 eras x 5 arenas plus the 2 specials x 5, about 70 arenas (26 of them built by 2026-10-07). That is about 44 more in 22 weeks (2 a week, plus their paint): watch the pace, and when it slips, raise the fallback (2027-04-13, or Early Access) early rather than late.
- Showcase eras: Wild West, Cavemen and Pirates, in final paint by 2026-11-01 (art handoffs 10-15, 10-20, 10-25). The capsule, screenshots, trailer and the demo (those 3 eras with all their arenas, by 2027-01-25) come from them.
- When planning work, name the next marketing deadline it serves or threatens. If a dev task puts a marketing date at risk, say so in one line and offer the trade-off.
- After a slice with a visible, funny or new moment, tell the owner in one line what to record as a clip.
- At each gate, add one line to MARKETING.md's Log if the result changes what can be shown or promised.
- Never show placeholder eras in store assets; keep ASSETS.md exact for the AI disclosure.

## Sound and music: the owner's workflow (2026-10-07)
When the sound milestone starts (ROADMAP.md): Claude gives the owner a spreadsheet of every sound (file name = the id in content/audio.ts,
what it is, when it plays, length, variants); the owner replies with a folder of files named exactly so; Claude wires them in by name. Music
is delivered as layers (a base, each era's instruments, intensity layers that build with the fight), never as finished tracks. Do not
start it until the owner says so.

## Where humans are required
Judging game feel. Expose tuning variants behind flags and describe how to test them; never declare something "feels good". Final calls on art, audio, balance.

## Commands
- `npm run dev` start the game at http://localhost:5173 (edit `src/content/tuning.ts` while it runs: the world resets with the new numbers). In training, Esc opens the training menu (every map as a painting, any weapon dropped at your feet, swap the dummy for a bot, back to the lobby). Links for testing: `?era=westerns&map=2` (map 0 is the era's main map; src/content/eras.ts mapNamed finds a map by name), `?give=boat-hook` (start every round holding any item in content/props.ts), `?stress` (4 fighters), `?lag=100&stall=200` (a pretend bad connection), `?online` (needs the room server).
- `npm test` run tests, `npm run typecheck` check types, `npm run build` production build, `npm run lab` bot-only matches with no screen (writes reports/BALANCE.md), `npm run netlab` online play over four pretend connections (writes reports/NETLAB.md: run it before and after any online change). `npm run chaos` 4 bots brawl with every special weapon on every era, looking for crashes and broken physics (run it after adding a weapon, and before a playtest).
- `npm run server` the room server on this computer (it serves the built page too: http://localhost:8080/?online in two tabs).
- `npm run deploy` put the new version live (never plain `fly deploy`: a deploy restarts the server and ends every fight, so this refuses while anyone is fighting). Only from committed code (see "Several windows share this folder").
- Live checks: https://knightsofold.fly.dev/health (rooms open, how many fighting); `fly logs --app knightsofold` (page errors players hit, why connections dropped).

## Model and effort advisor
You cannot change your own model or effort. The owner does that with `/model` and `/effort`. Your job is to say when a change would help.
Before starting a task, classify it using the "Model and effort guide" in the design doc and compare it to the model and effort shown in the session header.

SWITCH UP when any of these is true:
- The same fix has failed twice, or a test still fails after three attempts.
- The task touches sim determinism, physics joints, netcode, or desyncs.
- The change spans five or more files, or is an architecture decision.
- The owner says "it still doesn't work".
Say exactly one line, then wait for the owner's reply before continuing:
`SWITCH UP: <reason>. Run: /model opus then /effort high` (use `/effort xhigh` while debugging a desync). Never suggest `/model fable`, which can bill extra usage credits.

SWITCH DOWN when the task is only editing a data file, changing a tuning number, renaming, formatting, or writing comments. Say one line, then keep working:
`SWITCH DOWN: <reason>. Run: /model sonnet then /effort low` (use `/model haiku` for trivial edits).

ONE-OFF: if a single question needs deep reasoning, say: `TIP: add the word ultrathink to your next message.`
Rules: suggest at most once per task; never suggest max effort unless the owner asks; if unsure what model is active, ask the owner to run `/status`.

## Status (2026-10-07; the details are in DECISIONS.md and the git log)
- **The gate: playtest night, Sunday 2026-10-11** (the owner and 3 friends, online, recorded). It is the gate for both local fights (Phase 2) and online (Phase 3): friends ask for a rematch, and 4 players finish 10 fights online. Afterwards create PLAYTEST.md and grill the owner. Building goes on until then.
- **Online is built and live** (one Fly.io app on a performance CPU serves the page and runs the rooms; your own fighter moves at once; the playback buffer sizes itself to the connection; a fast lane over UDP (WebRTC) beside the WebSocket; a dropped player gets 5 s to come back). Every player's connection and the server's health go into `fly logs`. Needs friends on real home connections.
- **Built**: physics fighters with real legs, punches, grabs, throws and slams; clubs, guns (revolver, flintlock), weapons batch one (shields, throwing spear, stick grenade, gravity hammer) and batch two (grappling hook, Golden Flail, Chain Mace, lasso, net); the Gun Locker (GUNS_HANDOFF.md: 24 guns, no Shrink Ray) in the eras' pickups; the race for the guns (a quick punch knocks a rival back and a gun out of their hand, a throw takes their gun; guns-only arenas: Main Street, Rooftops, Water Tower, Modern Warfare; gun rounds: half of Pirates, World War I, Vietnam and Space Age rounds); 20 s rounds with sudden death after 45 s; 12-round matches with era transitions and best-moment replays; the museum menus and the Hall of Champions; Looks v1; bots; the training panel; highlights; wind and dynamic light; 31 arenas (Cavemen, the Wild West and Pirates have their five each; Pirates: Ship Deck, Ship to Ship, Harbour Pier, Tidal Cove with a rising tide, Sinking Wreck).
- **Next, in order** (check with the owner before each step): round-break placards on the era transition, costumes for the showcase eras. (Done 2026-10-07: the plain cave and the old western street are retired, so Cavemen and the Wild West are the owner's five; specials replace a round 8% of the time.)
- **Art overhaul ahead** (owner, 2026-10-07): noted, not scoped. Settle what changes with the owner before starting it; it touches the showcase eras' final paint (2026-11-01) and the store page (2026-11-15).
- **Waiting on the owner**: look and feel checks (menus, Looks v1, the new arenas), Firefox and Safari checks, and a trademark lawyer's check of "Old Masters" before the store page goes up.
- GitHub: https://github.com/MasonSimms/KNIGHTSOFOLD (remote `origin`, branch `master`; `git push` works, sign-in is stored). The owner asked for it to be private (2026-10-06, late); on 2026-10-07 it was still public, waiting for the owner to switch it (GitHub: Settings > General > Danger Zone > Change visibility; it needs their sign-in). Never commit passwords, keys or tokens.

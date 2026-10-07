# Knights of Old: instructions for Claude Code

Full design: `DESIGN.pdf` (the handoff plan; its "Locked decisions" section overrides anything that conflicts).
Physics party brawler: 2-4 friends, hidden health, knockoffs win, six eras. Browser first, Steam later.

## The owner is a beginner. You should:
- Explain each step in plain language and give exact Windows PowerShell commands. Never assume Git, Node, or terminal knowledge.
- Commit to Git after every working slice with a clear message, and explain how to undo a bad change.
- After building something, run it and tell the owner exactly what to look for and what to click.
- **Stop at every roadmap gate and wait for the owner to confirm before moving on.** Current phase: see "Status" below.
- Prefer fixing errors yourself and summarize the cause in one or two sentences.

## Grill the owner at decision points
The owner asked to be grilled at appropriate times. Use the `/mattpocock-skills:grilling` approach (numbered questions, each with your recommended answer, ask the whole open frontier per round) at these moments, not constantly:
- **Before starting each roadmap phase**: settle that phase's open design questions first (see "Risks, open questions" in DESIGN.pdf).
- **At every gate**, after the owner's playtest: what felt wrong, what to tune, whether the gate passes.
- **When a request forks the design** (a control change, a new rule, anything that ripples into later phases) and the answer is not already in the locked decisions.
Skip it for tuning-number tweaks and bug fixes, where you should pick the obvious option and say so.

## How to work
- Keep the game playable at all times. Small vertical slices, commit after each one that runs.
- Stay inside the current roadmap phase. Do not add features from later phases. Ask before adding any dependency not listed in the design doc.
- Before coding a feature, state the plan in a few lines; after coding, run it and report what you saw (FPS, console errors, behavior).
- Prefer small files and clear module boundaries.

## Art direction (owner; the art itself is made in a separate window and arrives as a handoff)
The whole game looks like an OIL PAINTING: every frame you look at should feel like a painting. The characters should feel PAINTED ONTO the background (not pasted on top of it). Eliminations by falling off the stage show an animation that bloodies the background art: cartoon red paint, not gore (a placeholder paint splash exists). Keep that in mind in every rendering decision; do not invent a different style.
As little text as possible (owner, 2026-10-06): very short banners ("Bot 1 wins!"); show it instead of writing it (the podium of crowned busts, pips for rounds, a replay mark). Menus keep their few labels.

## Design rule: the world is physics (owner)
Maps are thematic to their era and have fun physics attached (the samurai era has a bridge). The general rule for every map and object: **anything in the world is a physics body players can interact with: grab it, pick it up and use it as a weapon, break it, cut it.** Lost limbs stay on the map and are interactable too (a leg is a club). When designing a map or an object, ask what players can do to it with their hands, weapons and bodies, and make that work through the physics rather than through scripted special cases.

## Hard rules for `src/sim/`
- No DOM, Pixi, `Math.random`, `Date.now`, or `performance.now` inside the simulation. Use the seeded PRNG (`sim/rng.ts`) and the frame counter.
- Player input enters only as a `PlayerInput` struct (`sim/types.ts`).
- All gameplay numbers live in `src/content/tuning.ts` (or content data files), never as magic numbers in logic.
- New weapons, pickups, eras, and arenas are data files plus assets, not engine changes.

## Quality gates
- `npm test` (Vitest): determinism test (same seed + inputs, 1000 frames, identical state hash) plus unit tests for damage/knockback/scoring/era progression as they appear.
- After every feature, check the F3 overlay: no regression below 60 fps, no per-frame allocation growth.
- Run in Chrome, Firefox, and Safari before closing a phase.

## Records to maintain
`DESIGN.pdf` (keep current), `DECISIONS.md` (one line per decision, with date and reason), `ASSETS.md` (every asset's source and tool; needed for the Steam AI disclosure), `PLAYTEST.md` (what friends said, what changed; create at first playtest), `MARKETING.md` (launch plan, dates, wishlist status, marketing log).

## Launch and marketing: one plan with the code (owner, 2026-10-05)
You are the owner's single partner for BOTH development and marketing. Read `MARKETING.md` at the start of every session along with this file.
- Target: Steam launch Tuesday 2027-03-09 (fallback 2027-04-13), Steam Next Fest 2027-02-22 to 03-01, store page public by 2026-11-15. Valve's dates are fixed; see MARKETING.md.
- This target is shorter than DESIGN.pdf's 12-18 month roadmap. DECIDED (owner, 2026-10-06): the FULL game at launch, 12 eras x 5 arenas (about 60), against the recommended Early Access 6 x 3. That is about 55 more arenas in 22 weeks (about 2.5 a week, plus their paint): watch the pace, and when it slips, raise the fallback (2027-04-13, or Early Access) early rather than late.
- When planning work, name the next marketing deadline it serves or threatens (for example: 2-3 eras in final paint by 2026-11-01 for the capsule, screenshots and trailer). If a dev task puts a marketing date at risk, say so in one line and offer the trade-off.
- After a slice with a visible, funny or new moment, tell the owner in one line what to record as a clip.
- At each gate, add one line to MARKETING.md's Log if the result changes what can be shown or promised.
- Never show placeholder eras in store assets; keep ASSETS.md exact for the AI disclosure.

## Where humans are required
Judging game feel. Expose tuning variants behind flags and describe how to test them; never declare something "feels good". Final calls on art, audio, balance.

## Commands
- `npm run dev` start the game at http://localhost:5173 (edit `src/content/tuning.ts` while it runs: the world resets with the new numbers)
- `npm test` run tests, `npm run typecheck` check types, `npm run build` production build
- `npm run deploy` put the new version live (never plain `fly deploy`: a deploy restarts the server and ends every fight, so this refuses while anyone is fighting)

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

## Status
Latest (2026-10-07): online playability pass (self-sizing playback buffer, carry-on during stalls, hidden tab lets go of the controls, stale join banner cleared, amber ping on a shaky line; ?lag=100&stall=200 pretends wifi stalls). Valve-style lag compensation judged not applicable (physics hits, flying bullets); see DECISIONS.md. Needs an online playtest on a real shaky connection.
Direction (owner, 2026-10-06; DECISIONS.md "DIRECTION ROUND" and the lines after it): the game is called **Old Masters** (players see the new name; the repo, folder and fly.dev address keep the old one). Showcase eras are Wild West, Cavemen and Pirates. Specials are in at launch (about 70 arenas). No feature freeze; playtest night Sunday 2026-10-11. **Next: weapons** (real shapes, then grappling hook, then chain weapons), one window at a time.
Latest (2026-10-06): Looks v1 built from the owner's handoff (LOOKS_HANDOFF.md): 12 hats and 7 hairstyles (including Fubo) in the hat slot, 10 eyes, Bone in place of Teal, painted hats, and swaying parts that are looks only (render/dangle.ts). See DECISIONS.md. Needs the owner's look and feel check in the Hall and in a fight.
Before that (2026-10-05): menus built from the owner's mockup (museum home screen with painted arenas in gilded frames; the Hall of Champions with a painted portrait per seat, hat, eyes and colour pickers, ready-up; online uses the same Hall with the room code). Eyes are a third pick. The game now opens on the menus; testing links skip them. See DECISIONS.md. Needs the owner's look and feel check.
Before that (2026-10-05): the art package is applied for real: its oil painter is ported to the browser (src/render/painter/: painted era backdrops with the real ground, painted fighters with boil, capes, painted splats; per-era painting data in src/content/paintings.ts), plus the 12-era chronological match schedule and an escalating weapon spawner (see DECISIONS.md, ERAS.md, art-guide/ART_STYLE.md). Next: pirate water and boat physics, then the other four arenas per era.

Phases 0, 1 and 2 are built (see the git log and DECISIONS.md for what and why; DESIGN.pdf is the plan). **Waiting at the Phase 2 gate**: the owner and friends playing a real 2-4 player fight and asking for a rematch. The owner treated the Phase 1 gate as passed and told us to "progress through the next milestone", so Phase 2 was built in slices (quick feel fixes, walls and wall jump, weapons and disarming, local gamepad multiplayer with rounds and a scoreboard).

Since then, owner-requested Phase 2 additions are built (see DECISIONS.md): real physics legs with Stick Fight style crouch down to lying and crawling, a decorative second arm, tap-to-punch and hold-to-grab-and-fling unarmed combat (grabs time out and break on a hard hit), body-collision and stomp damage, hold-W flips, and club parrying. Their tuning numbers are first guesses and all need the owner's playtest. DESIGN.pdf has not been updated for these yet.

Stick Fight feel pass (2026-10-05, see DECISIONS.md): camera zoomed out (fighters 8.6% of the screen), side walls only on maps that are about them (arena.walls per map), a 2.2 m jump that falls faster than it rises, every ledge 1.5 m clear above whatever is under it, weapons in a hand pass through the scenery. Owner: the size is right, weapons through the floor are fine. maps.test.ts enforces the map rules: when designing a map, keep them.

Online (Phase 3) groundwork is built ahead of the gate at the owner's request, who cannot playtest right now (remote control): a room server over WebSockets, lobby, client mirror and 100 ms-lag tests; see DECISIONS.md and DEPLOY.md. Since then: deployed to Fly.io (knightsofold.fly.dev, DEPLOY.md), prediction of your own fighter built (Settings: Controls: Instant, on by default; src/net/predict.ts), a 5 s grace for dropped connections. Not done: real-connection playtests with friends. Commands: npm run server, then open /?online in two tabs.

Still open from earlier phases (all need the owner, none are code): the public URL deploy (Cloudflare Pages account), Firefox and Safari checks, and the painted background for the style test (see ASSETS.md).

GitHub backup (2026-10-05): repo (NOTE 2026-10-05: GitHub currently serves it as PUBLIC; the owner meant it to be private, check Settings > General > Danger Zone) https://github.com/MasonSimms/KNIGHTSOFOLD (remote `origin`; `git push` works, sign-in is stored). Work on `master`. Two windows can work at once by giving one of them its own folder (a git worktree on its own branch), then merging; the `maps` branch was done that way and is merged.

Do not start Phase 3 (online) until the owner confirms the Phase 2 gate; then grill them on Phase 3's open decisions first. Speak to the owner in plain English: they are not a developer, so describe tweakable factors by what they do (and give the setting name in brackets).

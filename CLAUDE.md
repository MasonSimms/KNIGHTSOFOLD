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
`DESIGN.pdf` (keep current), `DECISIONS.md` (one line per decision, with date and reason), `ASSETS.md` (every asset's source and tool; needed for the Steam AI disclosure), `PLAYTEST.md` (what friends said, what changed; create at first playtest).

## Where humans are required
Judging game feel. Expose tuning variants behind flags and describe how to test them; never declare something "feels good". Final calls on art, audio, balance.

## Commands
- `npm run dev` start the game at http://localhost:5173 (edit `src/content/tuning.ts` while it runs: the world resets with the new numbers)
- `npm test` run tests, `npm run typecheck` check types, `npm run build` production build

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
Phases 0, 1 and 2 are built (see the git log and DECISIONS.md for what and why; DESIGN.pdf is the plan). **Waiting at the Phase 2 gate**: the owner and friends playing a real 2-4 player fight and asking for a rematch. The owner treated the Phase 1 gate as passed and told us to "progress through the next milestone", so Phase 2 was built in slices (quick feel fixes, walls and wall jump, weapons and disarming, local gamepad multiplayer with rounds and a scoreboard).

Still open from earlier phases (all need the owner, none are code): the public URL deploy (Cloudflare Pages account), a GitHub backup (the `gh` tool is not installed; the owner creates a private repo and pushes), Firefox and Safari checks, and the painted background for the style test (see ASSETS.md).

Do not start Phase 3 (online) until the owner confirms the Phase 2 gate; then grill them on Phase 3's open decisions first. Speak to the owner in plain English: they are not a developer, so describe tweakable factors by what they do (and give the setting name in brackets).

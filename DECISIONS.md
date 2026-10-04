# Decisions

One line each: date, decision, reason.

- 2026-10-04: Head and torso are one rigid body with two colliders. The plan says "rigid head and torso", and a joint between them adds nothing.
- 2026-10-04: All joints use Rapier's ForceBased motor model (stiffness in N*m per radian). The default model was far too weak to hold an arm up, measured in a headless test.
- 2026-10-04: Elbow and wrist are stiff; the shoulder torque cap (`arm.shoulderMaxTorque`) sets how hard a swing is. A soft elbow made the stick whip and lag about 30 frames behind the aim.
- 2026-10-04: Damage is measured every frame for weapon colliders touching another fighter (closing speed along the contact normal x reduced mass x weapon multiplier), not only at first contact, so a stick already resting on a body can still hit when swung.
- 2026-10-04: Tuning hot reload rebuilds the world (via `Sim.reset()`), because body sizes, masses and joint limits are baked in at creation. Per-frame numbers (forces, thresholds) update live in place.
- 2026-10-04: Placeholder sounds are synthesised with WebAudio oscillators, so there are no audio files or licences yet. Howler.js (named in the plan) arrives with real licensed SFX in the art and audio phase.
- 2026-10-04: The training dummy is a fighter built by the same code with no input and no stick, so it balances, takes damage and dies like a player does.
- 2026-10-04: Phase 0 "deploy to a public URL" is not done yet. It needs a Cloudflare Pages or Netlify account, which is the owner's call.
- 2026-10-04: Added a dedicated cock-back button (hold right-click or left trigger/bumper): the weapon arm pulls up and behind, and on release gets a torque burst that grows with hold time (up to 0.5 s). Chosen by the owner (Spiderheck-style). It replaces the old "hold click for power" boost.
- 2026-10-04: A plain click is the same mechanism on a 5-frame automatic timer: a quick chop with the stick, a jab when unarmed. Every punch now starts with a pull-back, which fixes point-blank punches doing nothing.
- 2026-10-04: The release burst scales shoulder spring stiffness as well as the torque cap. Raising the cap alone changed nothing (measured): swing speed was limited by the spring, not the cap.
- 2026-10-04: Damage curve lowered (damageScale 5 -> 1.5) so a plain swing is a medium hit and a charged one is heavy. At the old value every swing hit the 60 damage cap and the cock bonus was invisible.
- 2026-10-04: impactMin stays at 10: walking into the dummy with a stick no longer hurts it (measured 0 damage).
- 2026-10-04: `?stress` URL option adds two scripted flailing fighters for a 4-fighter frame-time check. They are not AI (bots are out of scope).
- 2026-10-04: One arm per fighter (owner's call: less confusing controls). The off-hand is removed entirely, so a fighter is 4 physics parts (torso+head, upper arm, forearm, stick) and unarmed punches no longer alternate hands. Fewer bodies also helps the frame budget.
- 2026-10-04: With one arm, a full cock swing got much stronger and tipped the fighter over (tilt 1.2 rad), so cock.releaseMul went 4 -> 2.5 (measured: click impact ~20, half charge ~26, full charge ~59, tilt 0.64).
- 2026-10-04: Shields are a weapon you hold instead of a sword (owner chose this with the one-arm change), so block is the shield's swing. Revisit in Phase 4 when weapon data files are written.
- 2026-10-04: Style test is built as a drop-in slot: `public/art/test_bg.webp` (or png/jpg) shows behind the arena if present; grain and vignette are generated in code. The painted image itself comes from the owner's AI tool, so the test is not finished until they supply it.

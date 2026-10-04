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

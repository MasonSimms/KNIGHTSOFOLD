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
- 2026-10-04 [superseded, see the charge/throw entries below]: Added a dedicated cock-back button (hold right-click or left trigger/bumper): the weapon arm pulls up and behind, and on release gets a torque burst that grows with hold time (up to 0.5 s). Chosen by the owner (Spiderheck-style). It replaces the old "hold click for power" boost.
- 2026-10-04 [superseded]: A plain click is the same mechanism on a 5-frame automatic timer: a quick chop with the stick, a jab when unarmed. Every punch now starts with a pull-back, which fixes point-blank punches doing nothing.
- 2026-10-04 [superseded]: The release burst scales shoulder spring stiffness as well as the torque cap. Raising the cap alone changed nothing (measured): swing speed was limited by the spring, not the cap.
- 2026-10-04: Damage curve lowered (damageScale 5 -> 1.5) so a plain swing is a medium hit and a charged one is heavy. At the old value every swing hit the 60 damage cap and the cock bonus was invisible.
- 2026-10-04: impactMin stays at 10: walking into the dummy with a stick no longer hurts it (measured 0 damage).
- 2026-10-04: `?stress` URL option adds two scripted flailing fighters for a 4-fighter frame-time check. They are not AI (bots are out of scope).
- 2026-10-04: One arm per fighter (owner's call: less confusing controls). The off-hand is removed entirely, so a fighter is 4 physics parts (torso+head, upper arm, forearm, stick) and unarmed punches no longer alternate hands. Fewer bodies also helps the frame budget.
- 2026-10-04 [superseded]: With one arm, a full cock swing got much stronger and tipped the fighter over (tilt 1.2 rad), so cock.releaseMul went 4 -> 2.5 (measured: click impact ~20, half charge ~26, full charge ~59, tilt 0.64).
- 2026-10-04: Shields are a weapon you hold instead of a sword (owner chose this with the one-arm change), so block is the shield's swing. Revisit in Phase 4 when weapon data files are written.
- 2026-10-04: Style test is built as a drop-in slot: `public/art/test_bg.webp` (or png/jpg) shows behind the arena if present; grain and vignette are generated in code. The painted image itself comes from the owner's AI tool, so the test is not finished until they supply it.
- 2026-10-04: Removed the canvas grain overlay (owner: "weird"). The vignette stays; set finish.vignetteAlpha to 0 to remove it.
- 2026-10-04: Controls remapped by the owner. Left-click (hold) = charge: the weapon stays on the aim (no front or back wind-up pose) and loads momentum; release lunges the fighter along the aim with a torque burst. Right-click = throw: the arm cocks back automatically (8 frames), then the weapon flies along the aim. The instant "click" attack was removed.
- 2026-10-04: Damage is hit speed x the weapon's own factor, nothing else: impact = closing speed (m/s) x weapon.impactFactor (stick 2.2, fists 1.6), then damage = (impact - impactMin) x damageScale, capped. The old reduced-mass term was dropped (the victim's mass is constant, so it only added a hidden fudge factor). The lunge and throw speeds count automatically because closing speed includes the body's and weapon's own motion.
- 2026-10-04: "Swing disconnected from the mouse" had two causes, both measured. (1) The shoulder spring was badly underdamped: it overshot the aim by 1.2 rad and rang. (2) Rapier's default 4 solver iterations made the 3-body arm chain soft, which is why torque caps, stiffness and damping changes did nothing. Fix: the shoulder is now a velocity follower (turn rate = shoulderTrack x error, plus the mouse's own turn rate as feed-forward) and the solver runs 32 iterations / 4 PGS (sim.solverIterations, sim.pgsIterations; cost is about 0.09 ms for 4 fighters). Real-mouse sweep error went from about 1 rad to 0.17 rad.
- 2026-10-04: Power limits so flicks and throws cannot flip the fighter: shoulderMaxRate 14 rad/s, shoulderMaxTorque 300, balance kp 800 / kd 60 / max 600. At the earlier values (40 rad/s, 600) a plain mouse flick tilted the fighter 2.7 rad (upside down).
- 2026-10-04: The walking controller is disabled during the lunge burst (it braked the fighter to zero and cancelled the lunge). Lunge impulse 100 gives about 10 m/s and a 2 m slide at full charge.
- 2026-10-04: A thrown weapon is a normal attacker (stick part with its own velocity), so its damage follows the same speed x factor rule. A stick lost off the edge still returns to the owner's hand.
- 2026-10-04: Fixed fast key taps (R, F3) being missed: keyup removed the key before the game loop checked it. Taps are now recorded separately.
- 2026-10-04: Shapes are drawn 100x larger and scaled down so Pixi gives round heads instead of octagons.

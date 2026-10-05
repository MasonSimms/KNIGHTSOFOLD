// Every gameplay number lives here. Edit and save while the game runs: the world resets with the new values.
// Units: metres, seconds, kilograms, radians. +x is right, +y is DOWN (same as the screen).
export const tuning = {
  sim: {
    dt: 1 / 60,
    gravity: 22, // heavier than Earth: snappier, more comedic arcs
    maxStepsPerFrame: 5,
    solverIterations: 32, // Rapier default is 4; more = stiffer joints (arm chain) at some CPU cost
    pgsIterations: 4,
  },
  arena: {
    viewW: 19.2, // visible area, 1 m = 100 px at 1920x1080
    viewH: 10.8,
    platformX: 4.2,
    platformW: 10.8,
    platformTop: 7.4,
    platformThickness: 1.2,
    friction: 0.8,
    killY: 13, // below this is the void: instant kill
    killXMargin: 4, // metres past either screen edge
    wallGap: 1.3, // metres between each platform end and its wall: a fighter knocked off the end falls into the gap and can wall-jump out
    wallThickness: 0.5,
    wallTop: 3.2, // how high the walls reach (the platform top is at 7.4)
    spawnX: [7, 11.5, 5.5, 13.5], // fighter 0 = you, 1 = dummy, 2 and 3 = extra fighters (stress test)
  },
  fighter: {
    hp: 100, // hidden: never shown on screen (F3 overlay only)
    startArmed: true, // false = you start with empty hands, to try the punch
    torsoHalfHeight: 0.25,
    torsoRadius: 0.18,
    torsoMass: 6,
    headRadius: 0.17,
    headY: -0.55,
    headMass: 1,
    shoulderY: -0.28,
    armLength: 0.32,
    armRadius: 0.07,
    upperMass: 0.7,
    foreMass: 0.6,
    fistRadius: 0.09,
    fistMass: 0.3,
    armLinearDamping: 0.2,
    armAngularDamping: 0.5,
    friction: 0.6,
    restitution: 0.05,
  },
  motion: {
    moveSpeed: 5.5,
    groundAccel: 26, // lower = more slide and momentum, higher = snappier
    airAccel: 14,
    jumpSpeed: 8.5, // about 1.6 m high: clears a standing fighter with room to spare
    coyoteFrames: 6, // you can still jump this long after walking off a ledge
    jumpBufferFrames: 6, // a jump pressed this early before landing still happens
    jumpCut: 0.5, // letting go of jump early cuts the jump short by this much (1 = no cut)
    jumpCutMinSpeed: 2, // ...but only while still rising faster than this (m/s)
    wallSlideSpeed: 1.5, // fall speed while sliding down a wall you are pushing toward (m/s)
    wallJumpX: 6.5, // speed kicked away from the wall (m/s)
    wallJumpY: 10, // upward speed of a wall jump (same height as a normal jump)
    wallCoyoteFrames: 6, // a wall jump still works this long after leaving the wall
    wallLockFrames: 10, // after a wall jump, steering is switched off for this long so you do not drift back into the wall
  },
  lean: {
    // The body leans into where it is going, then springs back upright. Angles in radians (0.5 is about 30 degrees).
    perSpeed: 0.06, // lean per m/s of walking speed
    perAccel: 0.1, // lean while speeding up (forward) or braking (backward): the difference between wanted and actual speed
    max: 0.7, // never lean further than this from walking
    chargeBack: 0.35, // lean back while charging a club (anticipation)
    slamForward: 0.5, // throw the body forward during a lunge/slam
    punchBack: 0.2, // lean back while winding up a punch
    punchForward: 0.35, // lean into the punch
  },
  legs: {
    // Simple stick legs, drawn (not physical) but moved by their own little springy physics, so they swing, lag and flop
    // instead of following a walk animation. They are pendulums hanging from the hip.
    torsoVisualHalf: 0.08, // the drawn torso is shorter than the physical capsule
    torsoVisualY: -0.22,
    hipY: 0.0, // where the legs attach, measured down from the torso centre
    length: 0.43, // hip to foot (reaches the ground when the body stands)
    width: 0.1,
    spring: 110, // how hard a leg swings toward where it wants to be (higher = snappier)
    damping: 9, // how quickly the swinging dies down (lower = bouncier, more flop)
    inertia: 0.05, // how much speeding up or braking throws the legs (feet trail behind when you accelerate)
    swing: 0.65, // how far each leg swings front and back when running (radians)
    runRate: 7, // how fast the legs cycle for each metre per second of speed
    stance: 0.12, // how far apart the feet stand when still (radians)
    airSpread: 0.35, // legs spread like this in the air...
    airSwing: 0.25, // ...and kick about a bit
  },
  ragdoll: {
    // On death the head comes off onto a floppy neck and two real legs appear on loose hips.
    legLength: 0.42,
    legRadius: 0.05,
    legMass: 0.8,
    legStiffness: 2, // near zero = completely floppy
    legDamping: 0.4,
    hipLimit: 1.3,
    neckLimit: 0.9,
    neckStiffness: 15,
    neckDamping: 1.5,
    spin: 10, // random extra tumble given to the head and legs (rad/s)
  },
  drop: {
    // Right-click with a club in hand: let go of it. It keeps the speed your swing gave it, so swing first and then drop it to throw it.
    // Right-click with empty hands: pick your club up again.
    push: 3, // m/s of extra push along your aim
    pickupDelay: 40, // frames after dropping before you can pick it up again
    pickupRange: 1.6, // metres: how close the club must be to the middle of your body to pick it up
  },
  crouch: {
    // Hold S / down. You drop low (swings aimed at your head pass over you), and crouching lets you do more with the next move.
    rate: 0.25, // how quickly you drop and rise each frame
    speedFactor: 0.5, // walking speed while fully crouched
    jumpBonus: 0.12, // a jump from a full crouch goes this much higher
    lungeBonus: 0.3, // a lunge or punch from a full crouch has this much more momentum
    minHalfHeight: 0.11, // how short the body gets (it is 0.25 standing)
    headLift: 0.16, // how far the head comes down toward the shoulders
    legShorten: 0.72, // how much shorter the drawn legs get
    legSpread: 0.28, // how much further apart the drawn legs go
  },
  indicator: {
    // A ring that flashes where a big hit lands (there is no hit freeze: big moments are shown, not felt as a stutter).
    minImpact: 40, // hits at least this big show a ring
    seconds: 0.3,
    radius: 1.1, // metres, how big it grows
    color: 0xffffff,
  },
  dodge: {
    // Press dodge: you slip into the background plane. Fighters and weapons pass straight through you, you cannot hit
    // anyone, and you cannot be hit. Long cooldown, so it is a real decision. (The look is a placeholder for the later 2.5D depth.)
    frames: 36, // how long you stay back there (0.6 s)
    cooldownFrames: 360, // before you can do it again (6 s)
    visualSquash: 0.55, // how narrow you look while turned toward the screen (1 = not at all)
    visualShade: 0.45, // how much darker you look while behind everyone
    visualRaise: 0.06, // metres: you sit a touch higher on the screen, as if farther back
    visualRate: 12, // how fast you turn toward the screen and back
    recoveryFrames: 6, // after coming back from a dodge you cannot start an attack for this long (0.1 s: short enough to punish a swing that missed you)
  },
  balance: {
    kp: 800, // spring pulling the body upright
    kd: 60, // damping on spin
    maxTorque: 900,
    stunFactor: 0.25, // balance strength while stunned
  },
  arm: {
    // The shoulder follows the aim like a velocity servo: turn rate = shoulderTrack x angle error (capped), so no overshoot.
    shoulderTrack: 25, // 1/s: bigger = tighter to the mouse (25 closes a gap in about 3 frames)
    burstRateShare: 0.5, // during a charge burst or throw wind-up, how much of the extra strength also raises the turn-rate cap (lower = smoother, slower arc)
    shoulderMaxRate: 14, // rad/s cap on how fast the arm can turn
    shoulderForce: 300, // N*m per rad/s of rate error: how firmly it holds that rate
    aimFeedForward: 1, // 0 = ignore how fast the mouse is turning, 1 = full
    maxAimRate: 25, // rad/s cap on that feed-forward
    shoulderMaxTorque: 300, // torque cap: swing authority, and the kick the torso feels
    elbowStiffness: 1500,
    elbowDamping: 60,
    elbowMaxTorque: 600,
    elbowLimit: 2.6,
    limpDamping: 0.5,
    poseSmooth: 0.3, // how quickly the elbow and wrist glide to a new pose each frame (1 = instantly; lower = smoother, a bit lazier)
    slamSmooth: 0.6, // the same during a club slam, which should stay snappy
  },
  stick: {
    length: 1.1,
    thickness: 0.1,
    mass: 1.2,
    gripFromEnd: 0.25,
    impactFactor: 2.2, // this weapon's damage factor: impact = hit speed (m/s) x this
  },
  longMelee: {
    // How a club-type weapon is held. Angles are for a fighter facing right (mirrored when facing left):
    // negative = counter-clockwise = up. U is the upper arm, E the elbow bend, W the wrist bend (both relative to the part before).
    guardElbow: -1.0, // elbow bent so the club is held up in front
    guardWrist: 0.3,
    bendFade: 0.35, // the bend fades out over this much of aim as the cursor gets near straight up or down, so the arm can sweep over the top
    chargeUpper: -1.2, // charge: arm raised above the head...
    chargeElbow: -0.5, // ...elbow folded back a little
    chargeWrist: -0.1, // ...so the club leans slightly behind the head
    chargeCock: -0.2, // extra backward lean added at full charge
    slamElbow: 0, // slam: the arm straightens...
    slamWrist: 0.3, // ...and the club is pointing a little downward at the end
    elbowStiffness: 300, // springs with a rest angle: softer = the club head lags and whips more
    elbowDamping: 28,
    elbowMaxTorque: 400,
    wristStiffness: 80,
    wristDamping: 8,
    wristMaxTorque: 150,
    wristLimit: 2.4, // how far the club can flop relative to the forearm
  },
  charge: {
    // Hold the charge button (left-click): the weapon stays on your aim and loads momentum. Release: the fighter lunges
    // along the aim and the arm gets a torque burst.
    minFrames: 3, // shorter holds do nothing
    maxFrames: 30, // hold this long for a full charge (0.5 s)
    lungeMaxAngle: 0.61, // radians (35 degrees): the lunge follows the aim but stays this close to horizontal
    lungeImpulse: 100, // N*s along the aim at full charge (about 8 m/s for this body)
    torqueMul: 2, // shoulder strength multiplier at full charge during the burst (1 = none)
    slamDelay: 7, // frames after release before the club comes down: you fly forward with it raised, then slam
    releaseFrames: 18, // how long the burst lasts
    moveFactor: 0.65, // walking speed while charging or winding up
  },
  punch: {
    // Unarmed left-click. Hold: the fist is drawn back with the elbow folded, and the longer you hold the harder the punch.
    // Let go: the arm whips straight out along the aim and the body lunges in. A quick tap is a quick, light punch.
    // Angles are relative to your aim line, for a fighter facing right (mirrored when facing left).
    windFrames: 6, // the shortest wind-up: even a tap draws back this long
    maxWindFrames: 30, // hold this long (0.5 s) for the heaviest punch
    quickPower: 0.45, // strength of a tap, compared with a full-hold punch (1)
    strikeFrames: 10, // throw forward
    recoverFrames: 12, // before you can punch again
    cockUpper: 2.6, // upper arm swings this far behind the aim line
    cockExtra: 0.4, // ...and a little further back the longer you hold
    cockElbow: -2.2, // elbow folded tight
    guardUpper: 1.0, // resting guard: upper arm hanging down in front...
    guardElbow: -2.0, // ...forearm folded up, fist at the chest
    torqueMul: 2.5, // arm strength during a full-power throw
    strikeImpulse: 0.8, // extra shove on the fist each frame of a full-power throw
    lunge: 35, // push the whole body forward into a full-power punch
  },
  throw: {
    // Right-click while holding the charge: the swing starts, then the club is let go partway through it.
    // (Right-click with no charge just drops the club with whatever speed your own swing and movement gave it.)
    minPower: 0.3, // even a very short charge throws at least this hard
    afterSlamFrames: 3, // how far into the downswing the club is let go
    boost: 11, // extra speed (m/s) along your aim at full charge, on top of the speed of the swing
    lungeShare: 0.5, // how much of the usual lunge the thrower still gets
  },
  fist: {
    impactFactor: 3.0, // unarmed damage factor
    knockbackMul: 0.35, // punches shove the victim this much as hard as other hits do (1 = the same)
  },
  combat: {
    impactMin: 10, // below this nothing happens (resting contact never hurts)
    damageScale: 0.3,
    damageExp: 1.5, // 1 = damage grows in a straight line with impact; above 1, big committed swings are worth disproportionately more
    damageMax: 100,
    knockbackScale: 0.9, // how hard a hit shoves the victim
    knockbackUp: 0.2, // extra upward launch per impact
    knockbackMax: 45,
    spinScale: 0.04, // how much a hit tips the victim backward (it used to be random and huge: that was the flipping)
    headMult: 1.6, // damage multiplier for a hit to the head
    hitCooldown: 20, // frames before the same weapon can hit again
    stunFrames: 25,
  },
  respawn: {
    frames: 120,
  },
  shake: {
    minImpact: 45, // hits weaker than this do not shake the screen at all
    perImpact: 0.8, // pixels of shake per point of impact above that
    max: 16,
    decayPerSecond: 0.0004, // fraction left after one second (smaller = settles faster)
  },
  splat: {
    max: 120,
    radiusMin: 10, // pixels
    radiusMax: 40,
    radiusPerImpact: 1.2,
    alpha: 0.8,
  },
  audio: {
    master: 0.4,
    hitFreqHigh: 160,
    hitFreqLow: 45,
    hitLength: 0.14,
    hitFullImpact: 40,
  },
  finish: {
    vignetteAlpha: 0.35,
  },
  colors: {
    void: 0x141018,
    sky: 0x3b3550,
    platform: 0x6d5a45,
    wall: 0x57493a,
    platformEdge: 0x3a2618,
    outline: 0x3a2618,
    stick: 0x8c5a2f,
    players: [0xd94a3a, 0xe9ddc1, 0x2f6fb5, 0xe8b931], // player 1, dummy, then blue and yellow later
    damaged: 0xb04030, // tint blended in as hidden HP drops
  },
};

export type Tuning = typeof tuning;

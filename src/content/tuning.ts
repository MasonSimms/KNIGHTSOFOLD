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
    spawnX: [7, 11.5, 5.5, 13.5], // fighter 0 = you, 1 = dummy, 2 and 3 = extra fighters (stress test)
  },
  fighter: {
    hp: 100, // hidden: never shown on screen (F3 overlay only)
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
    moveSpeed: 5,
    groundAccel: 40,
    airAccel: 12,
    jumpSpeed: 9,
  },
  balance: {
    kp: 800, // spring pulling the body upright
    kd: 60, // damping on spin
    maxTorque: 600,
    stunFactor: 0.25, // balance strength while stunned
  },
  arm: {
    // The shoulder follows the aim like a velocity servo: turn rate = shoulderTrack x angle error (capped), so no overshoot.
    shoulderTrack: 25, // 1/s: bigger = tighter to the mouse (25 closes a gap in about 3 frames)
    shoulderMaxRate: 14, // rad/s cap on how fast the arm can turn
    shoulderForce: 300, // N*m per rad/s of rate error: how firmly it holds that rate
    aimFeedForward: 1, // 0 = ignore how fast the mouse is turning, 1 = full
    maxAimRate: 25, // rad/s cap on that feed-forward
    shoulderMaxTorque: 300, // torque cap: swing authority, and the kick the torso feels
    elbowStiffness: 1500,
    elbowDamping: 60,
    elbowMaxTorque: 600,
    elbowLimit: 1.6,
    limpDamping: 0.5,
  },
  stick: {
    length: 1.1,
    thickness: 0.1,
    mass: 1.2,
    gripFromEnd: 0.25,
    impactFactor: 2.2, // this weapon's damage factor: impact = hit speed (m/s) x this
    wristStiffness: 1500,
    wristDamping: 40,
    wristMaxTorque: 300,
    wristLimit: 0.35,
    grabRange: 0.8,
  },
  charge: {
    // Hold the charge button (left-click): the weapon stays on your aim and loads momentum. Release: the fighter lunges
    // along the aim and the arm gets a torque burst.
    minFrames: 3, // shorter holds do nothing
    maxFrames: 30, // hold this long for a full charge (0.5 s)
    lungeImpulse: 100, // N*s along the aim at full charge (about 8 m/s for this body)
    torqueMul: 2, // shoulder strength multiplier at full charge during the burst (1 = none)
    releaseFrames: 18, // how long the burst lasts
    moveFactor: 0.5, // walking speed while charging
  },
  throw: {
    // Right-click: the arm cocks back automatically, then the weapon flies along the aim.
    windupFrames: 8,
    cockAngle: 1.9, // how far behind the aim line the arm pulls back (radians)
    torqueMul: 1.5, // arm strength during the wind-up, so it gets there in time
    speed: 16, // m/s
    spin: 18, // rad/s of tumble
  },
  fist: {
    impactFactor: 1.6, // unarmed damage factor
  },
  combat: {
    impactMin: 10, // below this nothing happens (resting contact never hurts)
    damageScale: 2.5,
    damageMax: 60,
    knockbackScale: 1.5,
    knockbackUp: 0.3, // extra upward launch per impact
    knockbackMax: 90,
    spinScale: 0.3,
    hitCooldown: 20, // frames before the same weapon can hit again
    stunFrames: 25,
    hitStopMin: 3,
    hitStopMax: 6,
    hitStopFullImpact: 40, // impact that earns the maximum hit-stop
  },
  respawn: {
    frames: 120,
  },
  shake: {
    perImpact: 0.6, // pixels per impact point
    max: 24,
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
  charge_glow: {
    radius: 0.3, // metres
    color: 0xffe36e,
    alpha: 0.55, // at full charge
  },
  colors: {
    void: 0x141018,
    sky: 0x3b3550,
    platform: 0x6d5a45,
    platformEdge: 0x3a2618,
    outline: 0x3a2618,
    stick: 0x8c5a2f,
    players: [0xd94a3a, 0xe9ddc1, 0x2f6fb5, 0xe8b931], // player 1, dummy, then blue and yellow later
    damaged: 0xb04030, // tint blended in as hidden HP drops
  },
};

export type Tuning = typeof tuning;

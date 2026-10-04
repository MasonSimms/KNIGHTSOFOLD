// Every gameplay number lives here. Edit and save while the game runs: the world resets with the new values.
// Units: metres, seconds, kilograms, radians. +x is right, +y is DOWN (same as the screen).
export const tuning = {
  sim: {
    dt: 1 / 60,
    gravity: 22, // heavier than Earth: snappier, more comedic arcs
    maxStepsPerFrame: 5,
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
    kp: 400, // spring pulling the body upright
    kd: 40, // damping on spin
    maxTorque: 250,
    stunFactor: 0.25, // balance strength while stunned
  },
  arm: {
    // Motors are torque springs: torque = stiffness * angle error - damping * spin, capped at maxTorque (N*m).
    shoulderStiffness: 600,
    shoulderDamping: 10,
    shoulderMaxTorque: 100, // swing authority; also the kick the torso feels
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
    impactMass: 3.5, // "effective mass" used for impact (arm weight behind the swing)
    impactMult: 1,
    wristStiffness: 1500,
    wristDamping: 40,
    wristMaxTorque: 300,
    wristLimit: 0.35,
    grabRange: 0.8,
  },
  cock: {
    // Hold the cock button: the weapon arm pulls back; release for a torque burst that grows with how long you held it.
    angle: 1.9, // how far behind the aim line the arm winds back (radians)
    holdTorque: 60, // shoulder strength while cocked (low = slow, deliberate wind-up)
    minFrames: 3, // shorter holds give no bonus
    maxFrames: 30, // hold this long for the full bonus (0.5 s)
    releaseFrames: 14, // how long the burst lasts after release
    releaseMul: 2.5, // shoulder torque multiplier at full charge (1 = no bonus)
    autoFrames: 5, // a plain click winds up for this long, then releases automatically
  },
  fist: {
    impactMass: 1.2,
    impactMult: 1,
    punchFrames: 8,
    punchImpulse: 0.6, // per frame while punching
    punchCooldown: 20,
  },
  combat: {
    impactMin: 10, // below this nothing happens (resting contact never hurts)
    damageScale: 1.5,
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
    grainTile: 256, // px, noise texture generated in code
    grainAlpha: 0.1, // plan says about 8-12% canvas-weave strength
    vignetteAlpha: 0.35,
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

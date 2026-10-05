// Every gameplay number lives here. Edit and save while the game runs: the world resets with the new values.
// Units: metres, seconds, kilograms, radians. +x is right, +y is DOWN (same as the screen).
export const tuning = {
  sim: {
    dt: 1 / 60,
    gravity: 22, // heavier than Earth: snappier, more comedic arcs
    maxStepsPerFrame: 5,
    maxFallSpeed: 18, // terminal fall speed (m/s): a body landing faster than this on its legs gets blasted back out of the floor
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
    weaponRule: 'start' as 'start' | 'sky' | 'spots', // how weapons reach fighters: 'start' = everyone starts armed, 'sky' = clubs rain from above, 'spots' = clubs lie at fixed spots
    weaponSpots: [0.42, 0.58, 0.34, 0.66], // where along the platform (0 = left end, 1 = right end) the clubs lie in the 'spots' rule
    weaponReturnFrames: 120, // a weapon lost in the void comes back from the sky after this long (2 s)
    wallGap: 1.3, // metres between each platform end and its wall: a fighter knocked off the end falls into the gap and can wall-jump out
    wallThickness: 0.5,
    wallTop: 3.2, // how high the walls reach (the platform top is at 7.4)
    spawnX: [7, 11.5, 5.5, 13.5], // playing alone: fighter 0 = you, 1 = the training dummy, 2 and 3 = extra fighters (stress test)
    fightSpawnX: [6.2, 13.0, 8.6, 10.6], // a real fight of 2-4 players: where each one starts
  },
  fighter: {
    hp: 100, // hidden: never shown on screen (F3 overlay only)
    startArmed: true, // false = you start with empty hands, to try the punch
    torsoRadius: 0.18,
    torsoMass: 6,
    torsoInertia: 0.5, // extra resistance to turning (kg*m^2): higher = the body is harder to twist, by the arm, by hits, by anything
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
    moveSpeed: 6.05, // was 5.5 (+10%)
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
    punchForward: 0.35, // lean into the punch
  },
  legs: {
    // Real physics legs: a thigh and a shin each, with motors at the hip and knee that try to hold a walking pose.
    // The body is held up by the stand spring (below), so the legs only have to look right and react to the floor.
    torsoHalf: 0.08, // the body capsule (the hips are at the body's centre, the chest above it)
    torsoY: -0.22,
    thigh: 0.2, // hip to knee (the legs are a touch shorter than the stand height, so they rest on the floor without carrying the body)
    shin: 0.2, // knee to foot
    radius: 0.05,
    mass: 0.4, // each thigh and each shin
    friction: 0.3, // feet slide a little, so walking is not fighting the floor
    hipStiffness: 120, hipDamping: 8, hipMaxTorque: 60,
    kneeStiffness: 90, kneeDamping: 6, kneeMaxTorque: 45,
    hipLimit: 1.8, // how far a thigh can swing from the body (radians)
    kneeLimit: 2.5, // how far a knee can fold (it only folds one way: knee toward where you face)
    stance: 0.12, // feet apart when still (radians from straight down)
    standKnee: 0.15, // a slight knee bend when still
    swing: 0.65, // how far each leg swings front and back when running (radians)
    runKnee: 0.9, // how much the knee lifts during the forward swing
    runRate: 7, // how fast the legs cycle for each metre per second of speed
    airSpread: 0.35, // legs spread like this in the air...
    airKnee: 0.6, // ...knees tucked a bit
  },
  stand: {
    // An invisible spring holds the hips this high above whatever is under them (the Stick Fight / active-ragdoll trick).
    height: 0.42, // metres from the hips to the floor when standing
    stiffness: 400, // how firmly (1/s^2); with the damping below it settles without bouncing
    damping: 40,
    reach: 0.25, // the spring still grabs the floor this far beyond the wanted height (stepping off a ledge lets go)
    maxAccel: 80, // m/s^2 cap, so a landing does not catapult you
  },
  offArm: {
    // The second arm: pure decoration. It hangs off the shoulder and flops with your motion; it only touches the floor and walls.
    mass: 0.25, // each part (light, so it barely tugs the body)
    damping: 0.4, // joint friction: lower = floppier
    // In punches and grabs it joins in (for show: it still touches nothing but the floor and walls):
    stiffness: 60, // how firmly it holds its pose
    poseDamping: 6,
    maxTorque: 40,
    trail: 0.35, // radians it lags behind the main arm, so the two arms look like two arms
  },
  ragdoll: {
    // On death the head comes off onto a floppy neck and the legs go limp.
    legStiffness: 2, // near zero = completely floppy
    legDamping: 0.4,
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
    // Hold down: the stand spring lowers you smoothly toward the floor and the legs go soft and fold however they are bent.
    // Near the bottom you stop holding yourself upright and tip over the way you lean: you end up lying down. Let go to get up.
    downRate: 0.06, // how fast you go down each frame (0..1 of the way from standing to lying; 0.06 = about a quarter second)
    upRate: 0.1, // how fast you come back up
    lowHeight: 0.08, // hip height at the very bottom (lying down)
    legSoften: 0.85, // how much the leg motors relax at the bottom (1 = completely limp)
    kneeFold: 1.2, // extra knee bend the legs reach for as you go down
    tipStart: 0.6, // below this much crouch you start letting go of balance...
    tipAt: 0.9, // ...and here you no longer hold yourself upright at all (you tip over)
    tipTorque: 220, // a gentle push over the way you already lean, so you lie down instead of sitting upright (0 = none)
    speedFactor: 0.35, // crawling speed at the bottom (1 = walking speed)
    jumpBonus: 0.12, // a jump from a crouch goes this much higher
    lungeBonus: 0.3, // a lunge or punch from a crouch has this much more momentum
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
  flip: {
    // Hold W (gamepad: left stick up) in the air: the body rotates forward, the way you face. Let go and it rights itself.
    spin: 11, // rad/s the body spins up to while holding (a bit under 2 turns a second: a full flip fits in one jump)
    accel: 90, // rad/s^2: how quickly it gets there (and how quickly it stops spinning when you let go)
    // After landing (or letting go of flip on the ground) a body that is not upright turns smoothly back, instead of snapping:
    rightGain: 7, // 1/s: turn rate per radian of tilt
    rightMax: 6, // rad/s cap on that turn
    rightAccel: 45, // rad/s^2
    rightFrom: 0.7, // radians of tilt (40 degrees) beyond which the smooth righting takes over from normal balance
  },
  body: {
    // Body collisions: a fighter moving much faster than the one they hit deals damage by closing speed x factor (through the usual damage
    // curve). Landing on top of someone from above is a stomp: bigger damage and a 'stomp' event (for the special animation later).
    minSpeed: 5, // the faster fighter must be moving at least this fast (m/s) at the contact
    ratio: 1.6, // ...and this many times faster than the one they hit (so two people running into each other is harmless)
    factor: 1.6, // damage factor for an ordinary body slam
    stompFactor: 3.2, // damage factor for landing on someone
    stompAngle: 0.6, // how vertical the contact must be (0 = exactly from above, 1 = sideways) to count as a stomp
    knockbackMul: 0.6, // how hard a body slam shoves the victim (1 = like a club hit)
    cooldown: 20, // frames before the same fighter can slam again
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
    // Unarmed left-click, TAPPED: a quick thrown punch with no wind-up. The arm whips straight out along the aim and the body leans in.
    // (Held instead of tapped, it becomes a grab: see grab below.) Angles are for a fighter facing right (mirrored when facing left).
    power: 0.7, // strength of a punch (1 = the old full-hold punch)
    strikeFrames: 10, // throw forward
    recoverFrames: 12, // before you can punch again
    guardUpper: 1.0, // resting guard: upper arm hanging down in front...
    guardElbow: -2.0, // ...forearm folded up, fist at the chest
    torqueMul: 2.5, // arm strength during a full-power throw
    strikeImpulse: 0.8, // extra shove on the fist each frame of a full-power throw
    lunge: 35, // push the whole body forward into a full-power punch
  },
  grab: {
    // Unarmed left-click, HELD: your hand reaches out along the aim and grabs whatever part of a fighter it touches.
    // Keep holding to keep hold of them (up to maxFrames) and swing the mouse to whirl them; let go to fling them.
    maxFrames: 150, // a grab gives out after this long (2.5 s) and they drop out of your hands (no fling)
    holdFrames: 8, // hold the button this long (0.13 s) and it is a grab, not a punch
    armMul: 4, // how much stronger (and somewhat faster) your arm is while reaching or holding someone: enough to swing a whole body
    fling: 1.25, // the flung fighter's speed is multiplied by this when you let go (1 = only the swing itself)
    breakImpact: 20, // a hit on the grabber at least this big makes them drop who they are holding: the one held can hit their way out, or anyone else can
    thrownFrames: 90, // for this long after being flung (1.5 s) a hard crash hurts
    slamFactor: 2.0, // damage factor for crashing into the floor, a wall or another fighter: impact = crash speed (m/s) x this
    slamCooldown: 12, // frames between two crash hits on the same thrown fighter
  },
  disarm: {
    // A great hit can knock a club out of an opponent's hand. Where it lands matters: the hand (and the grip end of the club) is the
    // weak spot; elsewhere on the arm needs a much bigger hit; and when two clubs clash, only a clearly faster club wins the clash.
    handRadius: 0.3, // metres around the hand that count as "the hand"
    handImpact: 28, // impact needed to disarm with a hit on the hand
    armImpact: 55, // ...on the rest of the arm
    clashImpact: 40, // ...in a club-on-club clash
    clashRatio: 1.4, // in a clash the attacker's club must be this many times faster than the defender's
    kick: 7, // how hard the knocked-out club is flung away from the blow (m/s)
    kickUp: 3, // ...and upward
    spin: 12, // tumble given to it (rad/s)
    pickupDelay: 45, // frames before the dropped club can be picked up
  },
  eras: {
    specialChance: 0.15, // each round has this chance of being one of the special eras (fantasy archers, mobsters...) instead of the normal rotation
  },
  death: {
    // How a death is staged (cartoon, never gory). What killed you decides: a huge blow blows the body apart, a stomp or a hard crash flattens
    // it, a hard club hit takes off whatever it hit. (Impact = the same number the damage curve uses.)
    explodeImpact: 110, // any blow this big makes the body fly apart
    explodeSpeed: 9, // m/s each piece flies outward
    explodeLift: 3, // ...and upward
    explodeSpin: 14, // tumble (rad/s)
    crushImpact: 25, // a stomp or a crash at least this big flattens the victim (the picture squashes; physics is a normal fall)
    dismemberImpact: 42, // a killing club hit at least this big takes off the limb it hit (or the head)
    limbKick: 8, // m/s the lost limb flies away from the blow
    limbLift: 4,
    limbSpin: 16,
    shake: 0.05, // screen shake on an explosion or a crush
    squashSeconds: 0.12, // how fast a crushed fighter goes flat
    squashFlat: 0.65, // how much of their height is squashed away
    squashWide: 0.6, // how much wider they get
    squashDrop: 0.2, // metres they sink so the pancake rests on the floor
  },
  parry: {
    // Block a swing with your own club: hold it still (or nearly) in the path of a fast swing. The swinger's club flies back the way it came,
    // the swinger is pushed back a little and staggers, and you are untouched. Swing your own club into theirs and it is a clash instead.
    minSpeed: 6, // the incoming club must be moving at least this fast at the contact (m/s)
    maxSpeed: 2.5, // ...and the blocking club slower than this
    ratio: 3, // ...and the incoming club this many times faster
    bounce: 0.9, // the incoming club goes back at this much of its own speed...
    bounceMin: 7, // ...and never slower than this (m/s)
    knock: 3, // m/s the swinger's whole body is pushed back
    stun: 14, // frames the swinger staggers
    lockFrames: 24, // frames before the swinger can start another attack (0.4 s: the window to counter)
    cooldown: 20, // frames before that same club can parry-trigger again
    shake: 0.04, // screen shake
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
  match: {
    // A fight: last fighter standing wins the round and scores a point. Dead fighters stay down until the round is over.
    resultFrames: 150, // how long the result is shown before the next round starts (2.5 s)
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
    players: [0xd94a3a, 0x2f6fb5, 0xe8b931, 0x3e9b5a], // player 1 to 4: red, blue, yellow, green
    dummy: 0xe9ddc1, // the training dummy
    damaged: 0xb04030, // tint blended in as hidden HP drops
  },
};

export type Tuning = typeof tuning;

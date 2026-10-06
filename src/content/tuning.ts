// Every gameplay number lives here. Edit and save while the game runs: the world resets with the new values.
// Units: metres, seconds, kilograms, radians. +x is right, +y is DOWN (same as the screen).
export const tuning = {
  sim: {
    dt: 1 / 60,
    gravity: 22, // heavier than Earth: snappier, more comedic arcs
    maxStepsPerFrame: 5,
    maxPartSpeed: 60, // m/s: a safety cap on any body part (real play stays far below it: club tips reach about 35); stops rare solver blow-ups
    maxFallSpeed: 18, // terminal fall speed (m/s): a body landing faster than this on its legs gets blasted back out of the floor
    solverIterations: 32, // Rapier default is 4; more = stiffer joints (arm chain) at some CPU cost
    pgsIterations: 4,
  },
  arena: {
    // How much of the world the camera shows (owner: fighters sized like Stick Fight's, about 8-9% of the screen height, so the maps feel
    // open). 24 x 13.5 = 80 px per metre at 1920x1080: a fighter is 1.16 m, 8.6% of the height. (Was 19.2 x 10.8: 10.7%, everything felt
    // cramped.) Zooming means moving every arena position too (era maps in eras.ts are in these metres).
    viewW: 24,
    viewH: 13.5,
    platformX: 5.25,
    platformW: 13.5,
    platformTop: 9.25,
    platformThickness: 1.2,
    friction: 0.8,
    killY: 15, // below this is the void: instant kill (just under the bottom of the screen)
    killXMargin: 2, // metres past either screen edge
    // Floating ledges must never be in the way (owner: no getting stuck or interrupted by platforms, and room to swing, like SpiderHeck).
    // Every ledge's underside is at least ledgeHeadroom above whatever is under it, so you walk under it freely (weapons in a hand pass
    // through the scenery, so swings are never blocked), and every ledge is low enough for a full jump to get onto it from somewhere.
    // The maps test checks every era's map against both.
    ledgeThick: 0.3, // how thick a floating ledge is
    ledgeHeadroom: 1.5, // a fighter is 1.16 m tall
    weaponRule: 'start' as 'start' | 'sky' | 'spots', // how weapons reach fighters: 'start' = everyone starts armed, 'sky' = clubs rain from above, 'spots' = clubs lie at fixed spots
    weaponSpots: [0.42, 0.58, 0.34, 0.66], // where along the platform (0 = left end, 1 = right end) the clubs lie in the 'spots' rule
    weaponReturnFrames: 120, // a weapon lost in the void comes back from the sky after this long (2 s)
    // Side walls, chosen per map in eras.ts (owner: no high pillars on every map, but some maps should have walls, placed with thought).
    // None here: off an open end you fall into the void (you can still slide down the platform's side and jump off it).
    // side = -1 the left end, 1 the right end; up = how high the wall's top stands above the floor (metres; a fighter is 1.16 m);
    // gap = metres between the platform's end and the wall: 0 = a backstop (nobody goes off that end unless thrown over it), more = a gap
    // you fall into and can wall-jump out of.
    walls: [] as { side: -1 | 1; up: number; gap: number }[],
    wallThickness: 0.6,
    spawnX: [9.75, 14.25, 8.25, 16.25], // playing alone: fighter 0 = you, 1 = the training dummy (4.5 m apart, as before the zoom), 2 and 3 = extra fighters (stress test)
    fightSpawnX: [7.75, 16.25, 10.75, 13.25], // a real fight of 2-4 players: where each one starts
    ledges: [] as { x: number; up: number; w: number }[], // floating platforms (an era's arena can add them)
    ground: [] as { x: number; w: number }[], // separate ground slabs instead of one platform (empty = the one platform)
    bridge: null as null | { x0: number; x1: number; planks: number }, // a plank bridge across a gap in the ground
    props: [] as { kind: string; x: number; up: number }[], // loose objects lying on the arena
    // The front plane: things between us and the fighters (looks only: nobody can touch them). kind = grass or sign; x, y = where its base
    // sits (metres, the view is 24 x 13.5); scale = size; speed = m/s it slides across (a sign passing the train), wrapping round.
    front: [] as { kind: 'grass' | 'sign'; x: number; y: number; scale?: number; speed?: number }[],
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
    jumpSpeed: 9.8, // about 2.2 m high, two body heights (was 8.5 = 1.6 m, too low to get onto a ledge you can walk under; 11.5 = 3 m was way too floaty)
    fallGravity: 1.6, // coming down you fall this many times faster than gravity alone (owner: floaty; Stick Fight jumps rise and drop quickly). 1 = a plain arc
    coyoteFrames: 6, // you can still jump this long after walking off a ledge
    jumpBufferFrames: 6, // a jump pressed this early before landing still happens
    jumpCut: 0.5, // letting go of jump early cuts the jump short by this much (1 = no cut)
    jumpCutMinSpeed: 2, // ...but only while still rising faster than this (m/s)
    wallSlideSpeed: 1.5, // fall speed while sliding down a wall you are pushing toward (m/s)
    wallJumpX: 6.5, // speed kicked away from the wall (m/s)
    wallJumpY: 10, // upward speed of a wall jump (a bit lower than a normal jump)
    wallCoyoteFrames: 6, // a wall jump still works this long after leaving the wall
    wallTuckFrames: 30, // after a wall jump the club is held up over the head this long (0.5 s), so it does not snag the platform edge on the way out
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
    // Only while you are on your feet (owner: landing on your arm, head or back bounced you off the ground: the spring was lifting a
    // body that was upside down or lying). Full strength up to uprightFull of tilt, nothing past uprightNone (cosine of the tilt).
    uprightFull: 0.55, // cos: about 55 degrees
    uprightNone: 0.15, // cos: about 80 degrees
  },
  land: {
    // Running into things never rebounds (owner: landing on your arm, head or an item bounced you off the ground; it also bounced fighters off
    // walls). The stiff joint chain (sim.solverIterations) can spring a body back when a limb, the head or a held club hits first; a fighter
    // moving faster than fallSpeed may not come back the way they came faster than maxRebound in the same step. (Not while knocked down:
    // tumbling bodies may bounce. Jumps, hits and knockdowns are applied separately and are not affected.)
    fallSpeed: 3, // m/s
    maxRebound: 1, // m/s
    maxCut: 12, // m/s: never takes away more than this (real rebounds from the joints are under 10)
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
    aimReach: 0.7, // you pick up the thing nearest the point where you aim, this far (as a share of the range) from your body: aim at the one you want
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
    visualBlur: 2.5, // how soft you get as you slip back into the background (pixels at 1080p)
    visualRate: 12, // how fast you turn toward the screen and back
    recoveryFrames: 6, // after coming back from a dodge you cannot start an attack for this long (0.1 s: short enough to punish a swing that missed you)
  },
  balance: {
    kp: 800, // spring pulling the body upright
    kd: 60, // damping on spin
    maxTorque: 900,
    stunFactor: 0.25, // balance strength while stunned
  },
  rightUp: {
    // A body far from upright (after a knock, a landing, a tumble) turns smoothly back, instead of snapping. (W used to flip you; owner removed it.)
    gain: 7, // 1/s: turn rate per radian of tilt
    max: 6, // rad/s cap on that turn
    accel: 45, // rad/s^2
    from: 0.7, // radians of tilt (40 degrees) beyond which the smooth righting takes over from normal balance
  },
  slam: {
    // BODY SLAM (owner): holding someone (left-click held), jump and hold S. Your arm drives them straight down, they are turned head-first
    // and you both fall faster. When their head hits the ground, the damage depends on how far they were driven down: a slam from a
    // normal jump does good damage but does not kill; from a height it does. Then you let go of them and they are knocked down.
    drive: 30, // m/s^2: while slamming you both fall at least as fast as a fall with this much extra pull (gravity is 22)
    settleFrames: 6, // a slam can only start once you have held them this long (a brand-new grab is still settling)
    turnGain: 10, // turning them head-down: 1/s per radian still to go...
    turnMax: 14, // ...capped at this many rad/s...
    turnAccel: 240, // ...and reached this quickly (rad/s^2: a sudden spin would tear the grab apart)
    under: [0.25, 0.9], // where they are brought to: metres in front of and below your body
    steer: 10, // 1/s: how quickly they are brought there...
    steerAccel: 600, // ...changing their speed by at most this much (m/s^2: 10 m/s a frame; at 300 the victim often stayed above you, so you landed first and the slam fizzled)
    armGain: 0.3, // while slamming your grabbing arm is this soft (x its normal strength): the slam moves them and the arm follows
    damage: 15, // hidden HP for any slam that lands...
    damagePerMetre: 32, // ...plus this per metre their body dropped from the top of the slam (a slam from a jump: about 35-40; a drop of about 2.6 m or more: a kill)
    carryJumpSpeed: 8.5, // jumping while holding someone: you both leave the ground this fast (m/s), lower than a free jump (motion.jumpSpeed): a body in your hands weighs you down. The slams were tuned with 8.5
    swingDrive: 40, // m/s^2: someone you hold who is already coming down (a downward swing, a drop) is pulled down this much harder, so swinging them into the ground hits hard
    swingMin: 1.5, // m/s: ...once they are coming down at least this fast
    minSpeed: 4, // m/s: their head must hit the ground at least this fast
    impactFactor: 3.5, // how hard it counts for knockdown, screen shake and paint (x the head's speed)
  },
  body: {
    // Body collisions: a fighter moving much faster than the one they hit deals damage by closing speed x factor (through the usual damage
    // curve). Landing on top of someone from above is a stomp: bigger damage and a 'stomp' event (for the special animation later).
    minSpeed: 7, // the faster fighter must be moving at least this fast (m/s) at the contact (above walking speed: walking into someone never hurts; a lunge is about 8)
    stompMinSpeed: 5, // ...or this fast when landing on someone from above
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
    overTopMin: 1.5, // rad: a swing bigger than this whose short way round points down goes up over the top instead (so turning round never digs the club into the floor)
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
    // Guard (owner: the club follows the mouse but is HELD like a club, coming out of the fist across the forearm, not pointing straight on
    // from the arm). The club itself points at the mouse; the wrist holds it bent off the forearm and the arm is placed to suit.
    // A normal grip: the club comes out of the THUMB side of the fist, across the forearm (owner: not the reverse grip), and turns with the
    // mouse (rigidly, from the shoulder, so swings keep their power). The arm reaches out in front a little below the aim, nearly straight, so
    // the fist sits at chest height; the club leads the mouse upward. Aiming level = a club held up from a fist in front of the chest.
    holdLead: -1.0, // the club points this far above the aim (radians, about 70 degrees: aiming level, it stands nearly upright out of the fist; 0 = exactly at the mouse)
    holdArm: 0.4, // the arm points this far below the aim (0 when aiming straight down): fist out in front at shoulder height
    holdElbow: -0.4, // the elbow bends up a little
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
    armMul: 1.8, // how much stronger your arm is while reaching or holding someone (was 4: a body whirled like nothing; now the other fighter has real weight but can still be swung and thrown)
    fling: 1, // the flung fighter's speed is multiplied by this when you let go (1 = only the swing itself)
    maxFling: 12, // m/s: nobody leaves your hands faster than this
    maxCatchSpeed: 10, // m/s: a hand cannot lock onto someone flying past faster than this (relative to the hand)
    breakImpact: 20, // a hit on the grabber at least this big makes them drop who they are holding: the one held can hit their way out, or anyone else can
    thrownFrames: 90, // for this long after being flung (1.5 s) a hard crash hurts
    slamFactor: 2.6, // damage factor for a flung or held fighter crashing into the floor, a wall or another fighter: impact = crash speed (m/s) x this (was 2.0: owner wants throws into walls and swings into the ground to count as body slams)
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
  spawn: {
    enabled: false, // TESTING (owner): off for now, so no extra clubs lie around while the fighting is tuned. true = weapons keep arriving
    // Weapons keep arriving during a round, faster and better as it goes on (so rounds finish by themselves). Each era's pickups are in eras.ts.
    firstGap: 480, // frames from one spawn to the next at the start of a round (8 s)
    minGap: 150, // ...shrinking to this by rampFrames (2.5 s)
    rampFrames: 3600, // a minute
    strongAfterFrames: 1500, // the era's strong pickup can only appear after this (25 s)
    strongChance: 0.6, // once it can appear, this share of spawns are the strong one
    maxLoose: 6, // never more pickups lying around than this
    airdropChance: 0.5, // a spawn falls from the sky (otherwise it appears at one of the fixed spots)
    spots: [0.18, 0.5, 0.82], // fixed spots along the platform (0 = left end, 1 = right end)
    startRules: { start: 0.5, spots: 0.25, sky: 0.25 }, // how a round begins: everyone armed, clubs on the floor at fixed spots, or clubs falling from the sky
  },
  eras: {
    mixStarts: false, // TESTING (owner): everyone starts armed for now (true = some rounds start with the clubs on the floor or falling from the sky); // each round picks its starting rule from spawn.startRules (false = always the arena's weaponRule: the tests do this)
    changeGameplay: true, // an era changes the arena layout and the weapon (false = every round uses the standard arena and club: the tests do this)
    specialChance: 0.15, // each slot of a match has this chance of being one of the special eras (fantasy archers, mobsters...) instead of its normal era
  },
  maim: {
    // A HUGE club blow (rare: a thrown club or a full-speed charge) to a limb takes the limb off. You play on with the consequence until the
    // round ends (the next round everyone has a fresh body). A huge killing blow to the head takes the head off instead.
    impact: 60,
    leaveHp: 15, // the blow that takes a limb leaves the victim at least this much hidden HP (so it maims instead of killing)
    kick: 8, // m/s the lost limb flies away from the blow
    lift: 4,
    spin: 16,
    stunFrames: 25,
    swingCooldown: 40, // frames the club that took a limb cannot hit again (0.7 s: it does not kill them on the way through)
    oneLegSpeed: 0.55, // with one leg: walking speed...
    oneLegJump: 0.6, // ...and jump height
    noLegSpeed: 0.3, // with no legs you crawl (and cannot jump)
  },
  death: {
    // How a death is staged (cartoon, never gory). What killed you decides: a huge blow blows the body apart, a stomp or a hard crash flattens
    // it, a hard club hit takes off whatever it hit. (Impact = the same number the damage curve uses.)
    explodeImpact: 110, // any blow this big makes the body fly apart
    explodeSpeed: 9, // m/s each piece flies outward
    explodeLift: 3, // ...and upward
    explodeSpin: 14, // tumble (rad/s)
    crushImpact: 25, // a stomp or a crash at least this big flattens the victim (the picture squashes; physics is a normal fall)
    shake: 0.05, // screen shake on an explosion or a crush
    fallPaint: 0xb3232b, // the red paint that splatters the picture when someone falls off the stage (cartoon, not gore)
    squashSeconds: 0.12, // how fast a crushed fighter goes flat
    squashFlat: 0.65, // how much of their height is squashed away
    squashWide: 0.6, // how much wider they get
    squashDrop: 0.2, // metres they sink so the pancake rests on the floor
  },
  props: {
    // Loose objects in the world (planks, logs, bones) and lost limbs: all of them can be picked up (right-click, empty hands) and used as a club.
    lying: false, // TESTING (owner): the loose planks, logs and bones an era leaves lying on its map are off for now (true = on; bridges keep their planks)
    factor: 2.0, // damage factor of a held prop
    limbFactor: 1.6, // ...of a held limb (a leg, say)
  },
  bridge: {
    // A bridge is a chain of planks: it can be cut, it snaps if someone slams into it, and every plank that comes free is a club.
    plankMass: 3,
    plankThick: 0.24,
    linkLimit: 0.6, // how far each plank can swing from the next (radians): it sags a little
    cutImpact: 20, // a club hit at least this big cuts the plank it lands on free
    slamSpeed: 8, // a body hitting a plank at least this fast (m/s) breaks the bridge there (the stand spring soaks up an ordinary jump's landing, so only a hard fall or a flung body gets this fast)
    breakSpan: 1, // ...and this many planks either side of it
    shake: 0.03, // screen shake when a plank snaps
  },
  knock: {
    // A BIG hit knocks the fighter down: they go limp, spin head over heels in proportion to the blow, cannot act, bounce off walls and the
    // floor, and then get up on their own as soon as they are calm and on the ground.
    minImpact: 35, // hits below this just stagger
    frames: 20, // the shortest knockdown (0.33 s)...
    perImpact: 0.6, // ...plus this many frames for every point of impact above the minimum
    maxFrames: 70, // never longer than this (1.2 s)
    lift: 0.07, // m/s of upward launch per point of impact (the air time to tumble in)
    spin: 0.34, // rad/s of tumble per point of impact (impact 60 = about 20 rad/s: three turns a second at the start, slowing as the limbs drag)
    spinJitter: 0.3, // a little variety in the tumble
    balance: 0.04, // how much of the upright spring is left while knocked down
    legSoft: 0.9, // how limp the legs go
    armLimp: 0.05, // how much arm strength is left (a limp arm does not fight the tumble)
    minAge: 14, // earliest moment they may get up early (frames after the blow)
    calmSpin: 2.5, // ...once spinning slower than this (rad/s)
    calmSpeed: 2.5, // ...and moving slower than this (m/s)
    recoverStun: 6, // frames of staggering left once they are up
    crashSpeed: 6, // hitting a wall, the floor or a ledge at least this fast (m/s) while knocked down is a crash...
    crashBounce: 0.5, // ...and bounces them back off it with this much of the speed...
    crashSpin: 5, // ...and a fresh tumble (rad/s)
    crashCooldown: 10, // frames before the next crash can bounce them
    crashShake: 0.004, // screen shake per m/s of a crash
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
    max: 400, // decals on the picture (the paint from a whole round stays until the round ends)
    radiusMin: 10, // pixels
    radiusMax: 40,
    radiusPerImpact: 1.2,
    alpha: 0.95,
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
    // Painted backdrops (art-guide/ART_STYLE.md): each round's backdrop and ground are painted with oil strokes in a background worker.
    // width = painting resolution; under = smooth underpaint showing through the strokes (higher = smoother); relief = paint thickness;
    // bristle = how streaky a stroke is; jitter = colour wobble between strokes. Each era can scale these (content/paintings.ts, brush).
    paint: { width: 1280, under: 0.5, relief: 0.55, bristle: 0.25, jitter: 0.45 },
    // A live oil filter over the fighters, props and paint (off: they are painted textures now; set enabled: true to compare).
    oil: { enabled: false, radius: 3.5, relief: 0.13, stroke: 46 }, // radius = how far colour is blended (px at 1080p), relief = paint thickness lighting, stroke = brush length
    shadow: { alpha: 0.22, blur: 6, x: 0.05, y: 0.06 }, // the faint soft shadow that lifts each fighter off the map: strength, softness (px at 1080p), offset (m)
    front: { blur: 3.5 }, // how out of focus the front plane is (px at 1080p)
    boilFps: 9, // how often the painted fighters' brush strokes change (the package: 3 painted variants at 8-10 fps)
    // The hot-colour cape (looks only): where it hangs from (metres from the torso's centre), and how the cloth moves.
    cape: { backX: 0.1, shoulderY: -0.24, gravity: 9, trail: 3, flutter: 2.5, flutterRate: 6, damping: 0.94 },
    underOffset: 0.025, // metres: the dark underpaint peeking out at the lower right of fighters and objects
    paintBlur: 0.6, // softness of the paint on the picture (pixels at 1080p)
    // The painting style. Every era can override any of these in its `style` row (content/eras.ts).
    // THREE PLANES (owner): the background plane (painted, blurred and hazed), the play plane (fighters, ground, props: sharp), and an
    // optional front plane (arena data: grass, a passing sign...) between us and the fighters, slightly out of focus.
    style: {
      blur: 5, // how out of focus the background plane is (pixels at 1080p; painted in: the ground the fighters stand on stays sharp)
      haze: 0.1, // how much the background plane fades toward the horizon colour (air between us and it)
      grain: 0.035, // how strong the live canvas grain is (0 = none; the painted backdrop has its own weave)
      tint: 0xffe2b0, // a colour wash over the whole picture, like old varnish
      tintAlpha: 0, // (the painted backdrop is already graded; an era can still add a wash)
    },
  },
  colors: {
    void: 0x141018,
    sky: 0x3b3550,
    platform: 0x6d5a45,
    wall: 0x57493a,
    platformEdge: 0x3a2618,
    outline: 0x3a2618,
    stick: 0x8c5a2f,
    players: [0xd8402a, 0x2d5db0, 0xe8b931, 0x2f9e6b], // player 1 to 4: vermilion, ultramarine, cadmium yellow, viridian (the art guide's pigments)
    dummy: 0xe9ddc1, // the training dummy
  },
};

export type Tuning = typeof tuning;

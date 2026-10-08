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
    ice: 0, // how slippery the whole floor is: the share of your feet's grip it takes away (0 = none; 0.85 = you skate, and slide on when you stop)
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
    ground: [] as { x: number; w: number; up?: number; thick?: number }[], // separate ground slabs instead of one platform (empty = the one platform); each can stand `up` metres higher (or lower) and be `thick` deep
    bridge: null as null | { x0: number; x1: number; planks: number; kind?: string; water?: boolean }, // (kind: what its pieces are, props.ts, instead of planks; water: an aqueduct, tuning.aqueduct) // a plank bridge across a gap in the ground
    props: [] as { kind: string; x: number; up: number }[], // loose objects lying on the arena
    scenery: [] as { kind: string; x: number; up: number }[], // breakable scenery that belongs to the map (barrels, crates): always there, unlike the loose weapons (owner: environments have destructible elements)
    sea: null as null | { level: number; tide?: { rise: number; seconds: number } }, // water under the stage: its calm surface is `level` metres below the platform top (see tuning.water)
    boats: [] as { x: number; w: number; depth?: number; sinks?: { seconds: number; tilt: number; settle: number } }[], // floating ships instead of solid ground (needs a sea; see tuning.boat): each deck from x, w wide, its top at the platform top
    ropes: [] as { x0: number; up0: number; x1: number; up1: number }[], // ropes (see tuning.rope) from (x0, up0 m above the deck) to (x1, up1), each end tied to the ship under it; cut every one and the ships drift apart
    tar: [] as { x: number; w: number; level: number }[], // tar pits (see tuning.tar): from x, w wide (a gap in the ground), the surface `level` m below the platform top
    weapon: '', // this map's own weapon (an id in weapons.ts), instead of the era's
    roll: 0, // the painting slides by at this speed (m/s): a moving map (the train, the mammoth chase)
    tower: null as null | { x: number; w: number }, // a water tower's tank (see tuning.tower): from x, w wide, its top at the platform top: shoot its side and it leaks
    wind: null as null | { base: number; gust: number; dir: -1 | 1 }, // a windy map (see tuning.wind): a steady `base` m/s plus gusts up to `gust` more, blowing toward dir
    noWeapons: false, // nobody starts armed, nothing lies about and no pickups come (the train: fists and throws)
    spawnSpots: null as null | number[], // where on this map weapons appear when they do not fall from the sky (share of the platform; null = tuning.spawn.spots)
    gunsOnly: false, // nobody starts armed and only the era's guns drop in, early and often (eras.ts gunsOnly; tuning.spawn.gunsFirst, gunsGap)
    chariot: null as null | { at: number; cycle: number; speed: number; dir: 1 | -1 }, // a runaway chariot across the track (see tuning.chariot): first run at second `at`, then every `cycle` s, at `speed` m/s, first toward `dir` (then back)
    trapdoors: [] as { x: number; w: number; hinge: -1 | 1; at: number }[], // doors in the floor over a gap (see tuning.trapdoor): from x, w wide, hinged at its left (-1) or right (1) edge, first opening at second `at`
    train: null as null | { speed: number; cycle: number; passing: { kind: 'sign' | 'tunnel'; at: number }[] }, // a train map (see tuning.train): things pass at speed (m/s), each at its second `at` of every `cycle` seconds
    chase: null as null | { speed: number; mammothX: number; obstacles: string[]; gap: number }, // a treadmill map (see tuning.chase): the floor slides left at speed (m/s) toward a mammoth at mammothX; obstacles (props.ts kinds) ride in from the right, gap metres apart
    fires: [] as { x: number; w: number; up: number }[], // fires (see tuning.fire): flames from x, w wide, on the ground (up = 0) or a ledge `up` m higher
    // The front plane: things between us and the fighters (looks only: nobody can touch them). kind = grass or sign; x, y = where its base
    // sits (metres, the view is 24 x 13.5); scale = size; speed = m/s it slides across (a sign passing the train), wrapping round.
    front: [] as { kind: 'grass' | 'sign'; x: number; y: number; scale?: number; speed?: number }[],
  },
  fighter: {
    hp: 100, // hidden: never shown on screen (F3 overlay only)
    startArmed: true, // false = you start with empty hands, to try the punch
    torsoRadius: 0.18,
    torsoMass: 6,
    torsoInertia: 1.5, // extra resistance to turning (kg*m^2): higher = the body is harder to twist, by the arm, by hits, by anything (owner: less flopping; was 0.5: a swing or a hit spun the body about)
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
    stuckFrames: 20, // off the ground going nowhere this long (held up by something that is not a floor: jammed in a gap, hooked on an edge, on someone's head or a body) lets you jump (the top of a jump passes through 20 cm in under 15 frames, so no jumping twice in the air)
    stuckRange: 0.2, // m: ...going nowhere means staying within this distance of one spot (wiggling in a gap counts)
    jumpBufferFrames: 6, // a jump pressed this early before landing still happens
    jumpCut: 0.5, // letting go of jump early cuts the jump short by this much (1 = no cut)
    jumpCutMinSpeed: 2, // ...but only while still rising faster than this (m/s)
    wallSlideSpeed: 1.5, // fall speed while sliding down a wall you are pushing toward (m/s)
    wallJumpX: 3.5, // speed kicked away from the wall (m/s) (owner 2026-10-07: less of a leap away, more up: was 6.5)
    wallJumpY: 11.5, // upward speed of a wall jump (owner 2026-10-07: more up, a bit more than a normal jump: was 10)
    wallCoyoteFrames: 6, // a wall jump still works this long after leaving the wall
    wallTuckFrames: 30, // after a wall jump the club is held up over the head this long (0.5 s), so it does not snag the platform edge on the way out
    wallLockFrames: 6, // after a wall jump, steering is switched off for this long so you do not drift back into the wall (owner 2026-10-07, with the smaller push away: was 10)
  },
  landDip: {
    // Landing bends the knees for a moment, deeper the harder you land, then you spring back up (owner: more fluid movement, less stiff).
    // Measured in crouch (0 = standing, 1 = lying): the hips drop and the knees fold as for a crouch, but the legs stay firm.
    minSpeed: 2, // m/s: landing slower than this (a step down) does not dip
    fullSpeed: 15, // m/s: landing this fast dips the full depth (a normal jump lands at about 12)
    depth: 0.7, // the deepest dip (0 = off; 1 bounced back up)
    recover: 0.35, // seconds to come back up from the deepest dip
  },
  lean: {
    // The body leans into where it is going, then springs back upright. Angles in radians (0.5 is about 30 degrees).
    perSpeed: 0.03, // lean per m/s of walking speed (was 0.06)
    perAccel: 0.05, // lean while speeding up (forward) or braking (backward): the difference between wanted and actual speed (was 0.1)
    max: 0.35, // never lean further than this from walking (about 20 degrees; was 0.7, 40 degrees: the body whipped back and forth in a fight)
    ease: 0.1, // seconds: the body eases into a new lean over about this long instead of snapping to it
    chargeBack: 0.35, // lean back while charging a club (anticipation)
    slamForward: 0.5, // throw the body forward during a lunge/slam
    punchForward: 0.35, // lean into the punch
    flinch: 0.15, // lean away from someone close who is winding up, swinging or punching at you (with the free arm up to brace; 0 = off)
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
    // The second arm: for show (it only touches the floor and walls). It used to just flop; now it moves with what the fighter is doing
    // (owner: more fluid, reacting to what is going on). Poses are [upper arm, elbow] in radians as if facing right: the upper arm from
    // straight forward (PI/2 = hanging down, smaller = forward and up), the elbow bend (negative = forearm folds up). Limp when knocked down or stunned.
    mass: 0.25, // each part (light, so it barely tugs the body)
    damping: 0.4, // joint friction when limp: lower = floppier
    stiffness: 60, // how firmly it holds a punch or grab pose
    poseDamping: 6,
    maxTorque: 40,
    trail: 0.35, // radians it lags behind the main arm in punches and grabs, so the two arms look like two arms
    // Its other poses (owner: it was stiff; it should flow with the body). The springs are soft and lightly damped, so the arm lags behind
    // the body and swings through; the elbow is looser still, so the forearm trails a beat behind. (Was 25 and 6 on both joints: four
    // times more damping than the arm's weight needs, so it moved as if through honey, glued to the body.)
    softness: 14, // shoulder: how firmly it pulls toward the pose (N m per radian)
    swingDamping: 1.1, // shoulder: how much it resists swinging (lower = swings further past the pose before settling)
    elbowSoftness: 5, // elbow: lower than the shoulder, so the forearm trails
    elbowDamping: 0.18,
    blend: 0.12, // seconds: it glides into a new pose over about this long instead of snapping to it
    guard: [1.25, -1.9], // empty-handed, standing: fist up by the chest
    rest: [1.35, -0.6], // holding a weapon, standing: the free hand a little forward, elbow soft
    run: 0.7, // running: it swings this far either way, against the legs...
    runPose: [Math.PI / 2, -1.3], // ...about hanging, with the elbow bent like a runner's
    air: [-0.4, -0.7], // in the air: up and out for balance
    charge: [0.35, -0.3], // winding up a club: reached forward as a counterweight
    lunge: [2.4, -0.3], // lunging and swinging: thrown back
    brace: [-0.7, -1.8], // someone close is winding up or swinging: forearm up across the face
    braceRange: 2.5, // m: how close an attacker must be to brace against them
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
    // Keep kd / 60 / (the torso's turning inertia, about 0.26 + fighter.torsoInertia) under about 1: above it the damping overshoots every frame
    // and the body rattles (at 0.5 inertia and kd 60 it was 1.31; with balance doubled on that body, 2.6, it shook itself to pieces).
    kp: 1600, // spring pulling the body upright (was 800 on a lighter-turning body)
    kd: 90, // damping on spin (was 60)
    maxTorque: 1500, // (was 900)
    stunFactor: 0.25, // balance strength while stunned
    stunDamping: 0.75, // ...but this much of the spin damping stays (more than stunFactor: a dazed body sways back up instead of rocking)
  },
  hook: {
    // The grappling hook (owner, 2026-10-07; sim/hook.ts). PLACEHOLDER numbers until it is played.
    range: 9, // metres it flies before it comes back, having caught nothing
    speed: 38, // m/s it flies at
    drop: 0.15, // share of gravity it falls with in flight (a little arc)
    reel: 7, // m/s the rope shortens while you hold the click
    minLength: 0.7, // the shortest the rope reels in to (m)
    yank: 9, // N s: a fighter it catches is pulled this hard toward you at once
    stun: 25, // ...and loses their footing for this many frames
    cutSpeed: 6, // m/s a blade must be moving to cut the rope
  },
  tractor: {
    // The Tractor Beam (sim/hook.ts, gun `beam`: its range, reel and fling are in props.ts). PLACEHOLDER numbers.
    speed: 300, drop: 0, minLength: 0.8, // the beam reaches out at once, straight
    yank: 0, stun: 20, // a fighter caught is held helpless this long at first (frames)
    cutSpeed: 1000, // (a beam cannot be cut)
  },
  effects: {
    // The Space Age ray guns (sim/effects.ts; each gun's own numbers are in props.ts). PLACEHOLDER numbers.
    iceFriction: 0.02, // a frozen fighter slides like an ice block (their usual grip is put back after)
    bubbleDrift: 1.5, // a bubble drifts with the wind at up to this speed (m/s, at full wind)
    bubbleEase: 0.15, // how quickly a bubble takes on its float (share of the difference each frame)
    popHurt: 0.5, // any hurt bigger than this pops a bubble
    holeCore: 0.6, // a black hole's pull fades out within this distance of its middle (m), so what it holds swirls instead of shaking
  },
  netting: {
    // The net (sim/tangle.ts, weapon `net`). PLACEHOLDER numbers.
    speed: 11, // m/s it is thrown at (on top of how you are moving)
    flyFrames: 50, // frames it can still tangle someone after it leaves the hand
    frames: 130, // how long someone stays tangled (about 2 s)
    walk: 0.3, // ...walking at this share of their speed
  },
  lasso: {
    // The lasso (sim/hook.ts, weapon `lasso`): like the hook, but it only takes people and loose things, and holds a fighter longer. PLACEHOLDER.
    range: 7, speed: 26, drop: 0.25, reel: 5, minLength: 0.9,
    yank: 7, // N s toward you when it lands on someone
    stun: 70, // frames a lassoed fighter cannot act (about a second)
    cutSpeed: 6,
  },
  dive: {
    // Holding S in the air (owner, 2026-10-07): the body turns flat, head first the way you face; let go and it turns upright again.
    angle: 1.5, // radians from upright it turns to (1.57 = exactly flat)
    gain: 9, // 1/s: turn rate per radian still to go
    max: 9, // rad/s cap on that turn (flat in about a fifth of a second)
  },
  rightUp: {
    // A body far from upright (after a knock, a landing, a tumble) turns smoothly back, instead of snapping. (W used to flip you; owner removed it.)
    gain: 7, // 1/s: turn rate per radian of tilt
    max: 6, // rad/s cap on that turn
    accel: 45, // rad/s^2
    from: 0.7, // radians of tilt (40 degrees) beyond which the smooth righting takes over from normal balance
  },
  slam: {
    // BODY SLAM (owner): holding someone (left-click held), jump (backwards, or any way) and hold S: a suplex. Nothing steers them: your
    // grabbing arm gets stronger and sweeps up over your head toward your back, and they go over through the grip. If their head or body
    // hits the ground hard while you still hold S (even after you land), it is a slam: damage as for a throw that hard (grab.slamFactor)
    // times the bonus, they are knocked down, and you let go.
    settleFrames: 6, // a slam can only start once you have held them this long (a brand-new grab is still settling)
    armMul: 4, // how much stronger your grabbing arm is during the heave (a normal grab: grab.armMul)
    sweepRate: 6, // rad/s: how fast the arm sweeps over the top (half a turn in about half a second). Measured over 30 slams: 5-6 land every one, usually about 20 damage, up to 45-60, never a kill from a normal jump; 9 was harder but missed more
    sweepTo: -4.5, // where the sweep ends (radians, as if facing right: -1.57 = straight up, -3.14 = straight back): behind you and a little down
    bonus: 1.3, // a slam does this much more damage than a throw landing just as hard (owner: a little extra)
    carryJumpSpeed: 8.5, // jumping while holding someone: you both leave the ground this fast (m/s), lower than a free jump (motion.jumpSpeed): a body in your hands weighs you down
    minSpeed: 4, // m/s: their head or body must hit the ground at least this fast
    scoreFrames: 4, // a body lands a limb at a time: the slam is scored over this many frames after it first touches down, and the hardest moment counts
    impactFactor: 3.5, // how hard it counts for knockdown, screen shake and paint (x the speed they hit at)
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
    strikeFrames: 7, // throw forward (was 10: quicker, owner 2026-10-07)
    recoverFrames: 8, // before you can punch again (was 12)
    guardUpper: 1.0, // resting guard: upper arm hanging down in front...
    guardElbow: -2.0, // ...forearm folded up, fist at the chest
    torqueMul: 2.5, // arm strength during a full-power throw
    strikeImpulse: 0.8, // extra shove on the fist each frame of a full-power throw
    lunge: 70, // push the whole body forward into a full-power punch (was 35: a quick punch now reaches about 1.2 m, chest to chest)
    // What a quick punch does to the one it lands on (owner, 2026-10-07: like Stick Fight, the punch is for knocking a rival away from a gun,
    // more than for hurting them). PLACEHOLDER numbers.
    knock: 3.5, // m/s: it knocks them back this fast (away from the puncher), however hard it landed: about 2.5-3 m back
    lift: 1.5, // m/s: ...and this much up, off their feet a little
    hurt: 0.5, // share of a fist's usual damage it does (the long lunge lands punches at 15-20 m/s: at full damage bare-handed gun rounds were over in 6 s)...
    fistsOnlyHurt: 1, // ...but all of it on a fists-only map (the Saloon, the Train: fists are the weapon there, and at half the walled Saloon lasted 47 s)
    disarmsGuns: true, // a quick punch knocks a gun out of the hand it lands on (owner, 2026-10-07; clubs only come loose on a hit to the hand: tuning.disarm)
    gunFling: 4, // m/s: ...and the gun flies off this fast, the way the punch went (and half that up)
  },
  grab: {
    // Unarmed left-click, HELD: your hand reaches out along the aim and grabs whatever part of a fighter it touches.
    // Keep holding to keep hold of them (up to maxFrames) and swing the mouse to whirl them; let go to fling them.
    maxFrames: 150, // a grab gives out after this long (2.5 s) and they drop out of your hands (no fling)
    holdFrames: 8, // hold the button this long (0.13 s) and it is a grab, not a punch
    armMul: 1.8, // how much stronger your arm is while reaching or holding someone (was 4: a body whirled like nothing; now the other fighter has real weight but can still be swung and thrown)
    toss: 5, // m/s: right-click while holding someone tosses them this much along your aim, on top of your swing (owner: a short toss)
    fling: 1, // the flung fighter's speed is multiplied by this when you let go (1 = only the swing itself)
    maxFling: 12, // m/s: nobody leaves your hands faster than this
    maxCatchSpeed: 10, // m/s: a hand cannot lock onto someone flying past faster than this (relative to the hand)
    breakImpact: 20, // a hit on the grabber at least this big makes them drop who they are holding: the one held can hit their way out, or anyone else can
    thrownFrames: 90, // for this long after being flung (1.5 s) a hard crash hurts
    slamFactor: 2.6, // damage factor for a flung or held fighter crashing into the floor, a wall or another fighter: impact = crash speed (m/s) x this (was 2.0: owner wants throws into walls and swings into the ground to count as body slams)
    slamCooldown: 12, // frames between two crash hits on the same thrown fighter
    throwDisarms: true, // a fighter flung out of your hands drops what they were holding (owner: grab and throw someone to take the gun off them)
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
    enabled: true, // weapons keep arriving during a round (owner: on for the first playtest night; false = off, to tune the fighting without extra weapons)
    // Weapons keep arriving during a round, faster and better as it goes on (so rounds finish by themselves). Each era's pickups are in eras.ts.
    firstGap: 300, // frames from one spawn to the next at the start of a round (5 s; was 8 s for minute-long rounds: rounds are about 20 s now)
    minGap: 150, // ...shrinking to this by rampFrames (2.5 s)
    rampFrames: 1800, // half a minute
    strongAfterFrames: 720, // the era's strong pickups can only appear after this (12 s)
    gunsFirst: 20, // a guns-only arena (eras.ts gunsOnly): the first gun drops this soon (0.3 s)...
    gunsGap: 90, // ...and another every this many frames (1.5 s): everyone races for them (at 1 s / 2.5 s a third of the bots' gun rounds were over in under 8 s, bare-handed)
    strongChance: 0.6, // once it can appear, this share of spawns are the strong one
    maxLoose: 6, // never more pickups lying around than this
    airdropChance: 0.5, // a spawn falls from the sky (otherwise it appears at one of the fixed spots)
    spots: [0.18, 0.5, 0.82], // fixed spots along the platform (0 = left end, 1 = right end)
    startRules: { start: 0.5, spots: 0.25, sky: 0.25 }, // how a round begins: everyone armed, clubs on the floor at fixed spots, or clubs falling from the sky
  },
  eras: {
    gunRounds: true, // some eras play a share of their rounds guns-only (eras.ts gunRounds; owner, 2026-10-07; false = never: the tests do this)
    mixStarts: true, // each round picks how weapons arrive from spawn.startRules: everyone armed, clubs on the floor, or clubs from the sky (owner: on for the playtest; false = always the arena's weaponRule: the tests do this)
    changeGameplay: true, // an era changes the arena layout and the weapon (false = every round uses the standard arena and club: the tests do this)
    specialChance: 0.08, // (about one special a match; was 0.15: owner, 2026-10-06) each slot of a match has this chance of being one of the special eras (fantasy archers, mobsters...) instead of its normal era
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
    lying: true, // the loose planks, logs and bones an era leaves lying on its map (owner: on for the playtest; false = off; bridges keep their planks)
    factor: 2.0, // damage factor of a held prop
    limbFactor: 1.6, // ...of a held limb (a leg, say)
    maxLift: 20, // kg: anything heavier (a standing stone) cannot be picked up; it can be pushed, knocked over and hidden behind
    crushMass: 25, // kg: a loose thing this heavy coming hard into someone crushes them...
    crushSpeed: 2.5, // ...when it is moving at least this fast into them (m/s): a capstone dropping off its stones onto a head is about 3.5
    crushFactor: 11, // damage factor of a crush (a club is 2.2): a capstone tipping onto a head is about a full club hit, a boulder dropped from a ledge kills
    crushCooldown: 20, // frames before the same thing can crush again
    throughGlass: 0.75, // thrown through a shop window, you keep this share of your speed
    shatterSpeed: 6, // a mug smashes when its speed changes this much in one frame (m/s): thrown into something, or broken over a head
  },
  rope: {
    // A rope (arena.ropes; Ship to Ship lashes two ships together): a sagging chain of short links. A weapon passes through it only if
    // it hits too softly: a club hit of tuning.bridge.cutImpact or more, or a bullet, cuts it there. Bodies pass through ropes.
    links: 6,
    thick: 0.05,
    linkMass: 0.25, // kg per link
    slack: 1.15, // the rope is this much longer than the straight line between its ends, so it sags (and two ships rocking apart do not pull it taut)
  },
  aqueduct: {
    // The Aqueduct Bridge (Gladiators): its deck is a bridge of stone blocks carrying water (arena.bridge kind 'aqueduct-block', water).
    // A club cannot chip a block out: only a body slammed or flung into the deck knocks out the block it hits (one block, not the planks
    // around it; how fast: props.ts slam). Where a block has gone, the water pours through the gap and pushes down whatever is in it.
    fallPush: 22, // how hard the falling water pushes down (m/s², on top of gravity)
    fallDepth: 5, // how far below the deck the falling water still pushes (m)
    gone: 0.3, // a block this far from its place has gone (m): the water pours through its slot
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
  guns: {
    // Bullets (sim/guns.ts; each gun's own numbers are in content/props.ts). PLACEHOLDER numbers until the playtest.
    maxFrames: 150, // a bullet flying this long (2.5 s) is gone
    minSpeed: 8, // slower than this (slowed by the sea) it is gone
    waterSlow: 0.8, // in the sea a bullet keeps this share of its speed each frame
    blockPush: 0.3, // a weapon that blocks a bullet is pushed this share of the bullet's shove
    woodToughness: 3, // a wooden thing with no toughness of its own snaps after this much shooting (calibres added up)
    sceneryDamage: 12, // a bullet's damage to breakable scenery, per calibre (barrel 60, crate 45: see props.ts)
    sceneryMinImpact: 30, // a club hit or a crash this hard (or harder) damages breakable scenery by its impact
    minPiece: 0.18, // a snapped weapon's shortest half (m)
    snapFling: 1.5, // how hard the loose half of a snapped weapon flies off
    breakSpread: 3, // how fast the pieces of broken scenery fly apart (m/s)
    steady: 0.15, // how quickly the hand steadies a gun on the aim (share of the error corrected each frame)
    bounceKeep: 0.5, // a falling shot (a lobbed grenade round) keeps this share of its speed when it bounces
    brace: { spring: 300, damping: 30 }, // the other hand steadying a gun on the aim: how hard it turns the barrel toward the aim (1/s²), and how much it calms its swing (1/s)
    hurt: 2.6, // a gun's shots and blasts hurt this many times the damage curve (combat.damageScale went from 0.3 to 0.115 for 20 s rounds: guns stay as deadly as they were; fists, clubs and slams take longer)
    kickMul: 1.8, recoilMul: 1.6, pushMul: 1.8, // (owner 2026-10-07: guns should be felt at both ends) every gun's shove on the shooter's body (props.ts kick), the snap of the gun and arm (recoil), and the shove on whatever its bullet hits (push), times this
    sprayMax: 8, // a held trigger or a burst wanders more each shot (props.ts spreadPerShot), up to this many shots' worth
  },
  water: {
    // The sea (maps with arena.sea; see sim/water.ts). Everything in it floats: fighters, weapons, barrels, lost limbs, the dead.
    // Waves come from the frame counter, so they are the same every time a round is played.
    waves: [{ amp: 0.09, length: 7, period: 3.4 }, { amp: 0.04, length: 2.6, period: 1.8 }], // amp = height (m), length = crest to crest (m), period = seconds per wave
    float: 2, // how strongly a fighter floats (1 = just stays level with the surface; more = bobs higher and comes back up faster after a dive)
    propFloat: 2.2, // ...a weapon, barrel or plank
    sinkFloat: 0.55, // ...a fighter whose swim has run out (below 1: they go under)
    bodyHalf: 0.16, // how far below its middle a body part starts to be in the water (m): a softer number makes floating smoother
    drag: 5, // how much the water slows things moving through it (per second): falling in from the deck you go about 0.9 m under
    spinDrag: 3, // ...and slows their spinning
  },
  swim: {
    // Short swim (owner): in the water you float and paddle (A/D) for a few seconds; Space kicks you up out of the water to climb back
    // aboard. Stay in too long and you sink: going under is a knock-off.
    frames: 300, // how long you can stay in the water (5 s; back on the deck it starts again)
    wetAt: 0.35, // you are swimming when this much of your body is under the surface
    kick: 0.95, // the kick out of the water, as a share of a normal jump (it has to lift you about 1.5 m: up the ship's side)
    kickFrames: 30, // the shortest time between two kicks
    drownDepth: 1.3, // sinking this far below the surface finishes you (m)
  },
  tar: {
    // Tar pits (owner): it slows you heavily and you can only kick weakly; stay in too long and you sink (a knock-off). Loose things sink
    // slowly. Like the sea (sim/water.ts) but thick, still and hungry. PLACEHOLDER numbers until the Tar Pit playtest.
    float: 1.4, // how strongly a fighter floats in it (the sea is 2): about chest deep
    propFloat: 0.85, // ...loose things: below 1, they sink, slowly
    sinkFloat: 0.3, // ...a fighter whose time has run out: going under
    bodyHalf: 0.16, drag: 12, spinDrag: 6, // (as tuning.water: tar is much thicker)
    frames: 180, // how long you can stay in it (3 s; back on the ground it starts again)
    wetAt: 0.1, // ...counting while this much of you is in it (any of you: bobbing at the edge half out still counts)
    swallow: 60, // once you start to sink, this long later the tar has you, even clinging to its edge (frames)
    walk: 0.35, // your paddling speed in it, as a share of walking
    kick: 0.6, // the kick out of it, as a share of a normal jump (weak: a pit's edge should be low)
    drownDepth: 1.1, // sinking this far below the surface finishes you (m)
  },
  special: {
    // Weapons that do more than hit (owner, batch one; sim/special.ts, world.ts hit and blast). PLACEHOLDER numbers until the playtest.
    spearFly: 6, // a loose spear faster than this (m/s) turns its point into the way it flies...
    spearTurn: 14, // ...this quickly
    spearStick: 7, // it sticks into the ground or a wall when it arrives at least this fast (m/s)...
    spearPointFirst: 0.5, // ...within this angle (radians) of point-first
    spearThrown: 1.8, // a thrown spear hits this many times harder than a swung one
    blastRadius: 3, // a grenade's reach (m)
    blastPush: 14, // how hard it throws things outward at its middle (m/s), less further out
    blastLift: 5, // ...and up (m/s)
    blastImpact: 40, // how hard it hurts right next to it (a full club hit is about 45), less further out
    blastScenery: 4, // breakable scenery takes the blast this many times harder (a barrel within about 1.8 m breaks)
    blastShake: 0.6, // how much it shakes the picture (as a share of tuning.shake.max)
  },
  light: {
    // Dynamic light (owner; render/light.ts): fires and lanterns light the scene and cast each fighter's shadow away from them, flickering
    // with the flame; a lantern put out darkens the room (only the background: light never hides anyone). PLACEHOLDER numbers.
    glow: 3.2, // how far a light's glow reaches (m)
    glowAlpha: 0.32, // how bright it is
    warm: 0xffb85c, // its colour
    shadowLen: 0.35, // a fighter's shadow offset next to a light (m): it falls away from the light, shorter further off
    reach: 7, // beyond this distance (m) a light no longer turns the shadow (the plain soft shadow below and to the right)
    flicker: 0.18, // how much a flame flickers (share of its brightness)
    dark: 0.45, // how dark the background gets with every lantern out (0 = no change)
  },
  wind: {
    // Wind (sim/wind.ts; each map's own wind is its arena.wind). Owner: it moves the cosmetics a lot and play a little. PLACEHOLDER numbers.
    full: 12, // m/s: a strong gust (the pushes below are at this wind)
    drift: 0.3, // a fighter in the air drifts with the wind this fast (m/s; about 5% of walking speed): letting go you are carried, into it you are slower
    loose: 3, // ...a thrown or loose thing
    bullet: 6, // ...a bullet (it drifts a few centimetres over the picture)
  },
  tower: {
    // The Water Tower (sim/tower.ts): a bullet through the tank's side springs a leak; the jet shoves whatever it catches. PLACEHOLDER numbers.
    rim: 0.25, // a hole must be at least this far below the tank's top (m)
    jetFrames: 240, // how long a jet runs (4 s)
    fadeFrames: 60, // it weakens over its last second
    jetSpeed: 7, // how fast the water leaves the hole (m/s): the arc
    reach: 4, // how far out it shoves (m)
    width: 0.35, // how thick the jet is (m)
    push: 110, // how hard it shoves near the hole (m/s per second; 22 is gravity; standing firm you brake at 26): a blast
    maxJets: 6,
    stagger: 12, // caught in it, you are off balance this many frames (no braking): it carries you
  },
  chariot: {
    // The runaway chariot (Gladiators: Chariot Track, arena.chariot): two horses and the car as one body charging across at floor level.
    // Whoever it catches is flung ahead of it and hurt like a hit of `impact`; dust rises on its side `tell` seconds before it comes.
    len: 3.6, // m, the horses and the car
    height: 1.5, // m: a full jump clears it
    fling: { x: 16, y: 7 }, // m/s: whoever it catches flies ahead of it and up
    impact: 40, // how hard it hits (as a club's impact)
    tell: 1.2, // s of dust before it comes in
  },
  trapdoor: {
    // Trapdoors (Gladiators: Colosseum Floor, arena.trapdoors): each one rattles for `tell` seconds, drops open (a quarter turn, in
    // `swing`), hangs open until `open` seconds after it began, swings shut over `close`, and comes round again every `cycle`.
    cycle: 9, // s
    tell: 1, // s of rattling before it opens
    swing: 0.25, // s to drop open
    open: 2.5, // s from starting to open until it starts to shut
    close: 0.6, // s to swing shut
    rattle: 0.05, // how hard it rattles (radians)
    rattleRate: 45, // ...and how fast (radians of the shake per second)
    thick: 0.25, // m
  },
  train: {
    // The Train (sim/train.ts; the map's own timetable is its arena.train). PLACEHOLDER numbers until the playtest.
    signW: 1.2, signH: 0.45, signUp: 0.75, // a wooden sign: its size and how high its bottom is above the roof (m): jump it, or get down
    tunnelW: 5, tunnelUp: 0.75, // a tunnel mouth: how long it is and how high its roof is above the train's (m): lie flat
    whistle: 1.2, // the whistle blows this long before one comes into the picture (s)
  },
  chase: {
    // The Mammoth Chase (sim/chase.ts; the map's own numbers are in its arena.chase). PLACEHOLDER numbers until the playtest.
    length: 3.2, height: 2.6, // the mammoth's size (m): touching it gets you tossed
    gallop: 1.4, bob: 0.12, rock: 0.05, surge: 0.35, // its gallop: strides a second, how high it bobs (m), how much it rocks (radians), how far it lunges forward and back (m)
    toss: { x: 9, y: 11 }, // how hard it tosses you up and back (m/s): out of the picture
    tossSpin: 8,
  },
  fire: {
    // Fire (owner): standing in flames hurts over time and sets you burning; burning goes on hurting for a few seconds after you are out
    // (the sea puts it out). Wooden weapons and loose wood catch fire, and set alight whoever they touch. PLACEHOLDER numbers.
    height: 0.9, // how high the flames reach (m)
    flameDps: 25, // hidden health per second while standing in the flames (out of 100)
    burnFrames: 180, // how long you keep burning (3 s)
    burnDps: 6, // hidden health per second while burning
    woodFrames: 360, // how long wood keeps burning (6 s)
  },
  boat: {
    // A floating ship (maps with arena.boat): the main platform is its deck. It tilts when people stand toward one end, bobs on the waves,
    // always rolls back upright (it can not capsize) and drifts back to the middle.
    mass: 160, // kg (a fighter is about 13): heavier = it sits steadier
    depth: 1.6, // the hull from the deck down to the keel (m)
    tilt: 0.09, // how far one fighter standing at the very end tips the deck (radians, 0.09 = 5 degrees): more = a livelier deck
    roll: 0.35, // how much the deck follows the slope of the waves under it (0 = stays flat, 1 = rides every wave)
    heaveDamping: 1.6, // how quickly bobbing up and down settles (per second)
    rollDamping: 1.2, // how quickly rocking settles (per second)
    home: 0.4, // how strongly it drifts back to the middle (per second squared, per metre away)
    drift: 0.8, // how quickly sideways drifting settles (per second)
    apart: 1.25, // two ships with every rope between them cut drift this far apart, each (m): Ship to Ship's 1.5 m gap opens to 4
    apartSpeed: 0.4, // ...at this speed (m/s)
  },
  knock: {
    // A BIG hit knocks the fighter down: they go limp, spin head over heels in proportion to the blow, cannot act, bounce off walls and the
    // floor, and then get up on their own as soon as they are calm and on the ground.
    minImpact: 35, // hits below this just stagger
    frames: 20, // the shortest knockdown (0.33 s)...
    perImpact: 0.6, // ...plus this many frames for every point of impact above the minimum
    maxFrames: 70, // never longer than this (1.2 s)
    lift: 0.07, // m/s of upward launch per point of impact (the air time to tumble in)
    spin: 0.2, // rad/s of tumble per point of impact (owner: less flopping; was 0.34: a medium hit cartwheeled the body 1.75 turns, a big one 3. Now about 0.9 and 1.8)
    spinJitter: 0.3, // a little variety in the tumble
    balance: 0.04, // how much of the upright spring is left while knocked down
    legSoft: 0.6, // how limp the legs go (was 0.9: they flailed at 11 rad/s; now about a third of that)
    armLimp: 0.3, // how much arm strength is left (was 0.05: fully limp; a little tension keeps the arm with the body in the tumble)
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
    damageScale: 0.115, // how much every hit hurts (was 0.3: owner wants 20 s rounds, 2026-10-07; guns are scaled back up by tuning.guns.hurt so they stay as deadly)
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
  bot: {
    mammothMargin: 2.5, // a bot runs away from the mammoth when it is this close (m)
    duckAhead: 0.6, // a bot gets down this many seconds before a sign or tunnel reaches it
    gunKeep: 3, // with a loaded gun: stay at least this far from the target (m)...
    gunMax: 11, // ...and come closer if further than this
    gunAimTol: 0.08, // fire when the aim is this close to the target (radians)
    // Computer players (owner: they play like a regular person; src/sim/bot.ts). They only press the buttons a player has. These make them
    // more or less human:
    reactFrames: [10, 16], // a new decision every this many frames (about a fifth of a second: a person's reaction time)
    turnRate: 14, // rad/s: how fast its "mouse hand" can swing the aim round
    aimWobble: 0.25, // radians: how far off its aim can be (a fresh error with every decision)
    edgeMargin: 1.0, // m: it does not walk closer than this to an open edge
    climbHeight: 1.0, // m: someone this much higher is up on a ledge: it jumps after them
    jumpHold: 18, // frames it holds jump (the full height)
    swingReach: 0.6, // m beyond its weapon's length at which it starts a swing
    charge: [8, 30], // frames it charges a swing (from a quick jab to a full charge)
    throwChance: 0.06, // a charged swing is let fly instead
    closeRange: 0.95, // m: empty-handed, this close it punches or grabs
    grabChance: 0.4, // ...grabs instead of punching
    slamChance: 0.35, // a grab ends in a slam (jump back and hold S)...
    tossChance: 0.25, // ...or a right-click toss (otherwise it swings them up and flings them)
    dodgeChance: 0.3, // someone close winding up a big swing: it dodges this often
    fetchRange: 7, // m: empty-handed, it goes for a loose weapon this close (if it is nearer than the fight)
    gunFetchRange: 25, // m: ...but a loaded gun it races for from this far, fight or no fight (the race for the guns, owner 2026-10-07)
    hesitate: 0.08, // share of decisions that are a moment of doing nothing
    hopChance: 0.04, // share of decisions with a hop for no reason
    stuckFrames: 30, // lying down, or pushing to walk and getting nowhere, this long: it jumps out of it
    gapHop: 0.7, // m: walking toward a gap in the floor with more floor past it, it hops this close to the edge...
    gapReach: 2.5, // ...if the far side is within this (m)
    reachUp: 2.2, // m: it only goes for weapons at most this far above it (one jump up)
    backoffFrames: [8, 20], // after an attack it steps back for this many frames...
    backoffRange: 1.8, // ...to about this far from who it is fighting (m)
    personalSpace: 0.8, // m: someone else this close in its way becomes who it fights (it does not walk into them)
  },
  net: {
    // Online (owner: cut the lag cheaply before trying prediction). From pressing a key to seeing your fighter move online takes your ping,
    // plus a wait for the next snapshot, plus the blend buffer. A snapshot is about 1.3 KB: 60 a second is about 0.6 Mbit/s per player.
    snapEvery: 1, // the server sends a snapshot every this many 60 Hz ticks (1 = 60 a second; was 3 = 20 a second)
    blendTicks: 3, // your screen shows the world at least this many ticks behind the newest snapshot, to blend smoothly (3 = 50 ms; was 6 = 100 ms)
    blendMax: 18, // on a shaky line (snapshots arriving late in bunches) the buffer widens by itself to cover the stalls, up to this many ticks (300 ms)...
    jitter: { percentile: 0.95, window: 300 }, // ...to cover how late the last `window` snapshots (5 s) came, at this percentile: 1 = every hiccup (you see the others later); 0.95 = all but the worst twentieth, the rare stall carried over (extrapolateTicks). npm run netlab 2026-10-07: home wifi 125 -> 97 ms behind and no stalls. ?smooth tries 1
    blendRelax: 3, // ...and narrows again by one tick every this many seconds that it arrives steadily (back down to blendTicks). Slower than most wifi hiccups repeat, so it holds its width between them
    extrapolateTicks: 6, // when snapshots stop coming the motion carries on for up to this many ticks (100 ms: a lost message over a WebSocket holds the rest up for about that long) before the picture waits (0 = wait at once)
    eventRepeat: 30, // every snapshot repeats the deaths, pickups and new rounds of this many ticks before it (half a second): one lost on the fast lane loses none
    inputQueue: 3, // the server keeps at most this many of a player's inputs waiting (one is used per tick, so a quick tap is never lost); more than that and the oldest are folded together
    // Prediction (online, the Settings switch "Online controls: Instant"): your own fighter moves at once and is nudged toward the server.
    predict: { blend: 0.25, blendPerMetre: 0.6, blendMax: 0.6, snap: 1.5, deadzone: 0.01, history: 180, drive: 12, smooth: 0.8, replayMax: 30 }, // blend: share of the difference closed each snapshot (plus blendPerMetre for every metre off, at most blendMax); snap: metres off before it jumps straight there; deadzone: closer than this is left alone; history: inputs remembered; drive: how firmly the others are held to where the server shows them, for bumping into (per second); smooth: after a fresh start your fighter slides from where it was drawn to the guess, keeping this share of the gap each tick (0 = jump); replayMax: at most this many of your buttons are replayed at a fresh start (half a second)
  },
  match: {
    // A fight: last fighter standing wins the round and scores a point. Dead fighters stay down until the round is over.
    resultFrames: 150, // how long the result is shown before the next round starts (2.5 s)
    rounds: 12, // a match: one round per era (owner). A tie at the top after the last one plays extra rounds until someone leads
    crownFrames: 480, // how long the crown screen shows the winner before everyone goes back to the Hall (8 s)
    suddenDeath: { after: 2700, rate: 2 }, // a round still going after `after` frames (45 s) drains everyone left: `rate` x the seconds since, a second (2: all 100 hidden health gone in 10 s)
  },
  respawn: {
    frames: 120,
  },
  transition: {
    // Between eras (owner): half a second after the last elimination the picture freezes; the camera pulls back until it is a painting
    // on the museum wall; the round's best moment replays in it; the camera slides along the wall to the next painting (the next arena,
    // everyone at their starting spots) and goes into it. Seconds, and the painting's size on the wall (share of the screen).
    freezeFrames: 30, zoomOut: 1.2, slide: 1.3, zoomIn: 1.0, size: 0.55, gap: 0.35,
  },
  replay: {
    // The end of every era (each round) replays its best moment (owner): a quick replay of about 5 s, slowed down a little, with what
    // happened written over it. Online, the server sends it to everyone and waits for it before the next round.
    enabled: true,
    before: 150, // frames shown before the moment (2.5 s)
    after: 30, // ...and after it (0.5 s: the picture freezes then)
    speed: 0.7, // how fast it plays (0.7: 3.5 s of fight take 5 s)
    keepSeconds: 90, // how much of a round is kept for it (a best moment earlier than this before the round ends is not shown)
  },
  camera: {
    // A very subtle moving camera (owner): when only two fighters are left in a fight it eases in a little on them. It never shows past
    // the edge of the picture, and eases back out when the round is over. Practice (you and the dummy) never zooms.
    twoLeftZoom: 1.1, // how much closer it gets (1 = no zoom; 1.1 = 10% closer)
    margin: 3, // metres kept around the two of them (far apart, it zooms in less)
    ease: 1.2, // how quickly it moves in and out (higher = quicker)
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
    // Hurt (owner): a subtle spray in the hurt player's own colour, flung the way the blow went, soaking into the canvas.
    spray: { drops: [2, 6], reach: [0.25, 1.1], size: [7, 18], alpha: 0.55, minImpact: 12 }, // drops per hit (small hit .. big hit), how far they fly (m), their size (px), how strong; hits softer than minImpact leave no paint (2026-10-06: taps on the training dummy were burying the picture in paint)
    lightShade: 0.35, // paint of a very light colour (Bone, the dummy) is shaded this much toward umber, so it reads as paint and not as dust or snow
    // Knocked off (owner): streaks of their paint fly onto the canvas from where they went out toward the middle of the picture.
    streaks: { count: [3, 5], length: [1.4, 3], width: [26, 42], spread: 0.35, seconds: 0.35, alpha: 0.85, color: 'player' as 'player' | number, burst: 60 }, // length in m, width in px, spread = radians either side; color 'player' or a colour like 0xb3232b (red); burst = the splat where they went out (px). (2026-10-06: fewer, shorter, fatter streaks plus a burst: the old long thin ones read as scratches, not paint)
  },
  music: {
    // Dynamic music (owner; the stems are in content/audio.ts). Every sway is subtle.
    volume: 0.5, // the music's level under the sound effects
    eraFade: 2, // seconds an era's instruments take to fade in or out
    sway: { gain: 0.12, drive: 1, brightLow: 2200, brightHigh: 7000 }, // what excitement does: up to 12% louder, the drive layer from silent to full, and brighter (Hz)
    // Excitement (0..1): bursts for big moments that fade over burstFade s, on top of how much the fighters move (full at motionFull m/s,
    // worth up to 'motion'); it swells in about 'rise' s and calms over about 'fall' s.
    excite: { hit: 0.18, knockout: 0.45, big: 0.3, burstFade: 3, motion: 0.55, motionFull: 4, rise: 0.6, fall: 4 },
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
    dusk: { seconds: 10, wash: 0.45, vignette: 0.6, color: 0x1a0d08, throb: 0.15, rate: 1.2 }, // sudden death (match.suddenDeath): over `seconds` the picture darkens (wash: how dark, in colour) and its edges close in (vignette), throbbing (share, beats a second)
    // Painted backdrops (art-guide/ART_STYLE.md): each round's backdrop and ground are painted with oil strokes in a background worker.
    // width = painting resolution; under = smooth underpaint showing through the strokes (higher = smoother); relief = paint thickness;
    // bristle = how streaky a stroke is; jitter = colour wobble between strokes. Each era can scale these (content/paintings.ts, brush).
    paint: { width: 1280, under: 0.5, relief: 0.55, bristle: 0.25, jitter: 0.45 },
    // A live oil filter over the fighters, props and paint (off: they are painted textures now; set enabled: true to compare).
    oil: { enabled: false, radius: 3.5, relief: 0.13, stroke: 46 }, // radius = how far colour is blended (px at 1080p), relief = paint thickness lighting, stroke = brush length
    shadow: { alpha: 0.22, blur: 6, x: 0.05, y: 0.06 }, // the faint soft shadow that lifts each fighter off the map: strength, softness (px at 1080p), offset (m)
    front: { blur: 3.5 }, // how out of focus the front plane is (px at 1080p)
    water: { alpha: 0.8, crestWidth: 0.06, crestAlpha: 0.55 },
    // Hits (owner's visuals handoff, effects): a heavy hit (impact at or above freezeImpact, a hit to the head counting 1.5x) holds the
    // picture for freezeFrames frames (0 = never). A lost limb drips paint from its cut end (render/limbs.ts): for dripSeconds, about
    // dripsPerSecond drops of radius drop (m) lasting dropSeconds; once it has lain still for poolAfter seconds it lies in a pool of its
    // owner's paint, pool px across at 1080p, poolDrop m below its middle.
    hits: { freezeImpact: 40, freezeFrames: 3, dripSeconds: 3, dripsPerSecond: 7, drop: 0.025, dropSeconds: 0.45, poolAfter: 0.4, pool: 26, poolDrop: 0.06 },
    // Water and era extras (render/extras.ts): a splash throws crownDrops drops up at crownRise m/s (the full crown from crownSpeed m/s of
    // fall); ripples widen by `ripple` m over rippleSeconds; a wet fighter drips for dripSeconds at dripsPerSecond; a tar pit bubbles about
    // every bubbleEvery s, each swelling to `bubble` m over bubbleSeconds; a Space Age hit's spark (m, s); the Gravity Hammer's rings close
    // from `pull` m over pullSeconds.
    extras: { crownDrops: 10, crownRise: 4, crownSpeed: 8, ripple: 0.9, rippleSeconds: 0.9, dripSeconds: 2.5, dripsPerSecond: 6, bubbleEvery: 1.6, bubble: 0.13, bubbleSeconds: 1.4, spark: 0.35, sparkSeconds: 0.2, pull: 0.9, pullSeconds: 0.45 },
    jet: { width: 0.26, color: 0xcfe4ee, alpha: 0.85 },
    wind: { cape: 9, smoke: 0.12, flame: 0.03, trail: 0.05, spray: 0.04, grass: 0.025, jet: 0.03 }, // how much the wind (per m/s) moves: capes (m/s² of flap), smoke (drift share), flames (lean, radians), bullet trails, paint spray, grass (lean), water jets // a water tower leak: how thick, its colour, how see-through
    glassAlpha: 0.4, // how much a shop window hides what is behind it
    rollBlur: 2.5, // a moving map's painting is blurred along the way it moves: px (at 1080p) per m/s of speed
    tar: { alpha: 0.97, top: '#2b2017', deep: '#0b0806', sheen: '#7a6a58' }, // a tar pit: nearly opaque (whoever sinks is gone), dark, a dull sheen on top
    // Bullets (owner: moving white streaks with see-through trails that reach back past the shooter). m, 0..1, seconds.
    // The gold frame around the picture (render/frame.ts): its width (share of the picture's height), and the size of a hole (someone
    // knocked out through it) and of a bullet's crack, in frame widths.
    frame: { width: 0.018, hole: 3.2, crack: 0.9 },
    motion: { // swing trails, hit dabs and dust (render/motion.ts; looks only)
      trailSpeed: 9, // a weapon's tip moving faster than this (m/s) leaves a brushstroke behind it...
      trailFrames: 7, // ...this many frames long
      trailWidth: 0.07, trailAlpha: 0.55, // its width at the tip (m, tapering to nothing behind) and how solid it is; cream, or the era's hot colour after a charged swing
      dab: 0.16, bigDab: 0.36, bigImpact: 40, dabSeconds: 0.22, // a cream dab where a hit lands (m across); a hit this big or more gets the big burst with a red core
      landMin: 6, landFull: 14, dust: 0.55, // a landing faster than landMin (m/s) kicks up dust from the floor, the most at landFull; how solid the dust is
    },
    bullets: { shotShake: 0.4, hitShake: 0.35, streak: 0.7, streakWidth: 0.05, trailWidth: 0.05, trailAlpha: 0.35, tailBack: 1.5, trailFadeSeconds: 0.35, flashSeconds: 0.08, twirlSeconds: 0.35 }, // the near water: how much it hides what is under the surface (1 = all of it), and the light line along the top of the waves (m, 0..1)
    boilFps: 9, // how often the painted fighters' brush strokes change (the package: 3 painted variants at 8-10 fps)
    // The hot-colour cape (looks only): where it hangs from (metres from the torso's centre), and how the cloth moves.
    cape: { backX: 0.1, shoulderY: -0.24, gravity: 9, trail: 3, flutter: 2.5, flutterRate: 6, damping: 0.94 },
    // The swaying parts of hats (looks only; each hat's own settings are in content/hats.ts): how heavy they hang (m/s²), how much speed
    // they keep each step, the push away from the facing and the idle wobble (m/s²) unless a hat sets its own, how fast it wobbles,
    // constraint passes, and the longest step (s).
    dangle: { gravity: 9, damping: 0.9, trail: 1.5, flutter: 1, flutterRate: 6, iterations: 4, maxDt: 1 / 30 },
    // Googly eyes' loose pupils (looks only): how hard they are pulled back to the middle (1/s²), how fast they settle (1/s), and how much
    // speed they keep bouncing off the rim of the eye.
    googly: { spring: 500, damping: 6, bounce: 0.4 },
    // The afro's squish (looks only): a hard landing or hit squashes the curls wide and short, then they wobble back. spring (1/s²), damping
    // (1/s), kick = how much a sudden stop of the head squashes it, max = the most it squashes or stretches (0.15 = 15%).
    afro: { spring: 260, damping: 9, kick: 0.03, max: 0.15 },
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
    gun: 0x4c505a, // a gun's metal (its handle is the stick colour)
    things: { barrel: 0x6e4626, crate: 0xa07a4a, stave: 0x7a5232, upright: 0x7d7a70, capstone: 0x8a867a, boulder: 0x6f6b62, sign: 0x9a6a3c, post: 0x4a3222, tunnel: 0x4c4440, car: 0x7a3a24, wheel: 0x241a14, pane: 0xcfe6ee, stool: 0x6a4426, mug: 0xd9a441, lantern: 0xe8b04a, 'round-shield': 0x8a5a32, 'riot-shield': 0x9fb4c0, grenade: 0x4f5a3a, rope: 0xb09a6a, gangplank: 0x7a5232, chest: 0x6e3f1c, 'aqueduct-block': 0xc9bda4, trapdoor: 0x6a4a2a, chariot: 0x8a5a2c, horse: 0x5a3a24, table: 0x6a4426, bench: 0x7a5232, chandelier: 0x3a3430, 'ice-block': 0xc4dde8 } as Record<string, number>, // breakable scenery and its pieces
    players: [0xd8402a, 0x2d5db0, 0xe8b931, 0x2f9e6b], // player 1 to 4: vermilion, ultramarine, cadmium yellow, viridian (the art guide's pigments)
    dummy: 0xe9ddc1, // the training dummy
  },
};

export type Tuning = typeof tuning;

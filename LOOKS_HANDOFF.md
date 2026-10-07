# Handoff: Looks v1 (12 hats + Bare, 8 eyes, 8 colours, swaying physics)

> **Revised 2026-10-06:** the owner wants to keep the four hats already in the game (Cap, Top hat, Stetson, Beanie) alongside the new ones.
> That makes 12 hats plus Bare. Nothing is removed. The Beanie's pom-pom now bounces.
>
> **Revised again 2026-10-06 (evening):** 6 hairstyles added to the same hat slot (see §2b) and 2 more eye sets, Bloodshot and Wall-eyed
> (see §4). Totals: 18 headwear options plus Bare, 10 eyes, 8 colours.

From the owner's design window, 2026-10-05. The visual catalogue is the "Looks — Hats, Eyes, Colours v1" artboard on the owner's
"Museum Menu Screens" design canvas; ask the owner for a screenshot if you need to see it. This file is the spec.

**Owner request:** replace the current hat, eye and colour lists with the lists below. Some hats and one eye style get
physics that sways (feathers, floppy points, a veil, hair, loose pupils).

Before you start: read CLAUDE.md as usual. State your plan in a few lines. Work in the slices at the bottom and commit after
each one that runs. This touches five or more files, so give the owner the SWITCH UP line from CLAUDE.md before starting.

---

## 1. Ground rules

- **The sway is looks only, exactly like the cape** (`stepCape` in `src/render/render.ts`). Nothing new goes into `src/sim/`, and
  `PlayerInput`, snapshots and determinism tests stay the same. Online, each client sways its own copy.
- **Keep the art rules** (`art-guide/ART_STYLE.md`).
  - Hats are painted like the cape: shapes drawn to a canvas, then run through the painter's `paintFlat`, with 3 boil variants and cached.
  - The `drawHat` vector shapes are placeholders, so replace them.
  - **Eyes stay crisp vector** (the art rule keeps eyes out of the paint).
  - No outlines.
- **Content is data.** Hat and eye lists live in `src/content/looks.ts`. Per-hat sway settings go in a new data file,
  `src/content/hats.ts`. Shared sway defaults go in `src/content/tuning.ts` under `finish.dangle`.
- **Units.** Below, every position and length is given in **head radii (r)** from the centre of the head: x is to the face side,
  y points down (so −1 is the top of the head). The catalogue is drawn facing right; mirror everything with the facing, the way the
  eyes already are.

## 2. Hats (ids, names, what they look like)

Keep `none` = **Bare** as the first option (not counted in the 12). **Keep every existing id** (`cap`, `tophat`, `helmet`, `crown`,
`horns`, `cowboy`, `beanie`) so existing saves and rooms stay valid. All 12 hats are repainted with the painter; the old
`drawHat` vector shapes go.

Suggested order in the picker: `helmet, crown, horns, cap, tophat, cowboy, beanie, plumed, jester, wizard, hennin, locks`.

| id | Name | Look | Sway? |
|---|---|---|---|
| `helmet` | Great Helm | Steel bucket helm covering the whole head (r −1.27 … +0.67 tall, ±1.07 wide), dark visor slot across the eyes, thin vertical nose bar, 4 breath holes low. Eyes show in the visor slot. | Static |
| `plumed` | Plumed Helm | Steel kettle dome over the top half of the head with a brim (±1.33 wide at y −0.27). A long cream feather (#F1E6CF, quill #BFB49A) rises from the back of the dome. | **Yes**: stiff feather |
| `crown` | Crown | Gold crown, 5 points (y −1.85 … −0.73), dark gold band, red centre gem, two blue side gems. | Static |
| `horns` | Horned Helm | Steel cap plus band, two bone-coloured (#EDE3CC) horns curving up and out from the sides. | Static |
| `jester` | Jester Cap | Gold band round the head at y −0.6; three cloth points: left and right in vermilion, centre in cadmium; a small brass bell at each tip. | **Yes**: 3 floppy chains |
| `wizard` | Wizard Hat | Indigo cone (#4A4288) with a wide brim (±1.4 at y −0.73), little cream stars. The top third bends over. | **Yes**: bendy tip |
| `hennin` | Hennin & Veil | Tall plum (#7A3A5E) cone leaning back to about 2.8 r above the head, gold band at its base, a sheer cream veil (#F4EEE2 at 75% opacity) streaming from the tip. | **Yes**: cloth, like the cape |
| `cap` | Cap | (already in game) Peaked cap in a darker shade of the player's colour, brim pointing to the face side, small button on top. | Static |
| `tophat` | Top Hat | (already in game) Black stovepipe (≈1.5 r tall) on a black brim, band in the player's colour, a faint highlight down one side. | Static |
| `cowboy` | Stetson | (already in game) Leather-brown crown with a pinched dent, dark band, a wide curled brim (±1.67 wide) that sits low over the brow. | Static |
| `beanie` | Beanie | (already in game) Ribbed knit dome in the player's colour, darker ribbed cuff, cream pom-pom on top. | **Yes**: bouncy pom-pom |
| `locks` | Flowing Locks | Brown hair (#7A4E28 / #8C5A2E): a fringe over the forehead (static) and a mane down to the shoulders behind the head. | **Yes**: hair strands |

## 2b. Hairstyles (same `Hat` list and same picker row, after the hats)

Hair uses fixed natural colours (it doesn't follow the player's colour), painted with the painter like the hats. In the picker they
come after the hats; you can show the row label as "Hat / Hair". Order: `ponytail, braid, pigtails, mohawk, topknot, afro`.

| id | Name | Look | Sway? |
|---|---|---|---|
| `ponytail` | Ponytail | Auburn (#8A3A1E, tail #6E2E16) cap of hair, tied high at the back with a small Ultramarine band; tail hangs from the tie. | **Yes**: whips when you turn |
| `braid` | Long Braid | Blonde (#D8B35A / #C79A44) hair, one thick plait from the back of the head down past the shoulders (chunky alternating segments), red tie and a little tuft at the end. | **Yes**: heavy rope |
| `pigtails` | Pigtails | Ginger (#D8732E / #C4602A), centre parting, two short bunches at the sides with gold ties. | **Yes**: 2 bouncy bunches |
| `mohawk` | Mohawk | Dyed-red (#B5321F) crest of 7 stiff spikes along the top centre of the head, the rest bare. | **Yes**: stiff spikes |
| `topknot` | Topknot | Black (#1E1712) samurai-style: hair at the sides and back, a small folded knot on top with a gold tie. | Static |
| `afro` | Afro | Big round cloud of dark curls (#4A2E1A) behind and above the head (≈1.25 r radius, centred 0.75 r above the head centre), with a hairline over the brow. | **Squish**: wobbles on landing |

Sway settings (first guesses, same `DangleSpec` as §3; anchors in head radii, the back of the head is −x):

| Hair | Dangle | anchor | links | length | rest | stiffness | width | notes |
|---|---|---|---|---|---|---|---|---|
| ponytail | tail | (−0.93, −0.5) | 4 | 1.9 | 0.5 | 0.2 | 0.45 → 0.12 | |
| braid | plait | (−0.9, 0.05) | 5 | 2.0 | 0.15 | 0.1 | 0.42 → 0.3 | heavier: gravity ×1.4; use a braided strip texture (alternating lumps); `tip: 'tie'` (red tie plus tuft) |
| pigtails | left / right | (−0.97, −0.33), (0.97, −0.33) | 3 | 1.0 | ±0.7 (outward) | 0.3 | 0.45 → 0.15 | ties drawn at the anchors |
| mohawk | 7 spikes | evenly along x −0.7 … 0.7 on the top of the head | 2 | 0.5–1.1 (tallest in the middle) | pointing straight out from the head | 0.85 | 0.2 → 0.02 | they mostly jiggle |

Afro squish: no chain. Give the curl cloud a scale spring (`finish.afro.spring`, `damping`). When the head's vertical speed changes
suddenly (a landing or a hit), kick the spring so the cloud squashes wide and short, then wobbles back. Clamp it to about ±15%.
Add it to `dangle.ts` with a test (it settles back to scale 1).

Any unknown hat id (a client on an older build, URL test links) is treated as `none`. `FIRST_HATS` in `src/ui/hall.ts` can stay as it is.

## 3. Sway: one small module for all of it

Create `src/render/dangle.ts`. It is **pure math with no Pixi**, so it can be unit-tested; the renderer only reads its points. It is
the cape's verlet chain made general. Each "dangle" is a chain of points hanging from an anchor on the head:

```ts
interface DangleSpec {
  anchor: [number, number];  // in head radii, from the head centre (y down), face side = +x
  links: number;             // points in the chain, including the anchor
  length: number;            // total length, in head radii
  rest: number;              // the direction it wants to point when nothing moves (radians, relative to the head; 0 = straight down, -PI = straight up; positive leans away from the face)
  stiffness: number;         // 0 = hangs like cloth, 1 = rigid. Each step, each link turns this much toward `rest` (relative to the previous link)
  damping: number;           // 0..1, how much speed each point keeps (the cape uses about 0.9)
  gravity: number;           // multiplier on finish.dangle.gravity
  trail: number;             // pushes it away from the facing direction, like the cape's trail
  flutter: number;           // small idle wobble, like the cape's flutter
  width: [number, number];   // strip width at the root and at the tip, in head radii (for the rope mesh)
  tip?: 'bell';              // something drawn at the last point
}
```

Step it the way `stepCape` does: keep momentum, add gravity, trail and flutter, pull each link toward its rest angle by `stiffness`,
then fix the link lengths. The anchor follows the head (position **and** rotation), so a spinning or knocked head whips the dangle
around. That whip is the fun part. Draw each one with a `MeshRope`, using a painted strip texture (painted with `paintFlat`, strokes
running along the strip, 3 variants, swapped with the boil like the cape).

Per-hat settings (first guesses; the owner will tune them):

| Hat | Dangle | anchor | links | length | rest | stiffness | width | notes |
|---|---|---|---|---|---|---|---|---|
| plumed | feather | (0.27, −1.13) | 4 | 1.9 | −2.6 (up and back) | 0.55 | 0.35 → 0.12 | springs back upright after a hit |
| jester | left point | (−0.73, −0.6) | 4 | 1.2 | −2.2 | 0.2 | 0.35 → 0.05 | `tip: 'bell'` |
| jester | centre point | (0, −0.87) | 4 | 1.6 | −3.0 | 0.25 | 0.35 → 0.05 | `tip: 'bell'` |
| jester | right point | (0.73, −0.6) | 4 | 1.2 | 2.2 | 0.2 | 0.35 → 0.05 | `tip: 'bell'` |
| wizard | cone tip | (0, −1.87) | 3 | 1.1 | −3.1 | 0.45 | 0.4 → 0.04 | the base cone is static; the tip droops and swings |
| hennin | veil | (1.07, −2.8) | 6 | 4.2 | 0.3 | 0.05 | 0.3 → 0.7 | cloth; reuse the cape's trail and flutter feel; 75% opacity |
| beanie | pom-pom | (0, −1.3) | 2 | 0.25 | −3.14 (straight up) | 0.6 | 0.6 → 0.6 | not a strip: draw one painted ball (r 0.33) at the end point. It bobs on a short stiff spring, like the googly pupils |
| locks | 3 strands | (−0.9, −0.3), (−0.5, −0.8), (0, −0.95) | 4 | 1.6 | 0.2 | 0.15 | 0.5 → 0.25 | behind the head; overlapping strands read as one mane |

Defaults in `tuning.ts` → `finish.dangle`: `gravity`, `damping`, `flutterRate`, `iterations` (constraint passes, 4 like the cape),
`maxDt` (1/30 like the cape).

**Lost heads:** if the head comes off (maiming), its hat and dangles go with the head part, since they follow whatever the head is.

**Out of scope for v1, so ask the owner before building it:** hats being knocked off as physics objects you can pick up. That's a
design question under the "the world is physics" rule.

## 4. Eyes

Keep `round`, `fierce` and `sleepy` exactly as they are. Add five more. All of them are crisp vector, drawn in `drawEyes`, and work
over any hat. Sizes are in head radii (eye radius e = 0.255 r and pupil 0.13 r for normal eyes, as now).

| id | Name | Look |
|---|---|---|
| `googly` | Googly | Bigger whites (0.33 r) with a thin dark rim; loose pupils (0.15 r) that **rattle** (see below) |
| `startled` | Startled | Big whites (0.32 r), tiny centred pupils (0.07 r), two small arched brows above |
| `sly` | Sly | Lids cut flat just above the middle, sloping slightly down outward; pupils pushed toward the face side |
| `sad` | Sad | The reverse of fierce: brows slant **up** toward the nose and cut the top of each eye there; pupils a bit low |
| `cyclops` | Cyclops | One eye only, centred slightly toward the face (x +0.07 r, y −0.07 r), white 0.43 r, pupil 0.2 r, small cream glint |

| `bloodshot` | Bloodshot | Pinkish whites (#F2D9CC) with a few thin red veins (#C8352B) from the outer and inner corners, heavy droopy upper lids (a lid shape in a lighter tint of the body colour with a dark lid line) covering the top half, small low pupils, and a faint dark "bag" curve under each eye. A cartoon tired, dazed look. |
| `walleyed` | Wall-eyed | Normal-size whites; each pupil pushed hard to the **outer** edge of its own eye (left pupil far left, right pupil far right), so they look away from each other. Mirror with the facing like the other eyes. |

**Googly pupils (render-only sway):** each pupil is a spring-damper around the eye centre. Each frame its acceleration is
`−k·offset − c·velocity − headAcceleration + gravity`. Clamp it inside the white (|offset| ≤ white − pupil) and bounce off the rim
(keep about 40% of the speed). It lives in `dangle.ts` too and is tested. Tuning: `finish.googly.spring`, `damping`, `bounce`.

## 5. Colours

Same 8 slots and still unique per room. The first four are the locked pigments from ART_STYLE.md. One colour changes: **Teal goes,
Bone comes in.** Teal was too close to Viridian and Ultramarine for colourblind players; Bone is the only light colour.

| # | name | hex |
|---|---|---|
| 0 | Vermilion | `#D8402A` |
| 1 | Ultramarine | `#2D5DB0` |
| 2 | Cadmium | `#E8B931` |
| 3 | Viridian | `#2F9E6B` |
| 4 | Violet | `#8A4FD0` |
| 5 | Orange | `#E8812E` |
| 6 | Rose | `#E86AA8` |
| 7 | Bone | `#E6DCC6` |

Colours are saved and sent as an **index**, so only slot 7 changes meaning (Teal → Bone). No migration is needed. Check that the
cream eyes still read on a Bone body; if not, give the eye whites a thin dark rim only when the body is Bone.

## 6. Portraits (Hall of Champions)

`src/render/portrait.ts` bakes 3 still variants per look, so the dangles need a pose before baking. Run their step about 90 times
with the head still and a slight sideways breeze, then draw. Use a different breeze phase per variant so the boil also moves the
feather and veil a little.

## 7. Slices (commit after each one that runs)

1. **Data:** new lists in `looks.ts` (ids, names, colours), `hats.ts` with the sway settings, `finish.dangle` and `finish.googly` in
   `tuning.ts`, unknown ids fall back to `none`/`round`, update `FIRST_HATS`. Grep `src/net/` and the tests for hat and eye ids and
   fix any validation. `npm test` and `npm run typecheck` pass.
2. **Seven new eyes** in `drawEyes` (static googly pupils for now).
3. **Painted static hats:** add `paintedHat()` next to `paintedCape` in `src/render/painter/sprites.ts` and replace the placeholder
   `drawHat` shapes for all 12 hats and 6 hairstyles (only the static parts: dome, cone, band and fringe).
4. **`dangle.ts`** plus a unit test: a chain at rest settles to its rest angle; length is kept; stiffness 1 doesn't bend; googly
   pupils never leave the eye.
5. **Swaying parts** on the fighters: the ponytail, braid, pigtails and mohawk spikes, the afro squish, the beanie pom-pom, the feather, the jester points with bells, the wizard tip, the veil and the hair, following the
   head as it moves, rotates and comes off.
6. **Googly pupils live** in the fight.
7. **Portraits:** settle the dangles before baking.
8. **Records:** a DECISIONS.md line (12 hats with the 4 old ones kept, 6 hairstyles in the hat slot, 10 eyes, Teal → Bone, sway is render-only), an ASSETS.md note (still no asset files; hats
   are painted at runtime), and a Status line in CLAUDE.md.

## 8. What to tell the owner when it's ready

- Where to see it: the Hall of Champions (cycle the hat and eyes) and a fight (`npm run dev`).
- What to look for: the ponytail and braid whipping when you turn or flip; the pigtails bouncing; the afro squashing on landing;
  the beanie pom-pom bouncing when you land; the feather springing back after a hit; the jester points and bells flopping; the wizard tip drooping when you
  run; the veil streaming like the cape; hair swinging when you flip; googly pupils rattling when you land or get hit.
- What to tune, by name: `finish.dangle.gravity` (how heavy everything hangs), per-hat `stiffness` (stiff feather vs floppy cloth),
  `trail`, `flutter`, `finish.googly.spring` and `finish.googly.damping`.
- Check the frame rate with F3 at 4 fighters (`/?stress`), all wearing swaying hats. Report the FPS. Don't say it "feels good"; the
  owner judges feel.

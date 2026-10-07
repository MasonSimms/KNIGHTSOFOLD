# Handoff: two new hairstyles and a graphics pass (2026-10-06)

From the owner's design window. The code below is **already in the working tree but not committed**. Claude Code: please
1. run `npm test` and `npm run typecheck` (both passed in the design window: 33 files, 337 tests),
2. look at it in the game (the checks are below),
3. add the lines at the bottom to DECISIONS.md and ASSETS.md,
4. commit, e.g. `Looks: Graham and Bubby hairstyles; knockoff paint and hit spray pass`.

Then work through "Recommended fixes" with the owner. Those are suggestions, not done.

---

## Done: two new hairstyles (in the hat slot, after Afro)

Both are drawn and oil-painted at runtime by our own code like Fubo. There are no image files and nothing is AI-generated. Both are named after the owner's friends, from photos the owner shared.

**Graham**: a big loose mop of light-brown waves (`#A9814F` / `#7E5A36` / `#4A321C`), wider than the head and down past the ears. It has a fringe of waves over the forehead and wears **browline glasses over the eyes**.
- Its static parts are `graham` in `HAT_SHAPES` (fringe and ear curls) and `HAT_BACKS` (the mop) in `render/painter/sprites.ts`.
- Its swaying parts are in `DANGLES.graham` in `content/hats.ts`: two side curls that swing to the jaw and four flyaway waves on top.
- The glasses are `drawGlasses()` in `render/hat.ts`. They are drawn crisp like the eyes and not painted, so the thin rims survive: a dark tortoiseshell bar over each lens, steel rims and bridge, short arms, faintly tinted lenses with a glint.
  - `makeHat` raises them above the eyes on the first `step`, the same way as Fubo's bangs.
  - It returns them as `HatView.glasses`. `render.ts` pushes them onto the fighter's `eyes` list, so they mirror with the facing and squeeze when limp, just like the eyes.

**Bubby**: a round cloud of tight curls, a slightly lighter brown than the photo (`#8E6440` / `#6A4528` / `#3A2414`), with a row of curls tumbling onto the forehead. **It reacts to movement**:
- The cloud squashes on hard landings and hits, using the afro's squish (`SQUISHY` in `render/hat.ts`; tuning: `finish.afro`).
- Six short springy coils round the rim (`DANGLES.bubby`) each end in a round curl that bounces. This uses a new dangle tip, `'curl'`: a ball in the hair's own colour.

Ids are appended to `HATS` (`'graham'`, `'bubby'`), so saves and rooms that send older ids are unaffected.

**Check in the game:**
- In the Hall, click the hat arrow left from Bare to reach Bubby, then Graham. Portraits should show the glasses over the eyes.
- In a fight (`/?hats=graham,bubby,graham,bubby&stress`):
  - the glasses turn with the head,
  - Bubby's curls bounce when landing,
  - Graham's side curls swing when running.

## Done: knockoff paint and hit spray (`render/render.ts`, `content/tuning.ts`)

The owner's screenshot (Medieval, training) showed two things.

1. **The knockoff streaks read as thin red scratches, not paint.** They were 5–7 strokes up to 6 m long and only 10–22 px wide.
   - Now there are 3–5 shorter, fatter streaks (`splat.streaks`: length 1.4–3 m, width 26–42 px, spread 0.35).
   - A **burst splat** (`splat.streaks.burst`, 60 px) is painted where they went out. This matches the Burst/Streak look on the Paint & Effects board.
2. **The picture filled with cream speckles that looked like dust or snow.** These were the hurt spray of the light training dummy (and Bone): every tap left 3–9 drops that never fade.
   - Taps under `splat.spray.minImpact` (12) now leave no paint.
   - Drops per hit are now 2–6.
   - Paint of a very light colour (the same test as `rimEyes`) is shaded toward umber by `splat.lightShade` (0.35), so it reads as paint.

Tuning names for the owner: `splat.streaks` (count, length, width, burst), `splat.spray.minImpact`, `splat.spray.drops`, `splat.lightShade`.

---

## Recommended fixes (not done; please discuss with the owner first)

In order of how much they hurt the look in screenshots and the trailer (the Coming Soon page is due 2026-11-15).

1. **Side masses and foliage are too blurry, worst when the camera eases in.** In the screenshot the right third of the picture is a soft green smear.
   - The backdrop is baked at one size and then magnified by `camera.twoLeftZoom`, with `finish.paintBlur` and `front.blur` on top.
   - Options:
     - (a) bake backdrops at `twoLeftZoom` × the screen resolution;
     - (b) lower the blur on the side masses only;
     - (c) give foliage visible leaf-clump strokes, as ART_STYLE.md says brush texture is felt "mainly in foliage, grass, fighters".
   - Recommend (c) plus a smaller (b).
2. **Light fighters vanish against pale skies and stone** (the dummy and Bone in front of the grey-blue castle wall).
   - Give light bodies the dark underpaint edge more strongly (`finish.underOffset`) or a thin umber lost-and-found edge on the shadow side, the same idea as `rimEyes`.
   - Consider a warmer, darker straw colour for the dummy (`colors.dummy`); see the Bots & dummy board on the design canvas.
3. **Broken props pile up and read as stray sticks.** Several planks and staves lay overlapping on the ground in the screenshot.
   - Cap loose debris per arena (e.g. 6). Sink the oldest unheld piece into a small paint puddle, as the Weapon drops board proposes for weapons.
   - Paint the plank's end grain and a darker underside so it reads as wood, not a line.
4. **Knockoff bursts at the bottom edge hide behind the gilt frame.** Clamp the burst's position about 0.8 m inside the picture.
5. **The pennant is a flat red slab.** Paint it with a taper and two or three fold strokes in the hot colour plus a darker fold shade. Keep the cross-fade under 10%.
6. **Check the frame and letterbox at non-16:9 windows while the camera is zoomed.** The owner's screenshot shows the gilt frame on the right edge only, with black beyond it. That may just be a crop. If it's real, the frame or mask box is off-centre at that window size.

## Lines to add

DECISIONS.md:
- 2026-10-06: GRAHAM AND BUBBY (owner, with photos of two friends). Two hairstyles appended to the hat slot.
  - Graham: a loose light-brown mop with browline glasses drawn over the eyes. The glasses are crisp like the eyes and mirror and go limp with them.
  - Bubby: a cloud of tight curls a little lighter than the photo. It reacts to movement: the afro's squish plus six springy curls with a new 'curl' tip.
- 2026-10-06: KNOCKOFF PAINT PASS (owner: "fix these graphic issues", screenshot).
  - The streaks are fewer, shorter and fatter, plus a burst where the fighter went out; the long thin ones read as scratches.
  - Hits under 12 leave no spray, and spray is 2–6 drops.
  - Very light paint (Bone, the dummy) is shaded toward umber so it doesn't read as dust.

ASSETS.md, new section "Graham and Bubby (2026-10-06)":
- No files. Both hairstyles are drawn and oil-painted at runtime by our own code (sprites.ts `HAT_SHAPES`/`HAT_BACKS`, hats.ts `DANGLES`). Graham's glasses are vector shapes (render/hat.ts `drawGlasses`).
- Designed from photos the owner shared of two friends (direction only, not shipped). No image or sound is AI-generated; the code was written with Claude.

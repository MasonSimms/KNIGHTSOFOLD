# Assets

Every asset's source and tool, for the Steam AI-content disclosure. Columns: file or name, kind, source (hand-made / AI-generated + tool, version, prompt, seed / licensed + licence and link), notes.

| Asset | Kind | Source | Notes |
|-------|------|--------|-------|
| (none yet) | | | Phase 1 draws shapes in code and synthesises placeholder sounds with WebAudio, so there are no asset files. |

## Fonts
| Font | File | Source | Notes |
|------|------|--------|-------|
| IM Fell English SC | public/fonts/IMFellEnglishSC.ttf (184 KB) | By Igino Marini, SIL Open Font License 1.1 (licence text: public/fonts/OFL.txt). Downloaded 2026-10-05 from Google Fonts' official repository, github.com/google/fonts, folder ofl/imfellenglishsc. Not AI-generated. | Menus, scoreboard and round banner. |

## Menu pictures (2026-10-05)
No files: the gallery paintings, the portrait backgrounds and the portraits are painted at runtime by our own code (src/render/painter/, src/render/portrait.ts) from the era painting data, the same way as the backdrops. The museum wall, frames and lamps are CSS and a generated canvas texture (src/ui/menu.css, src/ui/menu.ts).

## The ship and the sea (2026-10-06)
No files: the Pirates ship (hull, rail, mast, sail, rigging, pennant) and the near water are drawn and then oil-painted at runtime by our own code (paintedHull and paintedWater in src/render/painter/sprites.ts), in the era painting's colours. Not AI-generated.

## Hats, hairstyles and eyes (2026-10-06)
No files: the 12 hats and 7 hairstyles are drawn and then oil-painted at runtime by our own code (paintedHat and paintedStrip in src/render/painter/sprites.ts; what sways is moved by src/render/dangle.ts), and the 10 eye styles are vector shapes (drawEyes in src/render/render.ts). Designed from the owner's Looks v1 catalogue (art-guide/looks-v1.png and LOOKS_HANDOFF.md, from the owner's design window: direction only, not shipped). No image or sound is AI-generated; the code was written with Claude.

## Weapons (2026-10-07)
No files: every weapon (the 15 era weapons and every pickup) is a few flat shapes written as data (src/content/weaponArt.ts), drawn and then oil-painted at runtime by our own code (paintedWeapon in src/render/painter/sprites.ts). Designed from the owner's weapon sheet (art-guide/visuals/weapons.png, from the owner's design window: direction only, not shipped). No image is AI-generated; the code was written with Claude.

## AI-generated content
None yet. Log tool, version, prompt and seed for every AI-generated image or sound.

## Style test (Phase 1 deliverable): how to run it
Goal: one tinted-shape fighter over one painted background, to check the look and the frame rate early.

1. Generate ONE Stone Age background with your AI image tool using the master prompt below. Size 2560x1440, no transparency.
2. Save it as `public/art/test_bg.webp` (PNG or JPG also work, same name). Reload the game: it appears behind everything. Delete the file to go back to the flat colour.
3. Press F3 and check FPS and frame time. Try it on your weakest laptop too; also try `http://localhost:5173/?stress` (4 fighters).
4. Log the asset in the table above (tool, version, full prompt, seed, date).

Master prompt (from the design doc, filled in for the Stone Age):

> Stone Age cave mouth and savanna at low golden sun, long shadows, wide landscape with open sky, [leave the lower third quiet and flat for fighters to stand on], simple bold shapes, oil painting on canvas, thick impasto brush strokes, visible palette-knife texture, limited palette of ochre #C98B3F, sienna #8C4A2F, bone #E9DDC1, umber #3A2618, flat simplified forms, hand-painted, loose brushed edges, no outlines other than brushed edges, full scene

Negative prompt (if the tool supports it): photorealistic, 3D render, glossy, airbrushed gradients, text, watermark, logo, extra limbs, anime, pixel art, comic outlines

Acceptance checklist: readable with a 120 px fighter standing in front of it? Era palette and visible brush texture? No baked text, watermark or smooth gradient? Logged here?

The vignette is generated in code (no file). Tune `finish.vignetteAlpha` in `src/content/tuning.ts` (0 turns it off). The canvas grain was removed.

## art-guide/ (2026-10-05)
- art-guide/ART_STYLE.md and art-guide/reference/*.jpg: style guide and reference paintings from the owner's separate art window (AI/tool-generated with the owner's own painter tools; used for direction only, not shipped in the game).
- src/render/oilpaint.ts: oil-paint screen filter written in this repo (our own GLSL; no external asset).

## Graham and Bubby hairstyles (2026-10-06)
- No files. Both hairstyles are drawn and oil-painted at runtime by our own code (render/painter/sprites.ts `HAT_SHAPES`/`HAT_BACKS`, content/hats.ts `DANGLES`). Graham's glasses are vector shapes (render/hat.ts `drawGlasses`).
- Designed from photos the owner shared of two friends (direction only, not shipped). No image or sound is AI-generated; the code was written with Claude.

# Assets

Every asset's source and tool, for the Steam AI-content disclosure. Columns: file or name, kind, source (hand-made / AI-generated + tool, version, prompt, seed / licensed + licence and link), notes.

| Asset | Kind | Source | Notes |
|-------|------|--------|-------|
| (none yet) | | | Phase 1 draws shapes in code and synthesises placeholder sounds with WebAudio, so there are no asset files. |

## Fonts
None yet. Use open-licence fonts (e.g. Google Fonts) and log them here.

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

The canvas grain and vignette are generated in code (no files). Tune `finish.grainAlpha` and `finish.vignetteAlpha` in `src/content/tuning.ts`.

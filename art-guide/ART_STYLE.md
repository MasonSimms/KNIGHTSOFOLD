# Knights of Old: oil painting art style (final)

Goal: every frame looks like a moving oil painting, not a cartoon. Simple cartoon fighters (big painted eyes, one costume piece, a hot-colour cape), painted world.
North star: `reference/north_star_painting.jpg` (loose olive-green painterly background, one hot red accent).
Approved look: `reference/hero_medieval_1920.jpg`, `reference/moving_painting_loop.webp`, `reference/era_*.jpg`.

## Rules
- No outlines. Lost-and-found edges. Smooth blended skies and walls; brush texture is FELT, not counted (strokes only faintly visible, mainly in foliage, grass, fighters).
- Muted world plus ONE hot accent per era (the vermilion pennant/cape). Soft backdrop, firmer foreground.
- Strokes follow form. Flowing cloth (cape, pennant) is the signature shape.
- Player pigments: Vermilion #D8402A, Ultramarine #2D5DB0, Cadmium #E8B931, Viridian #2F9E6B.
- Backdrop motion must be almost still: max ~10% cross-fade between 2 baked variants over a few seconds. Fighters, trails and splats may "boil" (3 painted variants at 8-10 fps).

## How to ship it at 60 fps (the painter is OFFLINE: ~40 s per backdrop, ~3-4 s per fighter frame)
1. Tier 1 (required): bake backdrops (2 seed variants) and fighter part sprites (3 boil variants). Game animates joints and swaps variants. Plain sprite draws.
2. Tier 2 (optional): one live paint shader over fighters/effects only, with automatic fallback to Tier 1. Measure on a weak laptop and Steam Deck first.
3. Tier 3: this painter lives in the repo as `tools/painter/` to regenerate art.

## Painter settings (tools/painter/paintlib.py top-level knobs)
JIT=0.5 (colour jitter), BRS=0.35 (bristle contrast), RELIEF=0.45 (impasto), UNDER=0.4 (smooth underpaint mixed back), plus 0.7 px blur. Raise for a bolder brush.
Stroke layers (px at 1280 wide): A 200x54 everywhere; B 92x22 foreground; C 40x9.5 edges and fighters; D 18x5.2 fighters only. Tapered, 3-9 bristle streaks, stop when colour changes. Render at 2x and downsample.

## Run (Python 3, numpy, opencv-python, pillow)
    cd tools/painter
    python3 keyframe.py 3840 2        # hero frame -> paint_1920.png
    python3 eras.py stone 2560 2      # also antiquity, gunpowder, modern, space
    python3 crown.py 2700 2
    python3 anim_render.py            # needs frames/ folder; ~5 min

## Rules for the repo
- Log every tool- or AI-generated asset in ASSETS.md (Steam AI disclosure).
- Stack: TypeScript, Vite, PixiJS v8, Rapier2D, Howler, Vitest, Colyseus, Electron + Steamworks.js.

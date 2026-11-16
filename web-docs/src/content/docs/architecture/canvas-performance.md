---
title: How the Feega canvas got fast and always sharp
description: Tiles, a zoom freeze, overlay resends, edit patches and direct vector rendering, with the numbers.
sidebar:
  order: 3
---

This is how the Feega canvas went from stuttering to holding the display cap, and from blurry mid-zoom frames to sharp ones. Every number below was measured on one real user canvas: 53 pages with components. Desktop is an M2 Pro with a 60 Hz display. "Phone" is the same machine with a 4× CPU throttle.

## The architecture

The renderer is a Rust core built on vello, running on WebGPU and compiled to wasm.

To keep pans and zooms cheap, it keeps a pyramid of 256 px tiles. While the camera moves, it shows cached rasters instead of redrawing the scene. Tiles are cheap when the camera moves: moving a tile costs almost nothing.

Their problem is magnification. A tile rendered at one zoom and shown at a higher one is blurry until it is baked again.

## A zoom freeze

To have tiles ready before they are needed, the core predicts where the zoom is going. It extrapolated zoom as `(now / was)^6`.

A fast zoom-out made that ratio small, and the sixth power made it close to zero. A near-zero zoom covers the whole world, so the prediction enumerated hundreds of millions of tiles. The tab froze.

The fix has three parts:

- clip the prediction to the canvas bounds;
- bound it to 2× the current zoom;
- cap the tiles enumerated per frame.

## Overlay resend

Selection handles and labels are drawn by the core. They were rebuilt and resent on every zoom step: `JSON.stringify` in TypeScript, a parse in wasm, then a re-encode.

During a gesture they do not change, so now they are held still until it ends.

| Measure | Before | After |
|---|---|---|
| Desktop zoom fps (60 Hz cap) | 48 | 60 |
| Frames over 8.3 ms (uncapped) | 55 | 25 |
| p95 frame time (uncapped) | 18.6 ms | 4.4 ms |

Moving a selection hit the same cost from the other side: every move resent every unselected label, because a selected frame's breakpoint views counted as unselected. The selection's chrome is now built once and carried by its offset; a move sends two numbers to the core.

| Marquee + move, landings (uncapped) | Before | After |
|---|---|---|
| Overlay bytes sent per move | 640 KB | under 2 KB |
| Main-thread time in overlay sends | 14–20% | under 1% |
| p95 frame time | 21.5–27 ms | 6.2–6.4 ms |
| 4× CPU fps | 38 | 59.5 |

## Tile bake budget

Tile bakes are now sized to a 4 ms budget per frame, so baking never eats the frame. At 4× CPU uncapped, fps went from 122–136 to 143–147.

## Edits

The core has a fast patch path that redraws only the edited part. It declined every edit inside a component instance, so on a canvas built from components, every edit rebuilt the whole frame.

After the fix, all edits patch: 10 out of 10 in the test set.

| Edit (desktop p50) | Before | After |
|---|---|---|
| Nudge | 119 ms | 12 ms |
| Colour | 101 ms | 10 ms |
| Hide | 70 ms | 13 ms |

Separately, by-id lookups inside loops were replaced with `Map` and `Set` indexes. One example: the layers panel on 2,000 layers went from 118 ms to 9 ms.

## The rethink: vectors during gestures

Tiles were fast but could never be sharp mid-zoom. So on desktop we now do what Figma does: draw pages from their vector encodings at the current zoom, every frame.

- The scene is built once per gesture, then redrawn each frame with the camera transform.
- Effects (blur, shadows) are expensive to redraw. They are cached per power-of-two zoom level and rendered finer than needed, so they are only ever downscaled, never magnified.

Results on desktop:

- 60 fps, the display cap;
- no blurry frames;
- mid-zoom sharpness up: Laplacian-variance median 234 → 260, p90 354 → 396;
- 0 page dropouts in 9 runs.

The honest limit: on slow devices, full scene rebuilds still spike. So phones and weak machines keep tiles, and a runtime guard falls back to tiles when gesture frames miss their budget. Per-page rebuilds are next.

## Lessons

- **Measure on the real canvas.** The synthetic fixture hid both the component bug and the freeze.
- **Profile per phase before optimising.** Three PRs of layout work gained nothing. Phase marks then showed the real cost was an O(n²) scan.
- **Check what an fps number measures.** The earlier 48 fps cap was screen recording: the harness, not the product.

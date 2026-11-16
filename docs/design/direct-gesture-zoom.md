# Direct gesture rendering (prototype)

## Problem

During a pinch or wheel zoom the core shows cached 256 px tiles. A level coarser than the zoom
is shown magnified, which blurs. ADR 0039 adds a scene fallback and crossfades, and that shows
one-frame vanishes.

## Change

Behind a flag (`?directZoom=1`, or `localStorage['feega:directZoom']='1'`), a gesture frame
skips tiles and draws the visible scene natively at the current camera:

1. `tiles::path_for` gains `Path::Direct`, picked when `GestureDraw::Direct` is set and the
   moment is a gesture (or settling), never while layers are lifted (drag keeps tiles).
2. `WebCore::direct_frame` plans the screen at the camera (`Compositor::plan_at`), the same
   plan the exact rest path uses, so vector groups compose their cached vello encodings
   (`Fragments` / `compose`) with the camera matrix. Encodings don't depend on zoom; only the
   transform changes.
3. The frame is drawn into one screen texture, presented with the overlay, and, when nothing is
   pending, copied into `retained` and adopted. The first still frame after the gesture is then
   already sharp: no settle pass, no swap, nothing to crossfade.
4. `CoreFrames` reads the flag (`direct-switch.ts`) and calls `setDirectGesture`.

Tiles, the pyramid, the warmup and the exact path are untouched. With the flag off nothing
changes.

## Not built yet

The design keeps cached textures only for content whose cost scales with area: blurs,
backdrops, mattes and big images, held at the next finer level so they are downsampled, never
magnified. The prototype redraws effect layers every frame through `layers::prepare`. The
existing layer cache is keyed on screen geometry, so it misses on every zoom step. The bench
below shows how much that costs.

## Measured (user canvas copy, 1440×900 headed WebGPU, CDP wheel pinch, 2026-11-16)

| | dev (tiles) | direct |
|---|---|---|
| capped fps, moderate / extreme | 60 / 60 | 60 / 59–60 |
| worst frame capped, moderate / extreme | 19 / 19–50 ms | 32–35 / 33–35 ms |
| core ms p50 / p95, moderate | 0.4 / 5.3 | 3.5–4.2 / 15 |
| core ms p50 / p95, extreme | 0.5 / 5.6 | 0.8–1.5 / 15 |
| uncapped fps, moderate / extreme | 1777 / 1382 | 767 / 888 |
| uncapped gaps > 8.3 ms, moderate / extreme | 103 / 109 | 225 / 188 |
| 4× CPU fps, moderate / extreme | 59 / 58 | 35 / 37 |
| 4× CPU worst, moderate / extreme | 67 / 67 ms | 99 / 85 ms |
| Laplacian variance mid-zoom median / p90, moderate | 235 / 355 | 246 / 405 |
| Laplacian variance mid-zoom median / p90, extreme | 223 / 349 | 224 / 385 |
| dips (6 moderate + 3 extreme runs) | 0 | 1 (motion edge, not a vanish) |

## Verdict

Not yet. Direct removes tile pops and blur on vector content, but:

- **Frames on screen arrive as held rasters.** The pages on this canvas are drawn through
  `plan.rasters` / pictures, so even a direct frame shows them magnified. Sharpness moved only
  at p90. Direct needs frames composed from their encodings too, not from held textures.
- **Effects are paid every frame.** Core p95 is 15 ms against 5 ms on tiles, and at 4× CPU it
  is 62 ms (35 fps). The layer cache misses on every zoom step. The finer-level effect texture
  cache is the step that decides whether this fits.

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

## Round 3: native pages and zoom-free effects (2026-11-16)

- `Library::set_native(Native::Vectors)`: a direct frame composes cached pages from their
  encodings instead of their held rasters. Held textures stay for lifted (dragged) nodes, and
  are kept, not evicted, so the still path finds them after the gesture.
- `zoomless`: an effect body is keyed on a hash of camera-free content plus a power-of-2 scale
  bucket, rendered at the next finer bucket and drawn at `s / bucket` (0.5, 1], so it is
  only ever downsampled. The bucket-space item is built only on a miss. The cache keeps up to
  4096 entries / 256 MB.

Split per overview frame at 1× CPU, p95: plan 2 ms, effect prepare 4 ms (hits only), scene
build 1 ms, vello CPU encode 4 ms.

| | dev (tiles) | direct round 3 |
|---|---|---|
| capped fps, moderate / extreme | 60 / 60 | 60 / 60 |
| worst frame capped | 19 ms | 19–34 ms |
| core ms p50 / p95, moderate | 0.4 / 5.1 | 3.0–3.4 / 11.7–12.1 |
| core ms p50 / p95, extreme | 0.5 / 5.6 | 1.4–1.6 / 12.0–12.4 |
| uncapped core p95, moderate / extreme | 0.7 / 0.7 ms | 2.5 / 1.2 ms |
| 4× CPU fps, moderate / extreme | 59 / 57 | 37 / 39 |
| 4× CPU core p95 | 9.4–9.6 ms | 50–51 ms |
| Laplacian median / p90, moderate | 235 / 354 | 264 / 408 |
| Laplacian median / p90, extreme | 223 / 349 | 224 / 393 |
| dips (6 moderate + 3 extreme) | 0 | 0 |

Targets: capped 60 met; 0 vanishes met; sharpness better (median +12% moderate, p90 +13–15%;
extreme-zoom median flat because those frames are mostly blank canvas); 4× CPU ≥ 55 fps
missed (37–39); core p95 < 8 ms missed (12).

The remaining cost is re-encoding the whole visible scene every frame: the vello CPU encode
alone is 4 ms at 1× and about 4× that under throttling. Hitting the targets needs encode
reuse across frames (append the previous frame's scene encoding with a camera transform
instead of rebuilding it), or a cheaper effect prepare (memoised fingerprints per clip).

## Round 4: held scene and memoised fingerprints (2026-11-16)

- `HeldView` / `Engine::build_held` / `draw_held`: a direct gesture plans, prepares and builds
  its scene once, with a 25% margin around the screen, and draws it every frame under the
  camera transform. It is rebuilt when content changes, when the view leaves the margin, or when
  the zoom leaves 0.7–1.41× of the build zoom. Effects are held one zoom room (√2) finer, so
  zooming in inside the room never magnifies them.
- `Fingerprints`: effect fingerprints are memoised per item until content changes.

| | dev (tiles) | direct round 4 |
|---|---|---|
| capped fps, moderate / extreme | 60 / 60 | 60 / 59–60 |
| worst frame capped | 19 ms | 32–50 ms (rebuild frames) |
| core ms p50 / p95, moderate | 0.4 / 5.2 | 0.7–0.8 / 7.7–8.4 |
| core ms p50 / p95, extreme | 0.5 / 5.3 | 0.6–0.7 / 7.6–8.3 |
| uncapped core p95 | 0.7 ms | 0.5–0.6 ms |
| 4× CPU fps, moderate / extreme | 58 / 58 | 41 / 40 |
| 4× CPU core p50 / p95 | 2.0 / 9.7–13 ms | 2.2–2.3 / 32–33 ms |
| Laplacian median / p90, moderate | 234 / 354 | 260 / 396 |
| Laplacian median / p90, extreme | 222 / 343 | 223 / 392 |
| dips (6 moderate + 3 extreme) | 0 | 0 |

Targets: capped 60, 0 dips and sharpness are kept. Core p95 is at the 8 ms line, not reliably
under it. 4× CPU ≥ 55 fps is missed (40–41), so direct stays behind the flag.

What is left: a steady direct frame now costs less than a tile frame (uncapped p95 0.5 against
0.7 ms). What remains is the rebuild: about 7–9% of gesture frames rebuild, and each one
re-plans, re-prepares and re-encodes a 1.5×1.5-screen scene, taking about 30 ms at 1× and
about 100 ms at 4×. Both the p95 and the 4× fps come from these frames. Ways to close it,
not built:
- build the next held scene ahead, in slices spread over the frames before the room runs out;
- keep per-frame encodings and re-append only the frames whose LOD or effect bucket changed;
- move planning and encoding to a worker.

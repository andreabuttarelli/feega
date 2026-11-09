# 0034 — The compositor draws cached tiles; raster runs on a budget

Status: proposed 2026-11-09.

## Context

On a canvas of six imported landing pages (`BENCH_CASE=landings`), zoom ran at 25 fps with p95
frames of ~270 ms at CPU 1x, and fit at ~35 fps. The profile put almost all of it inside one
`WebCore::frame` call: during a zoom gesture `Retained::step` re-rasters the whole screen
whenever the cached raster is stretched past √2 or cheap enough (`LIVE_FULL_MS`). A full raster
is one vello render per 1024 px tile plus one per layer body (blur, mask, backdrop), each with its
own `writeBuffer` / `createBindGroup`. Imported pages are full of layer bodies.

Tried and measured (interleaved A/B, 5 runs, landings fixture) without a zoom gain:
- caching layer bodies by content hash, position independent: zoom 25 → 24.5 fps;
- frames taller than a texture cached in bands: zoom 25 → 19 fps;
- layer bodies drawn scaled within a zoom step: zoom 25 → 25 fps;
- 2048 px render tiles: frames come out undrawn (the bug behind the 1024 cap, #1063).

## Prototype

`Retained::step` forced to present the held raster, scaled by the camera, for the whole zoom
gesture — zero vello work on the hot path. Same fixture, CPU 1x, one run:

| gesture | today | present only |
|---|---|---|
| zoom fps | 25 | 60 |
| zoom p95 / worst | 267 / 317 ms | 17.5 / 17.7 ms |
| fit fps | 33 | 42 |
| pan fps | 56 | 57 |

The ceiling is the display rate once nothing is rastered during the gesture. What the prototype
lacks is quality: one screen-sized raster scaled up goes soft and leaves empty margins when zooming
out — the stale scaled raster that was rejected before.

## Decision

1. **The hot path only composites.** During a gesture each frame draws GPU textures through the
   camera transform; it never calls vello.
2. **Tiles per frame per zoom step.** Each frame (group) is cached as square tiles at power-of-
   `2^(1/4)` steps (the existing `rung`), a mip-like pyramid. The compositor draws, per screen
   region, the sharpest tile it holds, falling back to coarser steps — never a blank.
3. **Raster on a budget.** After compositing, the frame spends at most ~4 ms rastering the
   missing or too-coarse visible tiles, nearest the pointer first. Detail therefore sharpens
   progressively during the gesture; at rest every visible tile reaches the exact step.
4. **One encoding, many tiles.** A tile batch encodes the frame's items once and renders the tiles
   from it, so per-render setup (`writeBuffer`, bind groups) is paid per batch, not per tile.
5. **Invalidation by content.** Tiles are keyed by the group key (immutable per revision) and step;
   a patch re-rasters only the tiles its damage touches. Frames held for a drag reuse the same
   tiles, which also removes the drag-start raster (prebuilt in idle).
6. **Worker later.** Moving the engine into an OffscreenCanvas worker is kept for after 1–5; it
   moves the remaining raster off the main thread but does not by itself remove it.

## Consequences

The retained screen raster becomes a cache of composited output, not the source of truth. Memory
is bounded by the existing texture budget, evicting the farthest and coarsest tiles first. The
benchmark's mid-gesture screenshot must show tiles sharpening, and the at-rest shot must match the
exact raster (pixel diff).

## Status 2026-11-09 (handoff)

Built on `perf/tiles` (#1871, draft, behind `?coreTiles`): `packages/gpu-core/src/tiles.rs` (tile
keys, visible/missing, coarse/fine fallback, reserve, eviction), `web.rs` (`tiled_frame`,
`raster_tile`, `present_tiles`, `overlay_texture`, `fill_reserve`, exact path at rest),
`compositor.rs` (`plan_at` draws uses uncached, `overlay_at`, `take_damage` incl. scene damage of
exact frames), `world.rs` (`scene`/`overlay` split, `scene_damage`, `Patch::uncached`).

Measured (landings, 1x, flag off vs on, 5 interleaved, first version): zoom 30 → 56 fps, p95
199 → 32 ms; fit 37 → 49; pan 57 → 60; drags −2…−7 fps (no tile reuse yet).

Open bug, reproducible with `BENCH_TILES=1 BENCH_CASE=landings BENCH_RUNS=1 BENCH_CPU=1 npx
playwright test -c tests/perf/playwright.config.ts`: after the pan gesture and its mid-gesture
check, the canvas presents fully blank at rest although the last tiled frame reports 104 tiles
drawn, 0 missing, settled (then JS stops calling `frame`). Only after the store reached its cap
(eviction active); a fresh page at the same camera renders. Suspects not yet ruled out: a texture
reused from `spare_tiles` or destroyed while still referenced; eviction picking visible tiles
(pin the last presented draw list); `settled()` switching to the exact path without a follow-up
frame (the exact frame never runs, so the screen keeps the last tiled present — check that the
last tiled present is not itself empty, e.g. by logging per-tile `within` rects). Next test to
write: fill to cap, evict, assert every key in `TileFrame::draw` maps to a live texture.

Resolved 2026-11-09: the blank was the overlay, not eviction. The reprojector drew the overlay
without blending over the tiles, replacing the screen with a mostly transparent texture whenever an
overlay existed (`Output::Over` now). Test: `an_overlay_drawn_over_the_tiles_keeps_them_where_it_is_transparent`.

Then: A/B of the current version, batched tile renders (step 3), drag reuse + idle prebuild
(step 4), default on (step 5).

## Status 2026-11-09 (evening)

A/B on landings, CPU 1x, 5 interleaved runs, median [min–max], overlay fix only:

| gesture | off fps | on fps | off p95 ms | on p95 ms |
|---|---|---|---|---|
| pan | 59 [58–60] | 60 [58–60] | 18.7 | 18.6 |
| zoom | 18 [15–19] | 56 [48–58] | 308 [283–417] | 18.7 [18.7–33] |
| fit | 35.5 [34–39] | 46 [39–54] | 32.9 | 31.7 |
| drag | 50 | 20 [11–23] | 18.6 | 148 |
| drag-element | 51 | 24 [20–32] | 18.6 | 118 |
| sharp at rest | 1.9 s | 2.8 s | | |

(off n=4: one off run blanked mid-fit, a defect of the flag-off path.) After batched renders and
drag reuse, one run: pan 59/18.6, zoom 56/18.7, fit 46/31.4, drag 47/18.6, drag-element 43/18.5;
drag start worst 0.47–0.65 s. Open: idle prebuild of held textures, fit p95, sharp-at-rest time.

Defect for later, flag off: one of five flag-off landings runs went blank mid-fit
(`fit: a frame was blank mid-gesture`); not investigated.

## Status 2026-11-09 (rest blocks)

The exact path at rest is gone from tiled mode: the exact picture is rastered in 256 px screen
blocks on the still budget, 200 ms after the last move (`Rest` in `tiles.rs`). Zoom 57 fps p95
18.7, fit 56 fps p95 33, worst frames ≤ 83 ms except drag start (≈ 0.6 s: the overlay rasters every
held frame at once). Time to sharp 2.6 s vs 2.0 s. Next lever: vello per-render setup
(`writeTexture`, `createBindGroup`), not more blocking.

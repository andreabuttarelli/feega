# The GPU core in a worker

Prototype behind `?coreWorker=1`. Default rendering is unchanged: without the param the backend
list and every call path are the same as before.

## Shape

The worker owns the `WebCore` (Rust/vello, WebGPU) on an `OffscreenCanvas` taken from the page
canvas with `transferControlToOffscreen`. The main thread keeps everything that is not the core:
input, Svelte state, display-list building (already off-thread in `frame-build.worker`), staging
(`stage`, `patchUses`, overlays) and the `rasterOf` bookkeeping (picture queues, groups shown).

The seam is the existing `Attached` interface (`core-web.ts`), the same one the native bridge
(`core-native.ts`) implements. `attachedOverPort` turns each call into one message; `hostCore`
applies them in order in the worker. No core logic moves, so `rasterOf`, `stage` and the tile
work in gpu-core stay shared. The only core change is `WebCore.attach_offscreen`, which shares
`attach`'s body through a `SurfaceTarget`.

Files: `packages/motion-core/src/motion/gpu-full/core-worker.ts` (protocol, both ends),
`src/lib/canvas/core/core.worker.ts` (entry), `src/lib/canvas/core/worker-switch.ts` (switch),
`CoreFrames.svelte` (backend list, per-input camera, canvas key).

## Which calls are per frame

| Call | Rate | Wire |
|---|---|---|
| `set_camera` | every input event | `[Camera, x, y, zoom]`, deduped on the main side |
| `frame` | main rAF while painting | `[Tick]`; answer is the last `Status` |
| `set_motion` | per gesture edge | `[Setting, name, value]` |
| `set_*_overlay` | when the overlay part changes | UTF-8 bytes, buffer transferred |
| `patch_uses` | when staging changes the uses | UTF-8 bytes, transferred |
| `put/append_group(_packed)`, `patch_group` | per build or edit | bytes + `Float32Array`/`Uint32Array`, all transferred |
| `picture` | per upload | `ImageBitmap`, transferred |
| status getters | per frame | one `Float64Array` (`Slot` layout) worker → main, transferred |

Messages are small arrays of numbers/strings plus transferred buffers; no JSON is built for the
wire beyond the strings the core already takes.

## Pictures

`ImageBitmap` is transferable, so every picture becomes one: `createImageBitmap(source)` on the
main thread (a GPU-side copy for bitmaps, a decode-free snapshot for canvases and video), then
transfer. Video frames go the same way: `rasterOf` already turns a moving source into a still
canvas, and `createImageBitmap` of that is the copy. `VideoFrame` transfer would skip one copy;
not needed for the prototype. Ordering: the bitmap is async, so a `forget_picture` that lands
before it resolves bumps a generation and the late bitmap is closed instead of sent.
`picture_rows` (banded uploads) is not exposed; the worker gets whole pictures — banding exists
to keep the main thread under budget, and the upload now runs off it.

## Camera latency

The camera is posted from a `$effect` on `view` (once per input event, before the main rAF), and
again from `paintOn` (deduped). The worker applies only the latest camera on its own
`requestAnimationFrame`, so a burst of wheel events costs one render. The worker keeps asking for
frames while the core reports `cache_pending` or `warming`.

## Synchronous reads

Hit-testing never asked the core: it runs on the spatial index in JS. What the main thread reads
synchronously are status getters (`lost`, `cache_pending`, `cache_bytes`, `warming`,
`picture_bytes`, `frame_counts`, outcome); they are answered from the last `Status`, one frame
stale. `busy()` answers false on the main side: the worker paces itself, and a stale `true`
would stop the main pacer for good. `patch_group` (the edit fast patch) returns a boolean: the
main side answers from the set of groups it sent, as the native bridge does; a refusal inside
the worker would go unseen (the group keeps its old content until the next full put). `poster`
(thumbnails) is a request/reply keyed by id. `draw` (one-shot export) is refused: that is the
exporter's path.

Core exceptions in the worker mark the core lost in the next `Status`; `paint` then calls
`attachAgain`, as for a main-thread trap.

## Support and fallback

`coreInWorker` refuses before touching the canvas when `transferControlToOffscreen` or
`navigator.gpu` is missing, so the next backend (main-thread WebGPU, then WebGL) gets a clean
canvas. A failure after the transfer (worker WebGPU missing — older Safari exposes
`OffscreenCanvas` but not WebGPU in workers) rejects `attach`; the backend switch re-keys the
canvas element, so the fallback attaches to a fresh one. Resizing re-keys the canvas in worker
mode too: an offscreen canvas cannot be transferred twice and the core has no resize.

## Not done

- No `VideoFrame` path; no banded uploads in the worker.
- Debug HUD tallies (`render_tally`) are not forwarded.
- The worker's rAF and the page's rAF are independent; nothing aligns them.

## Measured (2026-11-16, desktop, 1440×900 @2x, `tests/perf/core-worker-bench.spec.ts`)

Presented fps / p99 ms / frames over 8.3 ms, from the frame-done probe (main: after `frame`;
worker: after the worker's `frame`). Long tasks = main-thread `longtask` total over pan + zoom.
Zoom latency = wheel event → first frame done with the new camera (submit, not scan-out).

| canvas | mode | cap | cpu | pan fps / p99 / >8.3 | zoom fps / p99 / >8.3 | zoom lat p50 / p99 | long tasks | edit main busy ms |
|---|---|---|---|---|---|---|---|---|
| heavy | main | uncapped | 1× | 413 / 15.8 / 235 of 2054 | 256 / 39.8 / 187 of 1227 | 8.9 / 1243 | 3469 ms | 46.9 |
| heavy | worker | uncapped | 1× | 84 / 82.9 / 220 of 435 | 114 / 35.2 / 293 of 692 | 12.3 / 60.8 | 0 | 38.4 |
| heavy | main | uncapped | 4× | 114 / 53.3 / 100 of 537 | 85 / 38.2 / 239 of 511 | 6.2 / 53.4 | 861 ms | 99.2 |
| heavy | worker | uncapped | 4× | 114 / 47.1 / 163 of 587 | 141 / 37.8 / 236 of 852 | 6.0 / 68.6 | 0 | 88.0 |
| heavy | main | capped | 1× | 50 / 153.7 / 246 of 250 | 60 / 25.3 / 360 of 362 | 8.8 / 38.0 | 0 | 24.6 |
| heavy | worker | capped | 1× | 50 / 152.3 / 250 of 258 | 60 / 26.0 / 355 of 361 | 7.9 / 28.2 | 0 | 21.7 |
| heavy | main | capped | 4× | 37 / 92.6 / 160 of 160 | 47 / 56.3 / 287 of 287 | 8.6 / 85.3 | 986 ms | 88.1 |
| heavy | worker | capped | 4× | 51 / 77.4 / 248 of 256 | 60 / 34.7 / 357 of 362 | 8.4 / 27.8 | 0 | 67.2 |
| landings | main | uncapped | 1× | 471 / 17.8 / 184 of 2397 | 133 / 31.1 / 247 of 804 | 5.6 / 53.3 | 479 ms | 353 |
| landings | worker | uncapped | 1× | 99 / 28.5 / 316 of 510 | 80 / 62.0 / 336 of 483 | 11.5 / 178 | 0 | 286 |
| landings | main | uncapped | 4× | 38 / 142.9 / 64 of 145 | 167 / 29.6 / 180 of 1004 | 5.3 / 3927 | 5914 ms | 549 |
| landings | worker | uncapped | 4× | 129 / 29.3 / 278 of 668 | 87 / 37.0 / 276 of 528 | 7.1 / 245 | 0 | 495 |
| landings | main | capped | 1× | 60 / 35.9 / 300 of 303 | 59 / 40.4 / 349 of 357 | 8.4 / 37.7 | 63 ms | 351 |
| landings | worker | capped | 1× | 51 / 102.4 / 262 of 265 | 58 / 45.1 / 343 of 350 | 8.1 / 39.9 | 0 | 257 |
| landings | main | capped | 4× | 34 / 132.4 / 116 of 119 | 46 / 56.4 / 254 of 255 | 7.5 / 4333 | 4936 ms | n/a |
| landings | worker | capped | 4× | 55 / 49.3 / 280 of 285 | 56 / 48.1 / 329 of 341 | 9.7 / 76.7 | 204 ms | 463 |

At 60 Hz capped every frame is over 8.3 ms by definition; that column only matters uncapped.

Zoom flicker, 9 runs on the heavy canvas, capped: main 0,0,0,0,0,0,0,0,0; worker
1,0,0,0,0,0,0,0,0. One dip: the gate fails.

Pan latency is not reported: the probe compares camera x and zoom, the pan path moves mostly in
y, so it matched late frames. Add y to the probe before trusting it.

Reading:
- The worker takes the core off the main thread: 0 long tasks in 7 of 8 worker rows, and the
  cap holds at 4× CPU (heavy zoom 60 vs 47 fps, landings pan 55 vs 34).
- Uncapped at 1× it presents far fewer frames than the main-thread core (heavy pan 84 vs 413):
  the worker renders once per worker rAF, the main path whenever its pacer asks.
- A vello panic (`Tried to draw an invalid empty image`) hit worker mode in 2 of 4 configs, never
  main: a picture registered out of order with the scene, likely the async `createImageBitmap`
  hop.
- Edit main busy barely moves: edits are dominated by build and staging, which stay on main.

## Round 2: ordered pictures, tick pacing, pan-y probe

Changes:
- **Ordered pictures:** `picture` posts a `PictureSlot` synchronously. The worker queues every
  scene message behind an open slot until that bitmap lands, so the scene never references a
  picture before its upload. That is the main-thread ordering.
- **Tick pacing:** the main pacer's `Tick` renders at once (MessageChannel); camera and pending
  cache still ride the worker rAF.
- **Probe:** it now carries y and the worker rAF gap.

Results (raw in `~/Documents/feega-videos/perf/core-worker/round2/`):
- **Panic: not fixed.** It still fires in worker mode, and in main mode at 2200×1100. Ordering
  was not the cause. The next suspect is a picture texture released (`release` →
  `unregister_texture` + `destroy`) while a retained or tile encoding still holds its id.
- **Flicker: worse.** Worker dips were 0,0,0,1,0,0,1,0,1 (main all 0). Dip frames are saved
  (`dip-worker-*`). They show the GPU frame and the DOM labels at slightly different zooms: the
  worker commits its canvas independently of the main frame, so the screencast pairs mismatched
  cameras. That reading is not yet confirmed.
- **Display rate:** the worker rAF median gap is 15–22 ms, so it does not follow the display.
  Main rAF capped is 60 Hz in this bench browser; 120 Hz was not observed.
- **Wide window (2200×1100 @2x):** broken in both modes. Main hit
  `IntermediateTexture TooLarge 4100×1608 > 4096`, and many configs presented 0 frames. That is a
  gpu-core limit unrelated to the worker.
- **Long tasks:** the worker keeps 0 long tasks during pan at 1440×900. Zoom latency p50 is
  comparable (8–12 ms vs 6–10 ms).

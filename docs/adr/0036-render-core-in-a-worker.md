# 0036 — Render the canvas core in a worker (draft, parked)

Status: **draft, parked.** Code on `proto/render-worker`, behind `?renderWorker`. Not merged: frames go blank after fit with tiles off (the default).

## Context

On a 4x-throttled CPU, gestures on the landings canvas spend most of every 4 s gesture in main-thread long tasks. A profile on dev (one run per cell) attributes the busy time like this:

| gesture | tiles | `WebCore.frame` + other core wasm | other JS (stays on main) |
|---|---|---|---|
| zoom | off | 86% | 13% |
| zoom | on | 82% | 17% |
| drag | off | 60% | 39% |
| drag | on | 58% | 41% |

What stays on the main thread is mostly `setOverlay`, `getBoundingClientRect`, text encoding and display-list building. Moving the core off the main thread is therefore worth most on zoom and fit, and capped on drag.

## Decision (proposed)

The GPU device, vello raster, present and readback move into a module worker that owns an `OffscreenCanvas`. Svelte state, input, DOM overlays and display-list building stay on the main thread.

- `WebCore::attach_offscreen` shares its setup with `attach` through `attach_to(SurfaceTarget)`.
- `render-worker-client.ts` implements the existing `Attached` interface on the main thread, so `rasterOf` stays unchanged.

Protocol (`render-wire.ts`):

| direction | message | carries |
|---|---|---|
| main → worker | `attach` | the canvas (first time only), width, height |
| main → worker | `calls` | a batch of core calls, flushed per frame or microtask; packed float/end buffers are transferred |
| main → worker | `poster` / `free` | thumbnail readback / teardown |
| worker → main | `attached` / `failed` | attach result |
| worker → main | `framed` | frames acked, stats (outcome, pending, byte counts, lost, busy), optional `why` |
| worker → main | `poster` | bytes, transferred |

Pictures travel as resized `ImageBitmap` copies, transferred, in their own `calls` messages chained in order.

## Liveness rules

The worker answers about one frame late. Each rule below was a real freeze and now has a test in `render-ledger.test.ts` (`FrameLedger`, `AttachGate`):

1. **Pending covers in-flight frames.** Otherwise the paint loop stops on a stale "not pending" (frames stayed white).
2. **Busy clears when the GPU drains.** The worker reads the core's busy counter right after submitting, so it always reads busy. It now polls every 2 ms and re-reports once idle; without that, main never sent another frame.
3. **Two unanswered frames means busy.** This is the backpressure the frame pacer obeys.
4. **The last frame's outcome is kept** when a batch without a frame answers.
5. **A `partial` outcome counts as pending.** This did not fix the fit blank.
6. **Calls are held until the core is attached**, then run in order. The gate closes on free or re-attach. Before this, dropped calls left `busy` stuck.

## Measurements

Median of 3 runs. Each cell: presented fps / long-task ms per 4 s gesture / input p95 ms.

**4x CPU, tiles on**

| gesture | dev | worker (runs 1–2)* |
|---|---|---|
| pan | 49 / 699 / 64 | 53–60 / 0 / 0 |
| zoom | 11 / 2955 / 512 | 54–55 / 293 / 328 |
| fit | 47 / 897 / 152 | 49 / 0 / 56–72 |
| drag | 25 / 3555 / 0 | 33–35 / ~500 / 0 |
| drag-element | 25 / 3657 / 400 | 26–28 / 2241–3690 / ~330 |
| time to sharp (ms) | 4595 | 1669–2018 |

\* Run 3 of the worker arm failed with the fit blank.

**4x CPU, tiles off** (dev; the worker arm failed the gate)

| gesture | dev |
|---|---|
| pan | 45 / 485 / 24 |
| zoom | 2 / 3786 / 344 |
| fit | 3 / 2887 / 672 |
| drag | 5 / 3907 / 0 |
| drag-element | 7 / 4126 / 600 |

**1x CPU, tiles on:** both arms present about 60 fps; the worker has fewer long tasks.

**Reading the numbers:**
- "Presented fps" counts the core canvas's `data-painted` tally, the same for both arms. Main-thread rAF fps overstates the worker, because its rAF keeps ticking while presents lag.
- An input p95 of 0 means no event crossed 16 ms.

## Consequences

- **No fallback on the same element.** A canvas can be transferred to a worker only once, so falling back to the main-thread backends needs a fresh `<canvas>`. Under the flag, the backend list is the worker alone.
- **Safari is unverified.** It needs a WebKit run of WebGPU on an `OffscreenCanvas` in a worker.
- **Pictures race `forget`.** Pictures arrive asynchronously, and a `forget_picture` racing a late picture is unhandled.
- **Video costs main-thread copies.** Each video frame costs one `createImageBitmap` on the main thread.

## Open bug: frames blank after fit (tiles off, sometimes tiles on)

After Shift+1 / Shift+0, the worker presents only a small region, overlay titles included, and stays that way for more than 2 s. Main-thread `?coreDebug` reports "all drawn again" with outcome full, and held/pictured are complete. So the worker presents an image that doesn't match what the main thread drew.

Candidates:

1. The worker's core doesn't re-raster its retained or reprojected texture after `set_motion(Still)`.
2. The worker doesn't commit `OffscreenCanvas` presents while it is kept busy, for example by the 2 ms busy-poll `setTimeout`.
3. Ordering: pictures are posted asynchronously, outside the batch that carries their group, unlike the main-thread core.

**Debug-dump plan:**
1. In the worker, log one line per `frame`: outcome, camera, motion, `render_tally()`, `cache_pending()`, `busy()`.
2. Send the lines back on a debug message.
3. Run the same fit toggle (`tests/perf/canvas-landings-bench.spec.ts`, `BENCH_GESTURES=fit`, `BENCH_QUERY=&renderWorker`, 1x, tiles off) and diff the sequence against dev's main-thread core.
4. Read the result:
   - If the worker never re-rasters after Still, it's candidate 1.
   - If it rasters full frames but the screen doesn't change, it's candidate 2.
   - If `render_tally` shows missing pictures, it's candidate 3.

## Evidence

All under `~/Documents/feega-videos/perf/rw/`:

| folder | contents |
|---|---|
| `prof/` | dev cpuprofiles (4x, zoom and drag, tiles on/off) and `attr.mjs` (attribution) |
| `matrix3/` | latest matrix, both arms, with `presentFps` |
| `matrix2/` | earlier matrix, before `presentFps` |
| `t0/`, `t1/` | screenshots of the fit blank (`blank-*.png`) |

The bench metrics are split out as #1910.

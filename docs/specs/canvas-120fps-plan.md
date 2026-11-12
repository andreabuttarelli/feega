# Canvas at 120 fps and fast HD: handoff plan

Written 2026-11-12 for a session on another machine. It records what is measured, what is
unmerged, and the work packages in order. Read `CLAUDE.md`, `LESSONS.md`, `docs/perf-benchmark.md`
and `docs/adr/0037-*.md` first; their rules apply to every step here.

## The bar

Set by the user, in their words: the canvas holds 90–120 fps always, never below; any lag is
intolerable; after a zoom the picture turns sharp as fast as Figma; a zoom round trip must not
reload what it already drew. Tiles stay on (the user rejected turning them off).

Working definition of done, on a 120 Hz display, real-site fixture, fast and slow gestures:

| Measure | Target |
|---|---|
| Frames over 11 ms, every scenario (pan, drag, zoom sweep, far in, far out, fit, hunt) | under 2 % |
| Frames over 16.7 ms | 0 |
| Worst frame in a gesture | under 25 ms |
| Sharp around the pointer after the last input of a zoom | 50 ms |
| Sharp over the whole viewport after the last input | 150 ms |
| Edit latency (nudge, resize, opacity, hide, text key) | one frame, 16.7 ms |
| Returning to a view already seen | 0 still blocks rastered |

## How to measure, and the traps already paid for

- Benchmarks are only valid on an idle machine: load average below 4 before each run, one browser
  at a time. Every number taken above that on the first machine was thrown away. This is the reason
  the work is being handed over.
- Use the paced gesture bench. Before #2039 the bench sent wheel events unpaced and the same build
  read 4 % in one session and 18 % in another. Numbers from before #2039 are indicative only.
- `tests/perf/canvas-gesture-bench.spec.ts`: scenarios zoom-sweep, zoom-far-in, zoom-far-out,
  zoom-hunt, pan-wheel, pan-drag, pan-zoom, and `zoom-deep` once `perf/zoom-final-sooner` lands.
  Fast and slow profiles, 3 runs, medians, builds alternated run by run (A, B, A, B), load recorded
  per run. `npm run perf:budget` is the gate with the edit-latency checks (#2061).
- Zoom is clamped at 4 (`MAX_ZOOM` in `src/lib/canvas/gpu/camera.ts`). A bench that asks for 8x or
  16x measures 4x, and wheel events after the clamp must not count as "last input".
- "Level to sharp" in the bench measures one level finishing during the gesture. What the user sees
  is time from the last input to the final exact picture. Measure that (`zoom-deep` adds it).
- Headed Chrome only; headless does not run the WebGPU frames. The spec launches Playwright's
  Chromium; a copy with `channel: 'chrome'` is needed where only local Chrome is allowed.
- Count draws and rasters per batch, not milliseconds per tile, when looking for a cause: counts do
  not move with machine load. Two regressions were found that way (#2037, #2043).
- The wasm has no function names since #1996, so `scripts/perf/profile-buckets.mjs` cannot split
  plan, raster and present. It also files idle and GPU calls under "main-thread JS". Fix or replace
  it before trusting a profile split (work package 0).
- Fixtures: the real-site canvas `landings.feega` (copies of vercel, stripe, supabase, linear with
  desktop, tablet and mobile views) is not in the repository; it lives on the first machine under
  `~/Documents/feega-videos/perf/landings/` together with `landings-10k/50k/100k.feega`. Copy those
  four files across, or rebuild them with `scripts/perf/landings-fixture.mjs` and
  `scripts/perf/landings-scaled.mjs`. The user requires real-site copies in every perf canvas.
- Gestures in tests are gradual and realistic, also fast, over the full zoom range. No jumps from
  one zoom value to another.
- The committed wasm (`static/gpu-core/*`) conflicts on every merge. Rebuild with
  `npm run build:gpu-core`; never resolve it by hand.
- `gh pr merge --auto` merges immediately on this repository. Read that `test` is SUCCESS, then
  merge.

## Where it stands

Last clean run (2026-11-12 morning, landings, fast profile, medians of 3, load 1.7–3.5, before the
bench pacing fix, so indicative):

| Scenario | fps | p95 ms | Frames over 11 ms | Level to sharp p95 ms |
|---|---|---|---|---|
| pan-drag, pan-wheel, zoom-hunt | 120 | about 9 | 0 | 0 |
| pan-zoom | 119 | 9.0 | 1 | 8 |
| zoom-far-in | 116 | 9.8 | 7 | 34 |
| zoom-sweep | 113 | 10.3 | 53 | 33 |
| zoom-far-out | 106 | 16.7 | 10 | 0 |

With the paced bench (another session, same day): heavy canvas zoom 0.5–1.2 % of frames over 11 ms,
fit 1.0–1.8 %, pan 1.6–1.9 %, drag 2.1–3.1 %; landings fit about 3–5 %, drag about 3 %. So zoom is
inside the limit on the heavy canvas, and drag and fit on real pages are outside it.

Zoom-sweep profile, ms per frame over 1,174 frames (before the far-in fixes): idle 6.24, wasm 3.20,
WebGPU calls (`writeBuffer`, `writeTexture`, `submit`) 1.84, native 0.69, wasm-bindgen glue 0.56,
app JS and Svelte 0.52, GC 0.11. The interface is no longer the bottleneck: 0.30 ms per frame on
pan, 0.55 ms on zoom.

Edit latency is far from target. The descriptions of #2080 and #2085 claim 73–113 ms p50; the only
re-measurement was under load 7–20 and read 1.4–4.6 s, which proves nothing.

## What is already merged (do not redo)

- #1975: `evict_beyond` no longer walks every key each step (14.7 s of CPU in a session).
- #2001: world spatial index; a tile plans only the uses it shows (468 visited down to 2–6 on the
  100k fixture). `packages/gpu-core/src/uses.rs`.
- #2002: tile pyramid of absolute levels. #2016: vello 0.12. #2017: analytic rect shadows.
  #2021: gradient ramps uploaded only on change. #2010, #2011: blur tap merge and decimated blur.
- #2018 + #2037 + #2042: renders that overflow vello's buffers are split, without the false
  positives (3,303 draws for one batch) and with a bound when halving does not help (8,191 to 3).
- #2043, #2044, #2045: far-in sharp 326 ms to 34 ms. Empty groups with a filter get no layer; one
  draw bakes up to 4x4 tiles (`BATCH_TILES`); an SVG filter reaches only as far as its primitives.
- #2027, #2032, #2033: interface cost per camera tick; label culling; labels shaped once.
- #2039: paced bench. #2041: several wheel events per frame coalesced into one camera apply.
- #2051, #2052: frame freshness and drag budget.

## Unmerged work to pick up first

All on `origin`. Rebase onto current `dev` and rebuild the wasm before measuring.

| Branch / PR | What it does | State | What it needs |
|---|---|---|---|
| `perf/zoom-roundtrip-reuse` (no PR) | Reuses a kept rest picture on return (192 still blocks to 0); adds per-frame raster counters and `tests/perf/canvas-roundtrip-bench.spec.ts` | Committed and pushed, unbenched | One open gate: slow far-out time not sharp went 34 to 225 ms in one run when the stills' bytes shrank the pyramid; the pushed commit sizes the pyramid on the full budget and is unmeasured. Full A/B, stills compare, then PR |
| `perf/zoom-final-sooner` (no PR), stacked on the one above | Starts the rest picture 24 ms after the camera stops instead of after `GESTURE_QUIET_MS` 150 + `REST_AFTER_MS` 200. One run: rest start 391 to 64 ms, final picture 516 to 140 ms | Committed and pushed, unbenched | Frames over 11 ms rose 1.7 to 3.4 % (pan-zoom 0 to 2.2 %); commit `ddad9fbde` adds a 6 ms budget for a paused gesture and has never been measured. Find the setting that keeps the final picture inside 150 ms with frames over 11 ms not worse than dev |
| #2084 `fix/drag-ghost` | A dragged element is rastered alone at the current camera instead of being cut from screen tiles (`snapshot_lifts`, exposed when tiles became default in #1942) | CI green; another agent is verifying nine drag cases | Check it has merged. If not: verify, compare drag cost with dev, merge. Production is believed affected; a hotfix to `main` is the user's call |
| #2080 `perf/edit-start-now` | Starts the live frame rebuild inside the edit | CI green, correct in every case tried (0 differing pixels against a reload) | Latency on an idle machine, then merge |
| #2085 `perf/edit-fast-patch` (contains #2080) | Patches the frame on screen for opacity, hide and move; full rebuild replaces it | CI green, correct (392 px differ, identical on dev) | Latency on an idle machine, then merge after #2080 |
| #2069 `perf/refresh-budgets` (draft) | Sizes tile raster budgets to the display refresh | Draft, unmeasured | Measure on a 120 Hz and a 60 Hz display |
| #2034 `perf/engine-overlay-1a` | Selection rings drawn in the engine so they follow zoom | Stopped by ADR 0037's rule: 19 ms gain on 4 s, inside the 41 ms noise | Leave, unless a profile on the paced bench puts overlay work on top |

## Work packages, in order

Each is its own PR, with a failing test first, measured before and after as described above.

### 0. A trustworthy profile split (small, do first)

Build a profiling wasm that keeps function names (a build flag, not the shipped artifact) and make
`profile-buckets.mjs` report plan, lay out, `prepare_items`, encode, GPU calls and glue separately,
with idle and GPU calls out of "main-thread JS". Add per-frame counters to
`window.__gpuCanvas.frames` for tiles rastered, draws, texture uploads and bytes uploaded. Every
later package depends on being able to say where a slow frame went.

### 1. Land the unmerged branches

In this order, one at a time, because they touch the same files (`tiles.rs`, `web.rs`,
`retained.rs`, `world.rs`): #2084, `perf/zoom-roundtrip-reuse`, `perf/zoom-final-sooner`, #2080,
#2085. This closes the HD delay the user reports (the 350 ms wait before the final picture) and the
drag defect.

### 2. Baking must never cost a frame

This is the package that decides whether "never below 120" is reachable. Today a tile bake is
planned and encoded on the main thread inside the frame that composites; the gesture budget is
4 ms and one draw of a 4x4 block costs about 1.35 ms of CPU plus uploads, so a frame that bakes can
pass 8.3 ms. The frames over 11 ms on zoom-sweep and far-out are these frames.

- Split compositing from baking: a camera frame only composites what is held (transforms on held
  tiles, the nearest level scaled where the exact one is missing) and is not allowed to wait on a
  bake.
- Give baking a deadline scheduler: each frame measures what is left of the 8.3 ms after
  compositing and runs bake work only inside that remainder, in units small enough to stop
  (per tile, not per 4x4 block, when the remainder is short). Use the measured cost of the last
  bakes, per level, to predict whether one fits.
- Move plan and encode off the main thread: the planning and vello scene encoding can run in a
  worker with its own wasm instance; only the GPU submit stays on the main thread. Measure first
  whether the 1.84 ms of WebGPU calls or the 3.20 ms of wasm is the larger share on slow frames;
  if GPU calls dominate, batch uploads (one `writeBuffer` per frame, texture atlases instead of
  per-tile textures) before moving work to a worker. `OffscreenCanvas` with the whole renderer in a
  worker is the larger version of the same idea; decide with the profile from package 0.
- Order: centre and pointer first, then the rest of the viewport, then one ring of prebake in the
  direction of travel. During a decelerating zoom, bake the predicted destination level.

Acceptance: zoom-sweep and far-out under 2 % of frames over 11 ms and none over 16.7 ms, with time
to sharp not worse.

### 3. A tile pays only for what it shows

`Laying::lay` in `packages/gpu-core/src/groups.rs` walks every piece of an on-screen group and
`fragments::compose` walks every run of a span, so each tile touching a large frame pays for the
whole frame. `layers::prepare_items` was about 85 % of per-tile raster before #2043–#2045 and the
layer cache never hit (32 entries, 0 hits) because layers are clipped to the tile.

- Cull pieces and runs to the tile rectangle inside `lay` and `compose` (a per-group spatial index
  like `uses.rs`, built once per content version).
- Cache what does not depend on the tile: shaped text, resolved paints, filter chains, per content
  version and level, not per tile.
- Measure per-tile cost against the number of pieces in the frame it touches; it should be flat.

Acceptance: per-tile CPU independent of frame size on the 10k, 50k and 100k fixtures.

### 4. Drag and fit on real pages

The paced bench puts drag at about 3 % and fit at 3–5 % on landings. An agent of another session was
profiling these when it ran out of usage; nothing was written down. Profile both with package 0's
split. Candidates to confirm or discard with counts: re-raster of old and new bounds on every drag
frame (after #2084 a dragged element is drawn alone, check what the tiles under it cost), frames
re-entering sight during a fit all baking in the same frame (package 2's scheduler should absorb
it), and uploads of large images.

### 5. Edits in one frame

After #2080 and #2085: measure each edit kind with `perf:budget`. The path to 16.7 ms is the same
shape as package 2: patch the held picture in the frame of the edit (transform, opacity, visibility
are compositing changes), and redraw only the tiles the edited layer's old and new bounds touch,
not the frame. "Redraw only what an edit touches" was in progress in the other session with no
branch found; start from the damage rectangle of the edited clip.

### 6. Memory and return trips

A 10x zoom range spans 13 levels of about 115 tiles, about 1,500 tiles and 400 MB; the budget keeps
1,152 on a 2880x1800 screen, so a repeated round trip re-rasters about 1,770 tiles per lap
(365 ms of CPU). Three options were measured and all cost sharpness or memory: skipping the slow
tail of a flick (12 and 4 tiles on laps 2 and 3, but 930 ms not sharp against 520), doubling tile
memory (still about 400 tiles per lap), shrinking the pyramid (softer zoom-out, unmeasured). The
user has not chosen; the recommendation given was to keep re-raster for now. Once package 2 makes
re-raster free of frame cost, revisit: compressed tile textures (BC7 or ASTC where available) would
hold about four times as many tiles in the same memory. #2004 (tiles on disk across sessions) and
#1895 (frame sources in IndexedDB) are open drafts on the same theme.

### 7. Guard

Make the paced gesture bench a required check for PRs touching `packages/gpu-core`,
`src/lib/canvas` or `src/lib/components/canvas`, with the 2 % limit on frames over 11 ms and the
time-to-final-picture limit, at 120 fps (#2068 judges the budget at 120 fps and is open). Record
real-user frame summaries (#2053 is open) so the bar is checked on users' machines, not only on
ours.

## Not on the path

- ADR 0037 steps 2 and 3 (visible set and camera in Rust): on hold by its own rule until a profile
  on the paced bench puts camera handling or visibility on top. The interface costs 0.3–0.55 ms per
  frame today.
- The native desktop renderer: the desktop app ships the web renderer by decision; native comes
  later.
- Fewer tile levels per doubling or a higher downscale: rejected, text gets softer.

## Open questions for the user

1. Whether to ship #2084 to production as a hotfix once verified.
2. Which of the three return-trip options to take, or none (package 6).
3. Whether #2069 looks right on their 120 Hz display.

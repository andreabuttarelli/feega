# One canvas, web and native: staged plan

Executes [ADR 0040](../adr/0040-one-canvas-engine-web-and-native.md). Read `CLAUDE.md`,
`LESSONS.md`, `docs/perf-benchmark.md` and `docs/specs/canvas-120fps-plan.md` first: their
measuring rules apply to every stage (idle machine, one bench at a time, interleaved A/B, medians
of 3, real-site fixture).

## Rules for every stage

- **Web first.** Every stage except S4–S5 ships on the web and is measured there before the
  desktop sees it. The desktop host only ever runs code the web already runs.
- **One stage, one runtime boundary moved.** At the end of a stage the TS it replaces is deleted,
  not left dormant behind a flag for more than one green week.
- **Stop rule.** A stage whose measure does not move beyond the run-to-run range stops; the number
  goes into ADR 0040.
- **Test first.** Equality tests (Rust vs TS) are written before the port of each module and seen
  failing.
- **Fixtures.** `~/Documents/feega-videos/perf/landings/landings.feega` (vercel, stripe,
  supabase, linear; desktop, tablet, mobile) and the 10k/50k/100k scaled copies; the bench kit in
  `scripts/perf/`.

## Stages

Sizes are engineer-weeks, judgement, for one engineer who knows the codebase.

| Stage | What moves into `canvas-engine` | Web value, measured by | Exit criteria | Size | Deleted from TS |
|---|---|---|---|---|---|
| **S0** spike | Scene for one typical page: doc → display list for the element kinds of the real-site pages (frames, stacks / auto layout, rect and path fills, strokes, radius, images, text) | none shipped; numbers decide S3 | packed display-list wire byte-equal to TS on every page of `landings.feega` the subset covers, list of uncovered kinds; build time per page in native and in wasm (worker) vs TS in the worker, ≥ 2x faster or stop | 3–4 | nothing |
| **S1** one policy | `web.rs` per-frame policy (tile / direct / held path, warmup, pyramid, budgets) behind `Platform`; `web.rs` becomes surface glue; the desktop addon calls the same code | no regression on `perf:budget` and the gesture bench; desktop spike stops forking | `apps/desktop/native/src/{worker,painter,inbox}.rs` reduced to host glue; `cargo test` runs the policy without a browser | 2–3 | nothing (Rust-to-Rust move) |
| **S2** engine-owned interaction (0037 steps 1–4, extended) | camera, wheel / pinch / pan, inertia, one spatial index, hit-test, all overlay (selection, handles, names, guides, marquee, hover, peers' cursors, drop indicators), caret and text-selection drawing; intents out | overlay no longer lags a zoom (#1936 class of defects gone), main-thread ms per 4 s zoom (0037 measure) | zero DOM elements positioned from `view` during a gesture (test); e2e moved to `hit()` / `rect_of()`; screenshots at 0.1x / 1x / 4x light and dark | 6–8 | `spatial-index.ts`, `inertia.ts`, `world-overlay.ts`, overlay components (`FrameOverlays`, `FrameSelection`, `FrameGuides`, hover ring, marquee), wheel / pinch math in `GpuFlow.svelte`, card-kit contour transforms |
| **S3a** scene in Rust | doc → display list for the canvas path, behind the byte-equality corpus in CI; runs in the build worker as wasm; `?faces=rust` made the default first | load: time to all frames with content on `landings.feega`, cold and warm, 1x and 4x CPU | corpus 100 % of canvas-path kinds; CI fails on a byte difference; load faster beyond noise or stop | 10–16 | the worker's use of `prepare` / `drawFrame` (server still uses them) |
| **S3b** scheduling | frame, picture and font scheduling and caches; decode through `Platform` (`createImageBitmap` / platform decoders); source text in, display lists never cross to JS | load and gesture bench; main-thread long tasks during load | no doc JSON parsed on the main thread for drawing; long tasks over 50 ms during load halved | 4–6 | `frame-sources.ts`, `frame-cache.ts`, `frame-build*.ts`, picture uploads, most of `CoreFrames.svelte` |
| **S4** macOS host | child `NSView` above the web view, lowered under registered DOM layers; native input into the engine; display link; IPC command / event bridge; hidden-textarea IME | desktop only, behind `FEEGA_NATIVE_CANVAS`; compared with the web canvas in the same app | gesture bench late frames ≤ web's on the same machine and refresh; no drift in a 2-minute pan / zoom / drag / select / rename / type script recorded at 120 Hz; popovers, dialogs, context menus over the canvas correct; CJK and dead-key input; panel resize and monitor move (DPR) correct. Shared-texture route measured once, after an Electron upgrade, if the child view fails any of these | 6–8 | the spike's `view.rs` placement path; `native-canvas.cjs` page-driven camera |
| **S5** Windows, Linux | child HWND (DX12), X11 / XWayland child (Vulkan); per-OS input normalisation from recorded traces | — | S4's criteria per OS; Wayland-native subsurface deferred | 4–6 | — |
| **S6** retire the TS runtime | server still / video render calls the Rust scene through napi; native canvas becomes the desktop default after one green release | one implementation of layout and text | corpus becomes the Rust scene's regression suite; no TS module computes canvas layout | 4–6 | `src/lib/canvas/core/` canvas runtime, `CoreFrames.svelte`, most of `GpuFlow.svelte`, motion-core `prepare` / `drawFrame` canvas path |

Total: roughly 40–57 weeks of engineering, plus review and measuring; with the stop rule, the
real number is decided at S0 and S3a.

## S0 in detail

1. Crate `packages/canvas-engine` with a `scene` module and serde types for the subset of
   `MotionDoc` a real-site page uses. Fields the subset does not read are ignored, not rejected.
2. A TS script dumps, for each frame of `landings.feega` and each motion-core layout fixture, the
   doc and the packed display-list wire `prepare` / `drawFrame` produce at the poster time.
3. A Rust test reads the same docs, builds lists, packs them the same way and compares bytes.
   Unsupported kinds are counted per page, not skipped silently.
4. Speed: native release and wasm in a worker, same pages, interleaved with TS, under the shared
   bench lock. Not run until the bench kit is back in `scripts/perf/`.

## Risks to watch per stage

| Risk | Where it bites | Guard |
|---|---|---|
| Text shaping parity | S0, S3a | `?faces=rust` default before S3a; corpus compares glyph ids and advances, not only pixels |
| motion-core lock slows features | S3a–S6 | lock only the canvas-path modules; corpus failure names the module |
| Two-host input semantics | S2, S4, S5 | gesture math once in Rust; recorded event traces per OS as fixtures |
| IME and text editing | S2 (caret drawn by engine), S4 | hidden textarea on both hosts; CJK, dead keys, emoji picker in S4 exit |
| Accessibility | S2 | offscreen ARIA list of selection stays in Svelte; checked with VoiceOver per stage |
| Occlusion ordering | S4 | one registry of DOM layers in TS; e2e opens every registered layer over the canvas |
| Team velocity | all | each stage ships alone; never two stages half-done at once |

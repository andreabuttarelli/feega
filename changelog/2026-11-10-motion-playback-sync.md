# Motion frames keep playing on heavy canvases

**Why.** Playing a heavy motion frame (2–4 MB doc) on the canvas froze it until pause.

**Cause.** Every playhead tick rebuilt the frame in the worker: parse the whole doc, `prepare` it, draw. That took 30–55 ms on the landings fixture, longer than one tick. `CoreFrames.rebuildLive` landed a build only if it was still the latest asked, so with builds slower than ticks no build ever landed.

**Fix.**
- `liveGenerations` (`src/lib/canvas/core/live-generations.ts`): a build lands if newer than the one shown. Slow builds skip ahead instead of being discarded.
- `playingBuilder` (`frame-build.ts`): the worker keeps the last prepared doc; the playhead travels apart from the doc text, so a tick only draws. Build 42→21 ms, 30→18 ms, 55→37 ms on the three heaviest docs.

**Bench.** `BENCH_MOTION_CANVAS=<canvas.json> npx vitest run scripts/perf/motion-playback-bench.test.ts` replays 5 s at 60 Hz, 3 lanes, with measured build times. Heavy docs: before 0 fps, drift 2.5 s mean; after 29.6 fps (doc rate 30), drift 33–50 ms. It is a model of the landing policy, not a browser trace.

**Discarded.** A separate clock: `FrameTimeline` already advances by wall time, so the clock was not the drift source.

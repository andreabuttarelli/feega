# Canvas open and drag: less main-thread work per frame

Round 2 perf audit hotspots 2, 3, 6 and 7 (traces in `~/Documents/feega-videos/audit/round2/perf/`).

- **Template docs built lazily (hotspot 6).** The canvas page imports `BUILTIN_TEMPLATES`, and every
  built-in template built its doc at module load: component code generated, linted with acorn
  (`lintSource`), cloned, fields exposed. One long task, 344 ms at 1x and 1.8 s at 4x, before the
  canvas could paint. `lazyTemplate(build, meta)` (`src/lib/motion/template/lazy.ts`) gives the
  template a memoised `doc` getter; the doc is built when something reads it, on the canvas the
  component library. `lazy-docs.test.ts` fails if importing the templates lints or exposes a field.
- **One wire string per item (hotspots 2 and 3).** `spliceOf` stringified every item of a rebuilt
  list to diff it against the one on the GPU, and `core-web` stringified the whole list again to
  send it to wasm. `wire.ts` keeps one memoised JSON string per item (`WeakMap`), shared by the
  diff and by `listWire`/`spliceWire`. The frame worker sends the strings with the list
  (`builtAnswer`), so a frame built off the main thread is never serialised on it. The wire also
  stops sending `unsupported` and `bleed`, which the core never reads.
- **Shaped text measures remembered (hotspot 7).** Auto layout measures each text on every
  rebuild, and a drag rebuilds on every pointer move. `shapedText` now remembers measures per font
  book, keyed by component, props, unit and width (4096 kept).
- **Discarded.** A deep structural compare instead of `JSON.stringify` for the diff: V8's
  stringify was 10x faster on a 400-item list (1.7 ms vs 17 ms). Dropping `faces` from appended
  parts: the native core typesets each appended part with its faces.
- **Not done.** Image uploads (`copyExternalImageToTexture` on the main thread) stay as they were;
  splitting a large upload needs a gpu-core API taking an origin.
- **Measured** with the round-2 harness (30 heavy landing frames, dev server, desktop 1x and 4x CPU
  throttle; traces in `~/Documents/feega-videos/audit/round3/perf/{before,after}/`). Longest open
  task 343 → 86 ms (1x warm) and 1328 → 304 ms (4x cold); drag long tasks 5.6 → 2.5 s (1x) and
  29.0 → 25.0 s (4x); drag move to selection p50 69 → 54 ms (1x), 260 → 214 ms (4x). Time to all
  frames placed is not comparable between runs: it is the dev server loading ~2400 modules before
  the canvas surface exists (2.2–3.6 s at 1x across runs); frames are placed 11–61 ms after it.

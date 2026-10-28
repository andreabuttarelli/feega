# Interactive motion videos play on gpu-core

**Before.** Two engines. A video drew with gpu-core unless it was interactive
(`isInteractive(doc)`) or an expression read live input (`window.__feegaLive(` in the composed
page); then `stageOf` picked the hyperframes HTML player, an iframe fed `feega:input` messages
by `playerMain`. The embed, the downloaded file, `/live` and React (via `/e/:id`) all forked on
it, and the page carried the whole composed HTML a second time as the player config.

**Now.** One engine for every embed.

- `gpu-full/hit.ts`: hit-testing on the display list (`hitClip`, `hitClips`) and `linkAt`, which
  finds the run under a point through `textCaretAt`. No DOM. Links are boxes of text, not ink.
- `interactive/gpu-live.ts`: `liveFeed(raw)` builds the `LiveSpec` (`liveSpecOf` in compose, the
  same one the DOM runtime got), ticks `liveScene` with pointer, hover, press, tilt, scroll,
  time and variables, and returns a `Prepared` whose live lanes are held keyframes and whose
  bound text/colour props carry the variable values. Memoised per frame and values, so a still
  pointer does not redraw.
- `mountPlayer` takes `inputs`, draws the patched `Prepared`, remembers the last display list
  and answers `linkAt` / `clipAt`.
- `<feega-gpu-player>` gains `drive({ values, vars })` (merge, `undefined` removes), `linkAt`,
  `clipAt`, a `link` event and `varschange`. It listens to the pointer itself, which is what the
  React SDK uses; in the embed page the pad sits above it and `playerMain` drives it instead.
- `stageOf` and the hyperframes stage are gone from `servedPage`; `livePage`, the hosted embed
  and `source.json` are always gpu-core. The page no longer ships the composed HTML.
- The downloaded file inlines the player module, gpu-core (`gpu_core.js` plus the wasm, gzipped
  and base64, about a third of the raw size) and the font sheets and files the video reads
  (`recording` reader at export, `inlineReader` at play), so it draws text with no connection:
  3.9 MB, zero requests when opened from `file://`. `core-web` and `engines` read
  `__feegaGpuCore` before fetching from the origin.
- React: `scroll` and variables go through `drive`, `link` and `varschange` map to
  `onLinkClick` / `onVarsChange`, `onReady` lists the declared variables.

**Kept.** Stored legacy pages (`upgradePlayer`, `legacyFingerprint`, the live runtime chunk,
`/motion-runtime`) still serve the old player until they are rebuilt. Hyperframes remains the
DOM compositor behind custom components and the export/render path.

- `frameAt` clamps to the last frame: a video that does not loop used to end on an empty stage,
  because the clock reached `durationInFrames`, one past the last frame.

**Cannot move yet.** Live-mode custom components (games) are read one frame at a time,
`LiquidGlass` is not drawn by gpu-core at all (blobs are), and layers that read the DOM (custom
components, 3D models, mattes) still load their libraries from the app origin, so they need a
connection in the downloaded file.

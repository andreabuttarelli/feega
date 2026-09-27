# Composition node, phase 3: export

Phase 2 (`CompositionEditor.svelte`, mounted on the canvas) built a scene the
editor could preview and scrub through, but "Salva" only persisted layout
state — no Export button, deliberately, per that phase's report. This phase
adds it.

## What this adds

- `src/lib/canvas/composition/export.ts`: pure sizing/timing math — output size
  per aspect (`9:16`/`1:1`/`16:9`) × resolution (`720p`/`1080p`), frame count
  and per-frame timestamps at a given fps, and the avc1 encoder config
  (bitrate scaled to resolution). Unit-tested first.
- `src/lib/canvas/composition/encode.ts`: the browser-side encoder. Renders a
  **fresh scene on an offscreen canvas** built for export — kept apart from
  the one the live preview drives, so the export loop doesn't fight the
  editor's own `requestAnimationFrame` loop for the same GL context. Frame by
  frame: `scene.renderAt(t)`, `CanvasSource.add(t, duration)`, yield to the
  main thread, repeat. Waits for every media texture (`onTextureReady`) before
  frame 0, same discipline phase 1 already paid for.
- Muxer: **mediabunny** (`Output` + `Mp4OutputFormat` + `CanvasSource`), not
  `mp4-muxer`. Same author (`vanilagy`); mp4-muxer's own README now points at
  mediabunny as the actively maintained successor with more codecs and a
  simpler encode-and-mux-in-one API — no separate `VideoEncoder` wiring, no
  Uint8Array chunk plumbing. `canEncodeVideo('avc')` gates the choice: true
  where WebCodecs + avc1 exist, otherwise `MediaRecorder`→WebM (Firefox today).
  Both branches share the same offscreen-scene setup and frame loop shape.
- Both Three.js and mediabunny stay out of the canvas's default bundle:
  `encode.ts` is only reached through a dynamic `import()` inside the
  editor's export handlers, which themselves only run once someone opens the
  composition editor.
- Wiring: export produces a `Blob` (mp4 or webm), then reuses the plain
  canvas-upload path — file straight to `canvas-assets` from the browser
  (`uploadCompositionExport` in `+page.svelte`, same shape as `upload()`),
  then `write(id, { refId })` under the node's existing version concurrency
  (`saveCompositionExportRefId`). No new server action; `upload`/`write`
  already did everything needed.
- `composition -> 'video'` in `upstream-inputs.ts`'s `KIND_MAP` already
  existed (from an earlier commit) but had no test — a composition wired
  into a video node's reference input was provably untested. Added one.
- PNG export (`captureCompositionFrame`): same offscreen-scene build, one
  `renderAt(t)` at the current scrub position, `canvas.toBlob(..., 'image/png')`,
  same upload+write.

## Deliberately not done here

- No browser verification ran in this session — the `playwright` MCP
  connection was down (`CONNECTION_CLOSED`) and no interactive browser was
  available to drive `chromium.launch({ channel: 'chrome' })` against the dev
  server. The pipeline is unit-tested (frame math, sizing, encoder config) and
  type-checks clean, but **no MP4 has actually been produced and inspected**
  in this session — that verification is still owed before calling phase 3
  done in the sense `CLAUDE.md`'s "done means wired" rule asks for.
- No progress-bar cancel test beyond the manual `isCancelled` check wired into
  both encode branches — there's no unit test for the cancel path because the
  loop lives inside a browser-only function (`VideoEncoder`/`MediaRecorder`
  aren't available under Vitest's node environment).

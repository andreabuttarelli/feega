# Browser export and posters draw on gpu-core; the PixiJS motion engine is gone

Depends on #1415 (interactive on gpu-core). The `pixi8` package stays until #1412 (PixiJS canvas
renderer removed) lands: the canvas scene still imports it. Remove it with `npm uninstall pixi8`
right after.

## Before

Three engines drew a motion video: gpu-core (canvas, embeds), a PixiJS 8 engine under
`src/lib/motion/gpu` (reachable only through props nobody set) and the hyperframes HTML player
(`MotionPreview`, browser MP4 export, `/render/[token]`, posters). `pixi8` stayed in
`package.json` for the second one.

## Now

- `MotionPreview` takes `fullDoc` (doc, tokens, assets, audio analyses, a compose function for the
  DOM reads). With it, it draws through `GpuFullLayer`/`mountPlayer`; the hyperframes iframe stays
  behind it, hidden, as clock, audio, measuring and text editing. Without it, HTML as before.
- `render()` exports through `renderOnCore` first: seek a frame, draw it, read the bitmap, encode.
  `coreExportable` declines the video up front (HTML export runs instead, nothing half-written)
  when a frame has a gap the core does not draw (line and vector shapes, 3D devices without a DOM
  read) or when the times are not whole frames (motion blur sub-samples would collapse into one).
  Output size, fps, frame count and audio are unchanged: the encoder scales the bitmap to the
  export size and the audio mix is the same code.
- `prepare` takes the stored audio analyses, so music-reactive expressions bake the same as the
  HTML export. Tested in `prepare-analyses.test.ts`.
- `still()` (posters, compose page cover) draws one frame on the core and falls back to HTML.
- `/render/[token]`, the canvas export dialog (`FrameDialogs` passes a scene per draft doc),
  `CompositionPlayer`, the compose page and the preview route (`scene` next to `html`) pass the
  document.
- Deleted: `src/lib/motion/gpu/{engine,renderer,textures,text-layout,runs,fill-pattern,fit}`,
  `GpuLayer.svelte`, `RenderEngine.Gpu`. `scripts/gpu-parity` keeps its
  html-versus-core modes (`parity`, `export`, `scrub`); the PixiJS ones are gone. The
  `pixi.js@7.4.3` and `@pixi/unsafe-eval` script libraries for in-video code stay.

## Kept, and why hyperframes is not deleted

`capture()` (agent captures with layout boxes), measuring (`PartsProbe`), text editing and tap
targets read the DOM; line/vector shapes, motion blur and DOM-only layers are not drawn by the
core. The component library previews (`ComponentDetail`, `TemplateLibrary`) have no tokens or
assets to hand and stay on HTML.

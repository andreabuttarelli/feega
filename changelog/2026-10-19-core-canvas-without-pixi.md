# `?renderer=core` no longer loads PixiJS

ADR 0020 phase 3, step 1. Until now the core canvas ran on top of a full Pixi scene: Pixi drew
every node the core had not taken (posters of frames with custom components, cards still loading
their images), the ghost wire, the hover outline, and owned readiness (reveal, fit, draw layer).
html-to-image, the snapshot queue/cache, stored previews and the poster shelf all ran too.

Now, on the core path:

- `GpuScene` is imported dynamically (`import('$lib/canvas/gpu/scene')`) only when the core is
  off: `?renderer=gpu`, or when both core backends fail (`coreOff` boots Pixi then).
- A frame the core cannot draw whole is a **card drawn by the core** with the frame's poster as
  an image item (`postersFor` in `frame-poster.ts`) — no Pixi texture.
- Ghost wire and hover outline are core overlay items (`ghostItems`, `hoverItems`).
- `themeOf` moved to `gpu/theme.ts` with a hex mix; it used Pixi's `Color`.
- html-to-image is a dynamic import inside the snapshot job, which never runs on core (no scene);
  the poster shelf is empty on core.
- Reveal counts a node ready when the core reports it drawn.

`pixi-lazy.test.ts` fails if `GpuFlow`/`CoreFrames` import the Pixi scene, pixi or html-to-image
statically again.

Not done: the editing dim (`setDim`) has no core equivalent yet; neighbours stay at full opacity
while a frame is being edited on core.

# The core canvas is the default

`rendererOf` (`gpu/renderer-flag.ts`) returned the PixiJS canvas for anything that was not `?renderer=dom` or `?renderer=core`. Now the core canvas is the fallback:

- no param, or an unknown value: core;
- `?renderer=gpu` (also `webgpu`, `webgl`): back to the PixiJS canvas;
- `?renderer=dom`: the DOM canvas, as before;
- the kill switch (`canvas-force-dom` flag or `CANVAS_FORCE_DOM=1`) still wins over everything.

Why now: every node kind has a dedicated vector card (gen, list, doc, sources, empty nodes, iframe, select, effects, composition, studio batch, audio controls), and hover no longer mounts DOM tiles over cards.

Supersedes #973, which was written before those landed and also added a core-only kill flag (`canvas-core-off`); not carried over: `?renderer=gpu` is the way back for now. Deleting PixiJS (`gpu/scene.ts` and friends) waits until the default has been live without needing it.

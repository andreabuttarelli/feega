# Core canvas is the default

ADR 0020 phase 3, step 2. `rendererOf` defaults to `Renderer.Core`. Escape hatches:
`?renderer=gpu` (also `webgpu`/`webgl`) opens the Pixi canvas, `?renderer=dom` the DOM one.

Kill switches, read server-side by `canvas-renderer-switch.ts`:

- PostHog flag `canvas-core-off` or env `CANVAS_CORE_OFF=1` → `Switch.CoreOff`: everyone on the
  Pixi canvas; an explicit `?renderer=dom` still works.
- `canvas-force-dom` / `CANVAS_FORCE_DOM=1` still beats both.

Rules per switch live in one table (`UNDER` in `renderer-flag.ts`).

## Deleting PixiJS (after the default has been live)

1. Two weeks on core with no `canvas-core-off` flip and no `[canvas] core off` fallbacks
   reported, on desktop and iPhone.
2. Remove `?renderer=gpu` and `Switch.CoreOff`; the fallback becomes `Renderer.Dom`.
3. Delete `gpu/scene.ts`, `chrome-layer.ts`, `texture-cache.ts`, `texture-decoder.ts`,
   `upload-queue.ts`, `texture-pins.ts`, `bitmap-decode*`, `poster-shelf.ts`,
   `snapshot-queue.ts`, `snapshot-cache.ts`, `icon-bitmap.ts`, the snapshot and shelf code in
   `GpuFlow.svelte`, the stored card previews endpoint (#821) and `html-to-image`.
4. Drop `pixi8` from `package.json` once `src/lib/motion/gpu/*` (motion's old Pixi engine) is
   gone too: it is a separate user of the package.

# Shader library: first rows

First rows of a Feega-owned shader library, the seed of a future
open-source registry. All original GLSL, no ports.

- `packages/shader-fx/src/library/`: `ember-field` (particles), `voice-orb`
  (idle/thinking/speaking via `state` + `energy`). Each row is an
  `EffectInput` plus genre and a written description of the intended look.
- Three more (gradient, glass, wipe) were drafted and dropped on review.
- Rides the custom-effect contract (WebGL1, `effect(uv)`, typed params,
  lint), so a frame is a pure function of `u_time` and params.
- `effectStore` finds `library-<name>` before the org table and lists the
  library after the org's effects: the motion agent's `add_custom_effect`
  snapshots it into the doc, so preview and export render it. The project
  shelf endpoint lists them for the canvas effects editor.
- Cost at 1080p, M2 Pro (Metal ANGLE, `measure`): ember-field 4.5 ms,
  voice-orb 0.6 ms. All inside a 60 fps budget.
- `scripts/shader-library/`: headless Chromium harness on
  `@feega/shader-fx/gl`; determinism test and the still/MP4 renderer
  (`npx jiti scripts/shader-library/render.ts <dir> [name]`).

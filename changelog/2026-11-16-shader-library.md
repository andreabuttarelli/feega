# Shader library: first five

First rows of a Feega-owned shader library, the seed of a future
open-source registry. All original GLSL, no ports.

- `packages/shader-fx/src/library/`: `silk-drift` (gradient), `liquid-lens`
  (glass), `ember-field` (particles), `voice-orb` (idle/thinking/speaking via
  `state` + `energy`), `veil-wipe` (transition by `progress`). Each row is an
  `EffectInput` plus genre and a written description of the intended look.
- Rides the existing custom-effect contract (WebGL1, `effect(uv)`, typed
  params, lint), so the frame is a pure function of `u_time` and params.
- The project custom-effects shelf appends them as `library-<name>`, already
  passed: the canvas effects editor can apply them without an org row.
- Not done: the motion agent's add-shader path still looks effects up in the
  org table, so library rows reach motion clips only once copied there.
- `scripts/shader-library/`: headless Chromium harness on the real
  `@feega/shader-fx/gl` path; determinism test and the still/MP4 renderer
  (`npx jiti scripts/shader-library/render.ts <dir> [name]`).

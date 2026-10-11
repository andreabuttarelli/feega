# 3D performance guide for the motion agent, on demand

The prompt carried one line of three.js advice (`THREE_GUIDANCE`). A full checklist in every
prompt costs tokens on turns that never touch WebGL, so it is attached only when needed.

- `guides.ts`: one table `GUIDES` keyed by `GuideTopic` (today `3d-performance`), each with a
  `uses` pattern on the component js. `codeWrite` (write_component / patch_component) attaches
  `guide` the first time per turn a written source matches (`session.guides`), plus `warnings`
  from `lintAdvice`.
- Guide adapted to our engine: time from tl (no Clock, getDelta, rAF; `mixer.setTime`), one
  `three.renderer(canvas)` per component (each WebGL canvas is read back per frame, 16-context
  export budget in `webgl-budget.ts`), canvas sized to the layer box, pixel ratio left to the host,
  instancing, shared geometry/material, ≤3 lights, IBL via `set_look` presets, shadows sparingly,
  textures ≤2048, `renderer.compile`, no allocation in onUpdate, dispose in onDestroy, live mode
  pauses its loop.
- `lintAdvice` (`custom/lint.ts`, rule table `ADVICE`): non-blocking warnings for
  `new THREE.WebGLRenderer`, more than one renderer, `setPixelRatio`/`devicePixelRatio`, no
  `dispose`, shadow map with more than one casting light. `THREE.Clock` joins
  `FORBIDDEN_MEMBERS` as a clock rule: refused in deterministic mode, allowed live.
- Chose auto-attach over a `read_guide` tool: no extra round-trip, and the model cannot skip it.
  write_component is not exposed on MCP/CLI, so no parity change.
- Source: adapted from the MIT-licensed "Three.js Performance Optimization Checklist",
  freshtechbro/claudedesignskills (`plugins/bundles/core-3d-animation/skills/threejs-webgl/
  references/optimization_checklist.md`), © 2025 Claude Skills Project. Generic items dropped
  (LOD, Draco, render-on-demand, Clock.getDelta, mobile antialias toggles).
- Real local turn ("200 cubes orbiting a sphere", Sonnet, $0.27): guide arrived in the
  write_component result; the component used three.renderer, one InstancedMesh, Lambert, two
  lights, reused objects, matrixAutoUpdate=false and disposed in onDestroy; no warnings; check
  passed. Not applied: `renderer.compile`, sizing from the root box (hard-coded 1080×1920).

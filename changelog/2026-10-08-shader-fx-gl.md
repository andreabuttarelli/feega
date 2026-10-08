# `@feega/shader-fx/gl`: compile, draw, identity fallback

Ticket 1 of custom effects. One GL host for the canvas node, motion clips and server frames.

**On TWGL, not regl.** #290 pinned `twgl.js@7.0.0` (regl was dropped: it compiles with
`Function`, needing `unsafe-eval`). This package imports the same pinned npm module; the
component runtime keeps its own offline inlined bundle for sandboxed agent code. No second copy
is vendored.

**API.** `createRuntime(canvas)` → `null` without WebGL. `compile(rt, {frag, params})` →
program or `problems` (driver log). `draw(rt, compiled | null, source, {time, seed, values})`
— a `null` or failed program draws the passthrough, so a broken effect leaves the frame
unchanged instead of black. `drawEffect` = compile + draw + `passed`.

**Software GL cost (measured, open question 1).** Headless Chromium renders WebGL on
SwiftShader (`ANGLE … SwiftShader driver`) even without flags. 1080p, 30 draws, Apple M-series:

| Shader | default headless | `--use-angle=swiftshader` |
|---|---|---|
| grain (1 fetch + noise) | 10.1 ms | 25.3 ms |
| VHS (3 fetches, hash, noise, scanlines) | 13.5 ms | 21.7 ms |

So server frames/renders pay ~10–25 ms per custom-effect clip per 1080p frame, ~5× the GPU
budget of 4 ms. Budget kept in `tests/e2e/shader-fx.spec.ts`: `SOFTWARE_GL_BUDGET_MS = 60`
(headroom for slower CI runners).

**Tests.** Real GL only exists in a browser, and CI's unit step runs before Chromium is
installed, so the GL tests live in the Playwright tier (`tests/e2e/shader-fx.spec.ts`, no
page, bundle injected): bad GLSL → problems; passthrough returns input bytes; failing shader
leaves the frame unchanged; same time+seed → identical bytes; cost under budget.

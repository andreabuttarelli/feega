# Perf: the WebGL fallback is a wasm of its own

Before, one `gpu_core_bg.wasm` carried both renderers: vello compute (WebGPU) and vello_hybrid
(WebGL2, `web_gl.rs`, `gl_passes.rs`, `gl_reproject.rs`). Every WebGPU user downloaded the GL
path and never ran it.

Measured by building without it (twiggy alone can't attribute: the release wasm has no name
section):

| build | raw | brotli | gzip |
|---|---|---|---|
| both renderers | 1 990 509 | 443 528 | 608 363 |
| WebGPU only | 1 597 982 | 359 742 | 494 608 |
| GL share | 392 527 (19.7%) | 83 786 (18.9%) | 113 755 (18.7%) |

Now the cargo feature `webgl` gates those modules and the `vello_hybrid`/`vello_common` deps.
`npm run build:gpu-core` writes two builds into `static/gpu-core/`: `gpu_core` (WebGPU only) and
`gpu_core_gl` (both renderers, `--features webgl`). `scripts/gpu-core-version.mjs` versions both
(`CORE_VERSION`, `CORE_GL_VERSION`); `core-web.ts` keeps one loading promise per build:
`createCore` loads `gpu_core`, `createCoreGl` loads `gpu_core_gl`, `warmCore()` warms the one
`navigator.gpu` says will be used. The interactive export inlines `gpu_core_gl`, so a player
keeps its WebGL fallback. CI also builds `--features webgl`.

A browser without WebGPU downloads only the GL build, same size as before; a WebGPU canvas that falls back mid-session fetches it then.

Discarded: a GL-only wasm without the WebGPU renderer — the two share engine, world and scene
code, and the GL build would only drop vello's shaders; the fallback is rare enough that one
full build is simpler.

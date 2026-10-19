# gpu-core: the display list drawn natively by a Rust core

Step 6 of the gpu-full roadmap (ADR 0019), first increment. `packages/gpu-core` is a Rust crate
that reads the same display list `drawFrame` produces (JSON, one contract for both engines) and
draws it with Vello on wgpu — Metal here, Vulkan/D3D in the other native shells, WebGPU in the
browser in the next increment. `gpu-core-render <list.json> <out.png> …` renders headless.

Drawn now: paths with solid/linear/radial paint, the three fill rules, opacity and blend layers,
inside/outside stroke clipping. Named and skipped: images, blur, wipe scissor, masks/mattes,
effects, backdrop — the WebGL2 backend keeps drawing those until the core does.

`scripts/gpu-parity/core.ts` dumps the display lists of a parity doc, renders them with the
core and compares with the HTML frames the harness saved (same frame count).

| Kind | WebGL2 backend SSIM | Rust core SSIM | core pixels off |
|---|---|---|---|
| background | 1.0000 | 1.0000 | 0.00% |
| shapes | 0.9989 | 0.9992 | 0.22% |
| gradients | 0.9983 | 0.9984 | 0.10% |
| transforms | 0.9998 | 0.9999 | 0.07% |
| opacity | 0.9998 | 0.9998 | 0.07% |
| strokes | 0.9986 | 0.9985 | 0.44% |

The crate is not in CI yet (`cargo test` in `packages/gpu-core`, needs a GPU adapter).

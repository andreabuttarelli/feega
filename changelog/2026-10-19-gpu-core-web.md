# gpu-core runs in the browser on WebGPU (`?engine=gpu-core`)

Step 6, second increment (ADR 0019). The Rust core compiles to WebAssembly (`npm run
build:gpu-core`, output in `static/gpu-core/`, 2.3 MB, 525 KB gzipped) and draws the same display
list into a WebGPU canvas. `?engine=gpu-core` picks it in the preview; `?engine=gpu-full` keeps
the TypeScript WebGL2 backend, which still draws everything the core skips (pictures, masks,
effects, blur). Both sit behind `BACKENDS` in `gpu-full/backends.ts`.

The parity harness gains `--under=gpu-core`. Same numbers as the native build on the same
display lists, so one renderer gives the same pixels on the web and in the native shells:

| Kind | WebGPU core SSIM | native core SSIM |
|---|---|---|
| background | 1.0000 | 1.0000 |
| shapes | 0.9992 | 0.9992 |
| gradients | 0.9984 | 0.9984 |
| transforms | 0.9999 | 0.9999 |
| opacity | 0.9998 | 0.9998 |
| strokes | 0.9985 | 0.9985 |

Not yet: a WebGL2 path for the core (the hybrid sparse-strip renderer), images, masks, effects.
The wasm is committed because the deploy has no Rust toolchain.

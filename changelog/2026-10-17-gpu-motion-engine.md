# GPU motion engine, phase 1 (behind `?engine=gpu`)

Motion frames are drawn today by the browser rendering composed HTML, and the MP4 by capturing
that HTML (html-to-image) frame by frame. Phase 1 adds a hybrid GPU engine, one for preview and
export, on Pixi v8 (`pixi8`, WebGPU first, WebGL2 fallback).

- `src/lib/motion/gpu/scene.ts` compiles the composed HTML (parsed inert, no layout) into a
  scene and runs the **same** `motionEngine` timeline script against it: no forked easing or
  timing. Wrapper chains fold into one matrix (perspective → `PerspectiveMesh`).
- `SUPPORT` in `paint-of.ts` is the one table of what draws natively (Shape, Image, Video, Logo,
  BrandBackground) and what stays HTML. HTML clips are captured by today's engine in contiguous
  runs (`runs.ts`) and composited as textures; blended runs stay single so the GPU blends them.
- Editor preview: `?engine=gpu` overlays `GpuLayer.svelte` on the (hidden, still audible) player.
- `npm run bench:gpu-parity -- --doc=… --mode=parity|export|preview` renders both engines,
  reports SSIM/PSNR, side-by-side MP4, export and preview timings.

Discarded: a native doc→GPU compiler re-deriving vars/precomp flattening/junctions (a fork of
`composeHtml`); driving the scene from the live iframe DOM (keeps style recalc per frame).

No public changelog: invisible without the URL flag.

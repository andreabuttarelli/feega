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

## Phase 2

- Fallback runs are composed with only their clips (`composeHtml({ only })`), so a run no longer
  boots every 3D/particle/custom script. A doc goes to the HTML engine when two captures overlap
  or captures cover half its length: measured, those exported slower than today.
- Title/Text/Kicker/Caption are laid out once by the browser at rest (doc fonts, same `fitSize`)
  and rasterised once per line/block; line reveals and fades then run on the GPU at display rate.
- On the GPU too: gaussian-blur effects, brand background patterns, stroke overflow. Backdrop
  groups (LiquidBlob/Glass) stay one capture with everything they cover.
- Export with `?engine=gpu` at the doc's own size goes through `renderFrames`: runs shot ahead on
  lanes, the GPU draws in order into the WebCodecs encoder.
- Not done: masks, mattes, backdrop-filter, Adjustment, blend on a precomp group (all still an
  HTML capture). Server rendering dropped by decision (client only).

## Default

The GPU engine is now the default for the editor preview and the in-browser export.
`?engine=html` forces the old engine for one page; `PUBLIC_MOTION_ENGINE=html` or the PostHog
flag `motion-engine-html` force it for everyone. A doc the engine refuses, an interactive doc, an
export at another size, or any GPU failure during an export (redone from scratch on HTML via
`orFallback` in `renderInBrowser`) stays on the HTML engine. Real-stack e2e:
`tests/e2e/motion-gpu-export.spec.ts`.

## Back behind the flag (2026-10-18)

On real videos in Safari the GPU preview looked grainy and some animations differed from the
HTML engine; `?engine=html` looked right. The HTML engine is the default again; the GPU engine
runs only with `?engine=gpu` (the kill switch still forces HTML). The public changelog entry is
withdrawn until the GPU engine passes parity on real videos at preview size × DPR.

# Remove the PixiJS canvas renderer

## Why

The core renderer (`gpu-core`, vello in wasm) has been the default since 2026-10-21 and the Pixi
canvas (`?renderer=gpu|webgpu|webgl`) was only reachable by URL, kept as a comparison and as the
fallback when the core failed. It cost a second texture pipeline, a snapshot queue, a card-preview
upload and two shelves of hidden DOM in `GpuFlow`, all dead on the default path. ADR 0020 step F.

## Before

- `renderer-flag.ts` mapped `?renderer=` to `Renderer.Gpu` or `Renderer.Core`; the canvas page
  passed `core` to `GpuFlow`; the share page (`/s/[token]`) passed nothing and so drew with Pixi.
- `GpuFlow` mounted `GpuScene` (`scene.ts`, `chrome-layer.ts`, `texture-cache.ts`) and, when the
  core threw, switched itself to it.
- Pixi-only support: snapshot queue/cache and detail cells, poster shelf, upload queue, texture
  pins/LRU/decoder/bytes, bitmap worker, idle chrome, `/canvas-parity`.

## Now

- One renderer. `?renderer=` is not read: any old link (`webgpu`, `webgl`, `gpu`, `dom`) opens the
  core. The share page draws with the core too.
- A core failure shows "GPU renderer unavailable" instead of falling back.
- `memory-budget.ts` keeps only the texture budget and `previewHtml`.

## Kept

- `pixi8` and `pixi.js`/`@pixi/unsafe-eval`: the motion preview/export engine (`src/lib/motion/gpu`)
  and the in-video libs still use them. `html-to-image` stays for `text-layout`.
- `backend.ts` (shared with the motion engine), `frame-stats.ts` (perf harness reads it).
- `card-previews` route/table/loader: no longer fed by the canvas; removal needs its own change.
- `?renderer=` comparisons in `scripts/perf` and `scripts/bench`: now core against core.

## Tests

`renderer-switch.test.ts` fails if the canvas reads `?renderer=` or imports Pixi;
`canvas-legacy-renderer-param.spec.ts` opens the canvas with each legacy value and expects core.
The lost-context e2e test went with the fallback.

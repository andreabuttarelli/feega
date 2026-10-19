# Frames with older images draw live on the canvas

`motionSource` resolved a frame's assets from `motionAssets`, the 200 newest
of the project. The heavy canvas copy holds 1211: every frame whose images
or logo were older got no URL, `drawFrame` reported `component`/`text`, and
the core kept its poster — 8 of the 32 fallbacks on that canvas.

Ids the doc mentions but the library window misses are now read by id
(`namedAssets`, one `in` query). Raising the limit was discarded: the
library is also the editor's picker, and the next big project would hit
it again.

`scripts/gpu-parity/gap-histogram.ts` lists every frame's Unsupported
reasons on the heavy canvas and prints a histogram (`--why` dumps props).
Run with the main `.env`: `node --env-file=<.env> node_modules/vite-node/vite-node.mjs --config scripts/vite-node.config.ts scripts/gpu-parity/gap-histogram.ts`.

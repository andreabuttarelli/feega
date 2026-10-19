# Core canvas bench and image sizes

`scripts/bench/canvas-core.ts` reports full-paint time (`window.__gpuCanvas.settled`), image and
media request counts and preview uploads, takes `BENCH_RENDERERS` (default `gpu,core`, always
passed as `?renderer=`), and counts memory over every process the bench spawned (descendants of
its own pid) plus newly started browser processes by name — WebKit's XPC services are children
of launchd, so the name match stays.

Core cards fetched every image at `AssetSize.Full`; Pixi fetched 256 px far away and 1024 px
from zoom 0.75. `assetTier` applies the same rule to core cards. Videos on cards still preload
the whole file (`loadVideo`, `preload: 'auto'`) — the next over-fetch to remove. DOM reads of
custom frames run one at a time with a 60 s timeout each, so one hanging probe delays every
custom frame after it.

ADR 0020 carries the flip/delete steps A–F.

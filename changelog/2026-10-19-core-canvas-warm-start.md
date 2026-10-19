# The canvas renderer loads alongside the canvas data

`GpuFlow` was imported from an `$effect` of the canvas page, so its chunk and the core wasm
started only after the page data arrived and the page rendered. `+page.ts` `load` now starts
both (`warmRenderer`) in parallel with the data request; `warmCore` memoises the wasm load and
compile so `createCore`/`createCoreGl` reuse it.

Measured on the heavy copy with `scripts/bench/core-startup.local.ts`, prod build
(`vite preview`): the wasm request moves from after the data (~1.8 s) to ~0.56 s. What is left
before the first frame: the canvas API itself (1.2–1.7 s server time on the heavy canvas) and
the reveal gate (~1.4 s waiting for cards and frames). On the dev server the extra ~4 s is
Vite's unbundled module waterfall for `+page.svelte` and `GpuFlow`, not the renderer.

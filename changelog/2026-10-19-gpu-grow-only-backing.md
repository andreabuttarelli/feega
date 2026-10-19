# GPU canvas backing store only grows

Selecting a node hides the chat panel, deselecting shows it: the canvas surface goes
1116 ↔ 1396 px wide. Pixi's `resizeTo` reallocated the WebGL/WebGPU backing store on every
toggle — `resizeCanvas` was 56 ms self time in a Chrome profile of the ⌥-align step.

Now `GpuScene.resize` asks `grownBacking` and reallocates only when the surface outgrows the
current buffer; a smaller surface keeps it, and `.wrap { overflow: clip }` hides the excess.
`resizeTo` is gone, so Pixi no longer listens to window resize: the surface's ResizeObserver is
the only trigger.

Discarded: debouncing the resize (still one realloc per toggle, later).

Chrome, prod build, heavy canvas, median of 3 runs (p95 input→paint): ⌥-drag 114 → 67 ms,
align 50 → 45, move 68 → 61. WebKit unchanged within noise.

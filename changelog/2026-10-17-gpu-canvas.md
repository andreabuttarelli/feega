# The canvas draws on the GPU

Before: every node was a DOM subtree inside xyflow; 15 heavy nodes already made pan/zoom/drag stutter in real use, 200 nodes meant ~48k DOM nodes and 12 ms main-thread work per pan frame.

Now: `GpuFlow` (Pixi v8, WebGPU with automatic WebGL2 fallback) is the default canvas. It takes exactly `CanvasFlow`'s props, so the page keeps data, stores, actions, outbox and realtime. Frames, free elements and uploaded images are GPU textures; nodes with controls (generate, doc, sources, calendar…) mount their real DOM tile only while on screen and not far, the rest are GPU cards. A light DOM skeleton (`.svelte-flow__node` boxes with labels and ports) keeps hit targets, accessibility and the existing e2e selectors.

Escape hatches: `?renderer=dom`; `CANVAS_FORCE_DOM=1` or PostHog flag `canvas-force-dom` forces DOM for everyone (read server-side, cached 60 s); GPU init failure falls back to DOM.

Discarded: drawing every node type natively on the GPU (pixel parity with the DOM controls was not reachable; parity sheets in `feega-videos/webgpu-canvas/parity`), rasterising DOM tiles to textures (280 ms per shot, CORS-tainted thumbs).

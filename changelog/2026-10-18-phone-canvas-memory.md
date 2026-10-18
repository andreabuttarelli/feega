# GPU canvas: memory budget on phones

The heavy canvas (64 nodes, 41 motion frames) reloaded in a loop on iPhone Safari after the
WebGPU canvas became the default. Measured in Playwright WebKit with the iPhone 15 Pro
descriptor (DPR 3) and an in-app counter of GPU texture bytes (`window.__gpuCanvas.textures()`):
378 MB of textures, three of them 3574×3574 with mipmaps (68 MB each), GPU process ~1 GB.
Images outside the `canvas-assets` path are not resized by the server, and the texture cache
decoded them full size.

Now (`memory-budget.ts`, one table per device): a touch device decodes images to 512 px on
the long edge, renders at resolution ≤ 2 and without MSAA; the texture LRU budget is 128 MB
there, 256 MB on desktop (2048 px edge). After: 117 MB of textures, GPU process ~590 MB.

Not done: the LRU still pins every built card, not only the visible ones, so the budget does
not evict on a canvas larger than it; WebContent stays ~1 GB in this measurement even with
`?renderer=dom`, so that part is not the GPU canvas.

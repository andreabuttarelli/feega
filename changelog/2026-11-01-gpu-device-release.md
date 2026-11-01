# Disposed GPU rasters let go of their device

A canvas page on Windows Chrome reported `OperationError: A valid external Instance reference no
longer exists.` and became unusable (Code mode, then the Ledgerline 1440×4480 canvas with
breakpoint views). That text is Chrome's WebGPU connection to the GPU process dropping: crash,
reset or out of GPU memory. CDP `Browser.crashGpuProcess` reproduces it on macOS.

What was making it likely: wgpu's web backend does nothing on drop, so `WebCore.free()` left
its `GPUDevice` alive, with every buffer and texture, until garbage collection. The canvas makes a
new raster at each resize of its area (8 resizes, 8 live devices, 0 destroyed), and component
previews and core stills make one per use. On a GPU with little memory that ends in a GPU process
reset.

- `releaseOnDispose` (`gpu-release.ts`) captures the device the canvas context was configured
  with at attach and destroys it on dispose; it unconfigures the context only while it still
  holds that device, so a newer raster on the same canvas is left alone. After the fix: 8
  devices made, 7 destroyed, 1 alive.
- Rasters on their own canvas (`core-export.ts`) also lose their WebGL2 context, so the GL
  fallback no longer piles up contexts towards Chrome's limit, where the oldest (the canvas) is
  dropped.
- `CoreFrames` treats a throw while painting like a lost device and attaches again; after three
  losses on one backend it steps down to the next (`gpu-loss.ts`), instead of a frozen canvas.

Not reproduced: the exact Windows trigger in Code mode. On macOS, dev and production, Code mode
creates no extra device; the canvas recovers from a forced GPU process crash before and after.
Discarded: rebuilding `gpu-core` with a `Drop` that destroys the device (same effect, but a wasm
rebuild in a hotfix would carry unrelated Rust changes from dev into main).

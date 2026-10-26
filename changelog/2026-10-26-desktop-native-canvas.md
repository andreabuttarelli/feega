# Desktop app: native Metal canvas, opt-in

Spike #1332 drew gpu-core into an NSView behind a transparent window and
found no speed-up. This ports it into `apps/desktop/native` behind the
engine seam the web canvas already has (`rasterOf(Attached)`): a native
`Attached` (`core-native.ts`) forwards the same JSON command stream to
the addon through a preload bridge (`feegaNativeCanvas`).

- Opt-in: `FEEGA_NATIVE_CANVAS=1`, macOS only. Addon load failure or a
  rejected `attach` falls through `BACKENDS` to wasm.
- Render thread: QoS user-interactive, scratch texture pool, commands and
  camera coalesced, drawable acquired before the camera is read (the
  spike read the camera, then waited ~14 ms for a drawable).
- A surface texture that times out or is occluded skips the frame; the
  spike returned an error and stopped the thread for good.
- Page: ancestors of the canvas turn transparent while it is native; the
  dot grid is hidden (DOM sits above the native view).
- Discarded: shared-memory camera. The preload is sandboxed (cannot load
  an addon) and the render thread was never CPU bound (acquire wait
  ~800 ms/s, paint ~30 ms/s).
- Bench: `apps/desktop/bench` (`node bench/run.cjs --scene=<dir>`).

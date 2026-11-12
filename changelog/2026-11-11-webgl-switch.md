# The live canvas steps from WebGPU to WebGL, and says so

`CoreFrames` already re-attached after a lost device and, after `LOSSES_PER_BACKEND` (3) losses
on one backend, moved to the next one (native → WebGPU → WebGL) by remounting the canvas element
under `{#key backend:attempt}`: display lists, camera and selection live in JS, so nothing is
reloaded. Nobody could tell it happened.

Now every backend change goes through `switchTo`: under `?debug` it logs
`[gpu] backend webgpu -> webgl: <why>`, and it calls the new `onbackend` prop, which `GpuFlow`
sends to PostHog as `gpu_backend_fallback` `{ from, to, why }`. The server-side
`product-events` `track()` is not used: it runs only on the server, and this happens in the
browser. Backends are named (`GpuBackend`) instead of indexed functions.

`core-frames-backends.test.ts` simulates the loss: an attached WebGPU core whose `lost()` is
always true; after three attaches the next one is WebGL, on a fresh canvas, and one switch is
reported.

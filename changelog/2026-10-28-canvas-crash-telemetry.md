# Canvas crash telemetry

iPhone Safari kills the tab on fast pinch-zoom; the simulator has no WebGPU adapter and there is no Web Inspector at hand, so we had no numbers from the device.

Now, while a canvas is open:
- `gpu-probe.ts` wraps `GPUDevice.createTexture`, `GPUTexture.destroy`, `GPUQueue.submit` and wasm instantiation: live texture bytes/count, textures created, submits, GPU lag (one `onSubmittedWorkDone` in flight at a time), wasm memory. Counters only, no per-frame allocation.
- `crash-watch.ts` adds zoom, zoom/pan speed, frames since gesture start, zoom of last raster; `crash-record.ts` writes it to localStorage at most every 250 ms, with an "open" marker cleared on `pagehide` / `visibilitychange` hidden.
- next canvas load with the marker still set → POST `/api/v1/telemetry/crash` → Sentry `captureMessage('webcontent-crash-suspected')` (server side: the client's `beforeSend` drops internal viewers, and the reporter is internal) plus a `console.warn` line in Vercel runtime logs.
- `?coreDebug` HUD prints the same numbers on top.

No table: Sentry and runtime logs are enough for a handful of reports; no service-role use.

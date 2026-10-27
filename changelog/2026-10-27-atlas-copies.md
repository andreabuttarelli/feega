# Core canvas: stop re-copying pictures on every render

**Before.** `Engine` marked every drawn picture dirty before each vello render, so every strip
painted during a pan re-copied whole photos into vello's image atlas. A Chrome trace of the
panZoomed sweep at 4x throttle put 72% of long-frame time on an idle main thread waiting for
the GPU process; `Queue::Submit` took ~25 ms per heavy submit, and a Metal System Trace showed
blits (atlas copies) as most of Chrome's GPU time. JS (`changed`, chunking), GC and SipHash
together were under 15%.

**Why the marks existed.** vello 0.11 resolves a scene with no patches (no images, gradients or
glyphs) to a 0x0 atlas, which frees the atlas texture while its image cache still lists pictures
as resident. The next scene draws them from a blank atlas.

**Now.** `Engine` marks nothing per render. A patch-free scene gets an invisible gradient off
target, so it resolves against the real atlas and never frees it. A picture is recopied only when
`WebCore::picture` rewrites it (already marked there) or vello evicts or repacks it.
`Renderer::picture` (native) mirrors the web upload path so tests drive GPU pictures;
`Change::Unannounced` proves a picture is not recopied.

A first version kept the marks and only skipped pictures already copied; it lost pictures on the
web (LOD rasters baked from a blank atlas) and was replaced.

**Overlay.** A zoom step rebuilt every wire and chrome item and `SentOverlay` stringified all of
them. Zoom-free items are reused while their inputs hold; only items not sent before are
serialised. The resend itself (JSON into wasm, serde, hull) still costs ~100 ms when a zoom-
dependent item (hover ring) changes: splitting the overlay into a fixed and a live group is the
next step.

**Harness.** `scripts/perf` sweeps reported 0 frames under tsx (`__name` is undefined in the
page); a shim fixes it. A run now fails when the core falls back. `PERF_TRACE=1` writes Chrome traces of the zoom and panZoomed sweeps,
`trace-frames.ts` attributes long frames.

Not done: FxHash in `Groups::get`, chunking changes, `cardItems`/`layOut` memo. The trace put
them under the GPU wait; panZoomed holds 57+ fps p5 at x4 without them.

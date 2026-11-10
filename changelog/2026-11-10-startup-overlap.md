# Canvas sources fetched with page data

Frame sources were requested only after the lazy GPU renderer chunk mounted
CoreFrames. The page load now computes on-screen frames from page data and
saved viewport (`earlySourceUrls`) and warms `frameSources`, so the fetch
overlaps the renderer chunk and wasm. URLs match CoreFrames' reads, so the
warmed responses are reused. Startup marks (`startup-marks.ts`) measure the
waterfall in `canvas-load-bench`. Font `warm()` added, not yet called.

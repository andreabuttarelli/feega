# Phones leave unreadable frames unbuilt

Signal: the owner's iPhone and iPad kill the canvas tab on the first pan or
zoom. The crash record (#2121) showed a pure pan at zoom 0.05 with only 160 MB
of tracked textures, so the gesture was the last straw, not the cause.

Measured on the iOS 26.5 simulator (iPhone 17 Pro, Safari, `landings.feega` in
local mode, `footprint` of the WebContent process at rest, MiB):

| state | footprint |
|---|---|
| empty canvas (shell only) | 156 |
| landings at fit zoom, before | 945–992 (6 runs) |
| without breakpoint views (probe) | 761 |
| without the doc text cache (probe) | 880 |
| engine not attached (probe) | 796 |
| no media decode (probe) | 932 |
| no thumbnails / no DOM reads / worker killed (probes) | 967–973, innocent |
| after this change, fit zoom, first open / reopen | 193 / 207 |

Most of the 950 MB was JavaScript: every frame and every breakpoint view was
built at open, whatever the zoom, and JSC holds a parsed doc at ~3.3x its JSON
text (12.8 MB of docs became 42 MB of footprint in a calibration run).

Changes:

- `frameBuilder` no longer keeps each doc's JSON text (72 MB on the fixture).
  It saved a re-stringify on an asset-tier rebuild, but tier changes swap image
  URLs in the built list (`retier`) and no longer rebuild.
- The device budget has `readableWidth`: on a phone a frame drawn narrower than
  160 CSS px is neither warmed nor built; it shows its thumbnail or poster until
  a zoom makes it readable (checked on the cache zoom step, so a pan costs
  nothing). Desktop's width is 0.
- The canvas fit runs in a pre effect declared at the end of `GpuFlow`'s
  script, so CoreFrames' first build pass sees the fitted zoom, not the initial
  1 (which built three frames and their views before the fit landed).
- After a session that never reached `pagehide`, the saved viewport is ignored
  and the canvas opens fitted, with one line saying why.

Cost: on a phone, a canvas zoomed out shows thumbnails, or white posters for
frames never built on that device and without a server poster, and breakpoint
views appear only once their frame is built. Zoomed in, a phone still holds
every frame it has built: this does not bound memory while exploring.

Not changed: vello's fixed WebGPU bump buffers (176 MB, `vello_encoding`
`BufferSizes`) — the simulator runs the WebGL core, so they are absent from
these numbers and present on a WebGPU iPhone.

Playwright WebKit (iPhone profile) agrees: 1126–1384 MB at rest before,
234 after; zoomed in 6x so all 18 frames build, ~1 GB either way.

Guard: `npm run perf:phone-guard` now fails when a phone profile holds more
than 450 MB (iPad 600) at rest on the fitted canvas, and zooms in before the
pan check so that check still measures built frames.

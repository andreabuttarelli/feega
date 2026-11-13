# Phones draw far frames from snapshots and keep a bounded set built

Signal: the owner's iPhone and iPad kill the canvas tab on the first pan or
zoom. The crash record (#2121) showed a pure pan at zoom 0.05 with only 160 MB
of tracked textures: the gesture was the last straw, not the cause.

Attribution (iOS 26.5 simulator, iPhone 17 Pro, Safari, `landings.feega` in
local mode, `footprint` of the WebContent process, MiB):

| state | footprint |
|---|---|
| empty canvas (shell only) | 156 |
| landings at fit zoom, before | 945–992 (6 runs) |
| without breakpoint views (probe) | 761 |
| without the doc text cache (probe) | 880 |
| engine not attached (probe) | 796 |
| no media decode (probe) | 932 |
| no thumbnails / no DOM reads / worker killed (probes) | 967–973, innocent |
| nothing built (probe) | 193 |

Most of the 950 MB was JavaScript: every frame and every breakpoint view was
built at open whatever the zoom, and JSC holds a parsed doc at ~3.3x its JSON
text. The frame worker kept the last doc it built (~260 MB in Playwright
WebKit).

Changes, all phone rows of `BUDGET` (desktop builds everything, as before):

- `frameBuilder` keeps no JSON text of the docs it sends (72 MB on the fixture).
- `readableWidth` (160 CSS px): a frame drawn narrower is not built. It shows a
  snapshot. Where none exists yet, a background pass makes one, one frame at a
  time, nearest first, paused during gestures: the worker fetches the source,
  builds the frame and its breakpoint views and hands back the lists; the page
  draws each into a snapshot (the core's `poster` on WebGPU, a small GL core on
  WebGL), stores it in the thumbnail store, and lets the lists, the decoded
  pictures and the worker go. Breakpoint views keep their place beside the
  frame (`view-shots.ts`), so they are drawn from their snapshots too.
- Until a snapshot is ready a frame stands in as a tinted page with its title
  (`Stand.Pending`), and a server poster without an image is not drawn: no more
  white rectangles.
- `builtBytes` (64 MB, estimated as display items × 64 KB): past it, frames off
  screen go back to their snapshot — lists, doc, views, pickers, decoded
  pictures and engine groups are released (`sendBack` → `onevict`). Phones
  build only frames on screen.
- Idle frame workers are terminated on phones.
- The canvas fit runs before CoreFrames builds, so the first pass sees the
  fitted zoom; after a session that died without `pagehide`, the canvas opens
  fitted, with one line saying why.

Results: see the PR. Cost: a frame far away or zoomed out is a snapshot, not
vectors; panning to a frame shows its snapshot for the moment its build takes.
Server posters are still written only by a client that drew the frame or by
the editor; code- and URL-imported frames start without one.

Not changed: vello's fixed WebGPU bump buffers (176 MB) — handoff note in
`docs/specs/vello-bump-buffers-per-device.md`.

Guard: `npm run perf:phone-guard` fails on the resting footprint, the peak of
opening (snapshot pass included), and the footprint after a tour across every
frame.

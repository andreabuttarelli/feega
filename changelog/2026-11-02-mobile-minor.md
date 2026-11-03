# Mobile case study minor findings: frame key, zoom keys, space pan, new canvas, pen ink

From `~/Documents/feega-videos/audit/case-mobile/FINDINGS.md` (minor list).

- **F is the frame tool.** A bare `F` binding (`src/lib/motion/shortcuts.ts`) arms `DrawTool.Frame`
  in Design and Motion; `⇧F` still works. The help card lists `F`.
- **Zoom keys agreed.** The View menu read its keys with the first binding of each command, so it
  printed `⌘0` / `⌘1`, which the canvas never listens to, with fit and 100% swapped against the
  help card. `ZOOM_ITEMS` now takes the shift binding (`⇧1` fit, `⇧0` 100%, `⇧2` selection) and a
  test checks each label against `matchCanvasShortcut`.
- **Zoom readout.** `zoomLevel` (`view-menu.svelte.ts`) is fed by `GpuFlow` and shown in the View
  menu as a percentage.
- **Space-drag 1:1.** The pan itself was 1:1; the 2.2× came from the fling glide started on
  release, which a fast mouse drag fed with a high velocity. `glidesAfterPan` keeps the glide for
  touch only, as in Figma.
- **New canvas in an existing project.** The `project` action (`dashboard/pages/home.ts`) takes an
  optional `projectId`: the canvas is created there (through `toolScope`, which checks the
  project is reachable) instead of in a new project, so it shows in that project's Pages.
  `NewCanvasButton.svelte` adds the project list on home and Canvases.
- **Pen ink.** `#1732` fixed the colour of a stroked pen path but left the width at the schema
  default (1% of the frame side) and the FrameTools pen path unpainted. `penInk` gives every pen
  path in a frame a black 1 px stroke and no fill.

Not done: feature video (fixes only).

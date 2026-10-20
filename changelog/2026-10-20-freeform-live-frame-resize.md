# Frames resize freeform and live

Dragging a frame edge or corner, or typing W/H, now sets exactly that width x height, any ratio.

Causes of the old behaviour:

- `customSize` (`src/lib/motion/custom-size.ts`) scaled the node box up to fill 1920 / 1080 (the
  video caps), so a 500x300 node became a 1800x1080 doc. It now keeps the node pixels and only
  shrinks proportionally past the video caps; stills take any size up to the design range.
- A frame in a preset format was `Sizing.Fixed` (`motion-node.ts`): only the width was applied and
  the height followed the doc aspect, and `sizeFrame` refused preset frames (409
  `preset_format`). Frames are now always free; `heightFollowsDoc` only keeps the node box in step
  when a preset is picked in the inspector.
- Because a preset resize never touched the doc, `withConstraints` never ran: the frame content was
  just zoomed with the node. Free sizing goes through `fitToNode` -> `resizeFrame`, so pinned
  elements stay pinned.

Live: `GpuFlow` (and `CanvasTile` in the DOM renderer) report the box on every move through
`onLive`; the page throttles to one frame and hands `fitToNode(doc, picture)` to the open editor
(`VideoSide.preview` -> `previewDoc`). Release commits one `edit` (one undo step) and clears the
preview.

Not live: frames that are not open in the inline editor have no doc in the page; they still
re-layout on release.

Still true: an element with no `constraints` scales with the frame (`constrained()` returns it
untouched, so its fractional props scale). Left as is; only new elements default to Left+Top.

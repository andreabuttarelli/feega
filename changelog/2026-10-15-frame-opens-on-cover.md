# A frame opened on the canvas starts on its cover frame, not frame 0

Selecting a frame on the canvas opens the editor in the node. The editor started at frame 0, and
almost every template enters there: a Title's lines start at `yPercent: 105` under an
`overflow: hidden` mask, Text fades from opacity 0. So the node went from its poster to a black box
the moment it was clicked, on Chromium and WebKit, desktop and phone (`canvas-motion-inline`:
"the title draws inside the node, not a black box"). A still pinned to a frame was not affected.

Since 39928f6c1 (#502) a node without a stored poster also captured it at frame 0, so new nodes
showed black even closed.

`coverFrame(doc)` (`still.ts`) is the one rule: the pinned frame of a still, otherwise the middle of
the video. `MOUNT[Mount.Canvas].opensAt = OpensAt.Cover` opens the inline editor there; the full
page keeps `OpensAt.Start`. Poster capture in `MotionNode` uses the same frame.

Not changed: posters already stored at frame 0 stay until the doc changes. On a phone the tools bar
and timeline still cover most of the opened node; that is the next fix (same spec, "the add bar
never covers the edited frame").

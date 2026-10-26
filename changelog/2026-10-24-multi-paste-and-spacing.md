# Paste into several frames, spacing field

SE-08 and SE-10 (partial) of the parity roadmap.

- `pasteTargets` replaces `pasteIntoFrame`: every selected frame that takes drops, not only a
  lone one. With copied elements and 2+ frames selected, each element is pasted into each frame
  (`copyElement` once per pair, centred). One frame selected keeps the old behaviour.
- `gapOf` reads the gap a selection shares; `distributeSpace` (exact gap, from #1236) sets it. Multi
  inspector: a "Spacing" section with H and V fields, Mixed when the gaps differ, Design mode
  (props, not keys). The MCP side is `spacing` on `arrange_space`, already there.
- Not done: the on-canvas equal-gap handles, reorder and swap of smart selection. The field
  covers respacing; dragging the gap on the canvas needs an overlay in `FrameSelection`.

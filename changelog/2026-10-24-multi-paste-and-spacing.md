# Paste into several frames, spacing field

SE-08 and SE-10 (partial) of the parity roadmap.

- `pasteTargets` replaces `pasteIntoFrame`: every selected frame that takes drops, not only a
  lone one. With copied elements and 2+ frames selected, each element is pasted into each frame
  (`copyElement` once per pair, centred). One frame selected keeps the old behaviour.
- `distributeSpace` takes an optional gap in px (first clip fixed, 2+ clips) and `gapOf` reads the
  gap a selection shares. Multi inspector: a "Spacing" section with H and V fields, Mixed when
  the gaps differ. MCP: `gap` on `arrange_space`. The edit is Design mode (props, not keys).
- Not done: the on-canvas equal-gap handles, reorder and swap of smart selection. The field
  covers respacing; dragging the gap on the canvas needs an overlay in `FrameSelection`.

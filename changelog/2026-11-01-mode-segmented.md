# Mode switch as a segmented control, on the right

The Design/Motion/Play/Code switch was four tool-looking buttons at the left of the bottom bar. It is
now the shared `SegmentedControl` (recessed track, raised thumb sliding with an expo ease) at the
right end, after the tools. The thumb lives in the shared component, so its other users get it too.

The zoom percentage is gone from the bar; fit, 100% and selection zoom moved into the View menu.

Each mode carries an `accent` in `MODES`; `paint` writes `--ui-mode-*` tokens on the root, which
drive focus ring, selected wash, accent text and the playhead. Selection outlines keep `--ui-accent`.
Discarded: a second control for the bar; a per-component accent prop.

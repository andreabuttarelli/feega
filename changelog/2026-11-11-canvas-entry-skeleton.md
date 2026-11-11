# Canvas entry skeleton renders the real chrome

`CanvasEntryShimmer` was a hand-drawn copy: square boxes, a white page, a chat column always
open, a five-button add bar. When the canvas landed every piece moved.

It now mounts the real `CanvasTopBar`, `FloatingRail` and `CanvasAddBar` inert, on the
`--ui-canvas` dot grid. Only data-dependent text (project name, credits) is masked with a
fixed-width block; the chat panel shows only if the saved preference has it open. The two
cannot drift because they are the same components.

`tests/e2e/canvas-entry-skeleton.spec.ts` (`@real`) slows the canvas data load and compares the
skeleton and loaded boxes of top bar, rail and add bar.

Discarded: shared layout constants for a hand-drawn copy — still two renderings to keep aligned.

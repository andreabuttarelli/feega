# A free element's tile is never blank

After #677 a deselected shape went transparent for ~1 s (the tile mounted a capture player that
boots blank), and on reopen the tile showed nothing while `/session` loaded. Measured with
`tests/e2e/canvas-tile-never-blank.spec.ts` (per-animation-frame check over select → recolour →
deselect, twice): 149 / 191 blank frames before, 0 after.

- **Handover on close.** `NodeMode.Leaving` (`tileMode`, `editorOn` in `inline-motion.ts`): the
  closed frame's editor stays mounted, with only its stage visible and no pointer events
  (`InlineMotionEditor` `leaving`), while the tile draws its own picture under it. The tile calls
  `inlineStage.landed` once its poster is decoded or its own player has drawn (`DRAWN_EVENT`);
  `LEAVE_CAP_MS` (3 s) caps the wait. Another frame selected meanwhile opens after the handover.
- **Swap without a gap.** `MotionNode` keeps the last decoded poster (`shownPoster`) on screen
  until the next one has decoded, and under its own player until that player has drawn. A
  captured still is decoded before it replaces the player.

Discarded: rendering simple elements as SVG on the tile (option a) — the tile has no doc, only
node data, so it would need a second renderer kept in sync with the player.

Known: while the next poster loads, the tile can show the previous revision's picture for a
moment (never blank).

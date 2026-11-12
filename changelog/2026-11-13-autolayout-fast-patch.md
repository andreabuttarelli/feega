# Hide and move inside auto layout drawn in one frame

Before: `fastPatch` declined a hide when any ancestor was auto layout, and a move unless every
ancestor was free of it. Imported pages are stacks of auto layout, so on the landings fixture it
patched 36 of 3,789 hides and 45 of 11,349 moves, and 32 of those 81 differed from the full
build. Everything else waited for the worker rebuild (hide p50 74–83 ms, nudge 56–78 ms).

Now hide and move go through one diff of laid clips:

- A move changes only `transform`, which layout ignores, so no layout runs: the moved clip and
  its subtree slide.
- A hide whose parent is auto layout re-lays that container alone (`relaidWithin` in
  `layout/resolve.ts`): its non-hug axes are held at the size the full layout gave it, its hug
  axes are laid again. The full layout of the doc before the edit is computed at idle once a
  rebuild lands (`readyPatch`, with the shaped-text measure of the frame's fonts) and carried
  edit to edit after each accepted patch, so consecutive edits never lay the whole page.
- Every clip whose laid box only slid is shifted in the held list; `filters` origins move only
  with the transform part, as `worldAt` does.

What the patch declines is one table, `UNPATCHABLE`, next to the diff: a clip that resizes (a
hugging container that shrinks, text that rewraps), any change besides position, a comp
instance, animated position, a move under a rotated or scaled ancestor, hiding a parent (its
children are orphaned, not hidden), and an absolute item in the re-laid container (the
container laid alone places it differently from the full layout). Items decline too when their
clip has its own mask, a scissor, or a cut from a clipping frame that slid, or when they belong
to an instance whose host slid. The rebuild still runs and replaces the patch.

Gate: `fast-patch.landings.test.ts` hides and moves (three offsets) every visible clip of the
landings fixture and compares with the full build within 0.01 px; it is skipped where the
fixture is absent, so not in CI. Result: 1,767 of 3,789 hides and 10,452 of 11,349 moves
patched, zero mismatches. Main-thread cost of a patch in node: hide p50 1.3 ms, move p50 1.9 ms.

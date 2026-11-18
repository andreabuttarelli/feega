# Canvas: patch phase marks; the patch's real cost was a quadratic id scan

Three PRs of layout work did not move hide/resize. Phase marks (`performance.measure`, names
`patch:*`, collected per edit kind by `canvas-frame-budget` into `edit-phases-landings.json`)
showed why, on the landings bench (desktop):

| phase | resize p50 | hide p50 | colour p50 |
|---|---|---|---|
| layout (root / near) | 1.4 | 1.5 | 1.3 (near) |
| mini draw | 1.5 | 1.6 | 0.6 |
| whole patch (`patch:total:patched`) | 36.4 | 42.6 | 33.1 |

Layout and drawing were ~3 ms of a ~35 ms patch. Timing the rest in node on the biggest landings
doc (2125 clips) left ~28 ms unaccounted for, in `laidIncrementally`: the removed clips were found
with `old.filter((c) => !now.some(...))`, one scan of every clip per clip. It is a set lookup now.

- Paths seen: resize and hide take the root layout path (`patch:layout:root`), colour the near
  path; hide was mostly sent to the worker by the budget (`patch:total:budget`) because of the
  quadratic cost, not because of layout.

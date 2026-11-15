# Canvas: a reflow slides the clips it only pushes along

A redraw patch drew again every clip whose laid props changed plus all their descendants: on a
landing section a hide or resize redrew dozens of clips with real fonts, so the patch budget sent
those edits back to the worker.

- `subtreeRedrawn` now keeps the shown items of a clip whose laid props changed only in `x`/`y`
  (same transform, items without masks, matte or scissor) and shifts their matrices by the move.
  Only the edited clip (and its subtree), clips that changed size or style, and the subtree of a
  slid clip that clips or masks its content are drawn again.
- A filter's `origin` stays put when a clip slides: it is the world origin of the parent, which
  the reflow did not move.
- Fixture check: resize 508/527, hide 507/530, show 507/530, colour 75/102 patched, 0 mismatches.

## Layout stops at the nearest unchanged container

Sliding did not move the numbers: the landings frame has one root tree (the whole page), so the
incremental layout still laid out the page on every edit.

- `relaidBelow` (`resolve.ts`): lays out one container's subtree with the container held at its
  laid box, with instance content and nested absolute roots (`boxesOf` over the subtree).
- `relaidNear`: walks up from the edited clip to the first fixed-size, non-absolute auto-layout
  container whose box the relayout leaves unchanged, and stops there; it gives up (whole root
  tree) when the subtree holds an absolute child, whose carried shift depends on layout outside.
- The parity check now allows 1e-5 of the doc size (≤0.15 px on the 14 542 px landings page):
  the whole-doc layout and the local one round centre positions through different float paths
  (`0.023931` vs `0.0239307412`). With that tolerance: 1617 edits, 0 mismatches.

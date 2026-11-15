# Canvas: the redraw patch lays out only the edited root tree

A redraw patch (resize, hide, show, colour inside auto layout) laid out the whole doc with real
fonts on every edit, ~165 ms on a landings section, so #2189 sent those edits back to the worker.

- `laidSubtree` (`packages/motion-core/src/motion/layout/resolve.ts`): lays out one root tree
  (a clip with no parent and everything under it) with the same placer and instance content as
  `withAutoLayout`. Root trees never depend on each other, so the result is the whole-doc layout
  for those clips. Laid comps are cached per `doc.comps` object.
- `laidIncrementally` (`fast-patch.ts`): starts from the previous exact layout and relays out
  only the root trees an edit touched (in the doc before and after). Its result is stored as the
  exact layout of the edited doc, so the next edit starts from it.
- Guard: `fast-patch.landings.test.ts` compares it with `withAutoLayout` for hide, show and resize
  of every 7th clip of the landings fixture (1617 edits): 0 mismatches, byte for byte.
- #2189's attempt failed only because it took `ancestorsOf(...).at(-1)` as the root; the chain is
  root first, so that was the parent.
- Dirty flags that stop below the root were not added: a root tree is the smallest unit the
  layout can redo exactly with instance content (`relaidWithin` lays out without it).
- Text measures are cached per props object as well as per serialised props: an unchanged clip
  keeps its props object across edits, so it is measured without `JSON.stringify`.
- Colour p95 on desktop is the first colour edit after selecting the layer: it is not patched and
  goes to the worker (~115–190 ms); the next nine patch at 25–32 ms. Cause not found.

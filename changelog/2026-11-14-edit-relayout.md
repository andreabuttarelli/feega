# Canvas: resize and hide inside auto layout patch on the main thread

After #2177 a resize or hide inside an auto-layout parent still waited for the worker to rebuild
the whole frame (~80–95 ms on landings), because `fastPatch` only redrew clips with no
auto-layout ancestor.

- `subtreeRedrawn` (`src/lib/canvas/core/fast-patch.ts`): lays out the edited doc on the main
  thread (`withAutoLayout`, cached per doc and carried to the next edit), diffs every laid clip
  against the shown doc, and redraws only the clips whose laid props changed plus their
  descendants: `drawFrame` of a doc holding just those clips, their ancestors and the surface,
  with `autoLayout` removed so the laid geometry is drawn as is. Each clip's items replace its old
  run in the shown list. It declines for matte pairs, precomps, or a clip that had no items.
  Tried first: relaying out only the parent chain (`relaidWithin`). It mismatched the full build
  on landings (a 0.5 px shift outside the relaid container), so the whole layout is redone.
- The fixture check (`fast-patch.landings.test.ts`) compares the patch with `drawFrame` of the
  edited doc for every 7th clip: resize 318/527 patched, hide 423/530, 0 mismatches.
- First edit of a frame: the loaded list and its doc seed the patch state, so the first edit no
  longer waits for a full build to have something to patch.
- The redraw gets the frame's real typeset (fonts + smoothing), not the estimate.
- Spec: a `colour` kind (the fill's eye toggle, from the Properties tab; a keyframe kind was dropped:
  design mode shows no keyframe button to drive), `BUDGET_EDIT_PAUSE`
  between edits so a 4x throttled run is not polluted by the previous edit.
- A resize drag rewrites `layoutItem` and the children's props by their constraints, so it never
  matched the one-clip patch: edits that change only `props`/`layoutItem` of any number of clips
  now take the relayout redraw.

Landings, desktop, input → first changed pixel p50/p95 (ms), before → after: resize 123/134 →
6/8 (the drag preview; the patched list lands at ~67 ms p50), hide 79/90 → 18/48, colour 141/191
→ 98/157, nudge/opacity/leaf unchanged (~23/16 ms). Hide still rebuilds on every unhide, colour on
edits the patch declines. Details and the 4x table in PR.

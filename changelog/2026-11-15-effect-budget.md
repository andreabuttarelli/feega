# Canvas: the hide "effect" was a cold full layout; strikes expire; near relayout removed

Three commits.

1. **Near relayout removed.** `laidNear`, `relaidBelow` and the hug shift go: the root-tree
   layout costs ~1 ms on landings (phase marks, #2197), so they saved about a millisecond.
   `laidSubtree` and the parity test stay. Fixture checks unchanged (0 mismatches).
2. **Strikes expire.** The first patch of a layer (cold layout) does not count, a fast patch
   clears the layer's strikes, and strikes older than 2 s are forgotten. Patches tried without a
   redraw no longer feed the budget.
3. **The ~57 ms effect.** Marks between input and patch (`edit:*`, `patch:*`) on the landings
   bench: for a hide, `session.apply` → `port.show` took ~300 ms, of which the patch itself is
   ~20 ms when warm. The rest was the hide path's carried layout (`laid(before)`): it had no
   entry for a doc produced by a redraw patch, so it laid out the whole page with real fonts on
   every hide. `laid` now reuses the exact layout of that doc. The worker request
   serialisation (`sourceText`, ~3.5 ms) and `showLive` (~0.1 ms) were measured and are small.
   - The trace marks are recorded only when `globalThis.__editTrace` is set (the perf spec sets
     it): unconditional `performance.measure` calls would pile up entries for the whole session.

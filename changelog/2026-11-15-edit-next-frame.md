# Canvas: unhide, instances and colour patch; less JS between key and patch

Follow-up to #2182.

- Unhide patches: `fastPatch` gains `Edit.Show`. A re-shown clip's items are inserted before the
  next clip in draw order that has items (or after the previous one), matched also through
  instance items (`host__0__child`). New gaps of re-shown clips are placed by draw order.
- Precomp instances no longer block the relayout redraw: item runs match host-prefixed clip ids.
  This was why colour edits on landings patched 3–4/10: almost every section holds an instance.
  Fixture check (every 7th clip): resize 527→508, hide 500, show 500 of 530, colour 75/102,
  0 mismatches.
- The layout diff uses an exact layout per doc (`exactLaid`), never one carried from an earlier
  patch: a hide → show sequence mismatched on the carried one.
- A reflow that would redraw more than 48 clips goes to the worker: hiding a whole section took
  ~160 ms on the main thread, longer than the worker build.
- `diffDoc` skipped nothing: every field of every clip was JSON-compared on each edit. Clips and
  values that are the same object are now skipped (282 → <12 stringify calls on a 2-clip doc).
- Breakpoint views resolve after the edit's frame has painted (`paintThenIdle`), not in the first
  idle slot, which could come before it.
- Profiling: `~/Documents/feega-videos/perf/edit-latency/profile-windows.mjs` sums self time per
  function in a window after each input of a `BUDGET_PROFILE=1` run.

# A patched edit re-encodes only what changed

A fast-patched edit (hide, nudge, opacity) re-encoded every vello run after the first changed
item: `Encoded::reusing` kept only the runs before the splice. Hiding the nav re-encoded the
whole page (~9 ms of a 10–15 ms engine frame on the landings fixture).

- `Kept` now carries the splice's `tail`. After the changed span, encoding stops at the first run
  start that maps onto a run start of the old encoding and appends the old runs from there.
- Runs store their length, not an absolute end, so a shifted run is reused as is.
- Run boundaries were fixed counts (16 items), so deleting one item shifted every later boundary
  and nothing after it could be reused. A run now also ends after an item whose bounds hash to a
  cut (1 in 16), still capped at 16 items: boundaries follow content, so they resynchronise a few
  items after any insert or delete. Runs are shorter on average (~10 items instead of 16).
- The result is the same encoding a full re-encode gives: `tests/patch.rs` compares bytes.

Discarded: reusing the tail with fixed-count runs (no reuse after any hide); re-basing old
encodings by index (the greedy chunker depends only on items from a run's start, so a matching
start is the correct and sufficient check).

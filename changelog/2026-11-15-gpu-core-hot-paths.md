# gpu-core: two hot paths stop redoing work

A 4x-throttled zoom profile of the landings wall showed two costs that grow with
the canvas without producing anything new:

- **Overlay re-encoded whole on every set.** `Library::put_group` forgot the
  previous cast, so each `set_overlay` re-encoded every overlay item with vello
  (~1.5 s of the profile, under `overlay_at → plan_with → pieces_of`). It now
  seeds the new cast with the old one, as `patch_group` already did: unchanged
  prefix and tail runs are kept. Re-putting identical content now keeps the
  encoding; `the_encoding_survives_a_zoom_and_dies_with_an_edit` was changed to
  edit for real.
- **Layer cache keyed by `format!("{:?}", item)`.** Up to 1000 points formatted
  into a string on every recall and remember, and every key cloned on every
  sweep. The key is now a 128-bit hash streamed from the same text
  (`layer_key.rs`): no string, no per-frame clones.

Left alone: the overlay JSON parse through `serde_json::Value` (boundary work,
owned by the TS↔wasm audit; a RawValue rewrite cut it from 34 to 15
allocations per item).

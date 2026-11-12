# Canvas: dragging a frame no longer resends the whole overlay

A Chrome trace (CPU sampling, wasm names kept) of the budget bench's frame drag on the heavy
canvas put two costs on top of `WebCore::frame`:

- `setOverlay` ~670 ms per 4 s drag: every pointer move rebuilt the fixed overlay (wires and
  chrome of every node), `JSON.stringify`'d it and serde-parsed it in `set_overlay`, then
  replanned the `overlay:fixed` group. Only the dragged node's chrome had changed.
- `Reprojector::tile_uniforms` ~570 ms: two `Vec<u8>` per tile and a byte-by-byte `flat_map`
  collect, slow at `opt-level = "s"`.

The overlay has a third part, `selected`, between fixed and live: chrome of selected nodes and
wires touching them. Moving a selection leaves the fixed part's reference unchanged, so it is
not sent. `tile_slots` fills one zeroed buffer of 256-byte slots in place.

Selected chrome now draws above unselected chrome instead of in node order.

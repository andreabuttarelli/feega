# Canvas: shadows under 2 device pixels are skipped

At fit view most imported shadows shrink below a pixel, yet each still ran its blur and shadow
pass over the whole layer. Following Penpot (`shapes/shadows.rs`), a CSS `drop-shadow` or an
effect drop/inner shadow whose extent on screen — `max(blur, spread) × scale + |offset|` — is under
`MIN_SHADOW_DEVICE_PX` (2) is dropped: no passes, and no reach inflating the layer. The check lives
in `filters.rs` next to where the shadow graphs are recognised; the scale is the item's `space`,
which already carries zoom and pixel ratio.

Tests: `tests/shadow_lod.rs` (no passes and no reach at fit, passes at 1:1).

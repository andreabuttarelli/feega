# ⌥ measures distances

With a layer selected, hold ⌥ over another to see the
distances. `measureGaps` (`motion/measure-gaps.ts`) is the one rule: side by side or stacked →
the gap through the shared band (else from the selection centre); one inside the other → the
four distances to the outer edges.

- Frame: `SelectionOverlay` draws them with the existing gap lines and labels while ⌥ is held
  and another layer is hovered.
- Canvas: `tileGaps` (`canvas/measure.ts`) measures from the box around the selection to the
  hovered tile. `MeasureLayer.svelte` draws in canvas units, renderer-agnostic like
  `PeerLayer`; `CanvasMeasure` mounts it in the SvelteFlow viewport. The GPU renderer mounts
  `MeasureLayer` in its own transformed layer with the same gaps.
- Nothing is saved: view-only, no parity tool.

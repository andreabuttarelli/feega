# Canvas: the chrome overlay is not rebuilt at every stroke-zoom step

Measured with `tests/perf/camera-tick-bench.spec.ts` on the zoom fixture, the top JS cost of a zoom
was `chrome.ts` shifting and scaling label glyph contours: ~125k + 88k calls per wheel tick.

- Every chrome tile built in `GpuFlow.svelte` carries `strokeZoom` (16 steps an octave), and
  `world-overlay.ts` cached a tile's items keyed on the whole tile, so each step rebuilt the label,
  tag and ports of every frame. Only rings and handles depend on it. The cache now keeps a tile's
  labels and ports (`chrome:<id>`, keyed without the state fields) apart from its ring and handles
  (`state:<id>`, built only when the tile draws one), and `zoomFree` hands back the same `fixed`
  array when every part is unchanged.
- `CoreFrames.svelte` restaged the whole scene whenever the `overlay` prop changed identity,
  though `stage` only used it to send changed parts. The overlay is now sent from `paintOn`
  (still only when no gesture is moving) and a new overlay object only wakes the pacer.

What remains on zoom: card faces bake their label into the card list (`card-source.ts`), so every
card is drawn again at each of the 8 label steps per octave (~79k shift calls per tick on the
bench). Making labels, rings and handles zoom-free needs the engine to draw them in screen pixels;
the overlay is still sent as JSON through `set_overlay`. Both are engine work, not done here.

# Canvas: small frames keep only their ring, and a zooming overlay is held across small steps

Follow-up to #2268, aimed at wide select-all zoom.

- A pinned chrome piece whose frame is under 24 px on screen (where its label would hide
  anyway) draws only its `ring` items: no handles, label or port glyphs. Pieces without a ring
  (wires) are unchanged.
- A rough (zooming) held overlay now serves zoom steps within ±3 %: the reprojector scales it,
  so geometry still lands on the content exactly and only stroke widths drift by at most 3 %
  before the next redraw. A sharp overlay still redraws on any zoom change.

Not done: one combined outline for overlapping selected rings. A select-all profile at
2200×1100 @2 showed the overlay is no longer the bottleneck there: core bakes and tiles per frame
roughly double under select-all (2.5 vs 1.3 bakes, 2.2 vs 1.2 tiles) and most samples are GPU
submission (`writeBuffer`, `(program)`), so the remaining select-all cost is in the tile path.

Wide 2200×1100 @2 (user canvas copy, uncapped): nothing selected p95 7.4–7.8 → 7.4–7.5 ms;
select-all p95 9.8–10.0 → 9.3–9.8 ms; flicker 0/3.

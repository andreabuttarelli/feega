# Direct gesture rendering on desktop

During a gesture the canvas used to show cached 256 px tiles, which stayed magnified until the
right level was baked, so zooming blurred. On desktop a gesture now draws the scene natively
every frame:
- pages come from their vello encodings;
- effects come from a cache keyed on camera-free content and a power-of-2 level, held one zoom
  room finer so they are never magnified;
- the whole scene is built once per room and re-appended under the camera transform.

Phones, tablets and weak machines (fewer than 4 cores or under 4 GB) keep tiles. The choice is a
table in `src/lib/canvas/core/direct-switch.ts`. A desktop session falls back to tiles if more
than 10% of its first 120 gesture frames miss 16.7 ms. `?directZoom=0|1` forces either path.

Measured on the user canvas copy (details in `docs/design/direct-gesture-zoom.md`):
- 60 fps capped and 0 dips;
- sharper mid-zoom: Laplacian median 260 vs 234, p90 396 vs 354;
- core p95 about 8 ms.

At 4x CPU it reaches 40 fps against 58 for tiles, because each room rebuild costs about 100 ms
there. That is why phones stay on tiles until rebuilds are spread per page.

# Hold the canvas overlay across gesture frames

At 2200×1100, DPR 2, tiles missed 120 Hz: p95 18 ms, ~200 uncapped frames over 8.3 ms per pan. A
per-section profile showed the core CPU at under 3 ms, but GPU completion falling seconds behind.
A/B cores ranked the costs:
- without the overlay render, pan p95 dropped from 17.9 to 2.6 ms;
- without the tile compose, nothing changed;
- an empty overlay render gave p95 4.5 ms.

The cost is the overlay's content. The fixed overlay (node chrome and wires, about 80k vello
lines) was re-rendered every frame at 4400×2200.

`OverlayHold` renders the overlay with a 25% margin, capped at the device texture limit. It then
reprojects that render while the camera only translates inside the margin. Any zoom renders
again, because the pinned chrome keeps a constant screen size, and dev already caches its
encoding across zoom. It also renders again when overlay content changes (overlay parts,
`overlay:` groups, pictures, or anything while a node is lifted), and whenever the camera rests.

Rendering only the bands that hold overlay content was tried first and discarded: it is one
render per band, and the content, not the area, was the cost.

Uncapped, user copy, compared with dev at the time of merge (p95 / p99 / frames over 8.3 ms):

| | dev | hold |
|---|---|---|
| 2200 DPR 2 pan | 18.0 / 20.7 / 286 | 3.6 / 18.7 / 156 |
| 2200 DPR 2 zoom | 17.0 / 19.1 / 208 | 10.1 / 18.9 / 219 |
| 1440 pan | 1.4 / 16.8 / 146 | 0.4 / 1.7 / 127 |
| 1440 zoom | 3.1 / 17.3 / 107 | 2.6 / 5.7 / 90 |

The flicker check matches dev: 0 dips on zoom at 1440, and the same pre-existing dips on a wide
zoom (frames 47 and 135, present on dev too). Zoom at wide still misses 8.3 ms p95.

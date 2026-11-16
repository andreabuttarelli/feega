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
reprojects that render while the camera stays within one quarter-octave (1.19×, under the 1.25
cap) and inside the margin. It renders again when overlay content changes (overlay parts,
`overlay:` groups, pictures, or anything while a node is lifted), and whenever the camera rests.

Rendering only the bands that hold overlay content was tried first and discarded: it is one
render per band, and the content, not the area, was the cost.

Uncapped, user copy:

| | base | hold |
|---|---|---|
| 2200 DPR 2 pan, p95 / p99 / over 8.3 ms | 18.1 / 41 / 202 | 3.3 / 18.7 / 155 |
| 2200 DPR 2 zoom | 18.5 / 44 / 296 | 12.1 / 18.8 / 285 |
| 1440 pan | 0.9 / 2.4 / 167 | 0.4 / 1.6 / 133 |
| 1440 zoom | 2.6 / 5.8 / 95 | 2.4 / 4.9 / 90 |

Zoom at wide still misses 8.3 ms, because the overlay re-renders at each quarter-octave step.

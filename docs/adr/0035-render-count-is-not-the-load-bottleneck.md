# 0035 — Render count is not the load bottleneck

Status: accepted 2026-11-10.

## Context

The landings fixture (`BENCH_CASE=load`, `?coreTiles=0`) spends far more vello renders on layer
bodies than on the screen. The per-reason tally (`render_tally`, summed into
`window.__gpuCanvas.tally`, printed by the load bench) on a cold load at 1x:

| screen | raster | body | mask | matte | backdrop |
|---|---|---|---|---|---|
| 65 | 1 | 742 | 551 | 468 | 44 |

Masks without feather and non-luma mattes can be drawn inside the single Scene as `DestIn` /
`DestOut` compose layers. Done for both, the tally became body 406, mask 322, matte 0: ~480
fewer renders per load.

## Measurement

Interleaved A/B against origin/dev, 3 runs, every bench under the shared bench lock. Load, ms,
three runs each:

| | dev sharp | scene mattes sharp | dev all | scene mattes all |
|---|---|---|---|---|
| 1x cold | 3887 4106 4121 | 3941 3991 4082 | 2794 2796 2876 | 2794 2987 2859 |
| 1x warm | 2355 2403 2286 | 2163 2294 2260 | 2133 1869 1764 | 1826 1775 1742 |
| 4x cold | 10983 10698 10986 | 9737 10098 10711 | 7918 7576 7891 | 7550 7643 8253 |
| 4x warm | 7503 7322 8320 | 6812 6978 6943 | 5957 5992 6768 | 5615 5794 5775 |

Gestures, `BENCH_CASE=landings`, `?coreTiles=1`, CPU 4x: dev pan 48–53 fps, zoom 14–18, drag
22–23; scene mattes, one valid run, pan 52, zoom 13, drag 18. Its other two runs failed with a
blank pan frame.

## Decision

Cutting ~480 renders moves load times by at most ~7% at 4x, inside the run-to-run range, and
not at all at 1x or in gestures. Render count is not the bottleneck; this line stops. Only the
tally stays, to keep the count visible.

Scene mattes also drew the image cards of one landing darker than the layer path (stencil
mattes from `display-list.ts`), cause not found. Scene masks matched the layer path pixel for
pixel but moved no count on this fixture: its masks are feathered or luma.

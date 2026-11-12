# A zoom round trip shows the rest picture it already drew

Zoom 0.4 → 4 → 0.4 on the landings fixture, resting at both ends, three laps: every lap rastered
~1,770 tiles and 192 rest blocks (two 96-block screens at 2880×1800), lap 3 as much as lap 1. The
rest picture was redrawn even when the camera came back exactly where it had been.

`Stills` (`tiles.rs`) keeps the last two adopted rest pictures. A rest at a camera within half a
pixel and 1e-6 zoom of a kept one resumes it (`Rest::resume`) and is adopted without a raster; any
content damage drops them. Their bytes are taken off the kept tiles, so memory held stays where it
was (peak 368–374 MiB vs 363–366 MiB, budget 384 MiB).

Laps 2–3: still blocks 192 → 0, bake CPU ~552 → ~365 ms per lap. Tiles unchanged (~1,770).

Tried and dropped, both measured against dev in alternating runs:

- Not baking a level the zoom flies through (projected dwell from the zoom pace under a
  threshold). At 60 ms laps fell to ~650–950 tiles, but far-in level→sharp p95 rose 33 → 58 ms and
  time not sharp 258 → 398 ms: a level here bakes in ~30 ms, so most "flown" levels did turn sharp
  before. At 30 ms with a 32 ms window it held the 50 ms gate (42 ms) for ~15% fewer tiles.
- Evicting tiles drawn in passing before tiles drawn at rest. Laps fell to ~1,500 tiles, but slow
  zooms got softer: time not sharp far-out 32 → 157 ms, far-in 445 → 525 ms, pan-wheel 13 → 102 ms.

The tiles left are levels shown long enough to bake that the budget cannot hold: the pyramid
planned at a rest takes ~900 of 1,152 kept tiles and a flick's tail spends 100–230 ms on each of
its last five levels. With twice the tile memory (~630 MiB) laps 2–3 drop to ~370–440 tiles.

`tests/perf/canvas-roundtrip-bench.spec.ts` measures it (`BENCH_CASE=landings
BENCH_SPEC=canvas-roundtrip-bench`, `BENCH_CHANNEL=chrome` for local Chrome).

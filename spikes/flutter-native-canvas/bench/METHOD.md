# native-bench — measurement method

Same document, same script, same machine for every renderer (Flutter native, Electron, Chrome web canvas).

## Document
`scene.json` (`gpu-core-scene/1`): `groups` = one gpu-core DisplayList per frame, `uses` = World use items
(frame placement, `cache: true`), `images` = image clip -> file under `images/`, `motion` = animated uses.
Motion, `t` in ms, `phase = 2π·t/period`:
- `orbit`: translate `(x + amp·cos φ, y + amp·sin φ)`
- `pulse`: scale `1 + 0.25·sin φ` about the use origin, at `(x, y)`
- `slide`: translate `(x + amp·sin φ, y)`

## Window
1600×1000 logical points, Retina (2×) → 3200×2000 device px canvas area minus panels; record the actual canvas px.

## Script (deterministic, time-based, not frame-based)
1. **First frame**: process start → first canvas frame visible on screen (scene parse + upload + first draw).
2. **Overview**: fit the whole document (zoom ≈ 0.08) for 2 s.
3. **Pan**: zoom 0.25, pan `x(t) = x0 + 1600·sin(2π t / 4s)`, `y(t) = y0 + 900·sin(2π t / 6s)` for 10 s.
4. **Zoom**: centred on a landing page, `zoom(t) = 0.05 · 80^((1 - cos(2π t / 5s)) / 2)` (0.05 → 4.0 → 0.05) for 10 s.
5. **Motion**: zoom 0.5 centred on the motion row, motion playing, no camera move, 5 s.

## Metrics
- **fps** per phase: count of presented frames / seconds; also p50/p95/max frame interval (ms) and % frames > 16.7 ms
  (> 8.3 ms on a 120 Hz display).
- **render ms** (CPU+GPU per frame, renderer-internal) p50/p95 where the renderer exposes it.
- **Memory**: RSS of every process of the app (`ps -o rss`), sampled each second; report peak and steady
  (Chrome: sum of browser + GPU + renderer processes; `footprint` when available).
- **CPU**: `ps -o %cpu` of the same processes averaged over each phase.
- **GPU**: `ioreg -r -d 1 -w 0 -c IOAccelerator | grep -o '"Device Utilization %"=[0-9]*'` sampled each second (no sudo).
- **Text sharpness**: screenshots of the same landing hero at zoom 0.25, 1, 4; judge blur/aliasing; note if
  cached rasters get upscaled (blurry) during zoom and how long until sharp.
- **Motion smoothness**: fps in phase 5 plus a 5 s screen recording; stutter = visible jumps.

## Output
`native-bench/<renderer>/` : `results.json`, screenshots `zoom-0.25.png` `zoom-1.png` `zoom-4.png`, `pan-zoom.mp4`, `REPORT.md`.

# 0039 — Never show a tile magnified past 1.25×; draw a native LOD scene instead

Status: proposed (2026-11-14). Steps 1 (effect LOD table) and the cap, scene fallback and adjacent-level bake (branch `perf/never-blurry`) are built; the fallback is not yet cheap enough to merge.

## Context

While the right tile level is missing, the canvas shows a coarser level stretched to fit. On the
33-landing wall (15k layers) zooming between overview and a page stays blurry for 1.3–1.7 s,
because coarse tiles are expensive to make. A CPU profile shows tile raster time is almost all
effect layers: per-tile counts are about 13k bodies, 10k mattes, 9k backdrops and 7k masks. Each
of these costs its own vello render (bind groups, compute passes, upload), at roughly 0.05 ms CPU
per render plus GPU time. Figma never shows a magnified raster, so shortening the blur is not the
goal. Showing no blur at all is.

## Decision

1. **Cap on magnification.** A cached level may be shown at most 1.25× magnified, which is one
   step at 4 steps per doubling (1.19×). Finer levels may always be shown. The level choice in
   `tiles.rs` enforces this, and a test pins it.
2. **Native LOD scene for everything else.** Any screen area with no level within the cap is drawn
   from the scene at native resolution in the same frame, using a simplified scene:
   - text below ~3–4 px drawn as bars (exists: `lod::detail`);
   - effects below a few px dropped (`lod::PLAIN_BELOW_PX`, one row per effect kind);
   - images taken from GPU mip levels;
   - tiny layers merged.
3. **No pop on replacement.** Full-quality tiles replace the LOD scene in place, crossfading when
   the two differ.
4. **Keep adjacent levels warm.** Neighbouring levels stay resident and are baked at open and when
   idle, so the fallback is almost always a cached level within the cap.

## Why not only make tiles faster

Backdrop culling (#2170) and the effect LOD table each cut the worst stall: from ~200 ms to
101 ms, then to 85 ms. Blur time stayed at 1.4–1.7 s per leg. Throughput is limited by the cost of
each render, not by scheduling: the core sits idle 80% of the bench.

## Open problem: the LOD scene must fit one frame

Today one 4×4-tile batch at overview (about 0.4 of a 2880×1800 screen) costs up to 85–175 ms. A
full-screen native draw must come down about 20×. That needs both of these, measured on the
landings wall before the cap is switched on:
- **Effect atlas:** many small effect layers of one render go into a single vello render, instead
  of one render each.
- **Tighter effect thresholds:** most effect layers at overview are larger than the current
  4/16 px floors.

Until then, enforcing the cap would leave holes. So step 1 ships without the cap.

## Measured, 2026-11-15 (`perf/never-blurry`, effect atlas merged)

Sharp-zoom bench, landings wall, 10 legs, 3 runs per column. "Before" is the same build with only the counters.

| | desk before | desk after | CPU 4x before | CPU 4x after |
|---|---|---|---|---|
| frames with a tile magnified > 1.25× | 203 / 218 / 216 | 0 / 0 / 0 | 407 / 407 / 421 | 0 / 0 (1 run failed) |
| frames with bare tiles (blur or blank) | 187 / 193 / 190 | 0 | 224 / 209 / 248 | 0 |
| blank frames | 12 / 10 / 8 | 0 | 6 / 5 / 5 | 0 |
| fps | 56.0 / 56.7 / 56.8 | 55.9 / 55.6 / 56.4 | 35.0 / 35.8 / 35.0 | 34.8 / 34.9 |
| worst frame | 52 / 67 / 51 ms | 115 / 148 / 83 ms | 400 / 267 / 266 ms | 782 / 768 ms |

Getting fps back took patches: a fallback patch is kept while it stays within the cap, and only the bands newly uncovered around it render. Before that change the fallback cost 7.9 s per run at CPU 4x; after it, 2.4 s. Coarser detail floors for the fallback (text bars below ~4 px, effects dropped below 3× the usual floors, no new group rasters) gained only ~7%.

**Still open: the worst frame.** It is a single full-screen fallback after a large jump. The renderer
spends almost all of it encoding (plan 45–62 ms of 687 ms). Spreading it over frames is not
possible without showing either a magnified or an empty area. Block-budgeted rendering was tried
and brought back 1.8–3.2 s of blur. Fixing it needs a cheaper encode for the overview (for example
GPU-derived mip levels, proposal B in the architecture notes) before this can merge.

### Update: render-ahead and cheaper effects (desktop 4 runs, CPU 4x 4 runs)

| | desk before | desk after | CPU 4x before | CPU 4x after |
|---|---|---|---|---|
| magnified / bare / blank frames | 203–218 / 187–193 / 8–12 | 0 / 0 / 0 | 407–421 / 209–248 / 5–6 | 0 / 0 / 0 |
| fps | 56.0–56.8 | 56.0–56.5 | 35.0–35.8 | 35.0–36.0 |
| worst frame | 51–67 ms | 67–69 ms | 266–400 ms | 467–500 ms |

- While zooming in, the next fallback (1.25× closer) renders in 6 ms blocks while the current one still serves.
- Profiling the fallback at CPU 4x showed effect layers dominating (layer bodies 1.7 s, backdrops 1.2 s per run), not planning or encoding. The fallback now drops effects below 10× their usual floor (`lod::Floors`). Caching the encoded scene would not have helped much.
- What remains at CPU 4x: a single full fallback after the fastest zoom-in jumps.

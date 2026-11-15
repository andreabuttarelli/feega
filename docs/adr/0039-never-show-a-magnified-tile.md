# 0039 — Never show a tile magnified past 1.25×; draw a native LOD scene instead

Status: proposed (2026-11-14). Step 1 (effect LOD table) has landed; the rest has not.

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

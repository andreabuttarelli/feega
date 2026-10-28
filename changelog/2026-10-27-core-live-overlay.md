# Core overlay: fixed and live parts

**Before.** The core renderer took the whole canvas overlay (wires, node chrome, hover ring,
guides, peers) as one group. Any change, a hover ring included, re-sent the full JSON, which
wasm parsed and re-encoded. GpuFlow also built a new theme object on each zoom step, which
voided the zoom-free memo in `world-overlay.ts`: every chrome item was rebuilt and
re-serialised each frame.

**Now.**
- `World` holds two overlay groups, `overlay:fixed` and `overlay:live` (`OverlayPart`).
  `WebCore.set_live_overlay` sets the second.
- `overlayOf` returns `{ fixed, live }`. `SentParts` sends only the part that changed.
- Chrome and wire items are reused per node by field equality; `SentOverlay` caches each item's
  JSON by identity, not index.
- The theme is a stable `$derived`.
- Library group maps hash with FxHash instead of SipHash.

**Result.** The overlay left the top of the zoom trace. Zoom p5 at x4 stays at about 30 under
heavy machine load: see `scripts/perf/results/2026-10-27-core-live-overlay.md`. Next up: wasm
path encoding and vello's per-render bind groups.

**Discarded.** A binary overlay format: the remaining cost is not parsing.

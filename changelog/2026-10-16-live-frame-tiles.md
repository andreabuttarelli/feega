# Live frame tiles, capped

**Before.** A tile was live only while playing, capturing its poster, or (since #689) holding a local
doc — and the local-doc case had no limit: 50 seeded frames at zoom 0.4 mounted 30 players and 4× CPU
pan dropped to p5 12 fps.

**Now.**
- `src/lib/canvas/live-tiles.svelte.ts`: a FIFO of tiles in view; the first `LIVE_CAP` (desktop 6,
  tablet 4, phone 2) get a player. A tile leaving the view hands its player to the next one.
- `src/lib/canvas/canvas-lod.svelte.ts`: `CanvasPosterLayer` publishes the far-zoom LOD state; at far
  zoom no tile is live (the poster layer draws).
- `MotionNode`: live when in view, not far, has a doc, and holds a slot — or it is the edited/leaving
  frame (never capped). Fetched previews are cached per `id:revision`, so a re-granted slot doesn't
  refetch. Live tiles skip poster capture. "Open editor" sits above the player.
- Benchmark `feega-live` subject seeds local docs and zooms to 0.4; it logs how many players drew.

**Measured** (50 frames, chromium): cap 12 → 4× drag 30 fps avg; cap 6 → 40; uncapped → 26 (pan p5
12). Desktop unthrottled 60/55+ at cap 6.

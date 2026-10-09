# Custom clips off screen stop drawing every frame

The engine rendered every child timeline on every frame at its clamped time, so a Custom
clip outside its window kept running its draw at its first or last frame. Kit pieces
(`ui-kit/kit.ts`) read layout in that draw (`aim` → `offsetLeft`/`offsetWidth`) after writing
styles, forcing a style + layout per clip per frame: on Nimbra (8 Custom clips) forced layout
was ~43% of the main thread.

- `render` remembers the local time each child was last drawn at and skips it while that
  doesn't change (GSAP does the same). Inside its window a child still draws every frame.
- Determinism: seek → other time → same seek twice gives the same DOM (engine test); Nimbra
  and Saturn frames are pixel-identical before/after, forward and backward seek order.
- Measured (embed, iPhone 13 viewport, Chromium 4× CPU): Nimbra median 23 → 11 ms, p95
  39 → 26 ms.
- Not done: batching `aim` reads before writes inside the kit pieces; the visible clip still
  forces one layout per frame.

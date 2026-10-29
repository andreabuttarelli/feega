# Scrubbing a property is smooth again

Dragging opacity in the right bar or the colour picker on the Ledgerline landing ran at 5–10 fps
(1–2 fps with 4× CPU throttle) and saved mid-drag. Measured with `scripts/perf/scrub-probe.ts`
(headed Chromium, test account, CDP trace), the hot paths were all client side:

- **Number fields were not live gestures.** Every scrub tick recorded history and armed a save;
  with ticks slower than the 250 ms debounce, each tick saved. `NumberField` now begins/releases
  the session's `LiveGesture` (inspector, multi-select, 3D look): one history entry, one save.
- **Selection marks recompiled the frame picker every tick** (`compileScene`: compose the whole
  doc, parse it, seek the timeline 121 times). `FramePickers.of` takes `Reuse.Held` while a
  gesture is live, and `PickerSettle` keeps the held picker after any edit until the browser is
  idle, so the release paints first. `animatedStyles` now diffs only elements a
  `MutationObserver` saw written, not every element at every sample.
- **Breakpoint views rebuilt with the base frame each tick.** Their docs are held during a
  gesture and resolved once per doc (`heldViews`); an unchanged live doc is no rebuild
  (`sameLive`).
- **Every save refetched the frame `/source`** (base + each breakpoint view, twice: CoreFrames and
  the pick-doc fetch in GpuFlow), six requests per save. Frames drawn from a live doc are no
  longer fetched (`toFetch`).
- **Text was shaped from scratch every rebuild.** Faces memoize shaped runs and glyph outlines,
  face books memoize character lookups, `fontLoader` hands back the same book while the fonts are
  the same, and `shownDoc` (auto layout) runs once per doc instead of three times per build.

Not changed: the base frame still rebuilds its display list per tick (now mostly GPU upload),
and the GPU paint of a large clip at 4× throttle stays the limit there.

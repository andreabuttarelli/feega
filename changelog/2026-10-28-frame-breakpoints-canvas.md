# Frame breakpoints on the canvas

Breakpoint views had a model and agent tools but nothing drew them.

- `breakpoint-views.ts` lays each breakpoint right of its frame (80 px gap, frame scale) as a
  virtual `FrameAt` (`<nodeId>@bp:<id>`); GpuFlow draws them through CoreFrames with
  `resolveAt` docs in the live map, labels them, and picks elements inside them.
- Picking in a view sets `FrameEditSession.breakpoint`; the inspector shows `inView(doc)` and
  routes every edit through `liftEdit`, so whitelisted props become overrides for that view and
  everything else stays shared.
- Breakpoints section (presets + custom width, remove, pick view) and an overrides strip
  (overridden in X + Reset, Stack on this breakpoint).
- `resolveAt` now keeps pixels (text size, strokes, child widths); overrides are stored in base
  units. Without it every view shrank text by the width ratio.
- Screenshots come from `scripts/breakpoint-shots/shots.ts`: HTML export of each resolved view,
  not the logged-in canvas (that needs a real Supabase session).

# Effects stack: inner shadow, background blur, eye, side popover

**Before.** Effects (`motion/effects/registry.ts`) had drop shadow and Gaussian blur (= layer
blur) but no inner or background blur; each row toggled with a checkbox and listed every param
inline. Shadow opacity was its own number next to the colour. Strokes still edited inline.

**Now.**
- Registry: `inner-shadow` (offset + blurred `SourceAlpha`, `out` against the shape, flooded and
  merged over it) and `background-blur` (`Rendered.backdrop` → `backdrop-filter` on the effect
  layer, animated through `effectTimeline` as `backdropFilter`). `EFFECT_ALPHA` is the table of
  which colour param carries which opacity param (drop/inner shadow, glow); `editedParams` drops
  the paired alpha from the field list.
- `behind: true` on background blur → `seesBehind` puts `bd` on `.fx`, and `BEHIND_CSS` takes
  `opacity` out of its `will-change`: otherwise `.fx` is a Backdrop Root and the blur sees nothing.
- Effects section: open by default; row = grip, eye (`effect-eye`), name (opens a `SidePopover`
  with params, colour+alpha, order), remove. `StrokeStack` uses the same popover; rows show hex
  or paint type.
- `SidePopover`: Escape is caught in the capture phase so it closes only the popover, not the
  editor selection; z-index above the bottom toolbar.
- Add-effect menu: static `max-h-[60vh]` + scroll (19 kinds overflowed a 720px viewport).
- Agents: `add_effect`/`set_effect` take the new kinds from the registry; no new tool.

**Limits.** Background blur blurs the layer box, not its shape, and pauses while an ancestor
fades (opacity < 1 is a Backdrop Root). The GPU export path (`export/webgl-device.ts`) has its own
effect list and does not know either new kind.

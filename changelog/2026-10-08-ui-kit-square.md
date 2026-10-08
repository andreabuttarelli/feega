# UI kit: square by default, every corner follows `radius`

**Before.** `radius` defaulted to 14px, and several parts ignored it: phone frame 72px, notch
20px, swatch 3px, progress tracks 3px/5px, file icon 8px, chart bars `rx=4`, badges/chips/
address bar/kicker 999px. With `radius: 0` those stayed round — the shape rule (rectangle or
full circle, nothing between) broken by default and unfixable from props.

**Now.** Default 0. Every corner is `var(--r)`-derived; pill-shaped parts use
`calc(var(--r) * 999)`, so they are square at 0 and full pills at any radius. Only true circles
stay round regardless: dots, avatars, traffic lights, ticks, knobs (`50%`) and the toggle track
(`9999px`). The test `corners` enforces it for every piece and for `recreate_ui`.

**Visible.** Every `add_ui` piece placed without `radius` now renders square. Recreated UIs are
unchanged (they pass the radius read from the capture). Frames: `~/Documents/feega-videos/ui-kit-radius/`.

# Text inspector order and percent type units

Before: a text's sections followed the one global order, so Typography sat after Effects; line
height showed as `×` and letter spacing as `em`; the aspect lock sat beside X/Y; selects used the
browser arrow.

- `properties-view.ts`: `FAMILY_ORDER` lets a family override `SECTION_ORDER`; Text gets
  Align, Layout, …, Layer, Text, Fill, Stroke, Effects. Section `Text` is titled "Typography".
- `type-percent.ts`: inspector-only ×100 for `leading`/`tracking`; stored values unchanged.
  Not added to `PROPERTY_UNITS`: that table also feeds the agent's units and would change the
  agent API.
- W/H render in a `size-row` with the ratio lock at its end; PositionSection keeps X/Y only.
- Selects: `appearance: none` plus an inline SVG chevron.

Not done from the spec: resize-mode segmented with inline Hug/Fixed, size presets dropdown,
header component/variant icons.

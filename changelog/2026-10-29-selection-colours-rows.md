# Selection colours: one row layout

- Rows were name, count, then a duplicated name with a dropdown for tokens or a bare swatch for hex:
  nothing said what was clickable.
- Now every colour is `ColourRow.svelte`: swatch (resolved colour, tokens too), label (token name with
  a glyph, or hex in mono), count. Swatch and label are one button opening the existing `ColorPicker`
  anchored to the row; tokens swap from its Brand row, so the select is gone.
- `ColorField` gets `ColourDisplay.Row` for the button. Used by `FrameColoursSection` and
  `MultiInspector`; recolour logic untouched.
- "Select layers using it" target shows only when a caller passes `onselect`; no inspector has a
  selection setter yet, so nobody passes it.

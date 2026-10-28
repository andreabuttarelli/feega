# Right bar: full-bleed dividers, whole-row toggles, readable font menu

**Before.** The `+` sibling border missed sections wrapped in other blocks, so Layout, Alignment,
Constraints, Content and Appearance showed no divider in dark mode. Only the chevron area read as
the toggle. The font menu used a white background with near-white text and a purple selected row.
Text-range fields used an undefined surface token and a visible outline.

**Now.** One shared `.ui-section` class (`app.css`) draws a `--ui-divider` line under every
section, edge to edge: `InspectorSection`, shell `Section`, `MultiInspector`, `RangeTextInspector`.
Section headers are one full-width row with hover and a right-aligned chevron; header actions stay
separate targets. Shell fields (`FIELD_INPUT`) use `rounded-sm`. `FontPicker` uses the raised
popover tokens, wash hover, selected token, per-font previews kept.

**Not done.** `MultiInspector` sections are still static headings, not toggles.

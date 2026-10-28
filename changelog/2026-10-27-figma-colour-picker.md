# Figma-style colour picker

**Before.** A colour chip opened a popover with the browser's native colour input: an OS box that
could render broken, no saturation square on the first click, no opacity slider, HSB or swatches
from the document. Nine other places (guides, shared styles, variables, lights, text ranges,
section fill, component instances, brand wizard) each embedded their own native `type="color"`.

**Now.** One `ColorPicker.svelte` behind `ColorField.svelte`, used by every colour edit. Fill and
gradient stops embed it inline in the fill popover, so the square shows without a click; other
fields open it in a side popover. Square, hue and opacity (checkerboard) sliders, EyeDropper
button only where the API exists, Hex / RGB / HSL / HSB with an opacity field, and swatch rows for
document, brand and recent colours. Drag is rAF-throttled and wrapped in the existing live gesture,
so one drag is one undo step. Arrows nudge, Shift by 10. Conversions (`hsbOfHex`, `hexOfHsb`,
`unitAt`, `alphaOfText`, `snap`, `nudge`) live in `colour-field.ts`; `documentColours` in
`selection-colours.ts`.

**Format unchanged.** Colours stay `#rrggbb[aa]` or a brand token in the document, so agent tools,
CLI and MCP need no change.

**Discarded.** A colour library dependency (a square and two gradients are 200 lines). Context
for document swatches: `getContext` in a `.ts` helper resolves to a different svelte build under
vitest, so the palette goes down as a `palette` prop.

# Multi-selection inspector: box and shared style

`MultiInspector` showed only x, y, rotate, scale, opacity and blend.

- "Selection" section: X, Y, W, H of the joint box (`placeBox`). X/Y move every member by the
  difference; W/H scale proportionally from the top-left (`scaleAround`), so W and H move
  together, like Figma with the ratio locked.
- "Style" section, from the table `STYLE_PROPS` (fill, stroke, stroke width, font, font size,
  weight): a field appears when at least one selected clip has the prop; a differing value reads
  "Mixed"; editing writes the prop on every clip that owns it (`setPropAcross`) in one
  `onchange`, one undo step. Clips without the prop are left alone.
- No new tool: chat and MCP already reach the same ops through `set_props` and `arrange_space`
  (`move`, `scale_group`).

Not done: radius, constraints, pivot in the multi inspector.
Tests: `selection-props.test.ts`.

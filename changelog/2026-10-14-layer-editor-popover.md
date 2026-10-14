# Fill layer editor in a side popover

**Before.** Clicking a fill row expanded its editor inline under the list: grey rows, the props
of the selected layer below the stack, nothing tying them to their row. The row carried a type
select, so every collapsed row read like a form.

**Now.**
- `ui/shell/SidePopover.svelte` + `side-popover.ts`: one shell primitive, a 240px column left of
  the Properties panel (`data-side-edge` on the inspector root; else the caller's `within`
  element). `sidePlacement` is pure: right edge a gap before the panel, top aligned to the row and
  clamped to the viewport, a bottom sheet under 640px. Header: swatch, layer type, close. Escape,
  an outside pointerdown (outside the popover and the stack) or close shut it.
- `FillStack.svelte`: rows are swatch, hex (solid) or type name, opacity, eye, remove. The open
  row is `bg-ui-selected` and `data-open`. The type select moved into the popover. One popover at
  a time; another row swaps it.
- Meant to be reused for strokes, effects and any "more settings" of a section.

**Discarded.** Inline nested block with a connector: it keeps the panel long and still reads as
"below the list"; the popover is what Figma and Framer users expect.

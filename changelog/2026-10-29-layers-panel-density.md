# Pages + Layers panel at Figma density

User feedback on the first Pages/Layers panel (#1525): too big, a title
and close button on top, a blue block for the current page, a search bar
always visible, coloured layer icons, a solid accent row for selection.

- Layers kind of `CanvasLeftPanel` has no title/close head: two compact
  sections, "Pages" (chevron collapse, +, …) and "Layers" (search icon
  toggling an inline input). The panel still closes from the rail/Alt+1.
- Pages list defaults to ~4 rows of 28px and is resizable by the
  divider below it; current page is a subtle text-tinted wash; row "…"
  shows on hover.
- Layer rows 28px (`ROW_STEP_PX` 29 with the 1px gap), 12px text,
  12px indent, monochrome icons (glyph tells frame/component/text/shape
  apart), selection = `--ui-selected` instead of a solid accent; eye and
  lock appear on hover or when active.
- Mobile Layers sheet keeps its always-visible search (`searching`
  defaults to true).

# Frame templates: one name, a calmer picker

The same catalogue was called "components" (picker on the canvas and in the editor), "Templates"
(sidebar, `/app/templates`) and "motion templates" (changelog). It is now **Frame templates**
everywhere a user reads it. Routes, test ids and code names (`ComponentLibrary`, `catalogue.ts`)
stay: renaming them buys nothing and breaks links and specs.

`ComponentLibrary.svelte` was redesigned:

- **Real format.** Every preview was squeezed into a 16:9 box, so 4:5 posters sat in black bars.
  `CatalogueItem.native` keeps the template's own format (`format` still falls back to a starter
  format, because that is what gets inserted); `byShape` groups the grid by shape, each group
  with its own column width, so no card is letterboxed.
- **Filters.** All / Video / Still as one segmented control, then role chips from the template
  cards (`roles` in `cards.ts`). The kind tabs (components / media layouts / scenes) are gone:
  they described how a template is built, not what it is for. Search also matches roles.
- **Click inserts.** The detail aside is still there, behind a small round button on each card
  (`template-details`), for format and field edits before adding.
- **One player.** No video element until a card is hovered or focused; one id in state, so at
  most one plays — the canvas rule of a single playing slot. Touch shows posters only.
- **Keyboard.** `gridStep` assumed one uniform grid; with groups of different widths it moved to
  the wrong card. `spatialStep` picks the nearest card in the arrow's direction from the cards'
  rectangles. ArrowDown from search enters the grid; Esc closes the detail, then the picker.
- **States.** Shimmer skeleton until each lazy poster loads; empty state with "Clear filters".

Not touched: `CanvasAddBar` and the `frame_template` action (format sent for a 4:5 poster is still
16:9) — both owned by parallel work.

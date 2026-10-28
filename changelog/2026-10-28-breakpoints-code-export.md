# Breakpoints in code export

Exported code ignored breakpoints: the phone view existed on the canvas and nowhere in the code.

- `exportCode` builds one page per view (`resolveAt`) and `media.ts` diffs each against the next
  wider one, per element. Elements are matched by `clipId` (now on IR element/use/svg nodes):
  class names shift when a hidden layer frees a name, so matching by class mixed up elements.
- HTML and Svelte emit `@media (max-width: Wpx)` after the element's base block; React emits
  `max-[Wpx]:` Tailwind variants. A layer hidden at a view becomes `display: none` / `hidden`;
  a dropped declaration becomes `unset`. The page root is not diffed (its width is the view).
- The Ledgerline fixture defines Tablet and Phone explicitly as a table of user-chosen overrides
  (stacked grids, smaller display sizes, nav links and sidebar hidden, tighter gutters).
- Known gap: a layer hidden at the base and shown on a smaller view is not emitted.

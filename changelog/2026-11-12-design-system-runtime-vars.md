# Design-system import: variables emitted at runtime

Spec: `docs/specs/design-system-import.md`, stage 4, item 4.

MUI (CSS-vars mode) and Chakra write their custom properties with JavaScript: no source file
declares `--mui-palette-primary-main`. Item 1 already reads CSSOM text of page sheets, which
covers rules inserted with `insertRule` (empty `textContent`). This adds the computed style of
`:root` (`rootVars`, ≤512 names, values ≤200 chars) per capture, turned into a page sheet in
the capture's mode (`computedSheet`: Light `:root`, Dark `.dark`), so a Dark capture yields the
Dark values. `[data-mui-color-scheme=x]` and `[data-color-scheme=x]` are mode selectors.
`radius` / `spacing` name rows are case-insensitive (`--mui-shape-borderRadius`).

All of these are page tokens: read-only, never written back; a name declared in a file wins.
Rejected: walking every element for custom properties (cost per node inside the capture
budget, and only `:root` and theme containers hold tokens in practice).

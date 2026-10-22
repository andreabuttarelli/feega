# Copy and paste properties (⌥⌘C / ⌥⌘V)

Figma parity. `style-copy.ts` copies one element's look — the props listed in
`STYLE_PROPS` (fills, strokes, colour, background, type style, radius) plus
effects and blend — and pastes it on each selected element, keeping only the
props the target component's schema accepts. The copy is held beside the element
clipboard, so copying properties does not drop copied elements. Agent path:
`set_props`. Paste-to-replace (⇧⌘R) is not in this change.

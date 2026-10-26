# Selection colours

Figma's "Selection colors" for a mixed selection. `selection-colours.ts` walks
each selected clip's props and collects every hex colour once (fills, gradient
stops, strokes, text colour, background — whatever prop holds it); recolouring
swaps that exact colour everywhere in the selection through `setProps`. Shown in
`MultiInspector` as a "Selection colours" section. Brand tokens (`brand.text`)
are not hex and are not listed yet.

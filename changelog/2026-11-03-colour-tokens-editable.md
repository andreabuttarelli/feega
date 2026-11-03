# Colour tokens are editable from the chip and the Styles panel

From the import audit (round 2): an imported page binds fills to colour variables ("Vercel/Surface").
The fill showed the chip `Vercel/Surface #ffffff ×` and clicking it did nothing; the left Styles
panel listed only text styles, so a token could not be changed from anywhere obvious.

- **Chip.** `BindChip.svelte`: the bound name is a button that opens an editor with the colour and
  the other variables of the same type to swap to. A colour change goes through `recolour`
  (`motion/variable-library.ts`): it copies the collection into the frame if only the library has
  it, sets the value in the frame's active mode, commits, and pushes the collection to
  `variableLibrary`, whose sink re-syncs every other frame holding that collection
  (`syncedCollection`).
- **Styles panel.** New `ColourTokensSection.svelte` under the style library in
  `CanvasLeftPanel.svelte` lists the project's colour tokens (`colourTokens`) with a colour chip;
  an edit sets the collection's first (or active) mode through `recolouredCollection` and
  `variableLibrary.push`.

Not changed: the Styles panel is the project library by design, so styles and tokens from other
canvases of the same project still show; tokens are not separated per canvas.

Guards: `variable-library.test.ts` (recolour, shared repaint, library-only token, token list,
collection recolour), `bind-chip-render.test.ts`, `colour-tokens-render.test.ts`.

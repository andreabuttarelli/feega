# Reopening a canvas with an imported page froze it

Reopening a canvas holding a vercel.com import left the frame blank and
ignored Ctrl+scroll. `tests/e2e/url-import-reopen.spec.ts` (test account,
seeded from a real import) measured one main-thread task of 190 to 208 s
in three of three runs (dev build; the Svelte dev stack tracing inflates
it, production pays the same loop with fewer frames per second).

The profile: `StyleLibrary.found` (effect over every frame doc) pushed
each style whose JSON differed from the project library copy;
`syncStyle` re-committed the frame; the commit re-ran the effect. Both
sides compared with `JSON.stringify`, so the same style with its keys in
another order (jsonb returns keys reordered) never matched and the loop
ran until Svelte's guard. The variables library had the same comparison.

- Styles and variable collections now compare with `sameValue`
  (key-order free deep equality, `node-patch.ts`).
- A wheel, pinch or pointer press cancels the fit-to-content tween
  (`takeCamera`), so a zoom made while tiles arrive is not overwritten.

After: longest task 272 ms to 1.25 s across runs, zoom answers in under
100 ms, the frame paints about 2.4 s after its tile.

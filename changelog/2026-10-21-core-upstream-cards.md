# Core cards: iframe, select, effects, composition, studio batch

Each follows its DOM component. `iframe`: mode switch (URL/Code), address field, open icon, blank page area with the "Paste an address" / refusal hint, the code box and disabled "Mostra" button in code mode, the embedding note. `select`: prev/index/total/next header, help icon, the current item (photo, text, or the unconnected/empty message), one row per output (port swatch, label, thumb, value summary), "+ Output". `effects` and `composition`: picture or the "connect…" prompt, action buttons top right (`Open editor`, `Component`), "Not applied" tag. `studio_batch`: the pick state (with "No batches…" or the select box), the picked batch grid with counts, the unreachable state.

What the DOM cards read from the graph reaches the face through `viewOf` in the page (`NodeView` in `node-view.ts`): `selectView` for select (list, outputs, values), the upstream picture for effects, and a poll of `/app/studio/<id>/card` (or `/app/studio/cards`) for studio batches. `viewOf` now returns a `NodeView` (`source`, `media`, `select`, `batch`), not a `SourceView`.

Not done: the live iframe page and the A/B/Cards panels of composition (interactive DOM), the effects download button, the audio parameter form (operation, voice, sliders) and the "Choose a model" label of model3d, which belong to `gen-card`.

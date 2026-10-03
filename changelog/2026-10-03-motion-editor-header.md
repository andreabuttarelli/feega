# Motion editor: header no longer eats half the screen

`app.css` still carried the old analytics page rules (`.charts`, `.bars`, `.bar`), used by no
component. The global `.bar { flex: 1; flex-direction: column; justify-content: flex-end }`
leaked into every component that scopes its own `.bar`: the Motion editor header (stacked
vertically, grew to half the viewport, squashing preview and timeline), the timeline clip bars,
the chat "thinking" bar and the studio batch bar. Scoped Svelte rules win on the properties they
set, not on the ones they leave out.

Fix: delete the dead rules. Guard: `src/no-global-bar-style.test.ts`. Discarded: renaming the
editor's class, which would leave the leak in the other three components.

# Settings sheet: section page rendered with the next section's data

The errors (`reading 'image'`, `.find`, `optIn`, `e.data.models[s]`) came from the canvas
settings sheet (`CanvasSheet.svelte`), not from the `/settings/*` routes. Its switcher changes
`page.state.sheet` (shallow routing); the section page was passed `sheet.data`, which updated at
once, while `{#await settingsLoader()}` kept showing the previous page until the next module
resolved. For one tick models rendered spend data, spend rendered fonts data, and so on.

`settingsSheetSection(path, data)` in `sheet-pages.ts` now resolves the page module together
with the data it was asked for; the sheet renders the pair, so a page only ever sees its own data.

Discarded: `{#key}` in the settings layout (the routes were never the cause); defensive `?.` in
each page (hides the mismatch instead of removing it).

Repro: Playwright on production, canvas rail Settings, switcher Models/Billing limits/Fonts/…:
16 page errors over two rounds (normal and 6x CPU).

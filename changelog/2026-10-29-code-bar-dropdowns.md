# Code bar: two dropdowns

The right bar in Code mode had a React/HTML/Svelte segmented control plus a scrolling file tab row.
Replaced by two compact selects on one row: framework and file (mono name, file icon).

- Default file is the main entry (`src/pages/<Frame>.tsx`, `+page.svelte`, else `index.html`).
  `entryFile` used to return `index.html` first for React; now the page file wins.
- Native `Select` from `ui/select`, same as other inspector dropdowns.

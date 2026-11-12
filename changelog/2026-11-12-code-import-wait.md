# Code import waits for the page to settle, plus an extra capture wait

On traidue.com the article detail page shows its sidebar and table of contents a few ms after
load, and the import captured the page without them.

Readiness before: `tab.goto`, then `tab.settle` (network quiet for 500 ms, fonts ready, inner text
unchanged for one 150 ms poll), plus three fixed `settleMs` (1.2 s) sleeps in `pagePrepared`. A
node inserted after the one text poll, or a size change with no text change, was missed.

Now `settle` ends on `domStill`: a MutationObserver plus a ResizeObserver on the document, quiet
for `quietMs` (300) and capped at `maxMs` (3 000). It replaces the text poll.

New option: extra capture delay, `captureDelayMs` for the import and `routeDelayMs[route]` per
route (route wins, 0 included). `capture-wait.ts` validates and clamps it: at most
`CAPTURE_DELAY_MAX_MS` (10 s) per page and `DELAY_BUDGET_MS` (a third of the 150 s capture
budget) across all pages. It is stored in `nodes.data.code.delay`, so Pull re-imports with the
same value. Wired through the dialog, `/code-import`, the `import_code` op, `feega canvas
import-code --delay/--route-delay` and the skill text.

Dropped: a global setting; a wait added to every import by default (the settle covers it).

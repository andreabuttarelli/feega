# UI second pass: primitives and remaining surfaces

Second launch-quality review, scored at 1440 and 390 (light and dark).

## Shared canvas with an empty influencer node
`/s/[token]` answered 500 whenever the shared canvas held an influencer node
with nobody picked yet: `influencerView` queried `influencers.id = ''`, and
Postgres rejects an empty uuid. It now returns the empty view without a query.

## Canvas
- Credits read "50.00 (0)": the custom glyph rendered as a tiny parenthesised
  zero. `CreditAmount` now leads with the lucide `Coins` icon, and its
  aria-label says "credits" (was Italian). `CreditIcon.svelte` is gone.
- The "Svelte Flow" attribution is hidden (`proOptions.hideAttribution`). The
  library is MIT; the attribution stays in `CREDITS.md`.
- Node labels use `--canvas-label-size` (12px) instead of a literal 11px.
- Influencer, Post preview and Ads nodes with no data drew only a label: the
  tile snippet had no fallback. `EmptyNode` now draws icon, name and next step
  from one table, `NODE_EMPTY_HINT` (one row per node type, test-enforced).
  The share viewer shows "Nothing here yet" for the same case.
- Italian left in generation errors (`upstream-inputs.ts`, `node-data.ts`,
  `model-params.ts`, `upload-kind.ts`, download/export errors), the selection
  toolbar ("Migliora prompt") and route 404 messages is now English. The
  canvas page and its server action were left alone: another branch owns them.

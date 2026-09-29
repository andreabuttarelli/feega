# UI second pass: primitives and remaining surfaces

Second launch-quality review, scored at 1440 and 390 (light and dark).

## Shared canvas with an empty influencer node
`/s/[token]` answered 500 whenever the shared canvas held an influencer node
with nobody picked yet: `influencerView` queried `influencers.id = ''`, and
Postgres rejects an empty uuid. It now returns the empty view without a query.

## Canvas
- Credits read "50.00 (0)": the custom glyph rendered as a tiny parenthesised
  zero. `CreditAmount` now leads with the lucide `CircleDollarSign` icon (1 displayed credit = $1, see `credit-amount-format.ts`; `Coins` read as a chain link at 11px), and its
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

## Settings on primitives, global classes retired
Every settings page (project, brand, products, connected accounts, API keys,
team, billing, images & video, appearance, profile, danger zone) now renders
with `Panel`, `Field`, `Button`, `Input`, `Select`, `Textarea` and `Notice`.
Profile keeps the upload beside the avatar and a normal-width Save; billing
labels the balance "Credit balance" (it read "Credits used").

The legacy dashboard rules in `src/app.css` leaked into scoped components:
`.content`, `.grid`, `.panel`, `.panel-head`, `.field`, `.btn*`, `.mini*`,
`.approve-all`, `.acct`, `.status`, `.user` and `.head h1 !important` are gone,
and the two real consumers that needed them (`+error.svelte` buttons, the
settings column) carry their own scoped copy. The `* { margin: 0; padding: 0 }`
reset now sits in `@layer base`, so layered utilities beat it instead of
needing `!important`. The OAuth and CLI authorize pages were Italian; now
English.

## Assets, promote, wizard, calendar
- Assets: the file count moved into the active filter tab instead of floating
  beside Upload; source badges are quiet outline `Badge`s; meta no longer
  prints "800×800 —" when the size is unknown; empty states use `EmptyState`
  with one hint per filter (`EMPTY_HINT`).
- Promote (organic): Textarea, Select, Button; "Connect one" and "Create a
  brand" are real links; the disabled reason prints once, not under both
  buttons. Paid: gate CTAs and "Propose ad" use `Button`.
- Brand wizard: the top bar no longer repeats "Step N of 6" already shown above
  the progress bar; all 18 buttons are `Button`; checkboxes use ink, not the
  browser blue.
- Calendar: month navigation, brand filter and post popover actions use
  `Button`/`Select` with icons instead of "‹ ›" and "×" glyphs.
- Global `.tabs`/`.tab` and the dead content-library `.card*` rules are gone
  from `app.css` (they boxed the promote tabs and lifted every `.card` on
  hover); the three auth cards keep their border explicitly.
- Influencer panel names are 12px (were 10px).
- Share viewer: post, ads, embed and document nodes with nothing in them now
  return the empty view from `SHARED_VIEW_OF` (they drew a blank frame).

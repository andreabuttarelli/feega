# Model picker: one entry per model, names and prices

The Google group listed Nano Banana 2 and Pro twice, plus OpenRouter-named rows ("Google: Nano
Banana 2 (Gemini 3.1 ...)"), and token-priced rows showed "variable".

Cause: `offerableImages` offers every synced row no curated spec claims. OpenRouter also lists the
`-preview` ids of the same models, and keeps `Vendor: Name (codename)` as the label. Rows without
an entry in `IMAGE_OUTPUT_TOKENS` had no per-image price, so the run button said "variable".

- `canonical-image-models.ts`: one table, alias wire id to canonical wire id. An alias row is
  dropped when its canonical row is served; otherwise kept.
- `canvas/model-labels.ts`: `cleanLabels` strips `Vendor: ` and a trailing parenthesis; both stay
  when two models of a vendor would otherwise read the same.
- `imageOutputTokens`: exact table first, then a prefix table (`google/gemini-` uses the Nano
  Banana 2 tokens), so unknown Gemini image models get an estimate. Charge code is untouched.
- Price chip shows `~` when the quote is `variable` but a number exists.
- Kie.ai, Wiro and Higgsfield rows were already folded into routes (`discountFor`), not touched.
- Discarded: a migration. The sync only upserts; rows are filtered at read time, so no data change.
- `web-docs` price snapshot is generated from the live table; not edited by hand.

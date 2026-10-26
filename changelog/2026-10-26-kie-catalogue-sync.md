# Kie catalogue and prices come from Kie, not from a table

`kie-catalogue.ts` held three models and seven tools with hand-typed
credits; `KIE_PRICE_SOURCE` was a URL nobody fetched. Prices had drifted
(layer decomposition 24 credits in the table, 3.24 on the price list).

- Source of prices: `POST https://api.kie.ai/client/v1/model-pricing/page`,
  public, no key, max 100 rows per page, ~600 lines. Free-text descriptions
  are parsed for resolution (`1K`, `720p`, `1/2K`) and tier
  (`TURBO|BALANCED|QUALITY`); units we cannot bill (per token, per upscale)
  are dropped; two lines for the same slot keep the dearer one.
- Source of wires: the OpenAPI block on every `docs.kie.ai/market/*.md`
  page (listed by `llms.txt`): input names, enums, required fields. A model
  is added only if every required input is one we fill (prompt, aspect
  ratio, resolution, duration) and its id does not say it needs media
  (`image-to`, `edit`, `extend`, ...).
- `syncAiModels` fetches both every run. If either fails, Kie contributes no
  rows and the stored ones stay.
- The curated table keeps only what Kie does not publish: field mapping of
  the hand-wired models, the image tools, and `OPENROUTER_TWINS` (which Kie
  model is the discount route of which picker model).
- Kept out: models whose price lines point to a shared page (Seedream 5,
  Veo, Kling 2.6, Seedance 2.5) and every image-to-X/edit model.

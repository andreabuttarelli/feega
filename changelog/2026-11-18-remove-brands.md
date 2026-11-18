# Brands and products removed

Feega asked for a brand before it could publish anything, and a project could carry one. The
canvas never needed it (`projects.brand_id` was nullable and the normal case) and the brand kit,
brand memory and product catalogue pulled a second product into the first.

## What changed

- The brand entity, brand kit (logo, colours, fonts), per-brand memory and every brand-scoped UI,
  route and gate are gone. Motion videos, the canvas and the project chat run with no brand
  context.
- Products leave: store catalogue import, the Products node, and the Photo studio that worked on
  products.
- API and CLI follow the app: `/api/v1/brands/**` and the `brands`, `products`, `library`,
  `studio` commands and their MCP tools are removed. Billing is now
  `/api/v1/org/billing/{portal,checkout,checkout/one-time}` and API keys
  `/api/v1/org/api-keys`; `feega upgrade` takes no slug.
- `social_account_feed` nodes stay; they no longer write a brand.
- Per-user memory (`profiles.agent_memory`) stays.

## Decisions

- No `brandId: null` shims: parameters and branches were deleted with their callers.
- Tables (`brands`, `brand_fonts`, `brand_pins`, `products`, `brand_memory`) and the `brand_id`
  columns are not dropped here. A separate migration drops them after the deploy, so the previous
  deploy keeps working during the rollout. Migrations are immutable: none was edited.
- `write-rules.ts` and `query-tables.ts` in the contracts are generated from migrations, so they
  still list the old tables until that drop lands.
- The motion `BrandTokens` module is the document token set, not the brand entity; it stays.

## Discarded

- Keeping the brand as optional: it kept every gate and prompt branch alive for nothing.
- Dropping the tables in the same PR: breaks the old deploy mid-rollout.

See `docs/adr/0040-remove-brands.md`.

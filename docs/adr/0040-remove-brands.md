# 0040 — Brands and products removed

Status: accepted 2026-11-18.

## Context

A brand (logo, palette, fonts, voice, memory) and a product catalogue fed the Photo studio, the
brand-scoped CLI and API, and the brand context of every prompt. The canvas works without them
(`projects.brand_id` was already nullable) and asking for one before work started cost more than it
gave.

## Decision

- The code stops reading and writing `brands`, `brand_fonts`, `brand_pins`, `products`,
  `brand_memory` and every `brand_id` column. Per-user memory (`profiles.agent_memory`) stays.
- The Photo studio, the product and store-sync nodes, `/api/v1/brands/**` and the CLI commands
  `brands`, `products`, `library`, `studio` leave with them. Billing moves to
  `/api/v1/org/billing/*` and API keys to `/api/v1/org/api-keys`; `feega upgrade` takes no slug.
- The tables and columns are dropped by a separate migration after the deploy, never in the same
  change: until then the old code on the previous deploy still reads them.

## Consequences

`ai_calls` rows no longer carry `brand_id`. `NEW_DATABASE_STRUCTURE.md` keeps the old design as
history.

# Billing checkout field renamed usd → credits

**Why.** `usd` in the checkout body has meant credits since the feega plan
migration (1 credit = €1); the name still said dollars. No backward-compat
alias: no real integrations exist yet.

**What changed.**
- `CHECKOUT_LINK` / `ONE_TIME_CHECKOUT_LINK` input and `PlanSchema` in
  `packages/api-contracts/src/billing.ts`: `usd` → `credits`, descriptions
  updated. `cli/lib/contracts/billing.ts` re-synced (`sync-contracts.sh`).
- Both checkout endpoints (`src/routes/api/v1/brands/[slug]/billing/checkout`,
  `.../checkout/one-time`) read `parsed.data.credits`; `SUBSCRIPTION_RUNGS`
  keys on `credits`.
- `feega upgrade` CLI flag `--eur N` → `--credits N`; `--top-up N` unchanged.
  `cli/commands/upgrade.ts`, `cli/cli.ts`.
- Docs: `cli/docs/api.md`, `cli/docs/quickref.md`, `cli/llms.txt`,
  `cli/skills/feega/references/cli.md` (synced to
  `cli/plugins/feega/skills/feega` via `sync-plugin-skill.sh`).
- Tests updated first (red before the rename, green after):
  `checkout/server.test.ts`, `checkout/one-time/server.test.ts`,
  `packages/api-contracts/src/index.test.ts`.

**Discarded.** No compatibility alias for `usd` — nothing depends on it yet.

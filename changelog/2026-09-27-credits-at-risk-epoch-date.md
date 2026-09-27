# Billing: an at-risk row with no expiry showed "01/01/1970"

`org_credits_at_risk` groups by `org_id` and aggregates `expiring_credits`/`next_expiry` with a
`FILTER (WHERE expires_at IS NOT NULL)`. An org with only non-expiring grants still gets one row
back — both columns `NULL`, not an absent row. `+page.server.ts` mapped that row straight into
`atRisk` and the template did `new Date(null).toLocaleDateString()` → epoch.

## What changed

- `load` in `src/routes/p/[projectId]/settings/billing/+page.server.ts` now drops rows where
  `next_expiry` is null before mapping to `atRisk`. No template change needed: an empty array
  already hides the "credits expiring" line (`{#if data.credits.atRisk.length}`).
- Regression test: `page.server.test.ts` — "drops an at-risk row with no expiry instead of
  showing epoch 1970".

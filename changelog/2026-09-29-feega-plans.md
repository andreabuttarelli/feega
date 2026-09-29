# Billing aligned with feega.app plans

**Why.** feega.app sells €8/16/32/64/128/256 a month at 1 credit = €1 (EUR prices, lookup keys already live in Stripe; USD prices inactive); the app sold a different
ladder ($5–$400, 70:1 one-time) on price ids read from seven env vars, and
`credits_from_price_id()` was a placeholder. No subscription could have granted credits.

**What changed.**
- `CREDIT_LADDER` is the one plan table: price, credits (`price * 100` ledger units), Stripe
  `lookup_key` `feega_monthly_<price>`. Top-ups sell the same tiers at the same rate.
- Stripe prices are resolved by lookup key (one `prices.list`, cached in memory; a price whose
  amount or currency (not `eur`) disagrees with its tier is ignored). The API field stays `usd` for compatibility; its value is euros. `STRIPE_PRICE_ID_SUBSCRIPTION_*` removed.
- Removed dead Go/Starter/Pro Stripe code: `PRICES`, `priceFor`, `geoCouponFor`,
  `ensureBrandCustomer`, `createCheckoutSession`.
- Checkout returns to `/p/<id>/settings/billing?checkout=success&session_id=…` on `appOrigin`;
  the page confirms and polls the balance. Current plan read from the subscription's lookup key.
- Migration `20260929_feega_plan_grants.sql`: grants move from `stripe.subscriptions` to
  `stripe.invoices` (paid, `subscription_create`/`subscription_cycle`, idempotent on invoice
  id) so renewals grant; credits from `stripe.prices.metadata.credits`, fallback subscription
  metadata. Every trigger requires `metadata.app = 'feega'` and an existing `metadata.org_id`:
  the Stripe account is shared. The checkout trigger read `status`/`payment_status` columns the
  live Sync Engine table does not have (checked on `information_schema`); it now reads
  `_raw_data`. A malformed or unknown `org_id` used to raise inside the trigger (uuid cast, FK)
  and would have broken syncing for every app on the account.
- `scripts/stripe-grants-harness.mjs` (`npm run test:stripe-grants`) runs the triggers on a
  local Postgres against live-shaped stub tables.
- CLI `feega upgrade` opened a dead `/app/billing` URL; it now mints the checkout link via the
  API (`--eur`, `--top-up`).

**Discarded.** Portal `subscription_update_confirm` with an exact price (needs the item id; the
portal picker is enough). Mid-cycle proration invoices (`subscription_update`) grant nothing:
the new tier's credits arrive at the next cycle.

**Still open.** `src/lib/plans.ts` (Go/Starter/Pro) still feeds `plan-budget`, `PlanCards` and
the public pricing surfaces; it is no longer tied to Stripe.

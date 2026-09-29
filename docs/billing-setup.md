# Billing setup: Supabase Stripe Sync Engine

Purchases (subscriptions and one-time credit packs) are refused until this is done —
`public.billing_grants_ready()` gates every checkout path and answers false until both steps
below are complete. See `src/lib/server/billing-readiness.ts`.

## 1. Install the Stripe Sync Engine on project `klnswzhhgrqvbfjzioul`

Test mode first. The package is `stripe-sync-engine` (github.com/stripe/sync-engine — the
integration Supabase recommends; the npm package still installs under that name).

1. Get a **test-mode** Stripe secret key (`sk_test_...`) from the Stripe dashboard.
2. Run its migrations against the project's Postgres connection string (`DATABASE_URL`, direct
   connection — not the pooler). This creates the `stripe` schema: `stripe.customers`,
   `stripe.checkout_sessions`, `stripe.subscriptions`, etc. Nothing in this repo creates those
   tables; they are the Sync Engine's, not ours.
3. Deploy the Sync Engine's webhook handler (its own server, or the Supabase Edge Function
   variant if using that route) and point a **test-mode** Stripe webhook at it.
4. In the Stripe dashboard, add a webhook endpoint (test mode) subscribed to at least:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_succeeded`
   - `price.created`
   - `price.updated`
   - `customer.created`
   - `customer.updated`

   (The Sync Engine also backfills from the Stripe API directly, so a first sync doesn't strictly
   need the webhook live yet — but the webhook is what keeps `stripe.subscriptions` and
   `stripe.checkout_sessions` current going forward.)

Once the `stripe` schema exists and is being written to, apply, in this order:

- `supabase/canvas-migrations/20260924_billing_grants_ready.sql` (already live).
- `supabase/canvas-migrations/20260924_stripe_sync_grants.sql` — superseded; apply only because
  migrations run by filename, immediately followed by the next one.
- `supabase/canvas-migrations/20260929_feega_plan_grants.sql` — the live triggers:
  - `stripe.invoices`: a paid invoice with `billing_reason` `subscription_create` or
    `subscription_cycle` grants the month's credits, once per invoice id, expiring at the
    period end. Credits come from the price's `metadata.credits` in `stripe.prices`, falling
    back to the subscription's `metadata.credits`.
  - `stripe.checkout_sessions`: a paid one-time checkout grants `metadata.credits`, never
    expiring.
  - `stripe.subscriptions`: links/unlinks `orgs.stripe_subscription_id`.
  - Every trigger ignores rows without `metadata.app = 'feega'` and a `metadata.org_id` of an
    existing org: the Stripe account is shared with other products.

Verify with a local Postgres: `DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres npm run
test:stripe-grants`.

## 2. Create the 6 subscription Prices

Plans (`src/lib/credit-ladder.ts`): €8 / €16 / €32 / €64 / €128 / €256 per month, 1 credit = €1.
The app finds each Price by `lookup_key` — no env var, no price id in code. One-time top-ups need
no Price (the amount is inlined).

For each tier N, a recurring monthly EUR Price (a Price in any other currency is ignored):

| field | value |
|---|---|
| product name | `feega N` |
| `lookup_key` | `feega_monthly_N` |
| `unit_amount` | `N * 100` (euro cents) |
| `metadata` | `app=feega`, `credits=N*100` (ledger units: 100 = 1 displayed credit) |

A Price whose `unit_amount` disagrees with its tier is ignored. A tier with no Price answers
`subscriptions_not_configured`; top-ups work regardless.

Configure the customer portal to allow switching between these six Prices: the app sends existing
subscribers there to upgrade or downgrade.

## Going live

Repeat both sections with **live** Stripe keys/Prices and a **live**-mode Sync Engine
installation once test mode is verified end to end (a real test-card checkout completes and the
org's `credit_ledger` gets a row).

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
    `subscription_cycle` grants the month's credits, once per invoice id. Credits come from the
    price's `metadata.credits` in `stripe.prices`, falling back to the subscription's
    `metadata.credits`.
  - `stripe.checkout_sessions`: a paid one-time checkout grants `metadata.credits`, never
    expiring.
  - `stripe.subscriptions`: links/unlinks `orgs.stripe_subscription_id`.
  - Every trigger ignores rows without `metadata.app = 'feega'` and a `metadata.org_id` of an
    existing org: the Stripe account is shared with other products.

- `supabase/canvas-migrations/20261112_credits_never_expire.sql` — credits never expire: the
  balance sums every grant, the invoice trigger writes no `expires_at` and grants
  `metadata.credits × line quantity` (per-seat ready), and the `org_credits_at_risk` view is
  dropped. Verified in-process by `npm run test:credit-expiry` (pglite, no database needed).

- `supabase/canvas-migrations/20261113_editor_seats.sql` — one file, so no order to get wrong:
  - adds `orgs.editor_seats_grandfathered_at` and stamps every free org with more than one editor
    on the day it is applied (nothing sets it later; subscribing clears it);
  - adds `orgs.seats_paid` / `seats_paid_until` (the seats Stripe was paid for in the
    subscription's current period; written only by the app's `syncSeats`, through the service role,
    around each quantity change; backfilled from `stripe.subscriptions` for existing per-editor
    subscriptions) and `seats_checked_at` (the reconcile cron's cursor);
  - a renewal grants `metadata.credits × quantity` summed over the plan lines, wherever they sit;
  - a paid `subscription_update` grants what that invoice charged:
    `round(least(Σ proration line amounts, invoice total) × credits / unit_amount)`, euro only,
    once per invoice. It does not depend on how Stripe splits the lines (a credit/debit pair or one
    line), nor on the order invoices arrive in;
  - `canceled` / `incomplete_expired` unlink the org and turn every admin and member into a
    viewer; `unpaid` keeps it linked and turns them into viewers (they stay viewers when the plan is
    paid again; the owner promotes them); `paused` unlinks without demoting; `past_due` keeps it
    linked and blocks new editors.
  `npm run test:seat-billing` runs it in pglite, and CI runs both pglite harnesses.

Verify with a local Postgres: `DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres npm run
test:stripe-grants`.

## 2. Create the plan Price

One plan (`PLAN` in `src/lib/credit-ladder.ts`): €9 per editor per month, 500 credits per
editor, 100 credits = €1. The app finds the Price by `lookup_key` — no env var, no price id in
code. Top-ups (€10 / €20 / €50 for 1,000 / 2,000 / 5,000 credits, `TOP_UPS`) need no Price: the
amount is inlined in the Checkout Session.

| field | value |
|---|---|
| product | `feega` |
| recurring | monthly, per unit (licensed) |
| currency | EUR (a Price in any other currency is ignored) |
| `unit_amount` | `900` |
| `lookup_key` | `feega_monthly_9` |
| `metadata` | `app=feega`, `credits=500` (credits per seat; the trigger multiplies by quantity) |

A Price whose `unit_amount` is not 900 is ignored, and the app answers
`subscriptions_not_configured`; top-ups work regardless.

The six retired Prices (`feega_monthly_8` … `feega_monthly_256`): set them **inactive, never
delete them**. A subscriber still on one keeps renewing — the trigger reads that Price's
`metadata.credits` — and the credits page names their plan as current.

Configure Stripe **dunning (Billing → Revenue recovery → retries) to end by cancelling the
subscription or marking it unpaid**, never by leaving it `past_due`: a team left `past_due`
forever keeps its editors (it only cannot add more), while `unpaid` turns them into viewers and
`canceled` ends the plan.

Configure the customer portal **without plan switching and without quantity changes**:
invoices, payment method and cancellation only. The quantity is the number of editors, and only
the app sets it (`syncSeats`): an editor beyond the seats already paid this period is charged at
once (`always_invoice`); a removed editor lowers the quantity with no proration (the seat stays
paid until renewal, and re-adding within the period is free). It runs on an accepted editor
invite, a role change across viewer/editor, a removal or a leave, and hourly from the Vercel cron
`/api/v1/billing/seats/reconcile` (40 teams per run, oldest checked first, 502 when Stripe refuses
one). A subscription on a retired price (`feega_monthly_8` …) is never touched. Seat changes are
serialised per team (`claim_seat_sync`, a 30-second lease on `orgs.seats_sync_until`): the target
is computed from the member rows inside it, and a lower quantity is never sent with
`always_invoice`.

## Going live

Repeat both sections with **live** Stripe keys/Prices and a **live**-mode Sync Engine
installation once test mode is verified end to end (a real test-card checkout completes and the
org's `credit_ledger` gets a row).

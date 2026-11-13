# Billing: one plan, three top-ups, credits that never expire

Before: six monthly prices (€8 … €256, `CREDIT_LADDER`), each also sold as a one-time pack, and
the app showed ledger units ÷ 100 ("1 credit = €1") while the ledger and the landing counted
100 credits to the euro. Existing subscribers changed plan through the Stripe portal's
`subscription_update` flow.

Now `PLAN` (€9, 500 credits, lookup key `feega_monthly_9`) and `TOP_UPS` (€10/€20/€50 for
1,000/2,000/5,000) in `credit-ladder.ts`. Credits are numbers fixed by the owner, not derived
from the price. `formatCredits` shows ledger units as whole credits; `formatPrice` shows euros.
The retired prices stay only in `planForLookupKey`, so a subscriber on `feega_monthly_8` …
`_256` keeps renewing and is shown as current; none of them can be bought.

The portal upgrade flow is gone: `?/upgrade` became `?/subscribe` and refuses an org that
already subscribes; the API checkout answers `already_subscribed` with `app_billing_url`
instead of `no_subscription`. The `credits` input of `create_checkout_link` is kept but now
means credits (only `500` passes); old CLI values (`8` … `256`) get `unknown_plan`, loudly.
`feega upgrade --credits` was removed; `--top-up` takes 1000/2000/5000.

Defect fixed: `org_credit_balance` dropped expired grants but kept every debit, so a subscriber
who spent a month's grant lost the same amount again at renewal. Migration
`20261112_credits_never_expire.sql` removes the expiry filter, writes renewal grants without
`expires_at`, multiplies the grant by the invoice line quantity (ready for per-editor seats), and
drops `org_credits_at_risk`. Credit holds stopped skipping old grants so they agree with the
balance. `scripts/credit-expiry-harness.mjs` runs the real SQL in pglite
(`npm run test:credit-expiry`).

Not done here: per-editor seat quantity (next PR), plan-gated limits in `render-length.ts`,
the two definitions of "paid", tax configuration.

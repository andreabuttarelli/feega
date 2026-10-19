# In-app purchases feed the same credit ledger as Stripe

The native shell is headed to the App Store, Mac App Store and Play, where credits must be sold
through the store. Before: only Stripe (Sync Engine triggers) wrote `credit_ledger` and
`orgs.stripe_subscription_id`.

Now `POST /api/v1/webhooks/revenuecat` (shared secret in `Authorization`) maps each RevenueCat
event to a ledger grant, a refund debit or a store plan (`orgs.store_plan_*`) and applies it in
one RPC, `apply_store_event`, idempotent on the event id (`store_events`). Product ids reuse the
Stripe ladder: `feega_monthly_<eur>` and `feega_pack_<eur>`. RevenueCat `app_user_id` is the org
id. Sandbox events are ignored unless `REVENUECAT_SANDBOX=accept`.

The credits page shows a store paywall instead of Stripe checkout/portal only inside the native
shell with `NATIVE_STORE_BILLING=on`; off by default, so nothing changes for anyone today. The
paywall calls the shell plugin `feega-iap`, which does not exist yet (plan in ADR 0015).

Migration `20261019120000_store_entitlements.sql` is not applied. Uncensored mode stays
Stripe-only. A "no-AI lifetime" product is deferred until there is a no-AI feature to unlock.

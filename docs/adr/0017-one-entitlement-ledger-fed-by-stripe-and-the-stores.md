# One entitlement ledger, fed by Stripe and by the app stores

Context: the native shell (ADR 0009) ships to the App Store, Mac App Store and Google Play. Apple
(guideline 3.1.1) and Google require their own billing for digital goods bought inside the app;
credits and plans are digital goods. The web keeps Stripe. Two payment rails must not become two
entitlement models.

Decision:

- **The org owns the entitlement**, never a store. `credit_ledger` (grant − debit) is the credit
  balance every AI gate reads (`gateCredits`); `orgs` says whether a plan is active:
  `stripe_subscription_id` (web) or `store_plan_*` with `store_plan_expires_at > now()` (stores).
- **Two feeds, one ledger.** Stripe writes through the Sync Engine triggers (`stripe_event_id`).
  RevenueCat writes through `POST /api/v1/webhooks/revenuecat` → `readRevenueCatEvent` (pure
  mapping) → `apply_store_event` (one transaction: event row, ledger rows keyed on
  `store_event_id`, `orgs.store_plan_*`). Neither feed can grant twice: the Stripe key is the
  event/period id, the store key is the RevenueCat event id (`store_events.id`).
- **RevenueCat `app_user_id` = org id**, set by the app after login. Credits are org-level, so a
  purchase lands on the org whoever buys it. Restore purchases re-syncs the store receipt to the
  same id; RevenueCat then sends `TRANSFER`/renewal events, never a second grant for one event.
- **Products map to the same ladder** (`src/lib/store-products.ts`): subscription
  `feega_monthly_<eur>` (= Stripe lookup key) grants the rung credits expiring at the period end;
  pack `feega_pack_<eur>` grants the same credits, permanent.

| RevenueCat event | Subscription | Credit pack |
|---|---|---|
| `INITIAL_PURCHASE`, `RENEWAL`, `NON_RENEWING_PURCHASE` | grant, expiring; plan set until expiration | grant, permanent |
| `CANCELLATION` + `CUSTOMER_SUPPORT` (refund) | debit `refund`; plan cleared | debit `refund` |
| `CANCELLATION` (auto-renew off), `BILLING_ISSUE`, `PRODUCT_CHANGE`, other | recorded, no effect | recorded, no effect |
| `EXPIRATION` | plan cleared, granted credits expire on their own | — |

- **Sandbox vs production**: sandbox events are ignored unless `REVENUECAT_SANDBOX=accept`
  (preview/dev deploys only). The dashboard `TEST` event has no org and is answered without a write.
- **Where Stripe is hidden**: `billingChannelOf` returns `store` only for the native shell with
  `NATIVE_STORE_BILLING=on`; then the credits page shows the store paywall and no Stripe checkout
  or portal. Off by default: today's native builds are not on a store and keep Stripe.
- **Not in the stores**: uncensored mode stays web-only (it reads `stripe_subscription_id` alone);
  App Store guideline 1.1 forbids it in the app.

Native side: the hosted page calls `plugin:feega-iap|purchase|restore` (`src/lib/store-purchases.ts`).
The shell must ship a Tauri 2 mobile plugin wrapping RevenueCat `purchases-ios` (StoreKit 2) and
`purchases-android` (Play Billing), with a remote-domain capability that allows only those two
commands to the app origin. Until it exists the paywall says purchases are unavailable.

Deferred: a one-time "no-AI lifetime" product. It needs a feature an org without credits can
use and a column that says so; it maps to a third `StoreProductKind` with a permanent plan
(`store_plan_expires_at = 'infinity'`) once that feature exists.

Rejected: a separate store entitlement table read alongside Stripe (two answers to "is this org
paid?"); per-user RevenueCat ids (credits would follow a person across orgs).

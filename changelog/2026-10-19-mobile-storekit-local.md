# Mobile: in-app purchases testable without App Store Connect

Before: the paywall needed a RevenueCat key, so nothing could be bought on the simulator, and an
app store plan never showed as "Current plan" in `/app/credits` (it read Stripe only).

Now:

- `Products.storekit` with the 12 products; a vitest keeps it equal to `store-products.ts`.
- `FeegaStoreKit` (StoreKit 2, Debug builds only) is the store when no RevenueCat key is set;
  with the key RevenueCat wins. Production switches by configuration.
- `/app/credits` names the rung of an unexpired `orgs.store_plan_product`.
- The paywall says a purchase completed (credits arrive with the webhook, seconds later).
- `AppUITests` walks paywall → buy → simulated RevenueCat webhook → ledger → restore → refund
  on a local dev server, test account only; `FEEGA_DEMO_SESSION` seeds the session.
- Sign in with Apple: entitlement file and `CODE_SIGN_ENTITLEMENTS`; credential mapping moved to
  `FeegaCore.AppleIdentity` with tests. The sheet itself needs a team and an Apple ID.

Discarded: posting the webhook from the app in Debug (the page would fake what RevenueCat does);
a separate entitlement read for store plans (ADR 0017 keeps one ledger).

No public changelog: store billing is off and the app is not in the store.

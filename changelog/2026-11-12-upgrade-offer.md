# 15% upgrade offer on the canvas

A non-blocking banner on the canvas offers 15% off the first month, shown after the agent's
first finished turn or when a turn is refused for credits. Never opens checkout by itself.

- Real offer: one Stripe promotion code per user (`FEEGA15<user>`), on coupon
  `feega_upgrade_15` (15%, once), `max_redemptions` 1, `expires_at` one hour after creation.
  The code is found by its string, so the deadline lives in Stripe and never resets; after it
  expires no new code is made.
- Shown only to org owners without a subscription, when billing grants are ready.
- Checkout goes to the cheapest rung with the code applied.
- Events: `upgrade_offer_shown` / `_clicked` / `_redeemed` (redeemed is detected from
  `times_redeemed` and marked in the code metadata so it counts once). Needs migration
  `20261112100000_upgrade_offer_events.sql` to widen the `product_events.event` check.
- Development refuses a non-test Stripe key.

Discarded: a table for offers (Stripe already holds code and deadline).

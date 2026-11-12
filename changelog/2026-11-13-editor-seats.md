# Billing: the plan is per editor

The €9 plan is now per human editor (owner, admin, member); viewers are free and agents never
take a seat. The Stripe subscription quantity is the editor count, set only by the app through
`syncSeats` (`team/seat-billing.ts`): at checkout, when an editor invite is accepted, when a
role crosses viewer/editor, when an editor is removed or leaves, and hourly by the cron
`/api/v1/billing/seats/reconcile`. A failed Stripe call never undoes the member change: the cron
corrects it within the hour.

"Paid" for seats is now `orgs.stripe_subscription_id` (`billingTierOf`), not "ever bought
credits" (`isOrgFree`): a top-up alone no longer unlocks editors. A free team has
`FREE_EDITOR_SEATS = 1`. An editor invite accepted after the team stopped paying joins as a
viewer.

Ledger: a seat added mid-period grants its prorated credits from the net of the
`subscription_update` proration lines (rounded to the nearest credit); a removed seat claws
nothing back. When a subscription ends, every editor but the owner becomes a viewer. Free teams
that already had several editors are stamped `editor_seats_grandfathered_at` by the migration and
keep them; subscribing clears the stamp.

Discarded: grandfathering every cancelled team (a team could add ten editors, cancel, and keep
them free); granting a new seat's credits only from the next renewal (paying for a seat that
brings nothing reads as a bug); a lazy reconcile on page loads, since the Vercel cron already
exists.

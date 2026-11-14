# Product analytics: one catalog, org groups, revenue, replay

Before: `CoreEvent` went to PostHog, `ProductEvent` only to the `product_events` table, so the funnel
(signup, canvas created, agent failures) never reached PostHog; no org grouping, no revenue, replay
config without sampling, Sentry and PostHog unlinked.

Now:
- `track()` also forwards to PostHog when a user id is known; anonymous rows stay table-only.
- Server events carry `$groups.organization`; org creation sends `$groupidentify`.
- New events: onboarding_tour_completed, agent_connected, team_invite_sent/accepted,
  generation_failed, export_failed, plan_upgraded/downgraded/cancelled, revenue_recognized/refunded,
  client export_saved (survey trigger).
- `POST /api/webhooks/stripe` (needs `STRIPE_WEBHOOK_SECRET` + dashboard endpoint) forwards
  subscription, invoice and refund events on the org group. The Sync Engine webhook stays as is.
- Activation and north star as code in `src/lib/activation.ts`.
- PostHog replay sampled at `REPLAY_SAMPLE_RATE`, canvas/video/img blocked; Sentry tags with the
  PostHog person and session; `featureFlag()` helper.
- `docs/analytics.md` is the catalog; a test fails when an event is missing from it.

Discarded: merging the two enums into one (dozens of call sites move for no behaviour change; the
catalog test gives the single list), a separate `first_frame` event (PostHog first-time math on
`frame_created` says the same).

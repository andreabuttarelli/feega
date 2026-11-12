# A landing prompt starts the agent; every plan runs Opus 5.5

Before: the landing handed its prompt to `/app`, which only prefilled the
composer. The visitor had to press send again. The free plan ran Haiku for
20 unbilled turns. Nothing recorded where people stopped: PostHog is not
connected.

Now:

- The landing adds a nonce (`go`). `/app` claims it once
  (`startHandoff`, cookie `feega_handoffs_used`) and submits the composer by
  itself; the query is stripped with `replaceState`. A refresh or back only
  prefills. A GitHub/Figma/folder source, missing images or an empty prompt
  wait for input. The login cookie path gets `resumed=1` and a nonce if the
  link had none.
- Every plan runs Opus 5.5 and every turn is debited. `withoutDebit` and the
  20-turn cap are gone. A new user gets 100 credits ($1) once, at the first
  org (`credit_ledger` source `promo`, note `signup_grant`, one per user,
  unique index). A failed grant never blocks signup. Out of credits → 402 →
  the chat's upgrade screen.
- `product_events` (server-only insert, RLS on, no grants) records the funnel
  through one `track()`; it fails soft so the code can ship before the
  migration. `scripts/funnel.mjs` prints people per step per day from the
  view `product_funnel_daily`.

Discarded: claiming nonces in the DB (the table may not exist at deploy);
a separate anonymous cookie (the nonce already links pre- and post-login).

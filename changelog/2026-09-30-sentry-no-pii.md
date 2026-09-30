# Sentry without personal data

**Why.** Legal review: client Sentry ran with `sendDefaultPii: true` (IP,
cookies, headers, user) and an unmasked session replay.

**What changed.** `src/lib/sentry-privacy.ts` holds the config both inits
spread (`SENTRY_PRIVACY`, `sendDefaultPii: false`) and `scrubEvent`, run in
`beforeSend` on client and server: request reduced to the URL without query,
user reduced to `id`, emails in message/exception masked. Replay uses
`REPLAY_PRIVACY` (mask all text and inputs, block media) and is attached only
with Analytics consent (`Tracker.SentryReplay`). A source test fails if either
init drops the shared config.

**Discarded.** Hashing the user id: nothing calls `Sentry.setUser`, so no id
is sent today.

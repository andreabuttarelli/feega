# Tests never reach the live Supabase project

Production logs showed `POST rpc/org_credit_balance` answering 400 about 28
times a day, `invalid input syntax for type uuid: "org-1"`. The caller was not
the app: `canvas/actions.test.ts` and `influencers/page.server.test.ts` ran
the real credit gate, and `ai-log.test.ts` / `sandbox-credits.test.ts` the
real brand lookup. Vitest loads `.env`, so every local run sent fixture ids to
production; the gate is fail-open, so the tests stayed green.

`src/test/no-live-supabase.ts` (a Vitest setup file) answers any `*.supabase.co`
request with 503 and fails the test that made it. The four tests now mock the
boundary instead.

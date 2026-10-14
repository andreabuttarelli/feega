# Production e2e runs inside the test account

**Why.** The seeded `@real` harness created a user and an org per test and deleted them after.
On production the org cascade took 11-23 s and every other query queued behind it: the 6.7 s and
9.3 s frame opens seen in PostHog on 14/10 both fell inside such stalls.

**Now.** When `PUBLIC_SUPABASE_URL` is production, `createE2eSession` signs in as
`test@dazero.co` (`E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`), creates one project + canvas in that
account's org with the user's own RLS client, and teardown deletes only that project's assets,
chat threads, nodes, canvases, storage prefix and the project row. The `admin` fixture is the
same RLS client there. Any other database keeps the throwaway user/org mode.

**Guards** (`scripts/e2e/target.ts`, unit-tested): production refuses any account but the test
one, and refuses admin user/org writes — also at the top of `eval:bootstrap`, `eval:canvas`,
`eval:gen-node`, `eval:image-node`. `@real` runs are serial (`workers: 1`).

**Skipped on production:** the zero-credit spec (the test account has credits), `frame-collab`
(needs a second user), `calendar-checkbox` (writes brands outside the project).

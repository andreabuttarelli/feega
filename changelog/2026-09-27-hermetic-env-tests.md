# Hermetic tests: no secret from .env

`prompt-enhance.test.ts` and `actions.test.ts > run_loop` passed only with `.env`
(ENHANCE_PROMPT_MODEL / SUPABASE_SERVICE_ROLE_KEY), red in CI. The enhancer
test mocks `craft-model`; `wholeLoopCreditsAvailable` now calls
`createAdminClient` inside its fail-open `try`, so a missing key cannot crash
the loop estimate.

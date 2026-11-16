# Credits: atomic holds, durable debits, fail closed

## Why
An audit of the money path found four defects: render holds computed the balance in app code
and could overspend under concurrency; the debit for every AI call was a detached promise after
the call, so a failed insert left the usage free; the credit gate failed open (and the whole
billing provider fell back to "unmetered" if its module failed to load); a retried debit could
be charged twice or not at all.

## What changed
- `20261116_credit_spend_atomic.sql`: `credit_hold` (per-org advisory lock, all-or-nothing,
  idempotent by key), `credit_release`, `credit_release_stale`, `credit_gate`, and an
  `ai_calls` AFTER INSERT trigger that writes the debit in the same transaction as the usage
  row (unique per `ai_call_id`). `ai_calls.hold_key` lets a render's usage row settle its hold.
- `logAiCall` writes the row with its own id, retries, counts `23505` as landed, runs under
  `waitUntil`, and reports to Sentry a row that never lands. The app never writes a debit.
- The gate reads `credit_gate` on every spend (60 s cache removed) and refuses with
  `BillingUnavailableError` when it cannot: DB error, missing function, brand with no org,
  billing module absent. Explicit `BILLING_PROVIDER=open` and local mode stay open, decided in
  `billingProvider()`.
- `spendGate()` sits in the provider chokepoints (every LLM request, OpenRouter image/video,
  ScrapeCreators, audio, code-import sandbox); `SPEND_SITES` declares every module that records
  spend and the test fails if one is missing or does not carry its gate.
- The canvas tick releases holds older than a day that nothing settled.

## Rejected
- A hold before every LLM call: no cost estimate exists before the call; the gate plus the
  atomic debit bound overspend to calls in flight.
- A fallback to the old two-insert debit when the function is missing: it would keep a lossy
  path alive. The gate needs `credit_gate`, so before the migration AI is refused, never free.

## Deploy order
Apply the migration first, then deploy. Code first = every AI action answers 503 until applied.

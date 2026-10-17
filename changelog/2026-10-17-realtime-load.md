# Realtime broadcast budget and load test

Multiplayer cursors and live drag will ride Supabase Broadcast. The plan
in MULTIPLAYER.md quoted plan quotas from memory; they are now checked on
supabase.com/docs/guides/realtime/limits (2026-10-17) and live in
`PLAN_LIMITS` (`src/lib/realtime/broadcast-budget.ts`): messages/s Free
100, Pro 500, Pro without spend cap and Team 2,500; connections 200 / 500
/ 10,000; presence messages/s 20 / 50 / 1,000; payload 256 KB / 3 MB.

`budgetOf` counts a message once on send and once per receiver. At 20 Hz
five peers on one canvas use the whole Pro quota (500/s); ten need Team or
no spend cap. So the cursor tick coalesces cursor, selection and drag in
one message, and sends nothing when idle.

`npm run eval:realtime-load -- --peers=10 --hz=20 --seconds=20` opens N
connections as the test account (`E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`) on
a throwaway public broadcast topic, sends at the given rate and prints
loss, refused sends and p50/p95/p99 latency. No database writes, no model
calls. Its verdict decides whether a per-canvas relay is ever built.

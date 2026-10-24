# Spend caps (FL-10)

**Before:** the only limit was the org credit balance; one member could spend all of it.

**Now:** `org_spend_caps` (migration in #1267, applied separately) holds three cap scopes per org:
`org_member` (each member, anywhere), `project_member` (each member in one project) and
`project_total` (one project, everyone), each with `reset` none or monthly (UTC calendar month).
`capRefusal` runs before any spend in `runGenNode` (the canvas Generate path, loops included) and
at the start of the project agent turn; usage is the sum of `ai_calls.cost_usd`, read with the
admin client because that table's RLS is by brand. A reached cap answers `cap_reached` (the node
run is `refused` with that text; the agent route answers 403 `{error: 'cap_reached'}`). Admin API
`/api/v1/org/spend-caps` (GET members, PUT owners/admins, `cap_usd: null` removes), Settings >
Billing limits, CLI `feega caps [set <scope> <usd|off>]`, MCP `spend_caps`.

**Decisions:** a missing table (migration not applied) or an unreadable ledger reads as "no caps":
the gate fails open and logs, like the credit gate. The narrowest cap is named first in the
message. A cap is refused at exactly the limit, not after it; one run can overshoot by its own
cost, because the cost is only known afterwards. Not gated yet: image/video/audio routes that
call `media-generate` directly without `runGenNode`, the motion agent, and brand-wizard.
`ai_calls` has no index on `(org_id, actor_id, created_at)`; add one concurrently if the sum gets slow.

**Tests:** `spend-caps/policy|gate|store.test.ts`, `generate.model3d.test.ts` (refused before the
gateway), `agent/server.caps.test.ts`, route test, settings page test, CLI api test,
`tests/e2e/spend-caps.spec.ts`.

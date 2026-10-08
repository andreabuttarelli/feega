# `effects` table and `/api/v1/org/custom-effects`

Ticket 3 of custom effects. Storage for AI-written shaders.

**Scope: the workspace (org), not the project.** User decision: an effect written once is
reused across every project of the org. So `unique (org_id, name)` among live rows, no
`project_id` (the spec draft had one).

**Shape.** `name version frag params check_state check_problems cost_ms`, actor columns,
`deleted_at`. RLS `org_id in auth_org_ids()`. Writes go through `repos/effects.ts`:
`parseEffect` refuses (400), `lintFrag` problems are stored as `check_state = failed`, not a
refusal — the agent needs to read them back. Patch is `where version = $expected`, zero rows =
`409 conflict`; `edits: [{find, replace}]` like component ops.

**Before the migration is applied.** `PGRST205/42P01` → `GET` answers
`{ effects: [], available: false }`, writes `503 unavailable`. Nothing crashes.

**Migration** `20261008190000_effects.sql` — not applied.

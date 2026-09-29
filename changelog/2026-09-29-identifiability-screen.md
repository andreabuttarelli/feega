# Identifiability screen for uncensored generations

The existing safety screen (`screen.ts`) judges content categories — sexual, violent, hateful —
but says nothing about whether a prompt is specific enough to point at a real person: a named
tattoo, an exact facial description, a `@handle`, a workplace with a name. On uncensored models
that gap matters more than elsewhere.

Added a second, independent check that runs only for `uncensored: true` requests, in parallel
with the existing content check — both must pass:

- **`policy.ts`**: `IDENTIFIABILITY_CATEGORIES`, the same shape as `MODERATION_CATEGORIES`
  (`generic`, `distinctive_marks`, `specific_face`, `named_or_referenced_person`,
  `personal_context`), each with its own `escalateAbove`/`clearAtLeast`. `judgeDecision` and the
  new `identifiabilityDecision` both call a shared `decisionAgainst(categories, clearChoice,
  decision)` instead of duplicating the threshold logic — one table-driven function, two tables.
  `IDENTIFIABILITY_JUDGE_SYSTEM` is the LLM escalation prompt for this check.
- **`jev.ts`**: `jev()` now takes an optional `categories` so the same adapter builds Jev criteria
  from either table, instead of a second Jev client.
- **`screen.ts`**: `SCREEN_STAGES`, a table keyed by `uncensored`, says which stages run
  (`content` only, or `content` + `identifiability`) — applicability is a table row, not an
  `if (uncensored)` scattered at the call site. Both stages run via `Promise.all` and the first
  refusal wins; either one failing closed (Jev unavailable) refuses the whole request.
- **`moderation-config.ts`**: wires `decideIdentifiability`/`judgeIdentifiability` alongside the
  existing ports, logged under their own `ai_calls` labels
  (`moderation.jev.identifiability`, `moderation.judge.identifiability`) so cost is visible
  per-check.
- **`moderation_checks.stage`**: new migration
  (`20260929230000_moderation_identifiability_stage.sql`) adds `'identifiability'` to the check
  constraint — the prior migration is immutable, so this alters the constraint rather than editing
  it in place.

Refusal messages name what to remove ("too specific — could depict a real person. Remove
identifying details like distinctive tattoos, scars or birthmarks.") rather than a generic
"refused", per category, same pattern as the existing content refusals.

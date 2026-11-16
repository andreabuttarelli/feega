# One plan model in the code

## Why
Only one plan exists: €9 per editor per month, 500 credits per editor, one free editor, 100
welcome credits (`src/lib/credit-ladder.ts`). The per-brand Go/Starter/Pro model was still in the
code: `src/lib/plans.ts`, `src/lib/server/plans.ts`, `plan-budget.ts`, per-plan quotas in
`credits.ts`, a plan cache in `ai-log.ts`, per-plan render lengths and voice slots, the `?plan=`
login banner, `FEATURE_PLAN_GO`. No table carries a plan column any more, so every reader got
`null` and every org was treated as "no plan".

## What changed
- Deleted the old plan modules and every dead consumer (quotas, billing periods, post quotas,
  upsell ladder, Go flag, login banner, visual credit share).
- `BillingProvider` is `{ kind, gate(payer) }`: `quota`/`plansAbove`/`isTopPlan` had no caller.
- Behaviour kept exactly as production ran it: render length 60 s for every org, 3 custom voice
  slots, 50 knowledge documents. These were the "no plan" values every org already got.
- `FREE_CREDITS` lives in the credit ladder; the landing drift test now also pins it and the
  120-credits-per-provider-dollar rate.

## Open for the owner
Render length, voice slots and document limit have no paid tier now. Whether paying orgs get
more is a product decision, not a migration.

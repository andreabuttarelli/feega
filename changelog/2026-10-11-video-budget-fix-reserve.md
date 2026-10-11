# Video budget: $3, with a quarter kept for the fix round

**Why.** At $2 per video the builders often spent everything, so the critic's fixes and the
export never ran: the user got a half-finished cut and a "raise the budget" card.

**Before.** `VIDEO_CAP_USD = 2`, one pool shared by every role.

**What.**

- `VIDEO_CAP_USD = 3`, `FIX_RESERVE_SHARE = 0.25` (`brand-agent/limits.ts`).
- `video-budget.ts`: `Reserve.Kept` (build roles) leaves $0.75 untouched; `Reserve.Drawn`
  (roles in `DRAWS_FIX_RESERVE`, today only the fixer) can spend it.
- `turn.ts` picks the role before the budget check, so a fix turn runs even when the builders
  are out; the end-of-turn card is role-aware too.
- The raise (+$1) is unchanged and goes entirely to the builders.

**Discarded.** A separate per-role ledger: one constant and one set do the job.

# Credits page, redesigned for reading

`/app/credits` was one flat panel mixing balance, the weekly agent cap, the plan row, top-ups
and portal links, plus a "Usage by brand" table that showed zeros (brands are optional;
projects are the unit).

Now, top to bottom:

- **Your plan** card: Free or Plan, total (`€9 × N editors`), renewal date (new
  `SeatStatus.renewsAt` from the subscription's `periodEnd`), the payment notice from
  `team-seat-copy.ts`, and one primary action. Past due/unpaid swaps Manage for "Change payment
  method" (portal `payment_method` flow).
- Free only: Free vs Plan comparison.
- Balance with euro value; "about N images · M videos" derived from the org's own last-30-day
  average credits per call. Catalogue prices were not used: reading them needs the admin client
  and the gateway cache, too heavy for this page. Omitted when there is no history.
- Agent edits: progress bar and the day room frees up (new `AgentEditUsage.resetsAt`, oldest edit
  + 7 days, since the window rolls). Hidden on Plan.
- Top-ups as three buy cards.
- Usage, last 30 days, by project and by kind, from `ai_calls` via `recentUsage`
  (`$lib/server/credits.ts`) and the pure `usageBreakdown` (`$lib/credits/usage-breakdown.ts`,
  kind rules in one table). Empty state when zero. `billed_credits` wins; `cost_usd` is the
  fallback.
- Invoices / payment method as links.

The brand breakdown and its per-brand queries are gone.

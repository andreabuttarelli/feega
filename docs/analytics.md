# Product analytics

PostHog EU is the single destination. Two typed enums feed it, and this file is the catalog:
`src/lib/server/event-catalog.test.ts` fails if an event exists in code and not in the table below.

- `CoreEvent` (`src/lib/core-usage.ts`) → `coreEvent()` → PostHog only. Usage of the core loop.
- `ProductEvent` (`src/lib/server/product-events/track.ts`) → `track()` → `product_events` table
  **and** PostHog when a user id is known. Funnel, failures, billing.
- `ClientEvent` (`src/lib/analytics.ts`) → browser `track()`; only what a survey must trigger on.

Every server event with an org carries `$groups.organization = <org id>`. The org group profile
(`$groupidentify`) gets `plan`, `member_count`, `created_at` at org creation and `plan` on each Stripe
subscription change. Persons are identified by Supabase user id; server events are personless.

Guards, unchanged: no capture in `vite dev`, preview deploys, non-prod hosts, for internal users,
without consent (browser), and in local mode only `frame_created`/`export_completed` unless
`FEEGA_TELEMETRY=0` / `DO_NOT_TRACK=1`.

## Catalog

| Event | Source | Props | Call site |
|---|---|---|---|
| `canvas_opened` | core | canvas_id | canvas page load (`canvas-page.ts`) |
| `url_imported` | core | canvas_id | URL import |
| `figma_pasted` | core | source | canvas action `pasteFigma` |
| `template_inserted` | core | kind, template_id | template insert |
| `frame_created` | core | frame_id, actor | first motion revision (`motion-revisions.ts`) |
| `frame_edited` | core | frame_id, actor | later revisions, once per frame |
| `motion_edited` | core | frame_id, kind | frame ops |
| `node_generated` | core | medium | generation lands (`generate.ts`) |
| `export_completed` | core | format, target | export saved (`motion/export.ts`) |
| `agent_action` | core | via, op | MCP/CLI/chat op |
| `landing_prompt_sent` | product | kind, source | landing handoff (`hooks.server.ts`) |
| `login_started` | product | — | login handoff (anonymous, table only) |
| `signup_completed` | product | — | first terms acceptance (`tenancy/landing.ts`) |
| `handoff_resumed` | product | autostart, viaLogin | dashboard home |
| `canvas_created` | product | kind, source | dashboard home create |
| `agent_started` / `agent_first_output` / `agent_failed` | product | model / — / code | project agent |
| `credits_exhausted` | product | — | project agent gate |
| `import_failed` | product | source, error | dashboard home import |
| `canvas_perf` | product | perf summary | `/api/v1/telemetry/canvas-perf`, capped 30/user/h |
| `onboarding_tour_completed` | product | — | `POST /api/onboarding-tour` |
| `agent_connected` | product | key_id | first request with a `feega_` API key (`cli-auth.ts`) |
| `team_invite_sent` | product | role, via | `team.ts` invite and invite link |
| `team_invite_accepted` | product | role | `tenancy/landing.ts` after `acceptInvite` |
| `generation_failed` | product | medium, error | `giveUp` in `generate.ts` |
| `export_failed` | product | format, error | `saveExport` in `motion/export.ts` |
| `plan_upgraded` / `plan_downgraded` | product | amount, currency, plan, seats | Stripe webhook |
| `plan_cancelled` | product | amount, currency, plan | Stripe webhook |
| `revenue_recognized` | product | amount, currency, plan, invoice_id | Stripe `invoice.paid` |
| `revenue_refunded` | product | amount, currency, plan, charge_id | Stripe `charge.refunded` |
| `export_saved` | client | seconds | browser export save (`motion/export/save.ts`), survey trigger |

"First frame" is `frame_created` with PostHog's *first time for user* math, not a separate event.

## Activation and north star

Code: `src/lib/activation.ts`.

- **Activated**: `canvas_opened` and (`frame_created` or `frame_edited`) within 24 h of
  `signup_completed`.
- **North star**: weekly active teams (`organization` group) with ≥1 `export_completed` or
  `agent_action`.

## Stripe

`POST /api/webhooks/stripe` verifies with `STRIPE_WEBHOOK_SECRET` and forwards
`customer.subscription.created|updated|deleted`, `invoice.paid`, `charge.refunded` for objects tagged
`metadata.app = feega` + `metadata.org_id`. Setup: add the endpoint in the Stripe dashboard with those
five events and set `STRIPE_WEBHOOK_SECRET` in production. Refunds count only when the charge carries
the metadata.

## Replay, errors, flags, surveys

- Replay: PostHog, consent-gated, `REPLAY_SAMPLE_RATE` (0.25) in `analytics.ts`; all inputs and text
  masked, `canvas`, `video`, `img` blocked.
- Sentry events carry `posthog_distinct_id` and `posthog_session_id` tags.
- Flags: `featureFlag(key)` in `analytics.ts`. No experiments running.
- Surveys: PostHog JS renders surveys targeted in PostHog (only loads after consent). Planned:
  after first export (event `export_saved`), NPS at day 14 (person created ≥14 days), cancellation
  reason (event `plan_cancelled` cannot trigger client surveys; target the billing page URL).

## Dashboard "Feega — Weekly" (insight definitions)

1. Signups: trends, `signup_completed`, weekly count.
2. Activation rate: funnel `signup_completed` → `canvas_opened` → `frame_created`, window 24 h.
3. Funnel: `$pageview` (landing) → `signup_completed` → `canvas_created` → `frame_created` →
   `export_completed` OR `agent_action`, window 14 d.
4. Retention: weekly cohorts, start `signup_completed`, return `canvas_opened`.
5. DAU/WAU/MAU: trends, `canvas_opened`, unique users, day / week / month.
6. MRR: trends, sum of `amount` on `revenue_recognized`, monthly.
7. Agent usage: trends, `agent_action` broken down by `via`; `agent_connected` count.
8. North star: trends, `export_completed` OR `agent_action`, unique `organization` groups, weekly.

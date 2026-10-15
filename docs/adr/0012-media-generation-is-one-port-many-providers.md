# Media generation is one port, many providers; kie.ai is a discount route, never a peer

Context: an image, video or 3D node ran on OpenRouter (images synchronous, video through
`video_renders`) or on Wiro (an async task: submit, poll, download). Wiro's loop lived in
`wiro-run.ts` and was Wiro-shaped. We want Higgsfield's models, kie.ai's discounts on models we
already sell, and Wiro's uncensored catalogue, without a new branch in `runGenNode` per provider.

kie.ai was removed on 2026-09-20 (`efe65fcfe`) after measured failures: 3.5% of image renders
failed and p95 latency was 142.9s against OpenRouter's 3.4s (`2cc815c1a`); a poll timeout was
retried as a new task, so kie billed twice (`b48a40033`); undocumented required fields and a poll
endpoint answering `200` with `data: null` failed every call of three video tools
(`626597722`); cost arrived only on success, so abandoned tasks were invisible in `ai_calls`.
kie comes back because it sells the same models at 30–40% less, not because it got reliable.

## Decision

**One port for async providers.** `TaskProvider` (`src/lib/server/canvas/task-provider.ts`):
`run(ref, inputs, idempotencyKey)` → task id; `task(id)` → `pending | done(outputs, costUsd) |
failed(error)`; optional `cancel(id)` and `purge(id)`. One adapter per provider (`wiro.ts`,
`kie.ts`, `higgsfield.ts`) is the only code that knows a provider's URLs, auth, body shape and
status vocabulary. The core (`task-run.ts`) passes the catalogue's opaque `wire_spec` and a
neutral input map built from `wire_spec.fields`; nothing provider-shaped crosses back.

OpenRouter keeps its own transport (`media-generate.ts`): images are synchronous and video already
has a reconciler. It is the **primary route** in the same routing table, not an adapter of
`TaskProvider` — forcing a synchronous call into submit/poll would add a fake task store.

**One catalogue.** `ai_models` already holds `(id, catalogue)`, `provider`, `uncensored`,
`pricing`, `param_schema`, `wire_spec`. A task model's id is `<provider>/<model>`; the prefix
routes it (`generation/task-providers.ts`). Prices are `{lines: [{inputs, usd, method}]}` for every
task provider (`generation/task-pricing.ts`), priced per run from the same lines in the picker
(`pricedInputs`) and at billing (`quotedUsd`). Price sources: Wiro `/Tool/List` `dynamicprice`;
kie a hand-kept credit table from kie.ai/pricing, checked against `creditsConsumed` on every
finished task; Higgsfield `POST /estimate/<model>` per variant at sync time.

**Routing.** A model the user picks has one primary route (OpenRouter, Wiro or Higgsfield). kie
rows declare `wire_spec.discountFor = <picker model id>` and are never offered on their own. The
kie route is tried first only when: `KIE_API_KEY` is set, a kie price line matches the run's
params, kie is cheaper, and kie is healthy (success rate and p95 latency over its recent
`ai_calls`). The picker shows the kie price only in that case. On a kie submit error the primary
runs in the same request; on a kie `fail` or a task that outlives the kie window (3 min image,
15 min video) the reconciler fails that run and starts the primary as a new `node_runs` row.

**Billing.** Credits are gated by `gateAiAction`/`gateOrgAiAction` before the run, as today. Every
attempt writes `ai_calls` with the provider and its actual cost; a failed or abandoned attempt
has `ok=false` and `cost_usd null`, so it never debits. The delivering route debits once, with
`creditCap` = its quoted price, so the charge never exceeds what the picker showed for that route.
After a fallback the charge is the primary's price, which is higher than the kie price shown.

**Uncensored.** `ai_models.uncensored` is the only flag; `generation/uncensored-guard.ts` is the
only rule: an uncensored model runs only in an uncensored project, with the workspace opt-in, and
with no image, frame or reference input. Every task provider passes through it before submit.

**Storage.** Outputs are downloaded at once (kie keeps files 14 days, Higgsfield 7) into the
existing generated-media path (`brand-knowledge/<user>/<media|uncensored>/<provider>/…`), marked
with content credentials, and land as `assets` + `node_runs.output_asset_id`.

**Keys.** Only from env; a provider whose keys are missing is not built and its models are not
offered. Wiro `WIRO_API_KEY` (+ `WIRO_API_SECRET`), kie `KIE_API_KEY`, Higgsfield
`HIGGSFIELD_API_KEY_ID` + `HIGGSFIELD_API_KEY_SECRET`, OpenRouter `OPENROUTER_API_KEY`.

## kie failures and their mitigation

| Failure seen | Mitigation |
|---|---|
| 3.5% failures, p95 142.9s | Discount route only, health-demoted, automatic fallback |
| Timeout retried as a second kie task, billed twice | A kie task is never resubmitted; a timeout falls back to the primary |
| Abandoned task left no `ai_calls` row | Every attempt writes a row (`ok=false`, error `task_timeout`) |
| `200` with `code != 200` or `data: null` read as pending | Adapter treats any non-200 `code` or missing `data` as an error |
| Undocumented required fields | Only fixture-checked payloads enter the kie table; smoke script submits one |
| Result URLs expire | Downloaded into our storage on the poll that sees `success` |
| No cancel endpoint | None invented; the window bounds the waste, health bounds the rate |

## Consequences

A new async provider is an adapter, a row in `TASK_PROVIDERS` and its catalogue rows. A kie fallback can
cost us two provider bills for one user charge; health demotion keeps that rare. Prices that
OpenRouter states per token have no per-image quote and show as variable.

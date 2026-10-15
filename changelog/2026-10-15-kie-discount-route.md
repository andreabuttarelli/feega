# kie.ai returns as a discount route, with fallback

kie.ai was removed on 2026-09-20 for failures (ADR 0012 lists them). It returns because it resells
Nano Banana 2 and Pro 33–40% cheaper than our primary route, and only as a second-choice route:
the picker never lists a kie model, a kie row in `ai_models` carries `wire_spec.discountFor`.

- `kie.ts`: the adapter. `createTask` + `recordInfo`; a body `code` other than 200 is a refusal,
  a `200` with `data: null` is an error, never "still running" (the old Runway void).
- `kie-catalogue.ts`: the only kie models we sell, with credits measured on real calls before the
  removal (8/12 credits at 1K/2K for Nano Banana 2, 18 at 1K for Pro), × $0.005. Synced into
  `ai_models` only when `KIE_API_KEY` is set.
- `generation/discount-route.ts` decides: a kie line must price the run's params (default 1K),
  be cheaper than the primary (or the primary has no fixed price), and kie must be healthy —
  ≥95% success and image p95 ≤ 120 s over its last 50 `ai_calls`, judged after 10.
- The picker shows the kie price only where kie will be tried first (`pricedInputs` per
  resolution; resolutions kie does not price keep the primary price).
- `runGenNode`: kie submit error → the primary runs in the same request. kie `fail` or past its
  window (3 min image) → the reconciler fails that run and starts the primary as a new run.
  Every attempt writes `ai_calls`; a failed one has no cost, so only the delivering route debits.
- `npm run eval:provider-smoke` (dry run by default, `--spend` to call, $1 hard cap).

Discarded: kie as a peer provider with its own models in the picker (its failure rate makes it a
bad only-route); webhooks (`callBackUrl`) — the reconciler already polls every minute.
After a fallback the user pays the primary price, higher than the kie price the picker showed.

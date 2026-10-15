# Media generation goes through one provider port

ADR 0011. Wiro's submit/poll/deposit loop (`wiro-run.ts`) becomes the provider-neutral
`canvas/task-run.ts` behind the `TaskProvider` port (`canvas/task-provider.ts`). A task model's id
prefix (`wiro/`, `kie/`, `higgsfield/`) picks the adapter; the job id carries the same prefix
(`wiro:…`), so one reconciler (`reconcileTaskNodeRuns`) serves every async provider.
`generation/task-providers.ts` is the table of providers: env keys, price source, storage folder,
fallback window. OpenRouter keeps its transport as the primary route.

- Uncensored is one rule, `generation/uncensored-guard.ts`: uncensored project, workspace opt-in,
  no image/frame/reference input. Before, the input rule lived in `wiro-run.ts` and the project
  rule only knew the `wiro/` prefix; an uncensored model from another provider would have passed.
- Every attempt bills with its provider name and a `creditCap` equal to the quoted price, so a
  task can never debit more than the picker showed. A task with no reported cost bills its quote.
- A provider with no key is no longer offered in the picker (was: offered, then refused).
- Pricing lines (`{lines:[{inputs, usd, method}]}`) move to `generation/task-pricing.ts`.
- The recommender priced token-billed images at Gemini's 1,290 tokens per image: Hy Image showed
  $0.002 and cost $0.024. Token-billed images now have no per-image quote.

No migration: `ai_models.provider` and `ai_calls.provider` are free text.

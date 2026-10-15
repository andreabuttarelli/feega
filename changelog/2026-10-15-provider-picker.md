# Pick the provider, not only the model

The picker grouped models by maker and hid which provider would run them; a model served by
OpenRouter and kie.ai showed one price, the one Auto would pay.

- `ModelChoice.routes` (`withDiscountPrices`, `discount-routes.ts`): Auto, OpenRouter, kie.ai,
  each with its own `RoutePrice` and, for kie, `RouteStats` (success rate, p95, healthy) read from
  its last 50 `ai_calls`. `model-routes.ts` turns them into menu groups (one per model, one row per
  provider), parses the picked row, and prices a run by `params.provider` (`pricedFor`, used by
  `creditsForRun`), so the Generate button shows the price of the chosen provider.
- Routing (`runDiscountRoute`): `provider` absent/`auto` = before. `openrouter` = never kie.
  `kie` = kie even when demoted or dearer, queued without a fallback model; a submit failure is
  refused as "kie.ai failed: … Pick Auto …". Auto falling back writes `routeNote` on the node
  (server-written field, cleared at the next run), shown under the node header.
- Agents: `list_models` returns `routes[]`; `run_node` (chat op), `run_node_generation` (MCP) and
  `POST /org/nodes/:id/generate` accept `provider`. CLI `feega canvas models` prints one row per
  provider with the `--provider` value.
- kie coverage: Grok Imagine text-to-video (per second: 2.4/4.5/8 credits at 480p/720p/1080p) and
  GPT 6 Luna text ($0.03/$0.15 per million tokens, Responses endpoint `/codex/v1/responses`,
  `kie-chat.ts`, billed in `kie-text-run.ts`). Prices from kie's public price list API; before,
  only measured Nano Banana figures were used, which this list confirms (8/12/18 credits).
- `npm run eval:provider-smoke -- [--medium=text|image|video] [--only=kie]` adds kie video ($0.072)
  and text cases.
- Also: removed a dead fallback branch that a text replace had copied into the audio reconciler.

Higgsfield auth checked against docs.higgsfield.ai: `Authorization: Key <id>:<secret>`, as built.

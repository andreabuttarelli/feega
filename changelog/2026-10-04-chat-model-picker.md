# Chat model and reasoning picker

**Why.** The canvas chat and the motion editor chat ran on `LLM_DEFAULT_MODEL` (glm-5.3-flash)
with no user choice. User decision: default Claude Sonnet 5.5, reasoning medium.

**What.**
- Catalogue: live OpenRouter `/models` cache (`openrouter-models.ts`), the same source billing
  prices from. Now also reads `tools` and `reasoning.supported_efforts/default_effort`.
  `chat-model/catalogue.ts` derives options (tool-calling, no `:variant`/`~alias`), cost tier
  (`$` < $2, `$$` < $8, `$$$` per 1M in+out), and validates `{model, reasoning}` server-side:
  unknown model → 400 `unknown_model`, undeclared effort → 400 `unsupported_reasoning`.
- Wire: `providerOptions.openai = {reasoningEffort, forceReasoning: true}` → Responses body
  `reasoning: {effort}` (tested on the real SDK body). `forceReasoning` is needed: the SDK only
  sends reasoning for OpenAI ids.
- Persistence: per user, `auth.user_metadata.chat_model` via `GET/PUT /api/v1/chat-models`.
  Per user, not per thread: threads are implicit (one per project/node), so per-thread would
  reset the choice everywhere; no migration needed (deploys don't run them). GET reads
  `auth.getUser()` fresh — the session user is cached 30s and returned the old choice.
- Motion: the choice is the edit-tier model; code tier and vision steps keep their routing;
  reasoning is sent only on steps running the chosen model.
- UI: native selects (keyboard, mobile picker) in the composer; "Thinking" block when the
  model streams reasoning (`sendReasoning: true`).

**Billing fixes found on the way.**
- Gateway usage already counts reasoning inside completion tokens; `computeCostUsd` added it
  again for gateway-priced rows and for glm/gpt-5.6-sol RATES. Fixed (`thinkingInOutput`).
- `costFromJson` never found the invoice on Responses streams (`response.usage.cost`), and the
  project agent's turn ran outside the billing scope: every agent turn fell back to hand RATES.
  Measured: Gemini 3.7 Flash turn logged $0.00697 before, $0.00205 (the real invoice) after.

**Not done.** `reasoning.max_tokens` budgets: the AI SDK Responses path has no field for it;
the 5 budget-only models get no reasoning control. No plan tier gates expensive chat models in
this codebase, so none was added. Credit gate is a balance check; there is no per-turn
estimate. Motion per-model rows still price from RATES (Gemini RATES are Google-direct).

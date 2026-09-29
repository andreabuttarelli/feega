# Screen every prompt before it reaches a model

Before: only uncensored Wiro runs were moderated (`wiro-run.ts` → `screenGeneration`). Every
other generation — OpenRouter text/image/video, ElevenLabs audio, the enhancer, the sidebar
chat, the influencer builder — sent user text to the provider unscreened.

## What changed

- **`moderation/profiles.ts`**: one table, `MODERATION_PROFILES`, profile → categories, what
  to do when Jev is down, which judge tier, the fallback refusal. `standard` = the uncensored
  categories plus `adult_sexual` (any sexual/nude content, adults included) and a `safe`
  definition that no longer admits adult content; refusals read "This prompt was blocked: …
  isn't allowed in feega's standard mode." `uncensored` is the old table, unchanged. The profile
  comes from the model (`profileOf({ uncensored })`) or the route, never from a client flag.
- **`screen.ts`**: content screening takes the profile; `ON_JEV_OUTAGE` decides what a Jev
  failure means. Outcomes carry `unavailable` when no verdict was reached.
- **`moderation/model-input.ts`**: `screenModelInput(db, { profile, texts, scope })`, the one
  entry for non-Wiro paths. Empty texts skip; verdicts are cached 10 min per
  (profile, sha256 of normalized text), outages never cached — a loop pays once.
- **Wired at**: `runGenNode` (prompt + system prompt + upstream text, before the enhancer and
  any provider; Wiro keeps its own screen), both `/prompts/enhance` routes, the project chat
  POST (before the turn is saved; concurrent with thread loading), `generateInfluencer`.
  Loops, workflows, MCP `run_node_generation` and chat tool calls reach `runGenNode`.
- **UX**: node → `giveUp` (running false, error on the node, run failed). Routes → 422
  `{ error, code: 'prompt_blocked' }` (`blocked-response.ts`); the chat banner shows the server
  reason (`failed: 'blocked'`), no retry button.
- **Billing**: `ai-log.ts` bills nothing for labels starting `moderation.` — cost is logged in
  `ai_calls.cost_usd`, `billed_credits` null, no ledger debit. Applies to uncensored checks too.
  A blocked run never reaches a provider, so it costs the user nothing.
- **Guard**: `moderation/chokepoints.test.ts` scans `src/` for importers of model adapters
  (llm, ai-text, research, media-generate, prompt-enhance, openrouter-*, video, elevenlabs,
  wiro, and `streamText`/`generateText` from `ai`). Each must be in a table: screened (and the
  file must call `screenModelInput`) or a stated reason it carries no user text.

## Fallback chain (standard profile)

| Jev | LLM judge | Result |
|---|---|---|
| clear / refuse | not asked | Jev verdict |
| doubt | clears / refuses | judge verdict |
| not configured (`JEV_API_KEY` unset) | clears / refuses | judge verdict |
| HTTP error | clears / refuses | judge verdict |
| any failure | fails | refused, `moderation_unavailable` |

Uncensored keeps failing closed on a Jev outage. The standard judge uses the catalogue's
`cheapest-good` text model; uncensored keeps `best`.

## Decided against

- Screening inside `llmText`: it also carries third-party text (research, brand sites) and would
  moderate our own prompts. The guard test keeps the call sites honest instead.
- Billing blocked checks to the user: the refusal is ours to pay for.
- Images as moderation input: not in scope; standard image references are the user's uploads.

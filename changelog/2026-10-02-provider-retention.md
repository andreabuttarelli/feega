# User content no longer lingers at AI providers

Before: Wiro kept every task's inputs and outputs on its CDN, ElevenLabs kept
every dubbing project and text-to-speech history item, OpenRouter could route
to providers that log or train on prompts, and input files went out on 2-hour
signed links.

Now:

- `node_runs.provider_purged_at` (migration
  `20261002120000_node_runs_provider_purged_at.sql`, apply by hand). The canvas
  tick runs `purgeProviderCopies` after the reconcilers: every settled run
  (`done`/`failed`/`expired`) with an external job and no purge mark, finished
  in the last 7 days, goes to the purger registered for its job prefix
  (`provider-purgers.ts`). Success marks the row; a failure leaves it for the
  next tick. Deletion never runs inside the landing path, so it cannot precede
  our copy.
- Wiro: `Task/Detail` for the `socketaccesstoken`, then
  `Task/InputOutputDelete`, only in `task_postprocess_end`/`task_cancel`
  (Wiro refuses other states); earlier states answer `not_ready`. Wiro has no
  per-run auto-delete option. Wiro keeps the task record and parameters.
- ElevenLabs: `DELETE /v1/dubbing/{id}`; `DELETE /v1/history/{id}` for any
  sync generation whose response carries `history-item-id`, recorded on the
  run as `elevenlabs-history:<id>` after it lands. 404 counts as deleted.
  `enable_logging=false` (zero retention) is enterprise-only: not used.
- OpenRouter: `provider.data_collection: "deny"` on chat/embedding (through
  `withOpenrouterDefaults`, renamed from `withUsageAccounting`), grounded and
  media calls, and Gemini image calls. Checked live: GLM 5.3 Flash, Grok 4.6,
  Gemini 3.7 Flash, Claude Opus 5, GPT-5, DeepSeek vision, Gemini embedding
  all still route. ZDR discarded: no ZDR endpoint for gpt-image-*, Seedance,
  Kling, Grok Imagine. `/images` and `/videos` left unchanged (provider
  routing support there unverified).
- Canvas provider inputs (`signMediaPaths`) sign for 5 minutes, was 2 hours
  for generated media.

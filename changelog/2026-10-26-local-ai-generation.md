# Local mode: AI generation with your own keys

Local mode refused every generation and hid the text, image and video nodes
(#1347). With a provider key in the environment it now generates straight
against the provider.

Decisions:

- Keys: `KIE_API_KEY`, `OPENROUTER_API_KEY`, `LLM_API_KEY`
  (`src/lib/local-ai-keys.js`, the one list). `scripts/local.mjs` merges the
  repo `.env` under the process env and sets `PUBLIC_FEEGA_LOCAL_AI` to `1`
  or `0`. Only that boolean reaches the browser; a test asserts no `PUBLIC_`
  variable carries a key.
- Gate: `creditGateOutcome` refuses in local mode only when no key is set.
  `BILLING_PROVIDER=open` already makes the credit check a no-op, so no
  plan gate and no ledger.
- UI: `LocalOff` became a table of predicates. New `AiNodes` entry is off
  only without the flag; `CloudNodes` keeps products, feeds and the studio
  batch off. `CLOUD_ADDABLE` was split into `AI_ADDABLE` and `CLOUD_ADDABLE`.
- Models: the picker reads `ai_models`, which the cloud fills with a cron.
  Locally `syncLocalModels` runs once at start (same `syncAiModels`), then
  deletes the rows of providers without a key. `ai_models` has the composite
  key `(id, catalogue)`; the memory db assumed `id` alone and refused the
  sync.
- Media: stored where the existing local storage puts it, inside the
  `.feega` zip under `assets/`. Not a `<file>.assets/` folder: the file stays
  the single portable unit, and the same bytes already round-trip through
  cloud import.
- Moderation: unchanged. It judges with `LLM_API_KEY` (Jev is optional), so
  a kie-only setup is refused with the enable hint.
- Left out: the chat agent (`LocalOff.Chat` stays off).

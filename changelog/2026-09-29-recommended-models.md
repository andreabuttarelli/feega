# Recommended models, derived from the catalogue

Agents over MCP picked old, weak models: nothing told them which ones are
current. Now each medium (text, image, video) gets three tiers — `best`,
`balanced`, `cheapest-good` — scored from `ai_models`, not a hand list.

- Sync stores OpenRouter `created` (`released_at`), `expiration_date`,
  `context_length` and Artificial Analysis `intelligence_index`
  (migration `20260929200000_ai_models_release_facts.sql`, not applied yet;
  the sync drops a missing column and retries, reads return no
  recommendations until then).
- Scoring (`$lib/canvas/recommended-models.ts`): recency over 24 months,
  benchmark (text; missing = median, not a free pass), declared
  resolutions/params or context, log price tier. Balanced = quality minus a
  log-cost penalty within 80% of best; cheapest-good = cheapest within that
  floor. Expired, unpriced or zero-priced models are never recommended.
- Human judgment lives in `RECOMMENDATION_EXCLUSIONS`, one row + reason:
  `:free`, `:batch`, routers, SVG-only image models, video editors and
  upscalers.
- Canvas: picker shows a Recommended section with the tier; a node with no
  model resolves to `balanced` (`effectiveModel`).
- MCP/REST: `describe_node_types` returns `recommended_models`;
  `run_node_generation` without `model` uses `balanced`; an old (>12 months)
  or weak model runs with a `warning`.

Known limit: `created` is when OpenRouter listed the model, not its real
release — an old model newly listed looks new.

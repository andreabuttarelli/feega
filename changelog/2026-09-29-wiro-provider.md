# Wiro provider with opt-in uncensored models

Wiro is a second image/video provider next to OpenRouter, added to offer unfiltered models to
workspaces that explicitly opt in. Safety is part of the path, not a setting.

- Catalogue: `syncAiModels` also reads Wiro `POST /Tool/List` (text-to-image, text-to-video,
  and the `uncensored` search; the list is public). `wiro-catalogue.ts` maps each tool to an
  `ai_models` row: `provider = 'wiro'`, id `wiro/<owner>/<project>`, controls in `param_schema`,
  price lines from `dynamicprice` in `pricing.lines`, wiring (which Wiro field is the prompt,
  ratio, resolution, duration, image inputs, last frame) in the new `wire_spec`. `uncensored`
  comes from the tool title/slug: Wiro publishes no flag, only names. No hand-written list.
- Menu: `offerable-models.ts` picks the choice builder per provider (one table);
  `wiro-choice.ts` prices every setting combination (`pricedInputs`) so the cost shows before
  running. Uncensored rows are never recommended and are hidden until the org is allowed
  (`visibleCatalogue`, canvas page load). Badge in `ModelMenu.svelte` and on outputs.
- Run: `runGenNode` → provider table (`wiro/` prefix) → `runWiroNode` → `wiro-run.ts`:
  opt-in gate → likeness guard → Jev screen → `POST /Run/{owner}/{project}`. Every Wiro run is
  async (`external_job_id = wiro:<taskid>`), finished by `reconcileWiroNodeRuns` in the run tick
  via `POST /Task/Detail`; the output is copied to `brand-knowledge/<userId>/media/wiro/`
  (Wiro URLs expire) and billed at Wiro's `totalcost`, `ai_calls.uncensored` set.
- Auth: `x-api-key`, and with a secret `x-nonce` + `x-signature = HMAC-SHA256(key=API_KEY,
  message=API_SECRET+nonce)`, per wiro.ai/docs/authentication.
- Safety, all server-side in the path every caller shares (canvas, MCP, chat agent, loops):
  - Opt-in: `org_uncensored_optins` (owner only by RLS and code, 18+ attestation, policy
    version, who/when, turned off with who). Entitlement table: paid plans only
    (`orgs.stripe_subscription_id`).
  - Likeness: `likeness-guard.ts` table — catalogue talents, upload-built influencers, unmarked
    or under-18/undeclared-age personas, uploaded images and Global reference photos are refused
    for uncensored models; only generated media and influencers the owner marked as adult AI
    personas (`influencers.adult_persona_at`) pass.
  - Screen: Jev (`POST /systemone`, one `choice` over the category table in
    `moderation/policy.ts`). Unsafe top choice refuses; `safe` below 0.98 or any category above
    0.02 escalates to the recommended `best` text model with a strict JSON verdict; minors refuse
    above 0.005 without escalation, plus a keyword rule on uncensored models before any call.
    Jev missing or failing refuses (fail closed) for every Wiro model. Each stage is written to
    `moderation_checks`; Jev and the judge are billed in `ai_calls`.
  - Outputs: `assets.uncensored`. Share pages drop them before signing. `scheduleDelivery`
    refuses them where `ADULT_CONTENT_POLICY` forbids adult content and needs an explicit
    confirmation elsewhere (X, Reddit), so planned posts never auto-publish them.
- Migration `20260929220000_wiro_uncensored.sql`, applied.

Not done: Wiro file inputs are sent as signed URLs in JSON (the docs show URL defaults for
`combinefileinput`); if a model insists on multipart the run fails with Wiro's error. No real
Wiro or Jev call was made — no keys yet. Global reference catalogue: no app path writes to it,
so uncensored outputs cannot enter it.

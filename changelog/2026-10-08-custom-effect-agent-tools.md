# Custom effects from the canvas chat, checked on every write

Ticket 6 of custom effects (the motion tools landed with ticket 5, see that entry).

**Canvas chat.** `write_effect` (same contract as the motion one) and `list_effects`, which now
returns the built-in catalogue *and* `custom: [{ effect_id, name, state, step: { id:
'custom', ref } }]`. Putting a custom effect on a node is the existing `apply_effects` with
that step — no `set_effects_node`: the tool already replaces a stack. Motion clips stay with
`ask_motion_agent`.

**Server render of an effects node now draws custom steps.** `applyEffectsNode` (agent path)
runs `applyStackAsync`: built-ins on the CPU, each custom step through the GL page
(`window.__shaderFx.renderStill`, PNG in and out). Without a GL page, for a failed or deleted
effect, the step is identity. Video still passes custom steps through: per-frame GL on the
server is a follow-up.

**Endpoints.** `POST /api/v1/org/custom-effects` is now *write* (same name replaces it) and,
like `PATCH`, measures the effect when the server has Chromium — the check MCP writes need.

**Eval.** `npm run eval:custom-effect`: real motion agent on a disposable org, "make a VHS
effect and put it on clip 1", facts: row exists, check passed, clip references it, server
frame differs, cost from `ai_calls`. It reports `unrun` with the reason when the `effects`
table is not migrated or `CHROMIUM_PATH` is unset — which is what it does today.
`scripts/vite-node.config.ts` gained the motion bundles plugin and an `$app/server` shim so
scripts can import compose.

**Credits.** No new charge: writes happen inside an agent turn, billed as a turn.

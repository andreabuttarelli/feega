# The canvas effects node runs custom effects

Ticket 4 of custom effects.

**Model.** `EffectStep` is now `BuiltinStep | CustomStep` (`{ id: 'custom', ref, params,
enabled }`). `applyStack(pixels, steps, custom?)` takes the custom pass as a port: the browser
passes `customPass(effects, glDrawer().draw)` (shader-fx on TWGL, upload → draw → `read`), the
server passes nothing and a custom step is identity. Built-ins unchanged.

**Fallback.** `check_state = failed`, a missing effect, no WebGL, or a compile error on this GPU →
the step is a passthrough and its row in the editor turns red (`is-broken`). Never a black frame.

**Params.** Adapted at the edge (user decision 3): shader `number` → canvas `range`, `color`
and `seed` as they are (`customParams`). The 16 built-ins keep their own model.

**Wiring.** `EffectsEditor.svelte` "Add effect" gets a *Custom* group from
`customEffectsOf(projectId)` → `GET /api/v1/projects/[projectId]/agent/custom-effects`
(session cookie) → `listEffects(db, project.orgId)` → table `effects`. Preview, Apply (client
PNG) and the node thumbnail (`EffectsPreview.svelte`) all draw custom steps.

**Not covered.** Server-side apply (`applyEffectsNode`: agent path and every video) has no GL,
so custom steps there are identity. Running them in the server-frames browser is a follow-up.

**Found while building the demo.** A param keyed `seed` redefined the contract `u_seed` and the
shader failed to compile (the fallback held, the frame passed through). `parseEffect` now
refuses keys `src res time seed`.

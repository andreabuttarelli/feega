# Motion clips run custom effects (preview, render, server frames)

Ticket 5 of custom effects.

**Model — beside the 17 built-ins, not inside them.** User decision 3 (adapt where they meet):
a clip carries `shaders: [{ id, ref, enabled, params }]` (max 1 in v1) and the doc carries
`shaders: { [ref]: { name, version, frag, params } }`, a snapshot of the workspace effect. The
snapshot is what makes preview, render, web export and server frames reproducible without a
database. `EffectKind` stays 17: putting `custom` there meant guarding every
`EFFECTS[kind]` lookup (model, render, ops, inspector, tools) for one engine that shares none of
them. Params still animate as `fx.<id>.<key>` (`shaderProps` joins `withParams`).

**Raster path.** SVG filters cannot run GLSL and a browser cannot rasterise arbitrary DOM, so v1
takes Image and Video clips only (`clipShadersProblem` refuses the rest with a sentence the
agent can act on). `composeHtml` inlines `virtual:motion-shader-fx` (bundled from
`shaders/runtime-entry.ts`, same mechanism as TWGL in #290) and a seek-driven script: each seek
paints the visible `<img>/<video>` of `#mv-<clip>` into a scratch canvas (object-fit, position
and zoom emulated), runs the shader with `u_time` = clip-local seconds, and draws a canvas over
the media. The SVG stack of the clip applies on top. Compile failure or no WebGL → no canvas,
the clip shows unchanged.

**Server frames.** `@sparticuz/chromium` keeps WebGL on SwiftShader by default
(`--use-angle=swiftshader`); cost measured in ticket 1 (10–25 ms per 1080p frame).

**Tests.** `shader-frames.test.ts` draws real server frames through `drawFrames` in Chromium:
the shaded frame differs from the plain one (watched red with the runtime switched off) and the
same doc at the same time gives identical bytes. CI now installs Chromium before the unit step
so GL tests run there.

**Agent tools (in this PR, not ticket 6).** `motion-agent-parity.test.ts` refuses a doc/clip
field with no tool, and `motion-tool-references.test.ts` refuses a tool named in a description
that does not exist — so the field and its tools ship together: `write_effect`,
`patch_effect`, `list_effects`, `add_custom_effect`, `set_custom_effect`,
`remove_custom_effect`, through an `EffectStore` port (`server/effects/store.ts`, wired in
`turn.ts`). A write lints; if the server GL page exists (`chromiumGl`, Vercel/`CHROMIUM_PATH`)
it then measures cost at 1080p (budget `CHECK_BUDGET_MS = 60`, software GL) and flicker
(> 20% mean-brightness jump = warning, not a block); otherwise the effect stays `unchecked`
and still draws. Three failed writes a turn, then the agent must stop and report.

**Not in v1.** Inspector panel for custom effects, text/shape clips, more than one custom
effect per clip.

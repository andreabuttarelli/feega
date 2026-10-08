# Custom layouts from AI: compose "edit with AI", agent tools, CLI/MCP, remix

Ticket 10 of custom effects and layouts.

- **/app/compose**: under the template chips, a prompt ("Edit with AI") posts `?/designLayout`
  → `designLayout` (`server/layouts/design.ts`): moderation screen, one structured model call
  (`llmStructured`, default model, billed through `withOrgContext` like `enhance_prompt`),
  `writeLayout`; refused specs go back to the model once with the problems. The new layout is
  selected (`withCustomLayout`) and shows as a chip; its params drive the settings panel via
  `layoutOf`. The draft carries `custom: { id, name, spec }`; the doc carries `layoutSpec`
  (with the name) and `layoutRef`.
- **Motion agent**: `write_layout`, `patch_layout`, `list_layouts`, `apply_layout` (copies the
  spec into the Composition clip) through a `LayoutStore` port wired in `turn.ts`.
- **MCP**: `write_layout`, `patch_layout`, `list_layouts` (35 tools); **CLI**: `feega layouts`,
  `write <name> --file spec.json`, `patch <id> --at-version <n> --file`.
- **Remix**: `adoptLayouts` inserts each custom layout a remixed doc uses into the remixer's
  `layouts` (renamed on clash) and rewrites `layoutRef`; the effect author mapping is shared
  (`workspaceAuthor`).
- **Eval**: `npm run eval:custom-layout` — unrun until `layouts` is migrated. One-off check of
  the model path on a fake db (not the eval): the default model wrote a valid ring spec on the
  first try ("twelve cards on a slowly turning ring that bobs"), 12 finite instances, ~$0.003.
- **Not in v1**: canvas-chat layout tools (cut in the spec), code-kind layouts.

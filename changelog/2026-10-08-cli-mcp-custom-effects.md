# CLI and MCP write custom effects

Ticket 7 of custom effects. App → CLI → MCP, same names as the chat tools.

- **MCP**: `write_effect` and `patch_effect` (POST/PATCH `/api/v1/org/custom-effects`);
  `list_effects` now also returns `custom` (`GET /api/v1/org/effects` lists the workspace effects
  with the `{ id: 'custom', ref }` step). Surface goes from 30 to 32 tools; server instructions
  name them and stay under the 2,000-character budget (trimmed two phrases to fit).
- **CLI**: `feega effects`, `feega effects write <name> --file x.glsl [--params p.json]`,
  `feega effects patch <id> --at-version <n> --file x.glsl` (`--version` is taken by commander).
- **Scope**: org, not project — `<project>` from the spec draft is gone (user decision 2).
- `effects-parity.test.ts` now holds `write_effect` on both surfaces; skill and references name
  both tools (mirrored into the plugin).

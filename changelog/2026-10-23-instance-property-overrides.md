# Instance overrides beyond text

Instances could override only text from the panel; MCP took any prop but `hidden` and `effects`
live on the clip, not in `props`, so they were silently dropped.

- `withOverride` (`precomp.ts`) is the one place an override lands: `hidden` and `effects` go on
  the clip, the rest in `props`. Expansion (both renderers) and detach share it.
- `resetOverride` drops one property; the element entry and `overrides` vanish when empty.
- `InstanceInspector` lists each element of the main with Fill, Stroke, Image, Visible and Effects,
  and a Reset next to every overridden one. MCP: `component` action `reset-prop`.
- Discarded: a new tool for reset-prop (30k chat tool budget); the action folds into `component`.

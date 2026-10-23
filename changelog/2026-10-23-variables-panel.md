# Variables in Properties

Second step of the variables work (spec in `feega-videos/plans/variables-spec.md`).

- Frame selected, nothing inside it: Properties shows `VariablesLibrarySection` (collections, mode
  switch for this frame, one value input per mode, add variable, add mode, remove).
- A clip selected: `VariablesSection` lists its bindings with Unbind, and a picker (variable, then
  only the targets of that type that are still free: the scope filter).
- A bind icon on every field row was discarded for now: ~20 field kinds render through one snippet
  and a single section reaches the same result with one component.
- `addMode` copies the default mode's values; `variable` MCP tool gets `add_mode`.
- Bound fields still render editable; `set_props` refuses them with the variable's name, shown in
  the inspector error line.
- Verified in a real browser: `tests/e2e/canvas-variables.spec.ts` (@real).

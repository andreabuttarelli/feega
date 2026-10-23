# Variables with modes: model and agent tool

Roadmap VA-02..VA-04, spec in `feega-videos/plans/variables-spec.md`.

- `doc.variables`: collections with modes (first is the default, `active` is per frame doc) and typed
  variables (colour, number, string, boolean) whose value per mode is a literal or an alias to a
  variable of the same type. `clip.bind` links a prop (or `autoLayout.gap/crossGap/padding`) to one.
- Resolution is materialised, like named styles and `drivenVars`: each op ends with
  `resolveVariables`, which writes the value into `clip.props` / `clip.autoLayout`. The GPU canvas,
  export and embed read plain props, so there is one resolver and no renderer change. A live resolve
  at draw time was discarded: every renderer would need it and the two engines would drift.
- `set_props` refuses a bound prop (the next resolve would overwrite it silently).
- No migration: docs are jsonb. Old docs parse unchanged.
- MCP: one `variable` tool (define, mode, bind, unbind, remove, list); `get_motion_doc` returns
  `variables` and each clip's `bind`. Tool pins updated on purpose.
- Number values use the prop's own units (shares for size and opacity, px for gap and padding).

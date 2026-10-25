# Shot slots, kit UI props and a gate that fits short videos

**Before:** `list_shots` gave slot names only; colour slots (font ink paper muted accent) and
their types came out only in an error. `accent_line` past the last line silently drew no
accent, and its 0-based index was undocumented. `set_props {radius}` on a kit UI (UiEditorCanvas)
was refused as "unknown props roundness": the px alias (`radius` → shape `roundness`) ran on
every clip, also on Custom components that declare `radius` themselves. `add_ui.props` was a
free object, its per-kind props visible only after insertion. The MCP snapshot blocked a 9 s
brief on script, music and story acts, and flagged three different Custom clips as one repeated
layout (the gate compared `component`, always `Custom`).

**Now:** `list_shots` slots are `{type, required, default, minimum, maximum, about}` from the zod
schema (`shotSlots`), style slots included; an out-of-range `accent_line` is refused
(`SLOT_RULES` in the shot library). `propsFromPx` skips keys the Custom component owns.
`list_ui_kinds {kind?}` (read) gives each kind its props, typed. `blockingFor(problems, seconds)`
turns film-scale checks into advice under 15 s (MCP snapshot only; the in-app delivery gate is
unchanged). A Custom clip's layout role is its component name.

**Discarded:** a per-kind discriminated union on `add_ui`'s input schema: ~17 KB more on every
in-app chat turn.

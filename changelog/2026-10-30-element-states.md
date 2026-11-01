# Interaction states on any element (model + agent)

Every clip can carry `states`: one row per Hover / Pressed / Focus with overrides (opacity,
scale, rotateZ, blur, fill, stroke, strokeWidth, cornerRadius) and a transition
(easing + durationMs). `resolveState` is the only place that applies them. The agent writes them
with `set_element_state` / `remove_element_state`, which `edit` exposes to MCP.

Before: hover was only a prototype link (`trigger: hover` → navigate), never a look change.
Decisions and the Figma/Framer comparison: `docs/adr/0030-element-interaction-states.md`.
Discarded: one variant per state (copies the component for a hover).

# Multi inspector: roundness, constraints, pivot

Completes #1021's list. `roundness` joins `STYLE_PROPS`; `anchorX`/`anchorY` (pivot) join the
transform fields; a Constraints section edits horizontal/vertical pinning for every selected
clip in one `setConstraints` call, "Mixed" where they differ (`sharedConstraint`; unset reads as
the default, scale). Chat/MCP already have `set_constraints`, `set_props`, `set_transform`.
Tests: `selection-props.test.ts`.

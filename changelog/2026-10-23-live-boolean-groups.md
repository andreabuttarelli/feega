# Live boolean groups

Union, subtract, intersect and exclude used to be destructive: the bottom shape became the result
and the others were deleted (`combineShapes`). They now group the shapes (`liveCombine`) and set
`props.boolean` on the Precomp host; the children stay editable inside the group.

The group draws its result because `precompTracks` (the one place `flattenComps` expands groups)
runs `combineShapes` over the children when `boolean` is set. GPU canvas (`preparedDoc` in
`compose.ts`), export and SVG export all read that same flattened doc, so they match without a
renderer change, and nothing needs recomputing: it is derived every time.

- Selecting a live group and picking another operation changes `boolean`; Flatten (`bakeBooleanGroup`)
  ungroups and runs the destructive boolean, leaving one plain path.
- MCP: `combine_shapes` takes `live: true` for the four boolean ops; `flatten` on a live group bakes it.
  The tool-surface pin was refreshed with `-u` on purpose. `set_props boolean` on the group changes the op.
- `BooleanOp` moved to `shape/boolean-op.ts` (re-exported from `boolean.ts`) so `components.ts` can use
  it in the Precomp schema without a cycle.

Limit: the result is computed at frame 0 of the group, so animating a child's position does not
animate the boolean. Static edits (the case Figma covers) recompute.

Verified in a real browser: `tests/e2e/canvas-live-boolean.spec.ts` (union, nudging a child redraws
the union wider, Flatten leaves one path).

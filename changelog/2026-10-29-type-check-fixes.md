# Real bugs svelte-check already reported

`npm run check` had ~380 errors and CI never ran it; `scripts/typecheck-runtime.mjs` runs plain
`tsc`, which does not read `.svelte` files. Among the type noise were runtime defects:

- `+page.svelte` called `saveNodeData`, never defined: toggling a section item threw. The patch is
  now `sectionItemPatch` in `section-source.ts`, sent through `write`.
- `optimistic-insert.ts` `GHOST_SHAPE` had no row for line, arrow, frame: drawing a line threw.
- `history/live.ts` `mergeGraph` dropped `sessions`.
- `canvas-node-data.ts` `effectStepOf` rejected `custom` steps, so custom effects vanished.
- `transition-plan.ts` sent smart animate down the slide path with an undefined direction.
- `/app/compose` read `LAYOUTS['custom']`.
- `core-native.ts` lacked `set_live_overlay`; the native bridge has one overlay channel, so fixed
  and live items are merged before sending.
- `InstanceInspector` read `asset.label` (assets have `name`); `projects/lookup.ts` returned no
  `lastActiveAt`.

The rest were type-only: tooling (`wasm-bindgen` now emits `gpu_text.d.ts`, a `.d.mts` for the
migrations script, `allowImportingTsExtensions` for `cli/`, `open` as a root dev dependency),
legacy changelog dates moved to ISO, and code aligned with its own types. `canvas_comments` is
missing from `database.types.ts` (types not regenerated since its migration); comment-agent now
goes through `canvas-comments.ts`, which already wraps that table, instead of a hand-written row.

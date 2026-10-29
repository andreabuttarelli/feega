# Code bar redesign

- The Code right bar was plain boxes and monospaced text. It now follows the shell tokens and
  the radius scale, light and dark.
- `DevCode`: header with the frame name, `SegmentedControl` for React | HTML | Svelte, Copy and
  Download icon buttons; a file tab row when the export has several files; empty state.
- `CodeBlock` + `highlight.ts`: a small tokenizer (no library, none in the repo) feeding
  `--ui-syntax-*` tokens defined for both themes in `app.css`; line numbers, floating copy with
  "Copied" feedback, scroll inside the block.
- `DevInspector`: collapsible section, rows grouped by `dev-groups.ts` (a table: property to
  group), colour swatches, variables by name, click a value to copy, CSS/Tailwind behind a toggle.
- Also fixes `onfail` and `oncompare` svelte-check errors in `GpuFlow.svelte`/`flow-types.ts`.
- Discarded: shiki/prism (new dependency for ~6 token kinds).

# Figma paste of a full landing page

Before: a landing page (Landify UI Kit) pasted with a wall of text. Texts under the old
`TYPE_SIZE.min` or over 500 characters were refused and vanished. Instances were flattened
with "overrides ignored". Every image fill added a line, and the token banner overlapped the
toast.

Now:
- `effectiveSize` in `scene.ts` falls back from a 0 or missing `fontSize` to the first positive
  size of the style table, then 12. `textClip` clamps the size to `TYPE_SIZE`.
- `text()` in `components.ts` allows `TEXT_MAX_CHARS.block` (20000) for multiline text. The
  agent tools share the schema, so they follow.
- A flattened instance applies `symbolOverrides` and `derivedSymbolData` by guid path
  (`Scope`, `patchedNode` in `scene.ts`): text, fills, visibility, size, swapped symbols,
  nested instances. An instance with overrides or a different size is no longer linked to the
  main (`hasOverrides`), since the main would show the first instance's look.
- The flatten line is gone. Image fills no longer report: the clipboard has only the image id,
  so `figmaNotice` says once how many stay placeholders and why.
- `FigmaNotice.svelte`: one summary line, `Details` disclosure grouped by kind with counts,
  closes after 12 s unless open or hovered, one place for the token message.

Discarded: reading image bytes from the clipboard (not there), a toast per kind.

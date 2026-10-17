# A selected part shows only its own properties

**Bug.** Selecting a poster text part (e.g. "STUDIO" in the type grid) listed every Style and
Layout field of the poster: page background, the ink every line shares, other texts' colours.
`partFieldKeys` added every field no part claimed by name, plus a hand table
(`PART_FIELDS_BY_POSTER`).

**Now.**
- `src/lib/motion/template/part-usage.json`: field → parts, derived. `derive-part-usage.ts`
  renders each built-in poster (linkedom, the static-parts runner from #606) with one field
  perturbed and records which `data-part` elements change; CSS custom properties are followed
  through the component CSS (inherited props reach descendants, background/border paint only their
  element); nested parts are masked. `@page` marks changes outside any part. `part-usage.test.ts`
  file-snapshots it: a template that drifts fails CI (`vitest -u` regenerates).
- `part-usage.ts` `reach()`: Own (only this part, one instance), Shared, Elsewhere.
  `inspector.ts` `partFields`: own fields in the panel, shared in a collapsed "Shared with N
  parts", page-only never. Posters without a table fall back to name-owned fields.
- Text parts get a Fill section with their own stack (`part-style.ts`), seeded from the effective
  colour. A plain solid on a part with its own colour field (batch 6) writes that field; anything
  else goes to `clip.partStyles[partId].fills`, composed as a scoped `!important` rule inside the
  hot root (`hyperframes/part-styles.ts`). Old docs have no `partStyles`: output unchanged.
- Agents: `set_part_fill`; the clip summary lists `parts` and `partStyles`. Parity table updated.

**Discarded.** Poster runtimes reading overrides (old docs keep frozen component JS, and changing
it would untrust them in `staticParts`); deriving usage in the browser (CSP, cost).

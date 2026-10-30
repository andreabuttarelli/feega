# URL import splits the page into named sections

Phase 1 of 4 of turning a URL import into a design system (next: shared styles and variables,
components with props/variants/states, a "Design system" page).

Before, the page frame held one deep tree mirroring the DOM wrappers. Now its direct children
are section frames stacked in a vertical auto layout, named Nav, Hero, Logos, Features,
Testimonials, Pricing, FAQ, Stats, News, CTA, Footer, or `Section N`.

- `page-outline.ts` runs in the page after the tree and records a small outline of the
  full-width blocks: tag, role, aria-label, id/class words, first heading, background,
  picture/quote/details counts, pinned. It travels on `PageTree.outline`.
- `page-sections.ts` is pure: outline in, `{ name, top, bottom }[]` out. It descends `main`,
  the wrapper spine, tall and single-child wrappers; stops at landmarks; drops overlays
  contained in a sibling; lets a top nav overlap the next block. Adjacent generic blocks merge
  unless the later one has a heading, a name, a different background or a gap of 160px+.
  Every name rule is one row of `SECTION_NAMES`. No AI.
- `section-frames.ts` cuts the tree into bands with the slicer's `windowed` (moved to
  `page-window.ts` in its own commit). Text and icons go whole to the band of their top;
  other shapes are cut, so boxes are unchanged. Copies get `id~band`. An empty band merges into
  the next: an empty frame would vanish and shift the auto layout.
- On by default in the dialog, the route (`sections`), the `import_url` op and the CLI
  (`--no-sections`). `import_code` keeps the old tree.

`figma-doc` `grouped` now names the comp after the frame too: Layers labels a precomp by its
comp, so every imported frame (Figma too) read "Group N".

Fixtures: `fixtures/outlines/{stripe,linear,vercel}.json`, captured with
`scripts/url-import/capture-outline.ts`. Discarded: AI naming (cost, nondeterminism) and
detecting on the Figma tree alone (it has lost roles and headings).

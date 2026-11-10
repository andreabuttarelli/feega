# Template previews for all built-ins, newest first

The 61 snapcn templates and framed-reveal, showcase-scatter, card-cascade had no entry in
`previews.json`, so their cards were blank. Generated with `scripts/component-previews.ts`; a test now
fails when any built-in lacks a preview.

Catalogues were ordered by kind or name. Added dates now live in one registry per catalogue
(`motion/template/added.ts`, `canvas/template-added.ts`), derived from `git log -S` of each id (snapcn:
2026-11-10); `catalogue()`, `posterShelf()` and `templatesIn()` sort newest first. Dates of older
templates are the first commit that mentions the id, so moves can make them later than the real add.

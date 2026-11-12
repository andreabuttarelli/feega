# Arc free components as a built-in component library

Arc (uiarc.dev) publishes 143 free MIT items next to a paid tier. A trial folder import
reached SSIM 0.981 but needed manual help: a hand-written Vite app, a Google Fonts link and
no `next/*` imports. This ships the free set as the **Arc** group of the component library.

- `libraries/arc/`: a Feega-owned Vite app. `catalog.json` is the pinned catalog filtered to
  `tier === "free"`; `scripts/arc-library/sync.ts` installs only those items and refuses any
  registry item whose `meta.tier` is not free or that writes outside `src/components/arc/`.
  `src/demos/` renders every item across 31 pages.
- Folder dev server (`folder-shims.ts`): a Vite folder that imports `next/image`/`next/link`
  without `next` starts on a wrapper config that aliases them to `<img>`/`<a>`; one that uses
  `var(--font-geist|inter)` without declaring them gets Geist and Inter from Google Fonts.
- Design tokens: `[data-accent=x]` selectors become the modes of a separate `Accent`
  collection (the 8-mode cap rules out folding them into Light/Dark). Accents nested in dark
  stay out, listed as skipped.
- `scripts/arc-library/snapshot.ts` turns a capture into `src/lib/motion/template/arc/arc-doc.json`:
  one component-set doc per catalog item found (115), compacted by dropping values the doc
  parser restores. 4.7 MB raw, so the canvas loads `arc.ts` only when the library opens;
  the server lists it with the built-ins for agents and the API.
- `insertTemplate` now carries the template's variable collections into the doc (the doc's own win).

Fidelity (capture + repaint, `code-fidelity.browser.test.ts`, label `arc-lib`): average SSIM
0.975 over 31 pages, 266 components, 404 variants. Lowest: data-media 0.871, blocks-content 0.916.

Discarded: shipping the 9 MB full page doc; adding Arc to `BUILTIN_TEMPLATES` (client bundle).

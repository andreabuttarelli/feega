# Ruixen free components as a built-in component library

Ruixen UI (ruixen.com) publishes 212 free React + Tailwind components in an MIT repository
(github.com/ruixenui/ruixen.com, LICENSE.md: "MIT License, Copyright (c) 2025 Ruixen UI"). Its
paid tier (Pro, $99) lives on pro.ruixen.com and is not in that repository. This ships the free set
as the **Ruixen** group of the component library, the same way Arc was added.

- `libraries/ruixen/`: a Feega-owned Vite + Tailwind 4 app. `catalog.json` pins the `registry:ui`
  items of the repo's `registry.json` at commit `f6b2086`. `scripts/ruixen-library/sync.ts`
  fetches only from that commit of the MIT repo and refuses items served elsewhere (Pro), targets
  outside `src/components/ruixen/`, `next/navigation`/`next/font`, and imports the registry does
  not ship. 5 refused (listed under `skipped`). Demos are Ruixen's own examples, 6 per page,
  39 pages; `src/index.css` is adapted from the repo's `globals.css`.
- Shared with Arc: `scripts/component-library/{compact,snapshot}.ts` (snapshot now takes
  `<library> <Group>`), `shipped-library.ts`/`shipped-cards.ts`, and `libraries.ts`, the one list
  the canvas lazy-loads and the server lists for agents and the API.
- Snapshot: 197 of 207 installed items became component sets (6.3 MB raw, lazy). The first cut
  had 159; review found why 48 were missing and fixed three causes in shared code:
  - 34 render `<><style/><root/></>`: the `<style>` host counted as a second root, so
    `componentMarksOf` never marked them. `<style>`, `<script>`, `<template>`, `<link>` are now
    ignored as roots.
  - export names that are not the slug in PascalCase (`FAQScrollAccordion`, `Pricing_Plans`,
    `ThreeDWallCalendar`) and components that share their root with the demo (`XDemo`): the
    snapshot matches by normalised slug (`scripts/component-library/names.ts`).
  - 10 remain, recorded in `catalog.json` `skipped`: 2 only show after a click/scroll
    (`floating-navbar`, `add-task-sheet`), 8 are folded into a differently named demo.
- Strokes: `reframed` (moving a main from the page frame into its set) scaled x/y/size but not
  stroke width/dash/gap, which are relative to the frame's short side; inserted icons and borders
  drew at ~0.1 px. Fixed in `comp-frame.ts`; this also affects Arc once re-snapshotted (not done
  here: Arc's shipped snapshot still has the thin strokes).
- Images: demos used `/logos`, `/avatar-images`… from the Ruixen site; the sync now fetches those
  from the pinned commit into `libraries/ruixen/public/` (videos excluded). The snapshot fills
  image layers with durable URLs: remote ones as they are, local ones rewritten to
  `raw.githubusercontent.com/ruixenui/ruixen.com/<commit>/public/…` (`images.ts`). Before, every
  image in a shipped set was a grey placeholder.
- Capture determinism: the demo app wraps everything in `MotionConfig reducedMotion="always"`,
  so motion/react transitions are at their end state when the capture reads them.

Fidelity (`code-fidelity.browser.test.ts`, label `ruixen-lib2`): average SSIM 0.971 full page,
0.987 first fold, 39 pages, 469 components, 536 variants. The first run (0.974) scored broken
images on both sides; with images loading the real gaps show. Lowest, and why:
- cards-1 0.783: a coverflow carousel built with `perspective` + `rotateY` comes in flat.
- cards-3 0.869: rotated fan cards come in unrotated.
- more-2 0.885: a `<canvas>` rain background and a timer-driven feature rotator differ by frame;
  reduced motion does not reach them.
- heroes-1 0.904: a 3D receding-plane corridor flattened; a masked, tilted mockup becomes a grey
  placeholder.
- heroes-2 0.904: near identical; one headline wraps differently and shifts what follows.

Review inserts (composed as Add to canvas does, drawn with the still renderer, no database):
`~/Documents/feega-videos/code-import/round2/runs/ruixen-lib/review/`. Light/Dark arrive as the
`Ruixen Palette` collection (33 colours, Light and Dark modes) plus `Ruixen Colors`, `Radius`,
`Type`.

Not done: the feature demo video; 3D transforms, CSS masks and inline text size runs
(`$1,999 /one-time` comes in at one size).

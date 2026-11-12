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
- Snapshot: 159 of 207 installed items became component sets (5.5 MB raw, lazy).

Fidelity (`code-fidelity.browser.test.ts`, label `ruixen-lib`): average SSIM 0.974 full page,
0.987 first fold, over 39 pages, 442 components, 507 variants; 32 of 39 pages ≥ 0.95. Lowest:
cards-1 0.864, cards-3 0.875, more-2 0.884, heroes-2 0.899, heroes-1 0.904.

Animation: captured as a still after a 1.2 s settle (`RevealMode.Still`); motion is not carried
over. Marquees and scroll-driven items freeze mid-state, which is most of the low pages.

Not done: the feature demo video.

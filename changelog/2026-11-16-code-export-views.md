# Code export: every view, checked against the canvas

The Code panel passed `inView(source, breakpoint)` to the exporter, so on a
phone view the output had no media queries while the API, CLI and MCP (full
doc) had them. It now passes the source doc.

`withMedia` only diffed clips of the page root and dropped clip ids seen twice:
- layers hidden at base and shown in a view were skipped by `build`; they are
  now built, `display: none` at base, restored in their view;
- component mains are diffed per component (root included);
- a property dropped in a narrower view was reset with `unset`; `display` now
  resets with `revert` (a div is block, not inline).

`resolveView` instead of `resolveAt` for the export was tried: identical
scores on 8 views, so `resolveAt` stays.

Gate: `npm run test:export-fidelity` renders each view as the canvas still,
exports HTML, opens it at the view width and scores both (banded SSIM). Floors
are the measured scores minus 0.02. Open defects it pins: landing and
features-grid scroll sideways between breakpoints (`it.fails`), and a phone
view whose canvas still and export differ in text size (hero-phone 0.70).
Not tested: React and Svelte pixels (they need a build); they share the IR
and media pass.

Round two (gate named causes):
- Overrides on the exported frame's own root were never diffed (`entriesOf`
  excluded the root): features-grid tablet 0.909 -> 0.960. Root keeps its
  width/max-width/margin rules out of the diff.
- Component roots get `max-width: 100%`. Rows that do not wrap in the doc
  wrap only strictly between and below the defined view widths
  (`@media (max-width: V-1px)`, reset to `nowrap` at each view width), so a
  view width matches the canvas and in-between widths never scroll sideways
  (landing 414/600, features-grid 320 are green). A default wrap on every row
  was tried: landing tablet fell 0.652 -> 0.599.
- A component root with a Fixed width keeps it (button 140px): hero base
  0.922 -> 0.936.
- Canvas text can shrink 5% per `fitSize` step when the layout estimate
  (`layout/resolve.ts` measure) is narrower than the browser text: hero
  headline 598px canvas vs 629px export. Export does not mimic it.

React: Tailwind v4's `max-[N]` is `width < N`, the HTML rule is `width <= N`,
so a phone view was not applied at exactly 390px (page scrolled to 399px).
`tailwind.ts` now emits `max-[N+1]`. `CODE_EXPORT_REACT=1` builds the landing
React export (npm install + vite build, ~30 s) and compares wrapped rows and
sideways scroll with the HTML export at 1440/1439/810/809/600/390/389/320: equal.
Variant order was fine; the off-by-one was the defect.

Round three (Linear frame from the landings fixture, text-metrics agent):
- The synthetic page root keeps `min-height` of the base frame; views now
  restate it (`heightMedia`): Linear phone 9648px -> 5937px, height ratio 1.000.
- A view that switches padding from four sides to `padding-block/inline`
  reset each side with `unset` after the shorthand, zeroing the padding
  (landing phone: the 'Controllers at 1,400 companies' line lost its 20px
  gutters, which is why it did not wrap). Covered sides are no longer reset.
- `jsxSvg` turned `style` into SVG attributes and left `<img>` unclosed inside
  `foreignObject`: the React build of Linear failed. Style is now a JSX object,
  void elements are self-closed. The env-gated React build (`CODE_EXPORT_REACT=1`
  with `CODE_EXPORT_DOC=<doc.json>`) covers it. Not touched by this PR, so
  inferred to fail on dev too.
- `letter-spacing` and `line-height` keep four decimals (-0.045em was -0.04em).
- Titles are clipped to the 5% safe area on the canvas; the export lists that
  under Not exported instead of reproducing it.

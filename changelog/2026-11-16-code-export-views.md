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

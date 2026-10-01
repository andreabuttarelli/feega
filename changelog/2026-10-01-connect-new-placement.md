# "Connect to new…" places beside, never on top

**Why.** The new node was centred on a point 24px right of the
selection box, so it covered half its source. At first open `fitView`
zoomed a lone node to 2×, so the new node landed off-screen
(y = -278 in the repro). Clicks there hit `<html>`: Playwright reported
"html intercepts pointer events". No overlay or coach ring was involved.

**Rule.** `placeBeside` (`src/lib/canvas/placement.ts`): right of the
rightmost source + `PLACEMENT_GAP`, tops aligned, stepping down past any
occupied rect. Rects are the rendered tiles (text height included).
`planTemplate` uses the same gap: step = largest node in the template +
gap (a test checks no template node overlaps).

**View.** `CanvasFocus` (inside SvelteFlow) fits given node ids with
`FIT_PADDING`, max zoom `READABLE_ZOOM` (1). Used after connect-to-new
(sources + new node), after each coach step and after the coach's Run.
Initial `fitView` is capped at the same zoom.

**Test.** `tests/e2e/connect-new.spec.ts` (@real): text → image → video
with real clicks, asserts no overlap. It failed before the fix with the
intercept error.

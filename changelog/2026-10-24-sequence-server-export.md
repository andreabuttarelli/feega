# Server exports of a sequence embed its scenes

**Before:** `selectionPorts.read` returned the parent frame's stored doc. A sequence stores only
scene references, so Lottie / dotLottie / SVG / PNG / PDF exports of a sequence (the export
selection action and the `export_selection` canvas op) drew an empty frame. The browser export
dialog already resolved scenes, so MP4 and GIF were fine.

**Now:** `playedDoc` (`selection-export-ports.ts`) runs the doc through `withScenes` with the
head of every scene, the same resolution the embed path uses.

**Tests:** `selection-export-ports.test.ts` (sequence resolved, ordinary frame untouched) and
`sequence-lottie.test.ts` (a 3-scene resolved sequence exports a Lottie of the full length,
nothing skipped).

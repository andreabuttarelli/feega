# Fluidity scorecard: whole editing sessions as a release gate

The user judges the canvas on whole sessions, not single features: shapes reloading, old props
coming back and lag after every change. Specs so far each guarded one feature.

`tests/e2e/fluidity-scorecard.spec.ts` chains one realistic session on the heavy canvas copy in the
test org (project slug `gpu-fixture-0aef6d1a`, refreshed by the GPU agent's copy script), with no
reloads, on both renderers (`gpu` default, `?renderer=dom`), headed Chromium and WebKit, plus a
two-tab variant where a second tab keeps editing another node's prompt.

Per step (`fixtures/fluidity-probe.ts`): remounts of untouched nodes and player mounts
(MutationObserver), GPU build/fetch/upload counters, watched fetches (session, posters, fonts,
storage), flashes (1–2 frame transients in CDP screencast frames of the touched node and up to six
untouched ones; Chromium only), reverts (on-screen value returning to an earlier one per animation
frame, final value ≠ last set), input→paint (Event Timing plus input-to-next-frame), frame p95 and
long tasks. `fixtures/fluidity-report.ts` holds the thresholds and writes
`~/Documents/feega-videos/fluidity/SCORECARD.md`; one MP4 per session/renderer.

Steps the driver cannot reach are reported `UNDRIVEN` with the reason and fail the gate: a step
never tried is not a pass. Generate is mocked (503), never a model call. Nodes the session creates
are soft-deleted at the end.

`npm run test:gate` runs the serial real-stack gate list, scorecard included.

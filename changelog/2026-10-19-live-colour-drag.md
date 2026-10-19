# A colour picker drag paints live, and saves once on release

**Why.** Dragging in a colour picker changed nothing until the native picker closed: the field
only listened to `change`. Wiring `input` straight to the edit would have recorded a revision
and a save per step.

**What.** `liveEdits` (`src/lib/motion/live-edit.ts`) sits in front of the editor shell's
`edit`: while a gesture is open, each edit only sets `previewDoc` (hot-patched into the preview
iframe, and on the GPU engine recomposed) and a `liveRoot` that `frameDocs` publishes to the
canvas tile; release records the last doc once (one undo step, one save); cancel drops it.
`colourDrag` maps picker events onto the gesture: first `input` begins, `change`, a click
outside or unmount releases, Escape cancels. The gesture is passed as a prop
(`ColorField`, `FillStack`, `StrokeStack`, `PosterPartPanel`, `MotionInspector`, and, through
the `liveColour` action, `LookInspector` and template `FieldForm`). A Svelte context was tried
and dropped: the component tests mount the client build while `.svelte` files resolve the
server one, so `getContext` throws there.

**Tests.** `live-edit.test.ts` (one revision per drag, cancel, no gesture);
`tests/e2e/colour-drag-live.spec.ts` (@real, GPU and DOM canvas): 8 picker steps paint in the
preview in 16–31 ms each (median 23–25 ms), no `?/ops` request before release, one revision
after.

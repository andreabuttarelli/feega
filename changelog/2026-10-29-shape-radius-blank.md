# A stored prop the schema refuses no longer blanks the frame

- Cause: Shape (like every built-in) has a `.strict()` props schema. `parseMotionDoc` ran
  `propsProblem` in Lenient mode, but Lenient only relaxed custom components: one clip with
  `radius` (not a Shape prop; radii are `roundness` + `corners`) failed the whole doc, so the
  canvas drew nothing.
- Fix: `salvageProps` (components.ts) drops the top-level keys a parse rejects (unknown keys,
  wrong-typed values) and reparses, so defaults fill in. Load is Lenient; `addClip`/`updateClip`
  stay Strict, so agents still get the error.
- Changed decision: `parseMotionDoc` used to refuse a doc with a bad prop; now it keeps the doc
  and drops the prop.
- Also: `motion-recording.spec.ts` targets `editor-mode-switch` (bottom bar) instead of the gone
  `radiogroup`.

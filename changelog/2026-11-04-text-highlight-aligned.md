# Hover and selection boxes follow the drawn text

- **Symptom.** A text's hover/selection box was offset from its glyphs; in a horizontal stack only
  the first text was right, each following one drifted further.
- **Cause.** `3abae2a0f` made the frame picker read placements from `prepare(...)`, but without a
  typeset: auto layout measured texts with `estimatedText`, while the GPU draws with
  `shapedText`. Different widths, different stack offsets.
- **Fix.** `framePicker` takes a `Typesetter`; `GpuFlow` passes the loaded face book (the same
  memoised `loadFonts` the renderer uses). When it lands the picker drops its placements and
  bumps a state tick so overlays recompute. The default stays the estimate, so unit tests make
  no font requests.
- **Test.** `frame-pick-typeset.test.ts`: three texts in a horizontal stack, picker rects equal
  the GPU placements.

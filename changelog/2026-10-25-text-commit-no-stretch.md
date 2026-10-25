# Committed text no longer flashes stretched

After typing a free text, the canvas showed the new text squeezed or stretched
into the old box for up to two seconds, then snapped to the right size. Every
commit, every text.

Cause: `fitTextBoxes` showed the fitted doc at once (`liveDocs`) but placed the
fitted node size only after `saver.flushPending()`, a network round trip. For
that window the core drew the new doc's picture into the old node box
(`screen-uses` scales `size` to `box` per axis). Measured on the local stack:
every committed text stretched for 0.5–1.9 s.

Now `applyTextFit` (`text-autosize.ts`) amends, shows and places in the same
synchronous step. The flush was a leftover from when the size went through
`onResize`, which refit the doc on the server; `onPlace` stores only the size,
so nothing needs the doc saved first.

Rejected: drawing a stale picture at the box it was built for inside
`CoreFrames`. The box recorded at build time was itself the stale one, and the
text stayed stretched for good.

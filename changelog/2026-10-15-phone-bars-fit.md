# Phone bars fit the screen

Bottom bar: `phone-bottom-stack` was red on dev. Cause: `2f23e1f57` (draw free elements) put the
five draw tools in the canvas bar; at 44px targets the bar was 559px on a 390px phone, centred, so
it started ~85px off the left edge. Under 768px the draw group now shows only the active tool; a tap
on it opens the five (the rest of the bar steps aside), picking one folds them again. Desktop is
unchanged.

Top bar with a frame open (phone): the trail scrolled sideways (`overflow-x: auto`), so Export,
Full screen and close ran off the edge; on the canvas mount `⋯` was hidden outright. One table,
`src/lib/motion/phone-bar.ts` (`ON_PHONE`), says where each trail item goes on a phone: Publish,
Export, Full screen → `⋯`; version history → off. Menu, title (truncated, the lead shrinks first),
Design / Motion, undo / redo (`motion-touch` needs them in the bar), `⋯` and close stay. The canvas
top bar (browsing) already fit with long names; the new e2e holds it.

Guards: `phone-bottom-stack.spec.ts` (fold/unfold on screen), `phone-top-bar.spec.ts` (long names,
iPhone + Android, browsing and frame open: controls inside the viewport, nothing clipped, no page
scroll), `phone-bar.test.ts`.

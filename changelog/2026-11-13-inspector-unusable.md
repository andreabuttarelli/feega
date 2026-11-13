# Inspector: controls the audit marked unusable now work by mouse and keyboard

Round 3 of the inspector audit (#2088). Each fixed row lost its marker in
`tests/e2e/fixtures/inspector-audit/known.ts`.

- **Nested popovers stay in the focus trap.** `onBody` (`ui/shell/on-body.ts`) no longer lifts an
  element out of an open `SidePopover` (marked `data-focus-trap`). A colour picker opened from an
  effect popover is now inside it: Tab reaches it, Tab past it wraps, a press in it no longer
  closes the effect popover underneath (that press was the "harness mismatch" of round 2: the
  mouse really closed it), Escape closes only the picker and returns focus to the chip. One rule
  for every popover opened inside a trap, not a colour special case.
- **Effect colour hex.** The effect editor puts a colour row's label above the field; the hex was
  0 px wide beside the chip and the opacity.
- **Stack child W.** A fixed child capped by its stack showed the capped width, so ArrowUp wrote
  back the stored width and nothing changed. The field now shows the width set; "Capped at N px"
  explains the rest.
- **Frame width.** Inspector resizes went through `onResize` (the per-move drag callback) and never
  recorded the node box for undo: undo restored the doc and left the node at the new size, so the
  field kept 1200 and retyping 1200 was ignored. `nodePlaceOf().resize` now goes through
  `onResizeEnd`, the same undoable path as a drag release.
- **More actions menu.** At 800×600 it flipped above the window. It now always opens below its
  button, scrolls inside the space left (`max-h` = available height), and takes its content width
  (it was squeezed to the anchor width, cutting labels). A clamp in the shared dropdown content
  was tried first and dropped: every long menu (add effect, bind chips) became a scroll list
  shorter than the room it had before.
- **Size preset select** resets after a pick, so the same preset can be picked again.
- **Targets.** `.reach` (`app.css`) pads a row by 4 px and pulls the margin back: the target grows,
  the panel does not. Used on instance rows, reset/expose, prototype actions, stroke per side,
  installed fonts. Image sliders get a 24 px input with the same 4 px track. LUT select takes the
  row height; advanced type fields go one per row. Variant matrix cells get names.
- **Sweep.** A disabled button is no longer reported as covered (no pointer events: the probe hit
  its parent).

Not fixed, diagnosed in the markers: the "stale canvas" rows are edits that draw nothing new (DM
Sans loaded at 400/500/600 only, so 300 draws as 400; one-line line height; one-child gap) plus the
saved→live picture swap on the first edit; the line rows: a line shape is `Unsupported` in the
display list and its picture fallback draws nothing. Theme mode Dark repaints and undoes cleanly
and is strict again. The gradient bar stays pointer-only: its stops are already arrow-movable
sliders and `+` adds a stop by keyboard.

# A drawn text lands where and as big as it was drawn

Seen: on an empty canvas the first text/shape slid away from the drag (the GPU canvas and
the DOM canvas both fitted the view to the first node), and selecting it after creation
re-centred it. A click-created text was centred on the click. Its selection showed two
boxes: the element and, inside, the glyph ink.

- The view fits only the nodes present when the canvas opens; `FocusMode.Select`/`Reveal`
  move the camera only for a node not already in view (`inView`, insets aware). An editor
  opening on a free element reveals instead of reframing.
- `clickBox`: a click starts the box at the click, top-left.
- `BoxRole.Own` / `data-box`: a Text measures its own box, so its selection is the text box,
  which for a free text is the element itself.

Text sizing modes (auto width, auto height, fixed) are a separate change.

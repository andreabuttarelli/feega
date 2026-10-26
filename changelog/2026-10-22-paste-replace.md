# Paste to replace (⇧⌘R)

Figma parity. `replaceElements` in `move-element.ts` removes each selected
element and places the first copied element (element clipboard, ⌘C) at its
centre and start frame, reusing `placeElement` so sizing, carried fonts and
assets behave like a normal paste. Runs as a frame key through `BAR_OPS`; the
copies become the selection. Agent path: `add_clip`.

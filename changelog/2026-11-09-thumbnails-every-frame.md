# Thumbnails for every finished frame

The first thumbnail pass captured at most one frame per paint. Paints stop once the canvas
settles, so frames that finished in the same paint as others, often the breakpoint views, never
left a thumbnail. Now every frame that is fully drawn and on screen is captured in that paint
(`thumbsDue`).

Breakpoint views load later than desktop frames (their docs arrive through the live-doc path).
A view gets a thumbnail only after it has been drawn once, so the first reopen may still show
some views late.

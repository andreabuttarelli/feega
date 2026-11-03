# Lines and pen paths drawn into a frame use black ink

A line, arrow or stroked pen path drawn from the canvas onto a frame got the stroke
`brand.text`. With no brand that token is `#f0eee9` (FEEGA_TOKENS, built for dark
videos), and a new frame is white: the line was nearly invisible. The same tools used
inside the frame already drew with `DEFAULT_COLOUR.ink`; `drawnInFrame` now does too, so
the two entry points agree.

Rejected: resolving the brand token against the frame fill. A frame's look is free to
change after the line exists, and the in-frame tools never did it either.

# Plain-letter tools in Design mode

Design tools pick tools with bare letters (T text, R rectangle, O ellipse, P pen; unconfirmed,
the common standard). In a frame's Design mode T/R/O/P now
pick the tools; the ⇧ letters still work everywhere. Motion mode keeps the After Effects
meanings (T opacity, R rotation, P position, O work-area end), because the bindings with
`mode: Design` sit first in `SHORTCUTS` and `commandFor` takes the first match.

The canvas keeps ⇧ letters: bare letters there would collide with the global `g` sequences.
View-only (tool choice), no parity tool.

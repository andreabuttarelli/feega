# Canvas: the zoom no longer restyles every node

The canvas viewport set `--zoom` on itself every frame of a zoom. An inherited custom property
that changes restyles the element's whole subtree: every tile's DOM, every frame. The only reader
was the comment pin, which counter-scales by it. A heavy-canvas zoom profile spent 441 ms of 4 s in
style recalc.

The pins now get the zoom as a prop and set `--zoom` on themselves; the viewport only carries its
transform.

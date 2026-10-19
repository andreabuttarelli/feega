# Liquid blobs stay inside their frame on the canvas

#961 drew the lens correctly in a frame but `groups.rs` copied lens items
into the canvas screen unchanged: its centre, radii and box stayed in
frame coordinates, so on `?renderer=core` every blob was drawn at full
frame size near the canvas origin, spilling over other nodes.

`placed` now moves a lens through the `use` matrix (points transformed,
lengths scaled) and clips its box to the frame on screen. A lens also
records where its group starts (`under`), so it refracts only its own
frame's items, not every frame drawn before it on the canvas.

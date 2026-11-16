# Canvas: the selection ring hugs its frame while zooming

#2213 held `strokeZoom` mid-gesture for every chrome tile. Ring gap, stroke and handles are
world units sized `px / strokeZoom`, so with the step held they scaled with the camera: zooming
in 2× doubled the gap and the stroke, and the ring drifted away from the frame, then snapped back
on rest. Core cameras for tiles and overlay were already the same (`self.camera` in
`present_tiles` and `overlay_texture`): the mismatch was the overlay geometry, not the transform.

Selected tiles now take the live stroke step (`strokeZoomOf`, `settled-zoom.ts`); resting chrome
keeps the held step, so the expensive fixed part still isn't resent mid-gesture. Only the selected
part is resent, once per 1/16 octave. Labels stay held. Discarded: a zoom uniform in gpu-core for
screen-constant strokes — still the long-term fix.

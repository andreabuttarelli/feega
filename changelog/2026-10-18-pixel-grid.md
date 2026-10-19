# Pixel grid

Zoomed in far enough that one frame pixel covers 8 screen pixels
(`PIXEL_GRID_ZOOM`), the editor draws a one-pixel grid over the frame. ⇧' turns
it off and on; that is view state, not saved, so the agent parity marks it VIEW.

`PixelGridOverlay` sits inside `MotionPreview` with the other overlays, so it
draws over the HTML and the GPU engine alike. It reads its own on-screen width
every 200 ms instead of a resize observer: the canvas zooms the inline editor
with a CSS transform, which no observer reports.

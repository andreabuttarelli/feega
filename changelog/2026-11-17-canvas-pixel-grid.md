# Pixel grid over the whole canvas, zoom up to 3200%

The pixel grid was a DOM overlay inside an open frame, shown from 400%, and the camera stopped at
400% (`MAX_ZOOM` in `gpu/camera.ts`), so a canvas-wide grid at 800% could not exist. The camera
now goes to 3200%; Shift+1 / Shift+2 still fit up to 400% (`FIT_MAX_ZOOM`).

The grid is one `<canvas>` (`PixelGridCanvas.svelte`) over the surface. One canvas pixel per cell,
hidden under 600%, fading in to 800%, full above (`pixel-grid.ts`: `gridFade`, `gridStops`). Lines
sit at `offset + n * zoom`, so they land on whole canvas pixels at any zoom. Same toggle as before
(`FrameView.PixelGrid`, Shift+', Preferences > Views), default on.

Cost during gestures: while the camera moves (`CameraMotion.Moving`) the canvas is hidden and its
effect returns before reading `view`, so a pan or zoom does no grid work. It repaints once at rest.

Tried first: `liveItems` in the GPU overlay (`world-overlay.ts`). The items reached `setOverlay`
but nothing was drawn in Chromium, not even a solid red square, so it was dropped. The cause was
not found; the overlay `live` part is not painted for items outside the existing chrome shapes, or
not painted at all in this configuration.

Not done: removing the per-frame DOM grid. It still serves the frame editor at 400%.

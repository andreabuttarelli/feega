# Posters and thumbnails rendered offscreen

Frame thumbnails (IndexedDB, #1864) and the server poster (#1876) were a
crop of the visible canvas: `thumbRect` refused any frame not wholly on
screen, so tall pages (most imported landings) never got either, and a
cold open showed blank cards until every frame was built.

gpu-core gains `poster(group, width, height, scale)`: it draws the frame's
group through the existing device into an offscreen texture (same plan and
engine as the screen, pictures included) and resolves with its RGBA rows.
CoreFrames queues one job per frame the first time its whole version is
drawn, runs them in idle callbacks, waits while a gesture is active, and
feeds the same webp to the IndexedDB thumbnail and the poster upload
(at most 480 px wide, 4096 px tall). The WebGL fallback keeps the screen
grab.

Checked in the browser on the landings canvas: the six tall frames posted
their posters ~3 s after drawing; a cold open in a fresh profile shows the
four desktop pages whole at 1.5 s, before any frame is built.

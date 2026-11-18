# A returning frame keeps its last layer until its head draws

A frame shows the first *pictured* layer of its chain (`ready`, thumb, poster, `before`, blocks,
placeholder). A frame far off screen and over the picture budget draws its `:vectors` layer as
`before`. `chains` pruned `drawnLast` for every frame not "holding" (not rebuilding, not seen in
the last 15 s, not resident-and-unpictured); mid-pan a far frame drops out of all three, so its
`drawnLast` went. On arrival its whole group, put long ago but never pictured (non-resident
frames upload nothing), heads the chain; the vectors layer is no longer in it, gets dropped from
the GPU, and the only pictured layer left is the readable-frame placeholder, which draws nothing.
Seen on the 36-poster fixture at zoom 0.12: ~0.1–0.5 s of empty frame per return, and in 2 of 7
runs three frames empty for the whole 30 s watch (their upload never finished).

`drawnLast` now lives as long as the frame and its list; whether it joins the chain is still
decided by `holding`, so GPU memory is unchanged. When the head is not pictured, `stopgaps` puts
the last drawn layer again (next to thumbs), so the frame draws it in the same paint.

Measured on posters36, zoom 0.12, TL→BR after 30 s away, with the returning frames' uploads held
back (the stall seen live): before, 6 of 9 frames empty for the whole 10 s watch in 3 of 5 runs;
after, 0 empty frames in 5 of 5, each frame showing its vectors within 30 ms of arrival.

Not changed: the stalled upload itself (could not reproduce under the instrumented build), and
`Stand.Frame` drawing nothing.

# Engine: tile bind groups survive a frame with a lifted element

`Reprojector::draw_tiles` kept the bind groups of the tiles it drew, to reuse them next frame.
A frame that also draws a lifted (dragged) element calls it twice, and the second call replaced
the kept set with the lifted tiles only, so every screen tile got a new texture view and bind
group on every drag frame (~1.5 s of 4 s in the paced frame-drag profile, `create_bind_group`
plus `create_view`). Bindings are now kept per frame (`FrameKept`): anything either call used
survives to the next frame, anything unused for a frame is dropped.

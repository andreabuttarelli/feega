# Core canvas: node chrome is an overlay pass

On `?renderer=core` hover, selection ring, editing ring, handles and port names lived inside each
card's group and in `cardKey`. Hovering or selecting changed the key, the group was re-put and the
card showed its sketch for a frame; frames, free elements and groups lost the chrome entirely once
their real frame was put (the poster card carrying it was dropped).

Now `tileChrome` keeps only ports, lit port names and label (static, in the group); `stateChrome`
draws hover/ring/handles/names, passed to `overlayOf` as `chrome` for every core-drawn node and
drawn on top every frame, turned with the node's rotation. Overlay chrome must stay out of cached
groups and damage-limited rasters.

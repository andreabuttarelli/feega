# Retained texture: never show pixels from another place

Two ways the held (retained) texture showed content from a different part of the canvas:

1. `adopt_rest` copies only the screen-sized middle of the retained texture; `Retained::adopt`
   then declared the whole texture, overscan ring included, sharp for the new camera. The ring
   still held pixels from the previous camera. A small pan (`Step::Present`) or the tile underlay
   then drew that ring: frames from elsewhere on screen next to the right ones.
2. `Compositor::take_damage` (the tiled path) drained the world damage the retained texture needed.
   Leaving the tiled path without adopting a rest picture (blank tiles) presented the retained
   texture as it was before the edit.

Now an adopted texture marks its ring foreign: the tile underlay is clipped to the painted middle
(`Retained::painted`), and the next exact frame repaints the ring before anything can present it.
Damage taken by the tiles forgets the retained texture, so the next exact frame is a full render.

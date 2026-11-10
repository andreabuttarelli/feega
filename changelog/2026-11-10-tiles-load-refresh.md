# Tiled canvas: changed tiles refresh while the canvas loads

Since tiles became the default, the load bench showed first content 2.5 → 4.4 s cold and
0.6 → 4.1 s warm at 1x. Cause: a changed tile stays on screen as stale until it is rastered
again, but stale tiles counted as their own cover, so outside a gesture nothing queued them; only
the exact rest picture replaced them, and it waits 200 ms after the last change. During a load
changes never stop, so thumbnails and vector passes landed in the world but not on screen.
Now `Tiles::queue` sorts missing tiles into blank, stale and blurry; stale ones are re-rastered
(all at rest, one per frame in a gesture, the dragged frame's old place first).

Load bench, ?coreTiles=0 vs 1 after the fix (2 runs each):
- 1x: first cold 2.4-2.5 → 2.0-5.7 s (one outlier), warm 0.6-0.9 → 0.6-0.8 s; sharp warm 2.4 → 3.4 s.
- 4x: first cold 5.6-6.0 → 6.0-6.5 s, warm 2.5-3.8 → 4.4-4.6 s; all cold 7.4 → 9.4-9.7 s; sharp
  cold 9.5 → 10.6-13.8 s. Still behind flag-off at 4x.

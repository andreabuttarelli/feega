# Canvas: the overlay texture is kept while nothing changes

After #2262 the core lerped, copied and rendered the pinned overlay on every presented frame:
~0.3 ms more per frame than dev with nothing selected.

`OverlayKept` (`overlay_kept.rs`) keys the rendered overlay texture on camera and screen size.
Every core entry point that can change what the overlay draws (overlay parts, uses, groups,
pictures, budget, pixel ratio) forgets it; a draw with pictures still pending is never kept.
`PinnedScene::at` now lerps into the scene it handed out last frame instead of cloning a new one.

Bench on the user canvas copy, `?directZoom=0`, uncapped: flicker 0/9; nothing selected
~1,480–1,850 fps (dev ~1,400), over 8.3 ms 91–99 (dev 94–108); select-all ~1,280–1,700 fps
(dev 135–158), over 8.3 ms 107–135 (dev 277–298).

# Canvas: a tile pyramid instead of camera-relative bake levels

Before: idle baking followed the camera. `BAKED` held five levels relative to the current zoom
step, plus a reserve level, a coarse pass and one whole-canvas level (#1955). Every zoom moved
every level, so a zoom re-baked tiles it had baked a quarter-octave earlier, and the gesture
rastered "blurry" tiles one per frame. Eviction pinned tiles by re-deriving those levels per
tile.

Now there is one pyramid of absolute levels: 1/16, 1/8, 1/4, 1/2 and 1x of the pixel ratio
(`PYRAMID`). Each level has a share of the kept tiles. A level covers the whole canvas when it
fits its share, otherwise the area around the view the share allows. The coarsest level always
covers the whole canvas (at a coarser step if needed) unless the device's whole-canvas allowance
is 0 (phones). Baking runs in idle time, coarse to sharp, nearest the view first.

Below the pixel ratio the view draws the nearest level, so zooming within an octave needs no
new tile; #2020's credit still sharpens what that level leaves soft. Above it, tiles are rastered
on demand for the view, as before. The level the view draws always covers the screen plus a
quarter on each side, whatever its share. Tiles wholly outside the canvas are never missing (a
coarse level stops at the canvas edge, and panning past it rastered empty tiles every frame), and a
level that covers the painted screen is drawn alone, without the coarser held levels under it. The plan made at the last bake pins its tiles: eviction checks a key
against five index ranges, constant time, and a zoom away from where the plan was made does not
evict it.

Replaced: `ahead`, `reserve`, `coarse_ahead`, `canvas_ahead`, `BAKED`, `fill_reserve`,
`fill_coarse`, `fill_canvas`. The JS side passes the pixel ratio (`setPixelRatio`).

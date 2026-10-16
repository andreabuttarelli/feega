# Zoomed-out pan: node shells leave layout while the view moves

#587 left two 500-node cases red: WebKit overview pan (p5 37 fps) and Chromium 4× CPU pan
(29 fps). Its reading was image raster/decode. Measured, it is not: a Chrome trace of the pan is
~80% `Layerize`; a no-op poster draw, `ImageBitmap` thumbs (`createImageBitmap` +
`resizeWidth`) and `display:none` on node children each moved nothing. Taking the node shells out
of layout took both cases to 60 fps (p5 56+).

So under LOD (`poster-lod`), while the viewport moves (`.moving`), unselected poster nodes get
`display:none`. Nothing visible changes: their content was already hidden and the poster layer
draws them. xyflow skips zero-size measurements, so `measured` survives and the poster layer keeps
its rects; on `moveend` they return for hover, click and drag. Selected nodes stay.

Discarded, measured: right-sized motion posters (production posters are 480 px, under the 840
device px a node needs at zoom 1; image nodes already have zoom×DPR tiers), `ImageBitmap` thumbs,
the poster canvas above the nodes, `z-index:auto` on shells — none moved the pan.

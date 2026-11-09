# Frame images sized by zoom

Batched sources carry a media hint per image asset, but frames still drew
the signed original. CoreFrames now rewrites image assets to
`canvasAssetUrl(..., assetTier(zoom))` before the worker build and puts
the tier in the frame key of frames that have images: crossing the 0.75
zoom tier rebuilds at 1024 px while the drawn raster stays until the sharp
one lands. Works without width/height (the landings fixture has none).
Not done: decoding images before the build.

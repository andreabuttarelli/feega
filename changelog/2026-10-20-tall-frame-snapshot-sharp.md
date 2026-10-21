# Tall frame snapshots stay sharp

Card snapshots (html-to-image at 2x) were downscaled by `fitBitmap` to the
2048 px image decode edge. A 1440x6000 landing frame ended at ~0.34x of its
CSS size and looked pixelated at any zoom. Snapshots now have their own
`snapshotEdge` (8192 on desktop, unchanged on phone, which never shoots).
Not done: tiling beyond 8192, and re-rasterising on zoom settle.

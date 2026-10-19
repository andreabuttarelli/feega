# Core canvas: frame label and ports live in the overlay

#991 rebased on dev (its first commit already shipped). A motion poster is now face-only
(`CardLayer.Face`) and every core-drawn motion tile passes `ChromeLayers.Whole` to the overlay, so
frames, free elements and groups keep label and ports after their real frame is put, as vectors
drawn every frame instead of part of the poster group.

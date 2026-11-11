# Canvas: an image tier change swaps textures, not frames

Crossing the 0.75 zoom asset tier rebuilt every imaged frame (layout, text, encoding) only to
point its images at the other size; on the user's canvas five frames landed one by one up to
1.75 s after a zoom. The built list is now kept per frame with its tier; at the same revision, a
tier change rewrites the image sources of that list (`retiered`) and keeps their clips, so the
core keeps its geometry and only the pictures are uploaded again at the new size. Custom (DOM-read)
frames and lists whose images do not match the tier URLs still rebuild.

Checked on the landings fixture: the frames that opened at 1024 and settled at 256 were swapped
without a rebuild and drew normally.

# Poster cards are budgeted by their picture, not by the page they cover

On a canvas where all 36 frames had a fresh poster, only ~13 posters were drawn before the vectors
of their frames: the rest stayed blank. `resident()` keeps layers on the GPU within a texture budget,
and a poster card's bytes came from `pictureBytes(list.items)`, which multiplies the **drawn** size of
each image item. A poster is drawn over the whole page (1280 × ~10 000 world units), so each card
asked for ~51 MB, 1.8 GB for 36: only the dozen nearest the centre fitted.

Cards now pass the decoded picture's size (`pictures(i)?.size`) to `pictureBytes`; a ~480×4096
poster is ~7.9 MB. Frame vector lists keep the drawn size (their images are drawn near their own
size, and changing that is a separate measurement). On the 36/36-poster copy of stress36, posters
drawn by the time the splash goes: 9–13 → 32–36 of 36.

A first hypothesis, that the vectors' entry replaced the card in the frame's chain by id, was
tested (5+5) and did not move the numbers; it was dropped.

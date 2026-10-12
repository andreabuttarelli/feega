# Grid words and media template

New built-in `builtin:grid-words-media`, from a reference: off-white paper with a thin square
grid; a sentence appears word by word in a serif on white chips snapped to grid cells, with
small pictures snapped to cells between each pair of words.

- Placement: seeded best-candidate scatter on the grid (1-cell margin, 1-cell gap when room,
  pictures shrink before being dropped). `seed` rearranges it.
- Chips wipe open left to right (in-out expo), words land with the shared `wordIn`; pictures
  open from their centre and drift slowly so holds never freeze.
- Grid cell = short side / `cells`, so 16:9, 9:16 and 1:1 all work. Loops on the empty grid.

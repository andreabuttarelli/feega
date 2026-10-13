# Four more still posters, and a posters row on the home

**Templates**, one per reference, placeholder copy and generated placeholder photos only. Each
carries 2–3 marks of its own from the first render (the batch-2 rule):
- `builtin:poster-iso-blocks`: no logo, only a big header top left; true isometric blocks drawn from a `blocks` list (left top length
  depth height), line-up slanted on a face with a shear matrix and auto-fitted to it. Own:
  one top face in an accent with a numbered circle
  (`accentBlock`, `marker`), a vertical caption, the info rule moved to the left of its block.
- `builtin:poster-photo-grid`: a square grid (`columns`), a six-line letterspaced title fitted to
  the width, photo tiles cut from one picture per photo through SVG clip paths, `f` puts a tile
  over the title. Without photos a generated grey "facade" fills them. Own: an accent counter
  cell (`accentCells`, `counter`), an index line with rule, rows below the title spread out in
  taller formats so 9:16 does not leave an empty foot.
- `builtin:poster-white-shapes`: skewed white quadrilaterals from a `shapes` list (left top width
  height, tilt of top and foot edges), bilingual info blocks placed by `places`. Own: a taupe
  numbered circle, an index line, a vertical caption, the second-language title small top right.
- `builtin:poster-vertical-type`: a grid of thin rules, black and accent cells, photo cells with a
  dithered grain (`grain` drives an SVG threshold filter, photos and placeholders alike), words in
  pixel type running bottom-up. Own: all words read upward, one accent cell, a numbered tab in a
  black cell, a caption over the list.

**Kit.** `part(field, index)` tags drawn elements with `data-part` so the canvas can later make
them selectable; `upright` takes the field it tags. `numbersOf` parses a line of numbers.
`POSTER_PHOTOS` + `mediaProp` add a media list for posters with photo slots. A test checks every
non-style key field of the new posters is tagged.

**Home.** A `posters` row (`PosterShelf`) under the components row lists the still templates
(`posterShelf`: stills only, by name) with their jpg previews and the print formats (4:5, 9:16, A
poster). Use posts to the existing `?/fromTemplate` action; `starterDoc` already keeps the
template's still, so the editor opens on a still. The components row is unchanged.

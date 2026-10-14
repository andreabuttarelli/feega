# Seven more still posters

**Templates**, one per reference (12–18), placeholder copy and generated placeholder pictures
only. Each carries 2–3 editable marks of its own beyond the reference:
- `builtin:poster-curated-board`: a bold wordmark with outlined mono pill tags (SVG `rx` pills,
  the CSS radius rule stays 50%-only), ringed by thumbnails placed by `slots` with `number | name`
  captions. Own: corner lines top left/right (`issue`, `caption`), an accent numbered circle on
  the title (`marker`). Thumbnails cap their width so 9:16 does not blow them up.
- `builtin:poster-repeat-lineup`: the line-up on grey highlight boxes repeated every
  `repeatSize`, over a construction layer (acid blocks, grey bars, red/blue lines, dashed rings,
  ellipses) drawn from fixed tables and mirrored on odd repeats. Own: a black repeat number tag
  (`index`), the "live" note as a blue circle (`marker`), a rule over the info row, a vertical
  caption.
- `builtin:poster-festival-grid`: a 5-rule grid with `rows`, geometric title fitted to its cells,
  dots on the left rule, three long open arrows, photo cell, three programme columns, neutral
  partner marks (circle, square, triangle, ring). Own: an accent number cell (`counter`), labels
  by the dots (`dotLabel`), a vertical caption.
- `builtin:poster-wide-filmstrip`: thin wide title and huge dates fitted to the width; the strip
  sits centred in whatever space the columns and dates leave, so every format holds. Own:
  sprocket holes, frame numbers (`counter`), an index line with rule over the dates, a vertical
  caption.
- `builtin:poster-scattered-type`: text blocks placed by `places` (`90` turns one), photos by
  `slots`, tags by `tags`. Own: a tag line ending in `o` becomes an accent circle (`marker`),
  `fig. 01` numbers over photos (`index`), a ruled line under the dates (`caption`).
- `builtin:poster-sliced-photo`: one picture cut into strips by SVG clip paths (`shift from to`
  per strip) with white rules whose length follows each piece. Own: a numbered ring top centre
  (`marker`), numbers under each rule (`index`), a vertical caption.
- `builtin:poster-red-number`: photo turned duotone by a multiply layer in `tint`; the photo and
  the big number are placed as one group so they overlap in every format. Own: a red numbered
  circle on the photo corner (`marker`), an index line with rule under the title.

**Kit.** `POSTER_ART` adds `picture(photos, k, w, h, tones, look, salt)`: the user's photo, or a
generated still life (sphere, ring or stacked blocks on a floor) in the given tones — no people,
nothing from the references.

**Discarded:** reusing the sample photos of the component previews (they include animals and
landscapes tied to other templates); a CSS `9999px` radius for the pills (the shared poster test
allows only `50%`).

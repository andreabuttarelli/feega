# Hugged text widths use per-glyph advances

Auto-layout sized hugged text at a flat 0.5 em per character. Wide glyphs
("New" in bold Inter: 28.5 px real, 19.5 px guessed) overflowed into the
gap, so the canvas drew "NewMulti-entity" where the exported HTML (flex,
real metrics) showed "New Multi-entity". `textExtent` now sums a sans
advance table (measured on Inter) per character; unknown characters keep
the old average.

Investigated alongside, no code change:
- `export:native` notch on "rt" in "export" (DM Sans 600, tracking −0.05):
  fill rule is nonzero and every outer contour winds the same way; the
  ~1 px gap between the r terminal and the t crossbar is real geometry —
  Chrome renders the same seam at the same size and tracking.
- `export:native --text=glyphs` fails when a font URL contains `=`
  (Google `l/font?kit=…&v=v25`): the `--font url=file` flag splits on it.

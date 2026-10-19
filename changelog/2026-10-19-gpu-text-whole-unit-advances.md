# gpu-text shapes in whole font units again

#931 made HarfRust shape at 1/64 font unit to match fontkit's fractional advances. Native text
(gpu-core) shapes through the same `Face`, and its parity test against the TS fixture (fontkit)
went to 0.252 px on the Title cases, over the 0.25 px bound: at weight 600 the variable kerning of
the two shapers differs, and whole-unit rounding happened to stay inside the bound. Back to whole
units; `rustSource` still matches fontkit within half a unit per glyph.

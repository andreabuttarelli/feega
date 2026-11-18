# A font that cannot be decoded no longer blanks its frame

The Miro page on the stress canvas stayed blank: its uploaded Nanum Pen `.ttf` has `loca`
entries pointing outside `glyf`, so fontkit threw `RangeError: Offset is outside the bounds of the
DataView` the first time a glyph's metrics or outline were read. That happens during layout, long
after `fontLoader` had accepted the font (its `catch` only covers fetching and parsing the
header), so the error escaped `prepare` and `load` gave up on the whole frame.

`fontkitSource.covers` now also asks whether the glyph decodes (advance and outline). A glyph that
does not is not covered, so `faceBook` resolves it to the next family exactly as it does when a
font file is missing. Glyphs of the same font that decode keep using it. The first failure per
font is reported once (`[fonts] glyphs not decodable, drawn with the fallback <url>`).

Considered: validating every glyph when the font loads. Rejected: CJK fonts carry tens of
thousands of glyphs; the check runs per code point actually asked for, and `faceBook` caches it.

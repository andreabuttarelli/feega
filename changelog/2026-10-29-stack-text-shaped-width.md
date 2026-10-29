# Stack hugs text with the renderer's shaper

A Stack sized hugging text from `textExtent`, a per-character width table
(#1563). The GPU canvas then shaped the same text with the real font, so the
box and the glyphs disagreed by up to ~7% ("Get started" in DM Sans: 347px
box, 323px ink), and the text sat off-centre or overflowed the Stack.

`withAutoLayout` now takes a `TextMeasure` port (default: the estimate).
`prepare` passes `shapedText(typeset)`, which lays the text with the same
`planOf` + `layOut` the painter uses; text autosize does the same for free
stacks. Code export keeps the estimate: the browser shapes there.

Not fixed here: a "blocky" white-on-black glyph halo seen on the canvas in
headless Chromium. The display list for that frame is clean (one fill, one
glyph run); it appears on some loads only, so it is an engine raster issue,
not layout.

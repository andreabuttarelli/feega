# Custom components: text drawn by gpu-full

Text inside custom components was named as a gap and not drawn: the iso-blocks poster lost 7
text elements, the photo-grid poster 9.

- **The browser lays out, gpu-full draws.** The probe measures every visible character with a
  `Range` under the untransformed sheet and sends lines of characters with their x and the line's
  content-area top and height. `readTree` places each glyph at that x, on the baseline
  `top + height · ascent / (ascent + descent)`, from the same face book Title/Text use. No
  re-layout, so no line-break or kerning drift.
- **Fonts the page never loaded are rasterised in the probe.** A family named only in component
  CSS (`'Inter'`, `system-ui`) renders with a local font gpu-full has no bytes for. When no loaded
  `FontFace` matches the first family, the probe draws the characters at the same positions into
  a canvas and ships it as a layer.
- `text-transform` upper/lower case is applied per character; a glyph no face covers is the new
  gap `font`.
- The font loader flattens precomps first, as the HTML engine does: a custom poster inside a
  precomp lost its Archivo title.

Found, not fixed here: the HTML export draws Inter Tight 600 narrower and lighter than the live
player (≈12 px over an 80 px line). gpu-full matches the live player; that difference is most of
what is left on the iso-blocks poster.

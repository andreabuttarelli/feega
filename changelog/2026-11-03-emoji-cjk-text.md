# Emoji and CJK text no longer blank out on the GPU canvas

- **Symptom.** A text with an emoji or a Chinese/Japanese/Korean character rendered blank on the
  canvas; the console showed CORS errors from `fonts.gstatic.com/l/font?kit=…`.
- **Cause, loading.** The only fallback request asked the Noto Sans/Symbols families for every
  character past Latin. Google serves a `text=` subset only when the family has at least one of
  the glyphs: otherwise the file is a 400 without `Access-Control-Allow-Origin`, which the
  browser reports as CORS. None of those families has emoji or ideographs.
- **Cause, painting.** One character without a face made `paintText` return `TextGap.Glyph`, so
  the whole text was dropped.
- **Fix.** `FALLBACKS` in `text/fonts.ts` is the table of fallback groups by Unicode range: Noto
  Emoji (outline, not the colour font fontkit cannot draw), Noto Sans KR, Noto Sans SC, then the
  symbol families. `fallbackUrls` asks each group only for its own characters. A missing glyph is
  skipped; the gap is reported only when nothing in the text can be drawn.
- **Discarded.** A same-origin font proxy: the files were never blocked, only absent.

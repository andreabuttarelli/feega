# Canvas: symbol and CJK fallback fonts load once, with CORS

The text engine asked Google Fonts for its fallback families (Noto Sans and symbols, Emoji, SC,
KR) as a `&text=` subset of each frame's characters. Google serves those subsets from
`fonts.gstatic.com/l/font?kit=…`, which sends no CORS header: from the app every request failed,
the fallback glyphs were missing, and since each frame's text gave a different URL, every rebuild
asked again. The fallbacks are now requested by family; the stylesheet is the same for every frame
(fetched once per loader) and its faces come from `fonts.gstatic.com/s/…`, which allows CORS. Only
the unicode ranges a frame uses are downloaded, as before.

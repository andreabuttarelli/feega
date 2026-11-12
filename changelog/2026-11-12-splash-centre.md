# Canvas loading splash: centred in the canvas area, one size variable

The splash was `position: fixed; inset: 0`, so it centred on the whole window instead of the
canvas area, and its mark (48 px box, glyph 34.6 px) was a third of the wordmark's 108.8 px.

It is now `position: absolute` inside `.canvas`, and mark, wordmark and bar are sized in `em`
from one `font-size` (25 px): glyph, word and bar are all 2.72 em (68 px) wide. The mark's box
is 3.775 em because the glyph fills 72% of its viewBox; negative block margins hide the padding.
The wordmark box has a fixed width, so the font loading changes nothing. The static splash in
`src/app.html` uses the same values. It stays viewport-fixed: before hydration the layout is unknown.

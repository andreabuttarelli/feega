# Hosted embed loader

**Before:** the snippet was an iframe with a fixed `aspect-ratio`, an inline copy of `hostMain`
and, for scrub, a `<div data-scroll="N">` wrapper. Scroll logic lived in the customer's page and
froze at paste time; the iframe forced the video's ratio.

**Now:** `<script src="https://oh.feega.app/embed.js" async>` plus `<feega-motion src="id">`
(or `<div data-feega="id">`). `/embed.js` (5 min cache) serves `loaderMain` + `hostMain`; the
loader reads `/e/<id>.json` (width, height, playback, scrollLength parsed from the stored page),
mounts an iframe at 100%×100% of the element, builds the `data-scroll` sticky section itself for
scrub, and reuses `hostMain` for progress/visibility. No height from the host → video ratio, or
100vh for scrub.

The player sizes `hyperframes-player` to the cover box (`fitBox`, `?fit=contain` for contain),
so the engine's own contain fit lands exactly; overflow is cropped. The composition is fixed-size
HTML, so it scales by transform rather than re-rendering at container size. Autoplay respects
`prefers-reduced-motion`.

Old snippets keep working: `/e/<id>` still serves the page, their inline `hostMain` is unchanged,
and their aspect-matched iframe makes cover equal contain. Embeds published before this carry no
`scrollLength`; the JSON falls back to the default (3).

The downloaded HTML file keeps the iframe snippet (`fileSnippet`): it cannot call feega.

# Core canvas: list and doc cards are vectors, and no node is a snapshot

Every non-generate node was an html-to-image snapshot picture laid over a sketch once its tile had
been shot, so zoom re-keyed it and the card flashed. `cardItems` no longer takes a snapshot:
`CardTile.shot`, `CardPart.Shot`, `coreShots` and the core branch of `shootsTiles` are gone (the
classic canvas still shoots).

`faceOf` now carries `rows`, `pills`, `count`: a list draws its header (kind, count) and one row
per item that fits (index, thumbnail for image lists, text, status dot); a doc draws its header
(Read/Write, Public link) and its markdown as plain text. Social feed, products, influencer, ads
and the rest still draw the generic `source` face (title, subtitle, thumbnails); their dedicated
layouts are the next PRs.

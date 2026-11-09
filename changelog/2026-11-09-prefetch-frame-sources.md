# Warm every frame source in one batch on open

The batched sources route (#1859) was wired into `frameSources`, but
`CoreFrames` only asked for as many sources as it builds at once (6 on
desktop, 3 on phone). Each tick's batch held at most 6 ids, then 1 per
finished build: effectively one request per frame.

`ReadSource.warm(urls)` now asks for every unbuilt frame, in fill order
(on-screen first), and holds those results outside the 8-entry LRU until
they are read once. Builds stay capped; only the network fan-out changed.

Not done here: zoom-tiered image URLs, poster on save, a `load` bench case.

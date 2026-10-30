# Instant Layers tree

Before: the tree waited for `frame-outlines` per frame, and the outline cache died with the panel.

- Frames whose doc is already in memory (live docs, fetched pick docs) build their rows synchronously (`outlinesNow`).
- Never-loaded frames show their row at once; children appear when the idle prefetch lands, no spinner.
- Outline cache moved to `layersSource`: survives panel open/close, keyed per frame revision.
- Fetch runs at idle (`whenIdle`).
- Pages: current row gets the Layers selection colour and a dot.
- Studio leaves the rail (`offRail`); burger keeps it.

Discarded: server-side parts for local rows (posters still get parts from the idle fetch).

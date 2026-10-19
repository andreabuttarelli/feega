# Canvas page load: three server costs off the critical path

Timing each query of the canvas `load` on the 82-node copy showed ~1.8 s of server time
before the first byte:

- `canvasOutlines` read the full doc of all 58 motion frames (~1 s, 450 KB of HTML) to
  outline layers in a panel that is closed on load. `LayersPanel` already fetched missing
  outlines from `frame-outlines`; that is now the only path, and `canvasOutlines` is gone.
  Streaming the outlines as a promise was tried and dropped: the document ends later and
  Safari runs module scripts only after it ends (canvas mounted ~600 ms later).
- Templates, chat handoff, renderer switch and card previews need only the project, so
  they run alongside `listNodes` instead of after it. `loadDownloaded` stays after: it
  reads per node.
- `projectCatalogue` rebuilt the model catalogue from seven queries (~0.5 s) on every
  open, identical for every org. It is now reused for 60 s per server instance; the
  per-org uncensored filter still runs each time.

Production build, WebKit iPad Pro 11, before/after interleaved, median of 3 (ms):

| canvas | TTFB | revealed | interactive |
|---|---|---|---|
| heavy before | 2658 | 5260 | 5826 |
| heavy after | 1891 | 4543 | 5362 |
| light before | 1139 | 2285 | 2796 |
| light after | 668 | 1697 | 2211 |

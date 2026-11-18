# Local mode fetches pictures after the on-screen vectors

Once the first frames of a big canvas were built, each fetched all its pictures at once — from
`load()`'s staged show, from `seedLive`, and from tier swaps. In local mode that is hundreds of
requests on the six connections to the same Node process that parses frame sources: 689 picture
requests by 5 s on the 36-page stress canvas, and the sources of frames not built yet queued
behind them (a two-frame `/motion/sources` request took ~6 s).

`pictureTurns(limit)` (`src/lib/canvas/core/picture-turns.ts`) hands out picture turns: while an
on-screen frame shows nothing yet, `limit` frames at a time; once each on-screen frame shows
something, all of them. `load()`, `seedLive` (reusing the load's first fetch) and `swapTier` take a
turn. The limit is declared per mode beside the source asks, `picturesWhileVectorsOwed`: local 1,
hosted unbounded (pictures come from Supabase there, a different host). Posters and card faces
are not held.

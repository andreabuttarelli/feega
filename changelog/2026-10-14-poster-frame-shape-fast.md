# Poster frames keep their shape and show at once

**Before.** A still picked from the canvas add bar ("Frame templates") came out 16:9. The library
opened every item at the canvas' default format (16:9) and only offered 16:9 / 9:16 / 1:1;
`CatalogueItem.format` was `starterFormatOf(doc)`, which collapses 4:5 to 16:9. The client sent
16:9, the server composed a 1920x1080 doc and a node with no size (derived from `format`).
Production rows confirm it: canvas inserts of `Poster ...` saved 1920x1080 docs, dashboard ones
1080x1350.

The insert also showed nothing until the action returned: ~11 sequential Supabase round trips
(~1.1 s warm locally with `VERCEL=1`; in production edge logs ~2 s at ~370 ms per hop, plus cold
start). No still render, Chromium or storage probe runs in the action.

**Now.**
- `FORMATS_OF_MODE` (catalogue): stills offer 4:5 / 9:16 / A poster, videos 16:9 / 9:16 / 1:1;
  an item is listed in its own format; `libraryFormat` opens a still in its own format when the
  target asks for one stills lack. A changed format alone now reaches the insert.
- `startMotion({ picture })` sizes the node from the doc in the insert itself (`frameShape` →
  `frameNodeOf`); template insert, dashboard template, compose, gallery remix and move-out
  (`frameStore.create`, one round trip less) all pass their doc. Without a doc the size stays
  derived from `format`, so a later save can't freeze a wrong size.
- `startMotion` no longer lists canvas nodes when the position is given.
- The canvas shows a placeholder frame of the final size at once (`pending-frame.ts`), replaced
  by the saved node.
- `frame_template` answers with `Server-Timing` (scope, start, read).

**Discarded.** Rendering the poster server-side never happened here, so nothing to move async.

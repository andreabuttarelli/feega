# 0034 — Contours travel as packed floats, not JSON

## Context

gpu-core reads every display list with `serde_json` on the main thread
(`put_group`/`append_group`/`draw`). Measured on the three largest frames
of the landings fixture (real imported pages), contour coordinates are
96–99 % of the bytes: full-precision doubles, ~18 characters each.

Native, release, Apple M2 Pro, median of 30 (min–max):

| frame | list JSON | contours | `parse` today | `parse_packed` | skeleton JSON + floats |
|---|---|---|---|---|---|
| landing0 | 2.95 MB | 165 k numbers | 8.30 ms (8.11–8.79) | 1.54 ms (1.47–1.96) | 0.16 MB + 1.32 MB |
| landing1 | 18.4 MB | 996 k numbers | 60.6 ms (58.2–73.1) | 7.50 ms (7.23–9.23) | 0.84 MB + 7.97 MB |
| landing2 | 5.48 MB | 303 k numbers | 17.1 ms (16.1–68.7) | 2.91 ms (2.73–3.75) | 0.29 MB + 2.42 MB |

Discarded:

- **Rounding coordinates to 3 decimals**: bytes −58 %, parse only −15 %
  (7.1 / 51.6 / 13.5 ms): the cost is the count of numbers, not digits.
- **Removing `flatten` / internally tagged enums**: the skeleton without
  contours (all tags and `flatten`s kept) parses in 1.0 / 2.1 / 1.6 ms, so
  they are not where the time goes.
- **A full binary format (FlatBuffers, bincode)**: the gain past packed
  contours is the 1–2 ms skeleton, at the price of a schema both sides
  must version. Not worth it now.

JS side: packing while stringifying costs the same as stringifying
(5.1 / 30.5 / 8.7 ms vs 6.1 / 30.7 / 9.7 ms, Node 25).

## Decision

A contour in the JSON is either the inline array of numbers (unchanged)
or an integer index into a side `Float64Array` plus `Uint32Array` of
contour ends. `parse_packed(json, floats, ends)` reads both; `parse` is
unchanged and errors on an index. The `DisplayList` type does not change,
so render code is untouched.

## Wiring

The frame-build worker packs each item (`itemPack`: JSON with item-local
contour indices, `Float64Array` floats, `Uint32Array` ends) and transfers
the buffers. The main thread joins the item packs (`listPack`) and calls
`put_group_packed`/`append_group_packed`; gpu-core offsets each top-level
item's indices by the contours of the items before it. `draw` and
`patch_group` stay on the string wire.

## Measured in the browser

`BENCH_CASE=load`, landings fixture, 4 on-screen frames, base = `dev`,
interleaved, 5 runs each, time to all frames with content, median
(min–max):

| CPU | cache | base | packed |
|---|---|---|---|
| 1x | cold | 7403 ms (6032–11515) | 6972 ms (5076–7322) |
| 1x | warm | 5294 ms (5194–5807) | 4789 ms (4201–5591) |
| 4x | cold | 17849 ms (17029–26610) | 15678 ms (14631–16999) |
| 4x | warm | 16305 ms (15958–21430) | 13917 ms (13258–15575) |

Two 1x packed runs reached "sharp" late (24 s, 52 s) while content time
was normal; not reproduced at 4x. Watch it.

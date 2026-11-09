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

## Next

1. wasm entry points taking `(json, Float64Array, Uint32Array)` beside
   `put_group`/`append_group`/`patch_group`/`draw` (boundary change:
   agreed with the gpu-core owner first).
2. The frame-build worker packs and transfers the buffers; the cache by
   revision keeps the packed form.
3. Measure in wasm on the load benchmark; native numbers above are a
   ratio, not the browser cost.
